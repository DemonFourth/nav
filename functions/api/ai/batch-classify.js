import { callOpenAI, getAIConfig, extractJson } from './_shared.js'

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

  catNodes.sort((a, b) => b.depth - a.depth)

  let bestMatch = null

  for (const node of catNodes) {
    let score = 0
    let reasonPart = ''

    if (tags) {
      const tagList = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      for (const tag of tagList) {
        if (node.name.includes(tag)) { score += 200; reasonPart = `tags 匹配："${tag}"`; break }
      }
    }

    const nameLower = (name || '').toLowerCase()
    if (node.name.includes(nameLower)) { score += 100; reasonPart = `名称匹配分类："${node.pathRaw}"` }
    if (node.path.includes(nameLower)) { score += 60; reasonPart = `路径匹配名称："${node.pathRaw}"` }
    if (nameLower.includes(node.name)) { score += 100; reasonPart = `名称包含分类："${node.pathRaw}"` }

    try {
      const domain = new URL(url).hostname.replace(/^www\./, '')
      const domainBase = domain.split('.')[0]
      if (domainBase.includes(node.name) || node.name.includes(domainBase)) {
        score += 80; reasonPart = `URL 域名匹配："${node.pathRaw}"`
      }
    } catch (_) {}

    const textFields = [description, notes].filter(Boolean)
    for (const text of textFields) {
      const textLower = text.toLowerCase()
      if (textLower.includes(node.name)) {
        score += 40; reasonPart = `描述匹配分类："${node.pathRaw}"`; break
      }
    }

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
    const validCategoryIds = new Set(
      categories.map(cat => Number.parseInt(cat.id, 10)).filter(n => Number.isInteger(n))
    )

    const categoryHierarchy = buildCategoryHierarchyText(categories)

    const systemPrompt = `You are an expert bookmark organizer. Classify each bookmark into the most appropriate category.

YOUR PRIORITY: Always choose the MOST SPECIFIC (deepest) subcategory.

EXAMPLE: If categories include "153. [根] AI" and "198. [子1] AI / 视频制作", and the bookmark is about AI image generation, choose 198 (子分类), NOT 153 (根分类).

RULES:
1. Analyze NAME, URL domain, DESCRIPTION, TAGS, NOTES
2. The [子N] markers show category depth - prefer deeper matches
3. Only output a NUMBER that exists in the list
4. If a root category has a more specific child match, choose the child

Output ONLY valid JSON: {"categoryId": NUMBER, "reason": "简短中文原因"}`

    const results = []
    let successCount = 0
    let failedCount = 0

    for (const bookmark of bookmarks) {
      try {
        const fallback = keywordFallback({
          name: bookmark.name,
          url: bookmark.url,
          description: bookmark.description || '',
          tags: bookmark.tags || '',
          notes: bookmark.notes || '',
          categories
        })
        if (fallback) {
          results.push({
            id: bookmark.id,
            success: true,
            categoryId: fallback.categoryId,
            reason: fallback.reason,
            fallback: true
          })
          successCount++
          continue
        }

        const bookmarkInfo = [
          `Name: ${bookmark.name}`,
          `URL: ${bookmark.url}`,
          bookmark.description ? `Description: ${bookmark.description}` : null,
          bookmark.tags ? `Tags: ${bookmark.tags}` : null,
          bookmark.notes ? `Notes: ${bookmark.notes}` : null
        ].filter(Boolean).join('\n')

        const response = await callOpenAI(env, {
          path: 'chat/completions',
          method: 'POST',
          body: {
            model: config.model,
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: `Bookmark:
${bookmarkInfo}

Categories:
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
          results.push({ id: bookmark.id, success: false, error: '安全检查' })
          failedCount++
          continue
        }

        const parsed = extractJson(message, validCategoryIds)

        if (!parsed || typeof parsed.categoryId === 'undefined') {
          results.push({ id: bookmark.id, success: false, error: 'AI 无法确定分类' })
          failedCount++
        } else {
          const categoryId = Number.parseInt(parsed.categoryId, 10)
          if (!Number.isInteger(categoryId) || !validCategoryIds.has(categoryId)) {
            results.push({ id: bookmark.id, success: false, error: '分类 ID 无效' })
            failedCount++
          } else {
            results.push({ id: bookmark.id, success: true, categoryId, reason: parsed.reason || '' })
            successCount++
          }
        }
      } catch (error) {
        console.error(`Failed to classify bookmark ${bookmark.id}:`, error)
        results.push({ id: bookmark.id, success: false, error: error.message || '分类失败' })
        failedCount++
      }

      await new Promise(resolve => setTimeout(resolve, 500))
    }

    return new Response(JSON.stringify({
      success: true,
      results,
      successCount,
      failedCount
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('AI batch classify error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to batch classify'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}