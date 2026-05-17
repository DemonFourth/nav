import { ref, computed, reactive } from 'vue'
import { useBookmarks } from './useBookmarks'
import { useToast } from './useToast'
import { buildCategoryTree, getCategoryPath, getDescendantIds } from '../utils/categoryTree'

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

export function useCategoryEditor() {
  const { categories, addCategory, updateCategory, deleteCategory, reorderItems } = useBookmarks()
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast()

  // Category tree (nested structure)
  const categoryTree = computed(() => {
    const result = buildCategoryTree(categories.value)
    return result.tree
  })

  // Flat list with depth info (for parent selection)
  const categoryFlatList = computed(() => {
    const result = buildCategoryTree(categories.value)
    return result.flatList
  })

  // Selection State
  const selectedCategoryId = ref(null)
  const selectedCategory = computed(() => {
    if (!selectedCategoryId.value) return null
    const result = buildCategoryTree(categories.value)
    return result.map[selectedCategoryId.value] || null
  })

  // Expanded category IDs
  const expandedCategoryIds = ref([])

  // Edit form state
  const editForm = reactive({
    name: '',
    parentId: null,
    position: 1,
    maxPosition: 1
  })

  // Pending system state
  const initialDataSnapshot = ref([])
  const pendingChanges = ref([])
  const formOriginal = reactive({ name: '', parentId: null, position: 1 })

  // Form reset
  function resetEditForm() {
    if (!selectedCategory.value) return
    editForm.name = selectedCategory.value.name
    editForm.parentId = selectedCategory.value.parent_id || null
    const parent = findParent(selectedCategoryId.value)
    const siblings = parent ? parent.children : categoryTree.value
    const idx = siblings.findIndex(s => s.id === selectedCategoryId.value)
    editForm.position = idx + 1
    editForm.maxPosition = siblings.length
  }

  // Utility: find category in tree
  function findItem(id, tree = null) {
    const nodes = tree || categoryTree.value
    for (const node of nodes) {
      if (node.id === id) return node
      if (node.children?.length) {
        const found = findItem(id, node.children)
        if (found) return found
      }
    }
    return null
  }

  // Utility: find parent of a category
  function findParentOf(id, tree = null) {
    const nodes = tree || categoryTree.value
    for (const node of nodes) {
      if (node.children?.length) {
        if (node.children.some(c => c.id === id)) return node
        const found = findParentOf(id, node.children)
        if (found) return found
      }
    }
    return null
  }

  // Utility: get full path string
  function getPath(id) {
    const { map } = buildCategoryTree(categories.value)
    const path = getCategoryPath(id, map)
    return path.map(c => c.name).join(' / ')
  }

  // Utility: get siblings
  function getSiblings(id) {
    const parent = findParent(id)
    return parent ? parent.children : categoryTree.value
  }

  // Utility: remove item from tree by id
  function removeItemById(id, tree = null) {
    const nodes = tree || categoryTree.value
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) {
        return nodes.splice(i, 1)[0]
      }
      if (nodes[i].children?.length) {
        const removed = removeItemById(id, nodes[i].children)
        if (removed) return removed
      }
    }
    return null
  }

  // Utility: check if childId is descendant of parentId
  function isDescendant(parentId, childId) {
    const parent = findItem(parentId)
    if (!parent || !parent.children) return false
    if (parent.children.some(c => c.id === childId)) return true
    return parent.children.some(c => isDescendant(c.id, childId))
  }

  // Utility: get item name
  function getItemName(id) {
    const item = findItem(id)
    return item ? item.name : ''
  }

  // Existing findParent (kept for compatibility)
  function findParent(childId) {
    const { map } = buildCategoryTree(categories.value)
    const cat = map[childId]
    if (!cat || !cat.parent_id) return null
    return map[cat.parent_id]
  }

  // Available parent categories for selection
  const availableParentCategories = computed(() => {
    if (!selectedCategoryId.value) return []
    const { flatList, map } = buildCategoryTree(categories.value)
    const excludeIds = [
      selectedCategoryId.value,
      ...getDescendantIds(selectedCategoryId.value, map)
    ]
    return flatList
      .filter(cat => !excludeIds.includes(cat.id))
      .map(cat => ({
        id: cat.id,
        displayName: cat.displayName,
        depth: cat.depth,
        parent_id: cat.parent_id
      }))
  })

  // Drag state
  const dragState = reactive({
    draggingId: null,
    dropTargetId: null,
    dropPosition: null
  })

  // Toggle category expansion
  function toggleExpand(categoryId) {
    const idx = expandedCategoryIds.value.indexOf(categoryId)
    if (idx > -1) {
      expandedCategoryIds.value.splice(idx, 1)
    } else {
      expandedCategoryIds.value.push(categoryId)
    }
  }

  // Capture initial snapshot
  function captureInitialSnapshot() {
    initialDataSnapshot.value = deepClone(categories.value)
  }

  // Record a pending change
  function recordChange(change) {
    pendingChanges.value.push(change)
  }

  // Select category for editing
  function selectCategory(category) {
    selectedCategoryId.value = category.id
    editForm.name = category.name
    editForm.parentId = category.parent_id || null
    const parent = findParent(category.id)
    const siblings = parent ? parent.children : categoryTree.value
    const idx = siblings.findIndex(s => s.id === category.id)
    editForm.position = idx + 1
    editForm.maxPosition = siblings.length

    // Only capture snapshot if not already captured (don't overwrite mid-edit)
    if (initialDataSnapshot.value.length === 0) {
      captureInitialSnapshot()
    }
    formOriginal.name = category.name
    formOriginal.parentId = category.parent_id || null
    formOriginal.position = idx + 1
  }

  // Position controls (read-only display now, kept for compatibility)
  function changePosition(delta) {
    editForm.position = Math.max(1, Math.min(editForm.maxPosition, editForm.position + delta))
  }

  // CRUD operations (now local-only with pending)
  async function createCategory(name, parentId = null, isPrivate = false) {
    const result = await addCategory(name, parentId, isPrivate)
    if (result.success) {
      toastSuccess('已创建新分类')
    } else {
      toastError(result.error || '创建失败')
    }
    return result
  }

  async function editCategory(id, name, parentId, isPrivate = undefined) {
    const result = await updateCategory(id, name, parentId, isPrivate)
    if (result.success) {
      toastSuccess('已保存更改')
    } else {
      toastError(result.error || '保存失败')
    }
    return result
  }

  async function removeCategory(id) {
    if (!confirm('确定要删除该分类吗？这将同时删除所有子分类和书签。')) return { success: false }
    const result = await deleteCategory(id)
    if (result.success) {
      selectedCategoryId.value = null
      toastSuccess('已删除分类')
    } else {
      toastError(result.error || '删除失败')
    }
    return result
  }

  // Apply changes from edit form (original, calls API)
  async function applyChanges() {
    if (!selectedCategoryId.value) return { success: false }
    return await editCategory(
      selectedCategoryId.value,
      editForm.name,
      editForm.parentId
    )
  }

  // Move child item (local only) - works on categories.value directly
  function moveChildItem(parentId, childId, direction) {
    const siblings = categories.value
      .filter(c => (c.parent_id ?? null) === (parentId ?? null))
      .sort((a, b) => a.position - b.position)
    const idx = siblings.findIndex(c => c.id === childId)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= siblings.length) return

    const oldPos = idx + 1

    // Reorder: splice out and insert at new position, then recalculate all positions
    const [moved] = siblings.splice(idx, 1)
    siblings.splice(newIdx, 0, moved)
    siblings.forEach((c, i) => { c.position = i + 1 })

    // Trigger Vue reactivity
    categories.value = [...categories.value]

    const item = moved
    recordChange({
      type: 'reorder',
      id: childId,
      name: item.name,
      parentId,
      oldPos,
      newPos: newIdx + 1
    })
    toastSuccess(`已移动 "${item.name}"`)
  }

  function getChildIndex(parent, child) {
    return parent.children?.findIndex(c => c.id === child.id) ?? -1
  }

  // Move root item position - works on categories.value directly
  function moveRootItem(id, direction) {
    const siblings = categories.value
      .filter(c => c.parent_id == null)
      .sort((a, b) => a.position - b.position)
    const idx = siblings.findIndex(c => c.id === id)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= siblings.length) return

    const oldPos = idx + 1

    // Reorder: splice out and insert at new position, then recalculate all positions
    const [moved] = siblings.splice(idx, 1)
    siblings.splice(newIdx, 0, moved)
    siblings.forEach((c, i) => { c.position = i + 1 })

    // Trigger Vue reactivity
    categories.value = [...categories.value]

    const item = moved
    recordChange({
      type: 'reorder',
      id,
      name: item.name,
      parentId: null,
      oldPos,
      newPos: newIdx + 1
    })
    toastSuccess(`已移动 "${item.name}"`)
  }

  // Drag handlers
  function onDragStart(event, category) {
    dragState.draggingId = category.id
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', category.id)
  }

  function onDragEnd() {
    dragState.draggingId = null
    dragState.dropTargetId = null
    dragState.dropPosition = null
  }

  function onDragOver(event, category) {
    event.preventDefault()
    if (dragState.draggingId === category.id) return
    // Prevent dropping into own descendants
    if (isDescendant(dragState.draggingId, category.id)) return

    const rect = event.currentTarget.getBoundingClientRect()
    const relativeY = (event.clientY - rect.top) / rect.height
    if (relativeY < 0.33) {
      dragState.dropTargetId = category.id
      dragState.dropPosition = 'before'
    } else if (relativeY < 0.66) {
      dragState.dropTargetId = category.id
      dragState.dropPosition = 'child'
    } else {
      dragState.dropTargetId = category.id
      dragState.dropPosition = 'after'
    }
  }

  function onDrop(event, category) {
    event.preventDefault()
    const draggingId = dragState.draggingId
    const targetId = category.id
    const position = dragState.dropPosition

    if (!draggingId || draggingId === targetId) {
      onDragEnd()
      return
    }

    // Prevent circular reference
    if (isDescendant(draggingId, targetId)) {
      toastWarning('不能将分类拖入自己的子分类中')
      onDragEnd()
      return
    }

    const draggedCat = categories.value.find(c => c.id === draggingId)
    if (!draggedCat) {
      onDragEnd()
      return
    }

    const oldParentId = draggedCat.parent_id ?? null
    const oldPath = getPath(draggingId)

    let newParentId = null
    let newPos = 0

    if (position === 'child') {
      // Make it a child of target
      newParentId = targetId
      const siblings = categories.value
        .filter(c => (c.parent_id ?? null) === targetId)
        .sort((a, b) => a.position - b.position)
      newPos = siblings.length + 1

      // Auto-expand target
      if (!expandedCategoryIds.value.includes(targetId)) {
        expandedCategoryIds.value.push(targetId)
      }
    } else {
      // Insert before or after target
      const targetCat = categories.value.find(c => c.id === targetId)
      newParentId = targetCat?.parent_id ?? null
      const siblings = categories.value
        .filter(c => (c.parent_id ?? null) === newParentId)
        .sort((a, b) => a.position - b.position)
      const targetIdx = siblings.findIndex(s => s.id === targetId)
      // If dragging item is in the same sibling group, adjust index
      const isSameGroup = (draggedCat.parent_id ?? null) === newParentId
      const insertIdx = position === 'before' ? targetIdx : targetIdx + 1
      newPos = isSameGroup && insertIdx > siblings.findIndex(s => s.id === draggingId)
        ? insertIdx
        : insertIdx + 1
    }

    // Update the dragged category directly in categories.value
    draggedCat.parent_id = newParentId
    draggedCat.position = newPos

    // Recalculate positions for affected sibling groups
    // Old parent siblings
    const oldSiblings = categories.value
      .filter(c => (c.parent_id ?? null) === oldParentId && c.id !== draggingId)
      .sort((a, b) => a.position - b.position)
    oldSiblings.forEach((c, i) => { c.position = i + 1 })

    // New parent siblings
    const newSiblings = categories.value
      .filter(c => (c.parent_id ?? null) === newParentId && c.id !== draggingId)
      .sort((a, b) => a.position - b.position)
    newSiblings.forEach((c, i) => { c.position = i + 1 })

    // Re-sort to ensure correct order
    const finalSiblings = categories.value
      .filter(c => (c.parent_id ?? null) === newParentId)
      .sort((a, b) => a.position - b.position)
    finalSiblings.forEach((c, i) => { c.position = i + 1 })

    const newPath = getPath(draggingId)

    // Record change
    const isParentChanged = oldParentId !== newParentId
    if (isParentChanged) {
      recordChange({
        type: 'move',
        id: draggingId,
        name: draggedCat.name,
        oldParentId,
        newParentId,
        oldPath,
        newPath
      })
    } else {
      const oldIdx = oldSiblings.findIndex(s => s.id === draggingId)
      recordChange({
        type: 'reorder',
        id: draggingId,
        name: draggedCat.name,
        parentId: newParentId,
        oldPos: oldIdx + 1,
        newPos
      })
    }

    toastSuccess(`已移动 "${draggedCat.name}"`)
    onDragEnd()
  }

  // Drag hint text
  const dragHintText = computed(() => {
    if (!dragState.dropTargetId) return '拖拽到其他分类上将成为其子分类'
    if (dragState.dropPosition === 'child') return `将成为子分类`
    return `将移动到 ${dragState.dropPosition === 'before' ? '上方' : '下方'}`
  })

  // Reset form to original values
  function resetForm() {
    editForm.name = formOriginal.name
    editForm.parentId = formOriginal.parentId
    editForm.position = formOriginal.position
    const siblings = getSiblings(selectedCategoryId.value)
    editForm.maxPosition = siblings.length
  }

  async function applyFormChanges() {
    if (!selectedCategoryId.value) return { success: false }
    if (!editForm.name || !editForm.name.trim()) {
      toastError('分类名称不能为空')
      return { success: false }
    }

    const result = await editCategory(
      selectedCategoryId.value,
      editForm.name.trim(),
      editForm.parentId
    )

    if (result.success) {
      formOriginal.name = editForm.name.trim()
      formOriginal.parentId = editForm.parentId
      pendingChanges.value = pendingChanges.value.filter(change => change.id !== selectedCategoryId.value)
      captureInitialSnapshot()
    } else {
      resetForm()
    }

    return result
  }

  async function confirmAddCategory(name, parentId = null) {
    if (!name || !name.trim()) {
      toastError('分类名称不能为空')
      return { success: false }
    }

    const result = await createCategory(name.trim(), parentId)
    if (result.success && parentId && !expandedCategoryIds.value.includes(parentId)) {
      expandedCategoryIds.value.push(parentId)
    }
    if (result.success) {
      pendingChanges.value = pendingChanges.value.filter(change => change.type !== 'create')
      captureInitialSnapshot()
    }
    return result
  }

  async function confirmDelete(id) {
    if (!id) return { success: false }

    const item = categories.value.find(c => c.id === id)
    if (!item) return { success: false }

    const result = await deleteCategory(id)
    if (result.success && selectedCategoryId.value === id) {
      selectedCategoryId.value = null
    }
    if (result.success) {
      pendingChanges.value = pendingChanges.value.filter(change => change.id !== id)
      captureInitialSnapshot()
    }
    return result
  }

  // Confirm save - batch save to API
  async function confirmSave() {
    if (pendingChanges.value.length === 0) {
      toastWarning('没有待保存的更改')
      return { success: true }
    }

    // Save rollback snapshot
    const rollbackSnapshot = deepClone(categories.value)

    try {
      // Build reorder payload: flatten category tree with computed positions
      function flattenTree(tree, result = []) {
        tree.forEach((node, idx) => {
          result.push({
            id: node.id,
            position: idx + 1,
            parent_id: node.parent_id || null
          })
          if (node.children?.length) {
            flattenTree(node.children, result)
          }
        })
        return result
      }

      const items = flattenTree(categoryTree.value)
      const result = await reorderItems('categories', items)

      if (result.success) {
        pendingChanges.value = []
        captureInitialSnapshot()
        toastSuccess('保存成功')
        return { success: true }
      } else {
        throw new Error(result.error || '保存失败')
      }
    } catch (error) {
      // Rollback
      categories.value = rollbackSnapshot
      toastError('保存失败，已回滚')
      return { success: false, error: error.message }
    }
  }

  // Discard all changes (no confirm - caller handles dialog)
  function discardAll() {
    categories.value = deepClone(initialDataSnapshot.value)
    pendingChanges.value = []
    selectedCategoryId.value = null
    toastWarning('已放弃全部更改')
  }

  // Get change description
  function getChangeDescription(change) {
    switch (change.type) {
      case 'create':
        return `"${change.name}" (父: ${change.parentPath || '根分类'})`
      case 'rename':
        return `"${change.oldName}" → "${change.newName}"`
      case 'reorder':
        return `"${change.name}" 从第${change.oldPos}位→第${change.newPos}位`
      case 'move':
        return `"${change.name}" 从 ${change.oldPath || '根分类'}→${change.newPath || '根分类'}`
      case 'delete':
        return `"${change.name}" (路径: ${change.path || '未知'})`
      default:
        return '未知变更'
    }
  }

  // Get change type label
  function getChangeTypeLabel(type) {
    switch (type) {
      case 'create': return '新建'
      case 'rename': return '重命名'
      case 'reorder': return '排序'
      case 'move': return '移动'
      case 'delete': return '删除'
      default: return '未知'
    }
  }

  // Get pending change count
  function getPendingChangeCount() {
    return pendingChanges.value.length
  }

  // Has pending changes
  function hasPendingChanges() {
    return pendingChanges.value.length > 0
  }

  return {
    // Data
    categoryTree,
    categoryFlatList,
    categories,

    // Selection
    selectedCategoryId,
    selectedCategory,
    expandedCategoryIds,

    // Edit form
    editForm,
    availableParentCategories,

    // Tree operations
    toggleExpand,
    selectCategory,
    moveChildItem,
    createCategory,
    editCategory,
    removeCategory,
    applyChanges,

    // Drag & drop
    dragState,
    dragHintText,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,

    // Utils
    findParent,

    // Pending system
    pendingChanges,
    initialDataSnapshot,
    captureInitialSnapshot,
    applyFormChanges,
    confirmDelete,
    confirmAddCategory,
    confirmSave,
    discardAll,
    getChangeDescription,
    getChangeTypeLabel,
    getPendingChangeCount,
    hasPendingChanges,
    getPath,
    findItem,
    moveRootItem,
  }
}
