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
        displayName: getCategoryPath(cat.id, map).map(c => c.name).join('/'),
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

    // Capture snapshot + form original
    captureInitialSnapshot()
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

  // Move child item (local only)
  function moveChildItem(parentId, childId, direction) {
    const parent = categoryTree.value.find(c => c.id === parentId)
    if (!parent?.children) return
    const idx = parent.children.findIndex(c => c.id === childId)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= parent.children.length) return

    const oldPos = idx + 1
    const [item] = parent.children.splice(idx, 1)
    parent.children.splice(newIdx, 0, item)

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

  // Move root item position
  function moveRootItem(id, direction) {
    const tree = categoryTree.value
    const idx = tree.findIndex(c => c.id === id)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= tree.length) return

    const oldPos = idx + 1
    const [item] = tree.splice(idx, 1)
    tree.splice(newIdx, 0, item)

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

    const draggedItem = findItem(draggingId)
    if (!draggedItem) {
      onDragEnd()
      return
    }

    const oldParent = findParent(draggingId)
    const oldParentId = oldParent ? oldParent.id : null
    const oldPath = getPath(draggingId)

    // Remove from old position
    removeItemById(draggingId)

    let newParentId = null
    let newPos = 0

    if (position === 'child') {
      // Make it a child of target
      if (!category.children) category.children = []
      category.children.push(draggedItem)
      draggedItem.parent_id = targetId
      newParentId = targetId
      newPos = category.children.length

      // Auto-expand target
      if (!expandedCategoryIds.value.includes(targetId)) {
        expandedCategoryIds.value.push(targetId)
      }
    } else {
      // Insert before or after target
      const targetParent = findParentOf(targetId)
      const siblings = targetParent ? targetParent.children : categoryTree.value

      const targetIdx = siblings.findIndex(s => s.id === targetId)
      const insertIdx = position === 'before' ? targetIdx : targetIdx + 1

      siblings.splice(insertIdx, 0, draggedItem)
      draggedItem.parent_id = targetParent ? targetParent.id : null
      newParentId = targetParent ? targetParent.id : null
      newPos = insertIdx + 1
    }

    const newPath = getPath(draggingId)

    // Record change
    const isParentChanged = oldParentId !== newParentId
    if (isParentChanged) {
      recordChange({
        type: 'move',
        id: draggingId,
        name: draggedItem.name,
        oldParentId,
        newParentId,
        oldPath,
        newPath
      })
    } else {
      recordChange({
        type: 'reorder',
        id: draggingId,
        name: draggedItem.name,
        parentId: newParentId,
        oldPos: editForm.position,
        newPos
      })
    }

    toastSuccess(`已移动 "${draggedItem.name}"`)
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

  // Apply form changes (local only + record pending)
  function applyFormChanges() {
    if (!selectedCategoryId.value) return

    const item = findItem(selectedCategoryId.value)
    if (!item) return

    const oldName = item.name
    const oldParentId = item.parent_id || null
    const newName = editForm.name
    const newParentId = editForm.parentId

    // Update local data
    item.name = newName
    item.parent_id = newParentId

    // Record rename if name changed
    if (oldName !== newName) {
      recordChange({
        type: 'rename',
        id: item.id,
        oldName,
        newName
      })
    }

    // Record move if parent changed
    if (oldParentId !== newParentId) {
      recordChange({
        type: 'move',
        id: item.id,
        name: newName,
        oldParentId,
        newParentId,
        oldPath: oldParentId ? getPath(oldParentId) : '根分类',
        newPath: newParentId ? getPath(newParentId) : '根分类'
      })
    }

    // Update formOriginal
    formOriginal.name = newName
    formOriginal.parentId = newParentId

    // Update position info
    const siblings = getSiblings(item.id)
    const idx = siblings.findIndex(s => s.id === item.id)
    editForm.position = idx + 1
    editForm.maxPosition = siblings.length
    formOriginal.position = idx + 1

    toastSuccess('已应用更改')
  }

  // Confirm add category (local only)
  async function confirmAddCategory(name, parentId = null) {
    if (!name || !name.trim()) {
      toastError('分类名称不能为空')
      return { success: false }
    }

    // Create a temp ID for the new category
    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)

    const newCategory = {
      id: tempId,
      name: name.trim(),
      parent_id: parentId,
      position: 0,
      is_private: false,
      children: []
    }

    if (parentId) {
      const parent = findItem(parentId)
      if (parent) {
        if (!parent.children) parent.children = []
        parent.children.push(newCategory)
        newCategory.position = parent.children.length
        if (!expandedCategoryIds.value.includes(parentId)) {
          expandedCategoryIds.value.push(parentId)
        }
      }
    } else {
      categories.value.push(newCategory)
      newCategory.position = categories.value.length
    }

    recordChange({
      type: 'create',
      id: tempId,
      name: newCategory.name,
      parentId,
      parentPath: parentId ? getPath(parentId) : '根分类'
    })

    toastSuccess(`已创建 "${newCategory.name}"`)
    return { success: true, id: tempId }
  }

  // Confirm delete (local only)
  async function confirmDelete(id) {
    if (!id) return { success: false }

    const item = findItem(id)
    if (!item) return { success: false }

    const childCount = item.children?.length || 0
    if (!confirm(`确定要删除分类 "${item.name}" 吗？${childCount > 0 ? `此分类下有 ${childCount} 个子分类，它们也会被一并删除。` : ''}此操作不可恢复。`)) {
      return { success: false }
    }

    const itemPath = getPath(id)
    removeItemById(id)

    recordChange({
      type: 'delete',
      id,
      name: item.name,
      path: itemPath,
      childCount
    })

    if (selectedCategoryId.value === id) {
      selectedCategoryId.value = null
    }

    toastSuccess(`已删除 "${item.name}"`)
    return { success: true }
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
      // Build reorder payload: flatten category tree
      function flattenTree(tree, result = []) {
        for (const node of tree) {
          result.push({
            id: node.id,
            position: node.position,
            parent_id: node.parent_id || null
          })
          if (node.children?.length) {
            flattenTree(node.children, result)
          }
        }
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

  // Discard all changes
  function discardAll() {
    if (!confirm('确定要放弃全部更改吗？此操作不可恢复。')) return

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
    resetEditForm,
    availableParentCategories,
    changePosition,

    // CRUD (original API-calling versions, kept for compatibility)
    createCategory,
    editCategory,
    removeCategory,
    applyChanges,

    // Tree operations
    toggleExpand,
    selectCategory,
    moveChildItem,
    getChildIndex,

    // Drag & drop
    dragState,
    dragHintText,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,

    // Utils
    findParent,

    // New: pending system
    pendingChanges,
    formOriginal,
    initialDataSnapshot,
    resetForm,
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
