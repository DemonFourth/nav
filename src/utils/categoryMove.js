import { buildCategoryTree, getDescendantIds } from './categoryTree.js'

const MAX_DEPTH = 5

/**
 * 计算分类树的高度：叶子为 0，每深一层 +1
 * @param {Array} categories - 扁平分类数组
 * @param {Number} categoryId
 * @returns {Number} - 找不到该分类时返回 -1
 */
export function getSubtreeHeight(categories, categoryId) {
  const { map } = buildCategoryTree(categories || [])
  const node = map[categoryId]
  if (!node) return -1

  const height = (current) => {
    if (!current.children || current.children.length === 0) return 0
    return 1 + Math.max(...current.children.map(height))
  }
  return height(node)
}

/**
 * 判断分类能否移动到目标父分类下
 * 依次检查：自身 → 后代 → 目标是否存在 → 深度上限
 *
 * @param {Array} categories - 扁平分类数组
 * @param {Number} movingId - 要移动的分类 id
 * @param {Number|null} targetParentId - 目标父分类 id（null 表示根目录）
 * @returns {{ ok: boolean, reason: string }}
 */
export function canMoveToParent(categories, movingId, targetParentId) {
  const treeInfo = buildCategoryTree(categories || [])
  const { map, tree } = treeInfo

  if (!map[movingId]) {
    return { ok: false, reason: '分类不存在' }
  }

  if (targetParentId === movingId) {
    return { ok: false, reason: '不能移动到自身' }
  }

  if (targetParentId != null) {
    if (getDescendantIds(movingId, map).includes(targetParentId)) {
      return { ok: false, reason: '不能移动到自己的子分类' }
    }
    if (!map[targetParentId]) {
      return { ok: false, reason: '目标分类不存在' }
    }
  }

  const depths = buildDepthMap(tree)
  const targetDepth = targetParentId == null ? -1 : depths[targetParentId]
  const deepest = targetDepth + 1 + getSubtreeHeight(categories, movingId)

  if (deepest > MAX_DEPTH) {
    return { ok: false, reason: '超过最大嵌套深度（5层）' }
  }

  return { ok: true, reason: '' }
}

/**
 * 由树推导每个分类的层级，根分类为 0
 * @param {Array} tree
 * @returns {Object} - id → depth
 */
function buildDepthMap(tree) {
  const depths = {}
  const walk = (nodes, depth) => {
    for (const node of nodes) {
      depths[node.id] = depth
      walk(node.children || [], depth + 1)
    }
  }
  walk(tree, 0)
  return depths
}
