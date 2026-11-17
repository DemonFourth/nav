import { buildCategoryTree } from './categoryTree.js'

/**
 * 计算每个分类的书签数（含该分类所有后代分类的书签）
 * 导航栏菜单徽标与设置页菜单列表共用同一口径，禁止各写一份。
 *
 * @param {Array} categories - 扁平分类数组
 * @param {Array} bookmarks - 书签数组
 * @returns {Object} - 键为分类 id，值为该书签总数；没有书签的分类为 0
 */
export function buildCategoryBookmarkCounts(categories, bookmarks) {
  const directCounts = new Map()
  for (const bookmark of bookmarks || []) {
    if (bookmark?.category_id == null) continue
    const key = Number(bookmark.category_id)
    directCounts.set(key, (directCounts.get(key) || 0) + 1)
  }

  const { tree } = buildCategoryTree(categories || [])
  const counts = {}

  const walk = (nodes) => nodes.reduce((sum, node) => {
    const total = (directCounts.get(Number(node.id)) || 0) + walk(node.children || [])
    counts[node.id] = total
    return sum + total
  }, 0)

  walk(tree)
  return counts
}
