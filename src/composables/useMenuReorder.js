import { computed, reactive } from 'vue'

const DROP_BEFORE = 'before'
const DROP_AFTER = 'after'

/**
 * 根据指针位置计算插入方向
 * @param {DragEvent} event
 * @param {HTMLElement} element
 * @param {'horizontal'|'vertical'} orientation
 */
export function resolveDropPosition(event, element, orientation) {
  if (!element) return DROP_AFTER
  const rect = element.getBoundingClientRect()
  if (orientation === 'horizontal') {
    return event.clientX < rect.left + rect.width / 2 ? DROP_BEFORE : DROP_AFTER
  }
  return event.clientY < rect.top + rect.height / 2 ? DROP_BEFORE : DROP_AFTER
}

/**
 * 导航菜单拖拽排序状态机
 * 所有层级共用：只允许同一父级下的同级排序，不同父级一律判为无效落点
 *
 * @param {Object} options
 * @param {Function} options.menus - 返回当前菜单树数组
 * @param {Function} [options.canReorder] - 是否允许拖动（登录态）
 * @param {Function} options.onReorder - 排序结果回调 ({ parentId, ids })
 * @param {Function} [options.onInvalidDrop] - 跨层级无效落点回调
 */
export function useMenuReorder({ menus, canReorder = () => true, onReorder, onInvalidDrop }) {
  const state = reactive({
    draggingId: null,
    draggingParentId: null,
    targetId: null,
    targetParentId: null,
    targetName: '',
    dropPosition: null
  })

  let lastDragEndAt = 0

  const isActive = computed(() => state.draggingId !== null)

  const isInvalid = computed(() => (
    state.targetId !== null && state.draggingParentId !== state.targetParentId
  ))

  const hintText = computed(() => {
    if (!isActive.value) return ''
    if (state.targetId === null) return '拖到同级菜单上调整顺序'
    if (isInvalid.value) return '只能在同一层级内排序 · 跨层级请到 设置 → 菜单 修改父分类'
    return `松开后移动到「${state.targetName}」${state.dropPosition === DROP_BEFORE ? '上方' : '下方'}`
  })

  const getMenus = () => {
    const value = typeof menus === 'function' ? menus() : menus?.value
    return Array.isArray(value) ? value : []
  }

  function findWithParent(id, nodes = getMenus(), parentId = null) {
    for (const node of nodes) {
      if (node.id === id) return { item: node, parentId, siblings: nodes }
      if (node.children?.length) {
        const found = findWithParent(id, node.children, node.id)
        if (found) return found
      }
    }
    return null
  }

  function clearTarget() {
    state.targetId = null
    state.targetParentId = null
    state.targetName = ''
    state.dropPosition = null
  }

  function beginDrag(event, item, parentId = null) {
    if (!item || !canReorder()) return false
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      try {
        event.dataTransfer.setData('text/plain', String(item.id))
        const trigger = event.currentTarget?.closest?.('button')
        if (trigger) {
          event.dataTransfer.setDragImage(trigger, 16, Math.min(trigger.offsetHeight - 1, 24))
        }
      } catch {
        // setDragImage 在部分环境不支持，忽略即可
      }
    }
    state.draggingId = item.id
    state.draggingParentId = parentId
    clearTarget()
    return true
  }

  function hoverItem(item, parentId, position) {
    if (!isActive.value || !item) return
    if (item.id === state.draggingId) {
      clearTarget()
      return
    }
    state.targetId = item.id
    state.targetParentId = parentId
    state.targetName = item.name
    state.dropPosition = position
  }

  function endDrag() {
    state.draggingId = null
    state.draggingParentId = null
    clearTarget()
    lastDragEndAt = Date.now()
  }

  function wasJustDragging(threshold = 300) {
    return Date.now() - lastDragEndAt < threshold
  }

  function rowState(id) {
    const isTarget = state.targetId === id
    const sameLevel = isTarget && state.draggingParentId === state.targetParentId
    return {
      dragging: state.draggingId === id,
      before: sameLevel && state.dropPosition === DROP_BEFORE,
      after: sameLevel && state.dropPosition === DROP_AFTER,
      forbidden: isTarget && !sameLevel
    }
  }

  function dropItem(item, parentId, position) {
    if (!isActive.value || !item) return null
    if (item.id === state.draggingId) {
      endDrag()
      return null
    }
    if (parentId !== state.draggingParentId) {
      onInvalidDrop?.()
      endDrag()
      return 'invalid'
    }

    const draggedId = state.draggingId
    const group = findWithParent(draggedId)
    if (!group || (position !== DROP_BEFORE && position !== DROP_AFTER)) {
      endDrag()
      return null
    }

    const originalIds = group.siblings.map(node => node.id)
    const ids = originalIds.filter(id => id !== draggedId)
    const targetIndex = ids.indexOf(item.id)
    if (targetIndex === -1) {
      endDrag()
      return null
    }

    ids.splice(position === DROP_AFTER ? targetIndex + 1 : targetIndex, 0, draggedId)
    const changed = ids.some((id, index) => id !== originalIds[index])
    endDrag()
    if (!changed) return null

    onReorder?.({ parentId, ids })
    return 'reordered'
  }

  return {
    state,
    isActive,
    isInvalid,
    hintText,
    beginDrag,
    hoverItem,
    clearTarget,
    endDrag,
    wasJustDragging,
    rowState,
    dropItem
  }
}
