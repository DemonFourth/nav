import { callOpenAI, getAIConfig, extractJson } from './_shared.js'

/**
 * 关键词兜底（batch 版）
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

  const nameLower = (name || '').toLowerCase()
  for (const [id, cat] of categoryMap) {
    if (cat.displayName.includes(nameLower)) return { categoryId: id, reason: `名称包含分类关键词："${cat.name}"` }
  }
  for (const [id, cat] of categoryMap) {
    if (cat.fullPath.includes(nameLower)) return { categoryId: id, reason: `路径包含名称关键词："${cat.name}"` }
  }
  for (const [id, cat] of categoryMap) {
    if (nameLower.includes(cat.displayName)) return { categoryId: id, reason: `名称包含分类名："${cat.name}"` }
  }

  try {
    const domain = new URL(url).hostname.replace(/^www\./, '')
    const domainBase = domain.split('.')[0]
    for (const [id, cat] of categoryMap) {
      if (domainBase.includes(cat.displayName) || cat.displayName.includes(domainBase)) {
        return { categoryId: id, reason: `URL 域名匹配分类："${cat.name}"` }
      }
    }
  } catch (_) {}

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

    const categoryList = categories
      .map(cat => `${cat.id}. ${(cat.path || cat.name)}`)
      .join('\n')

    const systemPrompt = `You are an expert bookmark organizer. Classify each bookmark into the most appropriate category.

For each bookmark:
1. Analyze NAME, URL domain, DESCRIPTION, TAGS and NOTES
2. Choose the MOST SPECIFIC subcategory when available
3. Only output a NUMBER that exists in the category list
4. Even if no perfect match, pick the closest reasonable one

Output ONLY valid JSON: {"categoryId": NUMBER, "reason": "简短中文原因"}`

    const results = []
    let successCount = 0
    let failedCount = 0

    for (const bookmark of bookmarks) {
      try {
        // 先尝试关键词兜底
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

        // 构建书签信息
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
                content: `Bookmark to classify:

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

        if (message && !message.trim().startsWith('{') && /安全|safe|审核|filter|blocked|policy/i.test(message)) {
          results.push({
            id: bookmark.id,
            success: false,
            error: 'AI 返回了安全检查消息'
          })
          failedCount++
          continue
        }

        const parsed = extractJson(message, validCategoryIds)

        if (!parsed || typeof parsed.categoryId === 'undefined') {
          const rawPreview = message ?? '(空)'
          results.push({
            id: bookmark.id,
            success: false,
            error: `AI 无法确定分类`
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
          error: error.message || '分类失败'
        })
        failedCount++
      }

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