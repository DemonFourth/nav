import { buildCategoryTree } from './categoryTree.js'
import { canMoveToParent } from './categoryMove.js'

const MAX_DEPTH = 5

/**
 * 生成「父分类」选择列表，新建分类与移动到…共用。
 *
 * - excludeId 为空（新建）：只校验深度上限。目标分类 depth >= 5 时，
 *   在其下再建子级会超过 5 层，服务端会拒绝，因此提前置灰。
 * - excludeId 有值（移动）：复用 canMoveToParent，除深度外还要拦自身与自己的后代。
 *
 * @param {Array} categories - 扁平分类数组（含 parent_id / depth）
 * @param {{ excludeId?: Number|null, currentParentId?: Number|null }} options
 * @returns {Array<{ id, name, displayName, depth, disabled, reason, isCurrentParent }>}
 */
export function buildParentOptions(categories, { excludeId = null, currentParentId = undefined } = {}) {
  const { flatList } = buildCategoryTree(categories || [])

  return flatList.map((item) => {
    const depth = item.depth ?? 0
    let disabled = false
    let reason = ''

    if (excludeId == null) {
      if (depth >= MAX_DEPTH) {
        disabled = true
        reason = '已达最大层级（5 层）'
      }
    } else {
      const check = canMoveToParent(categories, excludeId, item.id)
      disabled = !check.ok
      reason = check.reason
    }

    return {
      id: item.id,
      name: item.name,
      displayName: item.displayName,
      depth,
      disabled,
      reason,
      isCurrentParent: currentParentId !== undefined && item.id === currentParentId
    }
  })
}
