import { buildCategoryTree, getCategoryPath } from './categoryTree.js'

/**
 * 把逗号分隔的标签字符串解析成数组：去空白、去空项、去完全重复，保留原始大小写
 * @param {string|null|undefined} raw
 * @returns {string[]}
 */
export function parseTags(raw) {
  if (!raw) return []
  const seen = new Set()
  const tags = []
  for (const part of String(raw).split(',')) {
    const tag = part.trim()
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
  }
  return tags
}

/**
 * 统计全站标签：按小写合并，name 取首次出现的写法
 * @param {Array<{tags?: string}>} bookmarks
 * @returns {Array<{name: string, count: number}>} count 降序，同数按名称升序
 */
export function buildTagStats(bookmarks = []) {
  const map = new Map()
  for (const bookmark of bookmarks) {
    for (const tag of parseTags(bookmark.tags)) {
      const key = tag.toLowerCase()
      const hit = map.get(key)
      if (hit) hit.count++
      else map.set(key, { name: tag, count: 1 })
    }
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh')
  )
}

/**
 * 至少带一个标签的书签数量
 * @param {Array<{tags?: string}>} bookmarks
 * @returns {number}
 */
export function countBookmarksWithTags(bookmarks = []) {
  return bookmarks.filter(bookmark => parseTags(bookmark.tags).length > 0).length
}

/**
 * 按标签筛选书签并按分类分组（菜单顺序，未分类最后）
 * @param {Array} bookmarks
 * @param {Array} categories
 * @param {string|null} activeTag
 * @returns {Array<{key: number|'none', categoryId: number|null, path: string[], leaf: string, parentText: string, bookmarks: Array}>}
 */
export function buildTagGroups(bookmarks = [], categories = [], activeTag = null) {
  if (!activeTag) return []
  const norm = String(activeTag).toLowerCase()
  const matched = bookmarks.filter(bookmark =>
    parseTags(bookmark.tags).some(tag => tag.toLowerCase() === norm)
  )

  const { map, flatList } = buildCategoryTree(categories)
  const order = new Map(flatList.map((category, index) => [category.id, index]))
  const buckets = new Map()

  for (const bookmark of matched) {
    const key = bookmark.category_id != null && map[bookmark.category_id]
      ? bookmark.category_id
      : 'none'
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(bookmark)
  }

  return [...buckets.entries()]
    .map(([key, items]) => {
      const isUncategorized = key === 'none'
      const category = isUncategorized ? null : map[key]
      const path = category
        ? getCategoryPath(category.id, map).map(node => node.name)
        : []
      return {
        key,
        categoryId: isUncategorized ? null : category.id,
        path,
        leaf: isUncategorized ? '未分类' : category.name,
        parentText: path.slice(0, -1).join(' / '),
        bookmarks: [...items].sort(
          (a, b) =>
            (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
            String(a.name).localeCompare(String(b.name), 'zh')
        )
      }
    })
    .sort((a, b) => {
      if (a.categoryId === null) return 1
      if (b.categoryId === null) return -1
      return (order.get(a.categoryId) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.categoryId) ?? Number.MAX_SAFE_INTEGER)
    })
}

/**
 * 按关键词过滤并排序标签（不修改入参数组）
 * @param {Array<{name: string, count: number}>} tags
 * @param {string} query
 * @param {'count'|'name'} sortBy
 */
export function filterAndSortTags(tags = [], query = '', sortBy = 'count') {
  const keyword = String(query).trim().toLowerCase()
  const list = keyword
    ? tags.filter(tag => tag.name.toLowerCase().includes(keyword))
    : [...tags]
  return list.sort((a, b) =>
    sortBy === 'name'
      ? a.name.localeCompare(b.name, 'zh')
      : b.count - a.count || a.name.localeCompare(b.name, 'zh')
  )
}
