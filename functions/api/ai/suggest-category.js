import { callOpenAI, getAIConfig } from './_shared.js'

// 尝试从 AI 回复中提取 JSON 对象，支持 markdown 代码块、前后文字等多种格式
function extractJson(text) {
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

    const prompt = `You are a bookmark categorization assistant. Please select the single most appropriate category for the following bookmark from the list below.

Bookmark:
- Name: ${name}
- URL: ${url}
- Description: ${description || 'N/A'}

Available categories (format: ID: path):
${categoryList}

Please return your recommendation in JSON format:
{"categoryId": <the chosen category ID as a number>, "reason": "<brief explanation in Chinese>"}

You may also explain your reasoning in natural language before or after the JSON. The important thing is to pick a valid category ID from the list above.`

    const response = await callOpenAI(env, {
      path: 'chat/completions',
      method: 'POST',
      body: {
        model: config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful bookmark categorization assistant. Return your answer as JSON when possible, but natural language explanations are also fine.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 200
      }
    })

    const data = await response.json()
    const message = data.choices?.[0]?.message?.content
    console.log('[AI cat] raw:', message?.slice(0, 300))
    const parsed = extractJson(message)

    if (!parsed || typeof parsed.categoryId === 'undefined') {
      const rawPreview = message?.slice(0, 200).replace(/\n/g, ' ')
      return new Response(JSON.stringify({
        success: false,
        error: `AI 无法确定分类。AI 实际回复：${rawPreview}`
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
