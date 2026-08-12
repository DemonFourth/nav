/**
 * GET /api/bookmarks/search
 * Agent 查询接口，支持关键词搜索、分类筛选、标签筛选。
 *
 * Query 参数：
 *   q          - 搜索关键词（搜索 name/url/description/tags/notes）
 *   category_id - 按分类 ID 筛选（支持逗号分隔多个）
 *   tag        - 按标签筛选（逗号分隔，任一匹配）
 *   fields     - 返回字段（逗号分隔，默认全部）
 *                可选: name,url,description,category_name,tags,notes
 *   limit      - 最大结果数（默认 20，最大 100）
 *   offset     - 偏移量（默认 0）
 *
 * 示例：
 *   GET /api/bookmarks/search?q=gpt
 *   GET /api/bookmarks/search?category_id=153
 *   GET /api/bookmarks/search?tag=Cloudflare&fields=name,url,description
 *   GET /api/bookmarks/search?q=&category_id=174
 */
export async function onRequestGet(context) {
  const { env, request } = context

  try {
    const url = new URL(request.url)
    const q = url.searchParams.get('q') || ''
    const categoryIdParam = url.searchParams.get('category_id') || ''
    const tagParam = url.searchParams.get('tag') || ''
    const fieldsParam = url.searchParams.get('fields') || ''
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)

    // 用户字段名 -> SQL 列
    const FIELD_MAP = {
      name: 'b.name',
      url: 'b.url',
      description: 'b.description',
      category_name: 'c.name',
      tags: 'b.tags',
      notes: 'b.notes'
    }

    const defaultSQL = 'b.id,b.name,b.url,b.description,c.name as category_name,b.tags,b.notes'
    const returnFields = fieldsParam
      ? fieldsParam.split(',').map(f => f.trim()).filter(f => FIELD_MAP[f]).map(f => FIELD_MAP[f]).join(',') || defaultSQL
      : defaultSQL

    // 认证检查
    const authHeader = request.headers.get('Authorization')
    const isAuthenticated = authHeader && authHeader.startsWith('Bearer ')

    const publicModeSetting = await env.DB.prepare(
      'SELECT value FROM settings WHERE key = ?'
    ).bind('publicMode').first()
    const publicMode = publicModeSetting?.value !== 'false'

    let conditions = []
    const bindings = []

    // 权限过滤：未登录只看公开书签
    if (!publicMode || !isAuthenticated) {
      conditions.push('b.is_private = 0')
    }

    // 关键词搜索
    if (q) {
      const p = `%${q}%`
      conditions.push(`(b.name LIKE ? OR b.url LIKE ? OR (b.description IS NOT NULL AND b.description LIKE ?) OR (b.tags IS NOT NULL AND b.tags LIKE ?) OR (b.notes IS NOT NULL AND b.notes LIKE ?))`)
      bindings.push(p, p, p, p, p)
    }

    // 分类筛选
    if (categoryIdParam) {
      const ids = categoryIdParam.split(',').map(id => parseInt(id.trim(), 10)).filter(n => Number.isInteger(n))
      if (ids.length > 0) {
        conditions.push(`b.category_id IN (${ids.map(() => '?').join(',')})`)
        bindings.push(...ids)
      }
    }

    // 标签筛选
    if (tagParam) {
      const tags = tagParam.split(',').map(t => t.trim()).filter(Boolean)
      if (tags.length > 0) {
        conditions.push(`(${tags.map(() => 'b.tags LIKE ?').join(' OR ')})`)
        bindings.push(...tags.map(t => `%${t}%`))
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // 统计总数
    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM bookmarks b ${where}`
    ).bind(...bindings).first()
    const total = countResult?.total || 0

    // 查询数据
    const { results } = await env.DB.prepare(
      `SELECT ${returnFields} FROM bookmarks b LEFT JOIN categories c ON b.category_id = c.id ${where} ORDER BY b.category_id, b.position LIMIT ? OFFSET ?`
    ).bind(...bindings, limit, offset).all()

    return new Response(JSON.stringify({
      data: results,
      total,
      limit,
      offset
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[search] error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Search failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}