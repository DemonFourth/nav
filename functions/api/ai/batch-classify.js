import { callOpenAI, getAIConfig, extractJson } from './_shared.js'

function buildCategoryHierarchyText(categories) {
  const lines = []
  const roots = categories.filter(c => !c.path.includes(' / '))
  const children = categories.filter(c => c.path.includes(' / '))

  if (roots.length === 0) {
    for (const cat of categories) {
      lines.push(`${cat.id}. ${(cat.path || cat.name)}`)
    }
    return lines.join('\n')
  }

  for (const root of roots) {
    lines.push(`${root.id}. ${(root.path || root.name)}`)
    const rootChildren = children.filter(c => c.path.startsWith(root.name + ' / '))
    for (const child of rootChildren) {
      const depth = child.path.split(' / ').length - 1
      const indent = '  '.repeat(depth - 1)
      lines.push(`${indent}${child.id}. ${child.path}`)
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

EXAMPLE: If categories include "153. AI" and "198.   AI / 视频制作", and the bookmark is about AI image generation, choose 198 (sub-category), NOT 153 (root).

RULES:
1. Analyze NAME, URL domain, DESCRIPTION, TAGS, NOTES
2. Indented items are subcategories - prefer deeper matches
3. Only output a NUMBER that exists in the list

Output ONLY valid JSON: {"categoryId": NUMBER, "reason": "简短中文原因"}`

    const results = []
    let successCount = 0
    let failedCount = 0

    for (const bookmark of bookmarks) {
      try {
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