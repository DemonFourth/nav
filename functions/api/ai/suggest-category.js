import { callOpenAI, getAIConfig, extractJson } from './_shared.js'

/**
 * 关键词兜底：当 AI 无法返回有效结果时，用本地关键词匹配给出推荐。
 * 核心策略：评分制 + 深度加权，优先返回最具体的子分类。
 */
function keywordFallback({ name, url, description, tags, notes, categories }) {
  if (!categories || categories.length === 0) return null

  const catNodes = []
  for (const cat of categories) {
    const id = Number.parseInt(cat.id, 10)
    if (!Number.isInteger(id)) continue
    const depth = (cat.path || cat.name).split(' / ').length - 1
    catNodes.push({
      id,
      depth,
      name: (cat.name || '').toLowerCase(),
      path: (cat.path || '').toLowerCase(),
      pathRaw: cat.path || cat.name || ''
    })
  }

  if (catNodes.length === 0) return null

  // 按深度降序排列，优先检查子分类
  catNodes.sort((a, b) => b.depth - a.depth)

  let bestMatch = null

  for (const node of catNodes) {
    let score = 0
    let reasonPart = ''

    // 1. tags 精确匹配（最高权重）
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      for (const tag of tagList) {
        if (node.name.includes(tag)) { score += 200; reasonPart = `tags 匹配："${tag}"`; break }
      }
    }

    // 2. 书签名称匹配
    const nameLower = (name || '').toLowerCase()
    if (node.name.includes(nameLower)) { score += 100; reasonPart = `名称匹配分类："${node.pathRaw}"` }
    if (node.path.includes(nameLower)) { score += 60; reasonPart = `路径匹配名称："${node.pathRaw}"` }
    if (nameLower.includes(node.name)) { score += 100; reasonPart = `名称包含分类："${node.pathRaw}"` }

    // 3. URL 域名匹配
    try {
      const domain = new URL(url).hostname.replace(/^www\./, '')
      const domainBase = domain.split('.')[0]
      if (domainBase.includes(node.name) || node.name.includes(domainBase)) {
        score += 80; reasonPart = `URL 域名匹配："${node.pathRaw}"`
      }
    } catch (_) {}

    // 4. description / notes 匹配
    const textFields = [description, notes].filter(Boolean)
    for (const text of textFields) {
      const textLower = text.toLowerCase()
      if (textLower.includes(node.name)) {
        score += 40; reasonPart = `描述匹配分类："${node.pathRaw}"`; break
      }
    }

    // 深度加权：越深的子分类加分越多，确保优先返回最具体的分类
    score += node.depth * 50

    if (score > 0 && (!bestMatch || score > bestMatch.score || (score === bestMatch.score && node.depth > bestMatch.depth))) {
      bestMatch = { categoryId: node.id, score, depth: node.depth, path: node.pathRaw, reason: reasonPart || `匹配："${node.pathRaw}"` }
    }
  }

  if (bestMatch) {
    return { categoryId: bestMatch.categoryId, reason: bestMatch.reason }
  }

  return null
}

/**
 * 将分类列表组织成层级结构，便于 AI 理解父子关系。
 */
function buildCategoryHierarchyText(categories) {
  const lines = []
  const roots = categories.filter(c => !c.path.includes(' / '))
  const children = categories.filter(c => c.path.includes(' / '))

  if (roots.length === 0) {
    for (const cat of categories) {
      lines.push(`${cat.id}. [根] ${(cat.path || cat.name)}`)
    }
    return lines.join('\n')
  }

  for (const root of roots) {
    lines.push(`${root.id}. [根] ${(root.path || root.name)}`)
    const rootChildren = children.filter(c => c.path.startsWith(root.name + ' / '))
    for (const child of rootChildren) {
      const depth = child.path.split(' / ').length - 1
      const indent = '  '.repeat(depth - 1)
      lines.push(`${indent}${child.id}. [子${depth - 1}] ${child.path}`)
    }
  }

  return lines.join('\n')
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

    const validCategoryIds = new Set(
      categories.map(cat => Number.parseInt(cat.id, 10)).filter(n => Number.isInteger(n))
    )

    // 第一步：关键词兜底（免费、即时）
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

    const categoryHierarchy = buildCategoryHierarchyText(categories)

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
            content: `You are an expert bookmark organizer. Classify a bookmark into the most appropriate category.

YOUR PRIORITY: Always choose the MOST SPECIFIC (deepest) subcategory.

EXAMPLE: If the bookmark is about "AI image generation" and categories include:
  - 153. [根] AI
  - 198. [子1] AI / 视频制作
  - 209. [子1] AI / Skills
Then choose 209 (Skills) because it's the most specific match, NOT 153 (AI).

RULES:
1. Analyze NAME, URL domain, DESCRIPTION, TAGS, NOTES
2. Look at the category hierarchy - the [子N] markers show depth
3. Choose the deepest matching subcategory, not the root
4. Only output a NUMBER that exists in the category list
5. If a root category has children that are more specific matches, choose the child

OUTPUT: {"categoryId": NUMBER, "reason": "简短中文原因"}`
          },
          {
            role: 'user',
            content: `Bookmark:
${bookmarkInfo}

Categories (hierarchy: [根] = root, [子N] = depth N):
${categoryHierarchy}

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

    if (message && !message.trim().startsWith('{') && /安全|safe|审核|filter|blocked|policy/i.test(message)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'AI 返回了安全检查消息'
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
      }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    const categoryId = Number.parseInt(parsed.categoryId, 10)
    if (!Number.isInteger(categoryId) || !validCategoryIds.has(categoryId)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'AI 返回的分类 ID 不在可选列表中'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      success: true,
      categoryId,
      reason: parsed.reason || ''
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('AI suggest category error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'AI 推荐分类失败'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}