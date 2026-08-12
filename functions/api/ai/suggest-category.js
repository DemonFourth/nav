import { callOpenAI, getAIConfig } from './_shared.js'

// 尝试从 AI 回复中提取 JSON 对象，支持 markdown 代码块、前后文字等多种格式
function extractJson(text, validCategoryIds = new Set()) {
  if (!text) return null
  const trimmed = text.trim()

  // 尝试 1：直接解析整段文本
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed.categoryId !== 'undefined') return parsed
  } catch (_) {}

  // 尝试 2：从代码块 ```json ... ``` 或 ``` ... ``` 中提取
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim())
      if (parsed && typeof parsed.categoryId !== 'undefined') return parsed
    } catch (_) {}
  }

  // 尝试 3：非贪婪匹配第一个合法 JSON 对象
  const jsonMatch = trimmed.match(/\{[\s\S]*?\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed && typeof parsed.categoryId !== 'undefined') return parsed
    } catch (_) {}
  }

  // 尝试 4：从左往右扫描，找到第一个 { 后逐个字符尝试解析
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '{') {
      for (let j = i + 1; j <= trimmed.length; j++) {
        const chunk = trimmed.slice(i, j)
        if (chunk.endsWith('}')) {
          try {
            const parsed = JSON.parse(chunk)
            if (parsed && typeof parsed.categoryId !== 'undefined') return parsed
          } catch (_) {}
        }
      }
    }
  }

  // 尝试 5：AI 可能直接输出自然语言，从中提取 categoryId 数字和 reason 文本
  const idMatch = trimmed.match(/(?:categoryId|分类\s*ID|推荐)\s*[：:]\s*(\d+)/)
  if (idMatch) {
    const reasonMatch = trimmed.replace(/.*(?:categoryId|分类\s*ID|推荐)\s*[：:]\s*\d+.*/i, '').trim()
    return { categoryId: Number.parseInt(idMatch[1], 10), reason: reasonMatch || '' }
  }

  // 尝试 6：finish_reason=length 时输出被截断，从所有数字中找匹配的 categoryId
  for (const num of trimmed.matchAll(/\b(\d+)\b/g)) {
    const n = Number.parseInt(num[1], 10)
    if (validCategoryIds.has(n)) {
      return { categoryId: n, reason: trimmed.trim() }
    }
  }

  return null
}

export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const { name, url, description = '', categories } = await request.json()

    if (!name || !url || !Array.isArray(categories) || categories.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing bookmark information or categories'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 构建合法的 categoryId 集合，用于后续校验
    const validCategoryIds = new Set(categories.map(cat => Number.parseInt(cat.id, 10)).filter(n => Number.isInteger(n)))
    const categoryList = categories
      .map(cat => `${cat.id}: ${cat.path || cat.name}`)
      .join('\n')

    const config = await getAIConfig(env)

    // 将 categoryList 压成一行，减少 token 消耗
    const categoryLine = categories.map(cat => `${cat.id}=${cat.path || cat.name}`).join(',')
    const validIds = Array.from(validCategoryIds).join(',')

    const response = await callOpenAI(env, {
      path: 'chat/completions',
      method: 'POST',
      body: {
        model: config.model,
        messages: [
          {
            role: 'system',
            content: 'Output ONLY valid JSON. No other text. Format: {"categoryId":NUMBER,"reason":"中文"}'
          },
          {
            role: 'user',
            content: `Bookmark: ${name} | ${url} | ${description || ''}\nCategories: ${categoryLine}\n{"categoryId":`
          }
        ],
        temperature: 0.1,
        max_tokens: 600,
        reasoning: { effort: 'none' }
      }
    })

    const data = await response.json()
    const choice = data.choices?.[0]
    const message = choice?.message?.content

    // 过滤掉安全审查等无意义回复
    if (message && !message.trim().startsWith('{') && /安全|safe|审核|filter|blocked|policy/i.test(message)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'AI 返回了安全检查消息，请检查内容后重试'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    console.log('[AI cat] finish_reason:', choice?.finish_reason, 'content_len:', message?.length, 'full:', JSON.stringify(data).slice(0, 800))
    const parsed = extractJson(message, validCategoryIds)

    if (!parsed || typeof parsed.categoryId === 'undefined') {
      const rawPreview = message ?? '(空)'
      const reason = choice?.finish_reason ?? '(未知)'
      const logDetails = `finish_reason=${reason}, content_len=${message?.length ?? 0}, raw=${JSON.stringify(rawPreview)}`
      console.error('[AI cat] extract failed:', logDetails)
      return new Response(JSON.stringify({
        success: false,
        error: `AI 无法确定分类。finish_reason=${reason}，AI 实际回复：${rawPreview}`
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const categoryId = Number.parseInt(parsed.categoryId, 10)
    if (!Number.isInteger(categoryId) || !validCategoryIds.has(categoryId)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'AI 返回的分类 ID 不在可选列表中，请重试'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      categoryId,
      reason: parsed.reason || ''
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('AI suggest category error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'AI 推荐分类失败'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
