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
    const { bookmarks, categories } = await request.json()

    if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing bookmarks array'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!Array.isArray(categories) || categories.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing categories array'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const config = await getAIConfig(env)

    // 构建合法的 categoryId 集合，用于后续校验
    const validCategoryIds = new Set(categories.map(cat => Number.parseInt(cat.id, 10)).filter(n => Number.isInteger(n)))
    const categoryList = categories
      .map(cat => `${cat.id}: ${cat.path || cat.name}`)
      .join('\n')

    const results = []
    let successCount = 0
    let failedCount = 0

    for (const bookmark of bookmarks) {
      try {
        const prompt = `You are a bookmark categorization assistant. Please select the single most appropriate category for the following bookmark from the list below.

Bookmark:
- Name: ${bookmark.name}
- URL: ${bookmark.url}
- Description: ${bookmark.description || 'N/A'}

Available categories (format: ID: path):
${categoryList}

Please return your recommendation in JSON format:
{"categoryId": <the chosen category ID as a number>, "reason": "<brief explanation in Chinese>"}

You may also explain your reasoning in natural language before or after the JSON.`

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
        const choice = data.choices?.[0]
        const message = choice?.message?.content
        console.log('[AI cat] finish_reason:', choice?.finish_reason, 'content:', JSON.stringify(message)?.slice(0, 300), 'full_data:', JSON.stringify(data)?.slice(0, 500))
        const parsed = extractJson(message)

        if (!parsed || typeof parsed.categoryId === 'undefined') {
          const rawPreview = message ?? '(空)'
          const reason = choice?.finish_reason ?? '(未知)'
          results.push({
            id: bookmark.id,
            success: false,
            error: `AI 无法确定分类。finish_reason=${reason}，AI 实际回复：${rawPreview}`
          })
          failedCount++
        } else {
          const categoryId = Number.parseInt(parsed.categoryId, 10)
          if (!Number.isInteger(categoryId) || !validCategoryIds.has(categoryId)) {
            results.push({
              id: bookmark.id,
              success: false,
              error: 'AI 返回的分类 ID 无效'
            })
            failedCount++
          } else {
            results.push({
              id: bookmark.id,
              success: true,
              categoryId,
              reason: parsed.reason || ''
            })
            successCount++
          }
        }
      } catch (error) {
        console.error(`Failed to classify bookmark ${bookmark.id}:`, error)
        results.push({
          id: bookmark.id,
          success: false,
          error: error.message || 'Failed to classify'
        })
        failedCount++
      }

      // 延迟以避免API速率限制
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    return new Response(JSON.stringify({
      success: true,
      results,
      successCount,
      failedCount
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('AI batch classify error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to batch classify'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
