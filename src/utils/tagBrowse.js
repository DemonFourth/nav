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
 * 归一化标签集合：string / string[] / null → string[]
 * 去空白、去空项、按小写去重、保留首次出现的写法，并保留传入顺序
 * @param {string|string[]|null|undefined} input
 * @returns {string[]}
 */
export function normalizeTagList(input) {
  const list = Array.isArray(input) ? input : input == null ? [] : [input]
  const seen = new Set()
  const result = []
  for (const item of list) {
    const tag = String(item ?? '').trim()
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(tag)
  }
  return result
}

/**
 * 切换一个标签：已存在（忽略大小写）则移除，否则追加到末尾
 * 不修改入参数组
 * @param {string[]} selected
 * @param {string} name
 * @returns {string[]}
 */
export function toggleTagSelection(selected, name) {
  const tag = String(name ?? '').trim()
  const current = normalizeTagList(selected)
  if (!tag) return current
  const key = tag.toLowerCase()
  const index = current.findIndex(item => item.toLowerCase() === key)
  if (index === -1) return [...current, tag]
  return current.filter((_, i) => i !== index)
}

/**
 * 书签是否同时包含全部标签（AND）；标签列表为空时返回 true
 * @param {{tags?: string}} bookmark
 * @param {string|string[]|null} tags
 * @returns {boolean}
 */
export function matchesAllTags(bookmark, tags) {
  const wanted = normalizeTagList(tags)
  if (!wanted.length) return true
  const own = new Set(parseTags(bookmark?.tags).map(tag => tag.toLowerCase()))
  return wanted.every(tag => own.has(tag.toLowerCase()))
}

/**
 * 从当前选择中移除已经不存在于标签统计里的项，保留其余顺序
 * @param {string[]} selected
 * @param {Array<{name: string}>} stats
 * @returns {string[]}
 */
export function pruneMissingTags(selected, stats = []) {
  const valid = new Set(stats.map(tag => String(tag.name).toLowerCase()))
  return normalizeTagList(selected).filter(tag => valid.has(tag.toLowerCase()))
}

/**
 * 按标签筛选书签并按分类分组（菜单顺序，未分类最后）
 * 多标签为 AND：书签必须同时包含全部标签
 * @param {Array} bookmarks
 * @param {Array} categories
 * @param {string|string[]|null} activeTags
 * @returns {Array<{key: number|'none', categoryId: number|null, path: string[], leaf: string, parentText: string, bookmarks: Array}>}
 */
export function buildTagGroups(bookmarks = [], categories = [], activeTags = null) {
  const wanted = normalizeTagList(activeTags)
  if (!wanted.length) return []
  const matched = bookmarks.filter(bookmark => matchesAllTags(bookmark, wanted))

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
