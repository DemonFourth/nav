import { callOpenAI, getAIConfig, extractJson } from './_shared.js'

/**
 * 关键词兜底：当 AI 无法返回有效结果时，用本地关键词匹配给出推荐。
 * 匹配优先级：tags 精确匹配 > name 匹配 > URL 域名匹配 > description 匹配
 */
function keywordFallback({ name, url, description, tags, notes, categories }) {
  if (!categories || categories.length === 0) return null

  const categoryMap = new Map()
  for (const cat of categories) {
    const id = Number.parseInt(cat.id, 10)
    if (!Number.isInteger(id)) continue
    const displayName = (cat.name || '').toLowerCase()
    const fullPath = (cat.path || '').toLowerCase()
    categoryMap.set(id, { id, displayName, fullPath, name: cat.name, path: cat.path })
  }

  // 1. tags 精确匹配（权重最高）
  if (tags) {
    const tagList = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    for (const [id, cat] of categoryMap) {
      for (const tag of tagList) {
        if (cat.displayName.includes(tag) || cat.fullPath.includes(tag)) {
          return { categoryId: id, reason: `tags 匹配："${tag}"` }
        }
      }
    }
  }

  // 2. 书签名称匹配
  const nameLower = (name || '').toLowerCase()
  for (const [id, cat] of categoryMap) {
    if (cat.displayName.includes(nameLower)) {
      return { categoryId: id, reason: `名称包含分类关键词："${cat.name}"` }
    }
  }
  for (const [id, cat] of categoryMap) {
    if (cat.fullPath.includes(nameLower)) {
      return { categoryId: id, reason: `路径包含名称关键词："${cat.name}"` }
    }
  }

  // 3. 分类名称出现在书签名称中
  for (const [id, cat] of categoryMap) {
    if (nameLower.includes(cat.displayName)) {
      return { categoryId: id, reason: `名称包含分类名："${cat.name}"` }
    }
  }

  // 4. URL 域名匹配
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '')
    const domainBase = domain.split('.')[0]
    for (const [id, cat] of categoryMap) {
      if (domainBase.includes(cat.displayName) || cat.displayName.includes(domainBase)) {
        return { categoryId: id, reason: `URL 域名匹配分类："${cat.name}"` }
      }
    }
  } catch (_) {}

  // 5. description / notes 匹配
  const textFields = [description, notes].filter(Boolean)
  for (const text of textFields) {
    const textLower = text.toLowerCase()
    for (const [id, cat] of categoryMap) {
      if (textLower.includes(cat.displayName)) {
        return { categoryId: id, reason: `描述中匹配分类："${cat.name}"` }
      }
    }
  }

  return null
}

export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const { name, url, description = '', tags = '', notes = '', categories } = await request.json()

    if (!name || !url || !Array.isArray(categories) || categories.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing bookmark information or categories'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 构建合法的 categoryId 集合
    const validCategoryIds = new Set(
      categories.map(cat => Number.parseInt(cat.id, 10)).filter(n => Number.isInteger(n))
    )

    // 第一步：关键词兜底（免费、即时，命中就直接返回）
    const fallback = keywordFallback({ name, url, description, tags, notes, categories })
    if (fallback) {
      return new Response(JSON.stringify({
        success: true,
        categoryId: fallback.categoryId,
        reason: fallback.reason,
        fallback: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 第二步：AI 推荐
    const config = await getAIConfig(env)

    // 构建分类列表：每行一个，包含 ID、完整路径、分类名
    const categoryList = categories
      .map(cat => `${cat.id}. ${(cat.path || cat.name)}`)
      .join('\n')

    // 构建书签信息
    const bookmarkInfo = [
      `Name: ${name}`,
      `URL: ${url}`,
      description ? `Description: ${description}` : null,
      tags ? `Tags: ${tags}` : null,
      notes ? `Notes: ${notes}` : null
    ].filter(Boolean).join('\n')

    const response = await callOpenAI(env, {
      path: 'chat/completions',
      method: 'POST',
      body: {
        model: config.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert bookmark organizer. Your task is to classify a bookmark into the most appropriate category.

Analyze the bookmark carefully:
1. Look at the NAME - what does this website/tool do?
2. Look at the URL - the domain often reveals the service type
3. Look at the DESCRIPTION - key details about functionality
4. Look at TAGS and NOTES - these strongly indicate the intended category

CATEGORY SELECTION RULES:
- Choose the MOST SPECIFIC subcategory when available, not a broad parent
- If the bookmark matches both a parent and child category, prefer the child
- Only output a NUMBER that exists in the category list
- Even if no perfect match exists, pick the closest reasonable one

OUTPUT FORMAT - return ONLY valid JSON, no markdown, no explanation:
{"categoryId": NUMBER, "reason": "简短中文原因"}

The reason should explain WHY this category fits, in 1-2 sentences in Chinese.`
          },
          {
            role: 'user',
            content: `Here is the bookmark to classify:

${bookmarkInfo}

Available categories (format: ID. FullPath):
${categoryList}

{"categoryId":`
          }
        ],
        temperature: 0.1,
        max_tokens: 1024,
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

    const parsed = extractJson(message, validCategoryIds)

    if (!parsed || typeof parsed.categoryId === 'undefined') {
      const rawPreview = message ?? '(空)'
      const reason = choice?.finish_reason ?? '(未知)'
      console.error('[AI cat] extract failed:', `finish_reason=${reason}, raw=${JSON.stringify(rawPreview)}`)
      return new Response(JSON.stringify({
        success: false,
        error: `AI 无法确定分类。finish_reason=${reason}`
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const categoryId = Number.parseInt(parsed.categoryId, 10)
    if (!Number.isInteger(categoryId) || !validCategoryIds.has(categoryId)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'AI 返回的分类 ID 不在可选列表中'
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