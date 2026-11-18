<template>
  <div class="menu-settings">
    <div class="menu-toolbar">
      <div class="menu-toolbar-title">
        <h2>菜单</h2>
        <span class="menu-toolbar-count">{{ categories.length }} 个分类</span>
      </div>

      <div class="menu-search">
        <svg class="menu-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          v-model="searchInput"
          class="menu-search-input"
          type="text"
          placeholder="搜索分类…"
          autocomplete="off"
        />
        <button v-if="searchInput" class="menu-search-clear" type="button" aria-label="清除搜索" @click="clearSearch">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="menu-toolbar-actions">
        <button class="menu-tool-btn" type="button" :disabled="expandableIds.length === 0" @click="toggleExpandAll">
          {{ allExpanded ? '收起全部' : '展开全部' }}
        </button>
        <button class="menu-tool-btn is-primary" type="button" @click="openCreate(null)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          新分类
        </button>
      </div>
    </div>

    <div class="menu-body">
      <div class="menu-list" role="tree" aria-label="分类菜单">
        <div v-if="categories.length === 0" class="menu-empty">
          还没有分类，点「＋ 新分类」开始
        </div>
        <div v-else-if="filteredTree.length === 0" class="menu-empty">
          没有匹配「{{ searchQuery }}」的分类
        </div>
        <template v-else>
          <MenuCategoryRow
            v-for="node in filteredTree"
            :key="node.id"
            :node="node"
            :depth="0"
            :expanded-ids="effectiveExpandedIds"
            :counts="counts"
            :editing="editing"
            :reorder="reorder"
            :reorderable="canReorder"
            :highlight="searchQuery"
            :open-menu-id="openRowMenuId"
            :selected="selectedId"
            :dirty-id="dirtyId"
            :edit-mode="rowEditMode"
            @toggle="toggleExpand"
            @select="selectCategory"
            @start-edit="handleStartEdit"
            @save-edit="handleSaveEdit"
            @cancel-edit="handleCancelEdit"
            @action="handleAction"
            @menu-toggle="handleRowMenuToggle"
          />
        </template>
      </div>

      <MenuDetailPanel
        v-if="isWide"
        ref="panelRef"
        :node="selectedNode"
        :name="draftName"
        :description="draftDescription"
        :meta="detailMeta"
        :dirty="draftDirty"
        :saving="saving"
        :name-error="nameError"
        @update:name="updateDraftName"
        @update:description="updateDraftDescription"
        @save="saveDraft"
        @cancel="discardDraft"
        @action="handlePanelAction"
      />
    </div>

    <CategoryCreateDialog
      :show="showCreateDialog"
      :categories="categoryFlatList"
      :default-parent-id="createParentId"
      :saving="createSaving"
      @close="closeCreateDialog"
      @confirm="handleConfirmCreate"
    />

    <MoveCategoryDialog
      :show="!!moveTarget"
      :category="moveTarget"
      :categories="categories"
      :saving="moveSaving"
      @close="closeMoveDialog"
      @confirm="handleMoveConfirm"
    />

    <ConfirmDialog ref="confirmDialog" />

    <Teleport to="body">
      <Transition name="hint-fade">
        <div v-if="moveHint" class="menu-move-hint" role="status">
          <span class="menu-move-hint-text">
            「{{ moveHint.name }}」只能在同一层级内排序
          </span>
          <button class="menu-move-hint-action" type="button" @click="openMoveFromHint">
            移动到其他分类…
          </button>
          <button class="menu-move-hint-close" type="button" aria-label="关闭提示" @click="dismissMoveHint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useBookmarks } from '@/composables/useBookmarks'
import { useAuth } from '@/composables/useAuth'
import { useAuthGuard } from '@/composables/useAuthGuard'
import { useToast } from '@/composables/useToast'
import { useMenuReorder } from '@/composables/useMenuReorder'
import { buildCategoryTree, getCategoryPath, getDescendantIds } from '@/utils/categoryTree.js'
import { buildCategoryBookmarkCounts } from '@/utils/categoryCounts.js'
import { debounce } from '@/utils/helpers'
import MenuCategoryRow from '@/components/settings/MenuCategoryRow.vue'
import MenuDetailPanel from '@/components/settings/MenuDetailPanel.vue'
import CategoryCreateDialog from '@/components/CategoryCreateDialog.vue'
import MoveCategoryDialog from '@/components/MoveCategoryDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const emit = defineEmits(['migrate-bookmarks'])

const { categories, bookmarks, addCategory, updateCategory, deleteCategory, reorderItems } = useBookmarks()
const { isAuthenticated } = useAuth()
const { requireAuth } = useAuthGuard()
const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast()

const confirmDialog = ref(null)
const panelRef = ref(null)

const treeData = computed(() => buildCategoryTree(categories.value))
const tree = computed(() => treeData.value.tree)
const categoryFlatList = computed(() => treeData.value.flatList)
const categoryMap = computed(() => treeData.value.map)
const counts = computed(() => buildCategoryBookmarkCounts(categories.value, bookmarks.value))

/* ===== 选中分类与右栏编辑会话（宽屏两列） ===== */
const selectedId = ref(null)
const draft = ref(null)
const saving = ref(false)
const nameError = ref('')
const resolving = ref(false)
const expectedRemoval = ref([])

const selectedNode = computed(() => {
  if (selectedId.value == null) return null
  return categoryMap.value[selectedId.value] || null
})

const draftName = computed(() => draft.value?.name ?? '')
const draftDescription = computed(() => draft.value?.description ?? '')

const draftDirty = computed(() => {
  const current = draft.value
  if (!current) return false
  return current.name !== current.savedName || current.description !== current.savedDescription
})

const dirtyId = computed(() => (draftDirty.value ? draft.value?.id ?? null : null))

const detailMeta = computed(() => {
  const node = selectedNode.value
  if (!node) return null

  const siblings = node.parent_id == null
    ? tree.value
    : (categoryMap.value[node.parent_id]?.children || [])
  const index = siblings.findIndex(item => item.id === node.id)
  const path = getCategoryPath(node.id, categoryMap.value).slice(0, -1).map(item => item.name)

  return {
    parentPath: path.join(' / '),
    parentName: path.length ? path[path.length - 1] : null,
    position: index >= 0 ? index + 1 : 1,
    siblingCount: siblings.length || 1,
    bookmarkCount: counts.value[node.id] ?? 0,
    childCount: node.children?.length || 0
  }
})

/* 宽屏（>1100px）才启用两列与右栏编辑入口，窄屏维持行内编辑 */
const WIDE_MEDIA = '(min-width: 1101px)'
const isWide = ref(typeof window !== 'undefined' ? window.matchMedia(WIDE_MEDIA).matches : true)
let wideMediaQuery = null
const syncIsWide = (event) => {
  isWide.value = event.matches
}
const rowEditMode = computed(() => (isWide.value ? 'panel' : 'inline'))

const resetDraftFromNode = () => {
  const node = selectedNode.value
  if (!node) {
    draft.value = null
    return
  }
  draft.value = {
    id: node.id,
    name: node.name || '',
    description: node.description || '',
    savedName: node.name || '',
    savedDescription: node.description || ''
  }
}

watch(selectedNode, (node) => {
  nameError.value = ''
  if (!node) {
    draft.value = null
    return
  }
  /* 有未保存改动时不覆盖草稿，避免后台刷新抹掉输入 */
  if (draft.value?.id === node.id && draftDirty.value) return
  resetDraftFromNode()
})

/* 打开时默认选中第一条根分类；选中项被删则自动回落，并提示未保存内容已丢弃 */
watch(tree, (nodes) => {
  if (nodes.length === 0) {
    selectedId.value = null
    draft.value = null
    return
  }

  if (selectedId.value != null && categoryMap.value[selectedId.value]) return

  if (selectedId.value != null) {
    const removedBySelf = expectedRemoval.value.includes(selectedId.value)
    if (draftDirty.value && !removedBySelf) {
      toastWarning('当前分类已被删除，未保存的修改已丢弃')
    }
    draft.value = null
    expectedRemoval.value = []
  }

  selectedId.value = nodes[0].id
}, { immediate: true })

const updateDraftName = (value) => {
  if (!draft.value) return
  draft.value.name = value
  if (nameError.value) nameError.value = ''
}

const updateDraftDescription = (value) => {
  if (!draft.value) return
  draft.value.description = value
}

const discardDraft = () => {
  nameError.value = ''
  resetDraftFromNode()
}

/* 保存：一次 PUT 同时提交 name + description；失败回滚并保留草稿 */
const saveDraft = async () => {
  const current = draft.value
  if (!current || !draftDirty.value) return true
  if (saving.value) return false

  const name = (current.name || '').trim()
  if (!name) {
    nameError.value = '分类名称不能为空'
    toastError('分类名称不能为空')
    await nextTick()
    panelRef.value?.focusName()
    return false
  }
  if (!requireAuth()) return false

  const category = categories.value.find(item => item.id === current.id)
  if (!category) {
    toastError('分类不存在，可能已被删除')
    draft.value = null
    return false
  }

  nameError.value = ''
  const description = (current.description || '').trim()
  const snapshot = { name: category.name, description: category.description }

  const rollback = () => {
    categories.value = categories.value.map(item => (
      item.id === current.id ? { ...item, ...snapshot } : item
    ))
  }

  saving.value = true
  categories.value = categories.value.map(item => (
    item.id === current.id ? { ...item, name, description } : item
  ))

  try {
    const result = await updateCategory(current.id, name, undefined, undefined, description)
    if (!result.success) {
      rollback()
      toastError(result.error || '保存失败，请重试')
      return false
    }
    current.name = name
    current.description = description
    current.savedName = name
    current.savedDescription = description
    toastSuccess('已保存')
    return true
  } catch (error) {
    rollback()
    toastError(error?.message === 'Token expired' ? '登录已过期，请重新登录' : '保存失败，请重试')
    return false
  } finally {
    saving.value = false
  }
}

/* 未保存改动的统一处置：取消 / 放弃更改 / 保存并继续 */
const resolveDraft = async ({ title, message, saveText }) => {
  if (!draftDirty.value) return true
  if (resolving.value) return false
  resolving.value = true
  try {
    const choice = await confirmDialog.value?.openWithChoices(message, title, [
      { text: '取消', value: 'cancel' },
      { text: '放弃更改', value: 'discard' },
      { text: saveText, value: 'save', primary: true }
    ])
    if (choice === 'save') return await saveDraft()
    if (choice === 'discard') {
      discardDraft()
      return true
    }
    return false
  } finally {
    resolving.value = false
  }
}

const selectCategory = async (id) => {
  if (id == null || id === selectedId.value) return
  if (resolving.value) return

  const ok = await resolveDraft({
    title: '未保存的修改',
    message: `「${selectedNode.value?.name || '当前分类'}」有未保存的修改，切换前如何处理？`,
    saveText: '保存并切换'
  })
  if (!ok) return
  selectedId.value = id
}

/* 宽屏下「重命名 / 编辑描述」统一落到右栏字段 */
const focusPanelField = async (node, field) => {
  if (!isWide.value || !node) return

  if (node.id !== selectedId.value) {
    const ok = await resolveDraft({
      title: '未保存的修改',
      message: `「${selectedNode.value?.name || '当前分类'}」有未保存的修改，切换前如何处理？`,
      saveText: '保存并切换'
    })
    if (!ok) return
    selectedId.value = node.id
    await nextTick()
  }

  if (field === 'description') panelRef.value?.focusDescription()
  else panelRef.value?.focusName()
}

const handlePanelAction = (action) => {
  const node = selectedNode.value
  if (!node) return
  if (action === 'create-child') openCreate(node.id)
  else if (action === 'move') openMoveDialog(node)
  else if (action === 'delete') handleDeleteCategory(node)
}

const hasUnsaved = () => draftDirty.value && !!selectedNode.value

const confirmLeave = async () => {
  if (!draftDirty.value) return true
  return resolveDraft({
    title: '未保存的修改',
    message: `「${selectedNode.value?.name || '当前分类'}」有未保存的修改，关闭设置前如何处理？`,
    saveText: '保存并关闭'
  })
}

defineExpose({ hasUnsaved, confirmLeave })

onMounted(() => {
  wideMediaQuery = window.matchMedia(WIDE_MEDIA)
  isWide.value = wideMediaQuery.matches
  wideMediaQuery.addEventListener?.('change', syncIsWide)
})

/* ===== 展开 / 收起 ===== */
const expandedIds = ref([])
let expandedInitialized = false

watch(tree, (nodes) => {
  if (expandedInitialized || nodes.length === 0) return
  expandedInitialized = true
  const ids = []
  const walk = (list, depth) => {
    for (const node of list) {
      if (depth <= 1 && node.children?.length) ids.push(node.id)
      walk(node.children || [], depth + 1)
    }
  }
  walk(nodes, 0)
  expandedIds.value = ids
}, { immediate: true })

const expandableIds = computed(() => {
  const ids = []
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.children?.length) ids.push(node.id)
      walk(node.children || [])
    }
  }
  walk(tree.value)
  return ids
})

const allExpanded = computed(() =>
  expandableIds.value.length > 0 && expandableIds.value.every(id => expandedIds.value.includes(id))
)

const toggleExpand = (id) => {
  expandedIds.value = expandedIds.value.includes(id)
    ? expandedIds.value.filter(x => x !== id)
    : [...expandedIds.value, id]
}

const toggleExpandAll = () => {
  expandedIds.value = allExpanded.value ? [] : [...expandableIds.value]
}

/* ===== 搜索 ===== */
const searchInput = ref('')
const searchQuery = ref('')
const applySearch = debounce((value) => {
  searchQuery.value = value
}, 150)

watch(searchInput, (value) => applySearch(value.trim()))

/* ===== 行内操作菜单（单例） ===== */
const openRowMenuId = ref(null)

const handleRowMenuToggle = (id) => {
  openRowMenuId.value = id
}

const closeRowMenu = () => {
  openRowMenuId.value = null
}

const handleMenuOutsidePointerDown = (event) => {
  if (event.target?.closest?.('.row-menu, .row-more')) return
  closeRowMenu()
}

const handleMenuKeydown = (event) => {
  if (event.key !== 'Escape' || openRowMenuId.value == null) return
  event.preventDefault()
  closeRowMenu()
}

const removeRowMenuListeners = () => {
  window.removeEventListener('pointerdown', handleMenuOutsidePointerDown, true)
  window.removeEventListener('scroll', closeRowMenu, true)
  window.removeEventListener('resize', closeRowMenu)
  window.removeEventListener('keydown', handleMenuKeydown, true)
}

watch(openRowMenuId, (id, prev) => {
  if (id != null && prev == null) {
    window.addEventListener('pointerdown', handleMenuOutsidePointerDown, true)
    window.addEventListener('scroll', closeRowMenu, true)
    window.addEventListener('resize', closeRowMenu)
    window.addEventListener('keydown', handleMenuKeydown, true)
  } else if (id == null && prev != null) {
    removeRowMenuListeners()
  }
})

const clearSearch = () => {
  searchInput.value = ''
  searchQuery.value = ''
}

const filteredTree = computed(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return tree.value

  const walk = (nodes, parentPath = '') => {
    const result = []
    for (const node of nodes) {
      const path = parentPath ? `${parentPath} / ${node.name}` : node.name
      const matched = path.toLowerCase().includes(query)
      const totalChildren = node.children?.length || 0
      if (matched) {
        result.push({ ...node, children: node.children || [], totalChildren })
        continue
      }
      const children = walk(node.children || [], path)
      if (children.length) {
        result.push({ ...node, children, totalChildren })
      }
    }
    return result
  }
  return walk(tree.value)
})

const searchExpandedIds = computed(() => {
  if (!searchQuery.value) return expandedIds.value
  const ids = []
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.children?.length) {
        ids.push(node.id)
        walk(node.children)
      }
    }
  }
  walk(filteredTree.value)
  return ids
})

const effectiveExpandedIds = computed(() =>
  searchQuery.value ? searchExpandedIds.value : expandedIds.value
)

/* ===== 行内编辑 ===== */
const editing = ref(null)

const handleStartEdit = async ({ id, field }) => {
  /* 窄屏行内编辑前先处置右栏遗留的草稿，避免两处同时改同一分类 */
  if (draftDirty.value) {
    const ok = await resolveDraft({
      title: '未保存的修改',
      message: `「${selectedNode.value?.name || '当前分类'}」有未保存的修改，开始行内编辑前如何处理？`,
      saveText: '保存并继续'
    })
    if (!ok) return
  }
  editing.value = { id, field }
}

const handleCancelEdit = () => {
  editing.value = null
}

const handleSaveEdit = async ({ id, field, value }) => {
  editing.value = null
  if (!requireAuth()) return

  const category = categories.value.find(c => c.id === id)
  if (!category) return

  const snapshot = { name: category.name, description: category.description }
  const next = value.trim()

  categories.value = categories.value.map(c => {
    if (c.id !== id) return c
    return field === 'name' ? { ...c, name: next } : { ...c, description: next }
  })

  const nameArg = field === 'name' ? next : category.name
  const descriptionArg = field === 'description' ? next : undefined

  const result = await updateCategory(id, nameArg, undefined, undefined, descriptionArg)
  if (!result.success) {
    categories.value = categories.value.map(c => (c.id === id ? { ...c, ...snapshot } : c))
    toastError(result.error || '保存失败')
    return
  }
  toastSuccess(field === 'name' ? '已重命名' : '已更新描述')
}

/* ===== 新建分类 ===== */
const showCreateDialog = ref(false)
const createParentId = ref(null)
const createSaving = ref(false)

const openCreate = (parentId = null) => {
  if (!requireAuth()) return
  createParentId.value = parentId
  showCreateDialog.value = true
}

const closeCreateDialog = () => {
  if (createSaving.value) return
  showCreateDialog.value = false
}

const handleConfirmCreate = async ({ name, parentId }) => {
  if (createSaving.value) return
  if (!requireAuth()) return
  createSaving.value = true
  try {
    const result = await addCategory(name, parentId)
    if (result.success) {
      showCreateDialog.value = false
      toastSuccess('已创建分类')
    } else {
      toastError(result.error || '创建失败')
    }
  } finally {
    createSaving.value = false
  }
}

/* ===== 行操作 ===== */
const moveTarget = ref(null)
const moveSaving = ref(false)

const openMoveDialog = (node) => {
  if (!requireAuth()) return
  moveTarget.value = categories.value.find(c => c.id === node.id) || node
}

const closeMoveDialog = () => {
  if (moveSaving.value) return
  moveTarget.value = null
}

const handleMoveConfirm = async ({ parentId }) => {
  const category = moveTarget.value
  if (!category || moveSaving.value) return
  if (!requireAuth()) return
  if (parentId === (category.parent_id ?? null)) {
    moveTarget.value = null
    return
  }

  moveSaving.value = true
  try {
    const result = await updateCategory(category.id, category.name, parentId)
    if (result.success) {
      const parent = parentId == null ? null : categories.value.find(c => c.id === parentId)
      toastSuccess(parent ? `已移动到「${parent.name}」下` : '已移动到根分类')
      moveTarget.value = null
    } else {
      toastError(result.error || '移动失败')
    }
  } finally {
    moveSaving.value = false
  }
}

const handleDeleteCategory = async (node) => {
  if (!requireAuth()) return
  const category = categories.value.find(c => c.id === node.id)
  if (!category) return

  const { map } = buildCategoryTree(categories.value)
  const descendantCount = getDescendantIds(category.id, map).length
  let message = `确定要删除"${category.name}"吗？`
  if (descendantCount > 0) {
    message += `\n此分类下有 ${descendantCount} 个子分类，它们也会被一并删除。此操作不可恢复。`
  }

  const confirmed = await confirmDialog.value?.open(message, '删除分类')
  if (!confirmed) return

  /* 自己删掉的分类不弹「未保存已丢弃」提示 */
  const removalIds = [category.id, ...getDescendantIds(category.id, map)]
  const markRemoval = () => {
    expectedRemoval.value = removalIds
  }

  markRemoval()
  const result = await deleteCategory(category.id)
  if (result.success) {
    toastSuccess('分类已删除')
    await nextTick()
    expectedRemoval.value = []
    return
  }

  if (result.needsDecision) {
    const choice = await confirmDialog.value?.openWithChoices(
      `分类"${category.name}"下有 ${result.bookmarkCount} 个书签，如何处理？`,
      '删除分类',
      [
        { text: '取消', value: null },
        { text: '查看并迁移书签', value: 'migrate' },
        { text: '连同书签一起删除', value: 'cascade', primary: true }
      ]
    )
    if (choice === 'cascade') {
      markRemoval()
      const cascadeResult = await deleteCategory(category.id, { cascade: 'true' })
      if (cascadeResult.success) {
        toastSuccess(`分类已删除，${cascadeResult.deletedBookmarks ?? result.bookmarkCount} 个书签已一并删除`)
        await nextTick()
        expectedRemoval.value = []
      } else {
        expectedRemoval.value = []
        toastError(cascadeResult.error || '删除失败')
      }
    } else if (choice === 'migrate') {
      expectedRemoval.value = []
      emit('migrate-bookmarks', { id: category.id, name: category.name })
    } else {
      expectedRemoval.value = []
    }
    return
  }

  expectedRemoval.value = []
  toastError(result.error || '删除失败')
}

const handleAction = ({ action, node }) => {
  if (action === 'rename') {
    editing.value = { id: node.id, field: 'name' }
  } else if (action === 'description') {
    editing.value = { id: node.id, field: 'description' }
  } else if (action === 'focus-name') {
    focusPanelField(node, 'name')
  } else if (action === 'focus-description') {
    focusPanelField(node, 'description')
  } else if (action === 'create-child') {
    openCreate(node.id)
  } else if (action === 'move') {
    openMoveDialog(node)
  } else if (action === 'delete') {
    handleDeleteCategory(node)
  }
}

/* ===== 拖拽排序（仅同级，复用导航栏语义） ===== */
const canReorder = computed(() => isAuthenticated.value && !searchQuery.value)

const handleMenuReorder = async ({ parentId, ids }) => {
  if (!isAuthenticated.value || !ids || ids.length < 2) return

  const originalPositions = {}
  categories.value.forEach(category => {
    if (ids.includes(category.id)) originalPositions[category.id] = category.position
  })
  if (Object.keys(originalPositions).length !== ids.length) return

  categories.value = categories.value.map(category => {
    const index = ids.indexOf(category.id)
    return index === -1 ? category : { ...category, position: index + 1 }
  })

  const items = ids.map((id, index) => ({ id, position: index + 1 }))
  const result = await reorderItems('categories', items)
  if (!result.success) {
    categories.value = categories.value.map(category => (
      originalPositions[category.id] !== undefined
        ? { ...category, position: originalPositions[category.id] }
        : category
    ))
    toastError(result.error || '菜单排序保存失败')
  }
}

/* 跨层级落点提示：给「只能同级排序」一个出口 */
const moveHint = ref(null)
let moveHintTimer = null

const dismissMoveHint = () => {
  clearTimeout(moveHintTimer)
  moveHintTimer = null
  moveHint.value = null
}

const showMoveHint = ({ id, name }) => {
  moveHint.value = { id, name }
  clearTimeout(moveHintTimer)
  moveHintTimer = setTimeout(() => {
    moveHint.value = null
    moveHintTimer = null
  }, 8000)
}

const openMoveFromHint = () => {
  const hint = moveHint.value
  if (!hint) return
  dismissMoveHint()
  const node = categories.value.find(c => c.id === hint.id)
  if (node) openMoveDialog(node)
}

const reorder = useMenuReorder({
  menus: () => tree.value,
  canReorder: () => canReorder.value,
  onReorder: handleMenuReorder,
  onInvalidDrop: showMoveHint
})

onBeforeUnmount(() => {
  clearTimeout(moveHintTimer)
  removeRowMenuListeners()
  wideMediaQuery?.removeEventListener?.('change', syncIsWide)
})
</script>

<style scoped>
.menu-settings {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.menu-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  /* 右侧预留设置弹窗右上角关闭按钮（16px 边距 + 30px 按钮 + 10px 间隙），
     避免「＋ 新分类」被 × 覆盖 */
  padding: 12px 56px 12px 14px;
  border-bottom: 1px solid var(--nav-border, var(--border));
  background: var(--nav-glass, var(--bg));
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
}

.menu-toolbar-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-shrink: 0;
}

.menu-toolbar-title h2 {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}

.menu-toolbar-count {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.menu-search {
  position: relative;
  flex: 1;
  min-width: 120px;
  max-width: 320px;
  display: flex;
  align-items: center;
}

.menu-search-icon {
  position: absolute;
  left: 9px;
  width: 13px;
  height: 13px;
  color: var(--text-tertiary);
  pointer-events: none;
}

.menu-search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 28px 6px 28px;
  border: 1px solid var(--nav-border, var(--border));
  border-radius: 8px;
  background: var(--input-bg, var(--bg-secondary));
  color: var(--text);
  font-size: 0.75rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.menu-search-input:focus {
  border-color: color-mix(in srgb, var(--nav-primary) 55%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.menu-search-input::placeholder {
  color: var(--text-tertiary);
}

.menu-search-clear {
  position: absolute;
  right: 5px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
}

.menu-search-clear:hover {
  background: var(--nav-bg-hover, var(--bg-hover));
  color: var(--text);
}

.menu-search-clear svg {
  width: 11px;
  height: 11px;
}

.menu-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-left: auto;
}

.menu-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid var(--nav-border, var(--border));
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.menu-tool-btn:hover:not(:disabled) {
  background: var(--nav-bg-hover, var(--bg-hover));
  color: var(--text);
}

.menu-tool-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.menu-tool-btn svg {
  width: 13px;
  height: 13px;
}

.menu-tool-btn.is-primary {
  border-color: color-mix(in srgb, var(--nav-primary) 45%, transparent);
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
  color: var(--nav-primary);
}

.menu-tool-btn.is-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--nav-primary) 20%, transparent);
  color: var(--nav-primary);
}

.menu-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  overflow: hidden;
}

.menu-list {
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  padding: 6px 10px 24px;
  overscroll-behavior: contain;
}

.menu-list::-webkit-scrollbar {
  width: 6px;
}

.menu-list::-webkit-scrollbar-track {
  background: transparent;
}

.menu-list::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb, var(--border));
  border-radius: 3px;
}

.menu-empty {
  padding: 48px 16px;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--text-tertiary);
}

/* 跨层级落点提示条（Teleport 到 body） */
.menu-move-hint {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 10020;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: min(560px, calc(100vw - 32px));
  padding: 9px 10px 9px 14px;
  border-radius: 12px;
  background: var(--nav-glass, var(--bg));
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border: 1px solid var(--nav-border, var(--border));
  box-shadow: 0 12px 32px -12px var(--shadow-lg, rgba(0, 0, 0, 0.35));
}

.menu-move-hint-text {
  flex: 1;
  min-width: 0;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-move-hint-action {
  flex-shrink: 0;
  padding: 5px 10px;
  border: 1px solid color-mix(in srgb, var(--nav-primary) 45%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
  color: var(--nav-primary);
  font-size: 0.75rem;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.12s ease;
}

.menu-move-hint-action:hover {
  background: color-mix(in srgb, var(--nav-primary) 20%, transparent);
}

.menu-move-hint-close {
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
}

.menu-move-hint-close:hover {
  background: var(--nav-bg-hover, var(--bg-hover));
  color: var(--text);
}

.menu-move-hint-close svg {
  width: 12px;
  height: 12px;
}

.hint-fade-enter-active,
.hint-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.hint-fade-enter-from,
.hint-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

@media (max-width: 1100px) {
  .menu-body {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .menu-toolbar {
    flex-wrap: wrap;
  }

  .menu-search {
    order: 3;
    flex-basis: 100%;
    max-width: none;
  }

  .menu-toolbar-actions {
    margin-left: auto;
  }
}
</style>
