import { callOpenAI, getAIConfig, extractJson } from './_shared.js'

/**
 * 将分类列表组织成层级结构，便于 AI 理解父子关系。
 */
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

    // AI 分类：全权交给 AI，传入全部分类树
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
  - 153. AI
  - 198.   AI / 视频制作
  - 209.   AI / Skills
Then choose 209 (Skills) because it's the most specific match, NOT 153 (AI).

RULES:
1. Analyze NAME, URL domain, DESCRIPTION, TAGS, NOTES
2. Look at the category hierarchy - indented items are subcategories
3. Choose the deepest matching subcategory, not the root
4. Only output a NUMBER that exists in the category list

OUTPUT: {"categoryId": NUMBER, "reason": "简短中文原因"}`
          },
          {
            role: 'user',
            content: `Bookmark:
${bookmarkInfo}

Categories (indented items are subcategories):
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