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
          :reorderable="isAuthenticated"
          :highlight="searchQuery"
          @toggle="toggleExpand"
          @start-edit="handleStartEdit"
          @save-edit="handleSaveEdit"
          @cancel-edit="handleCancelEdit"
          @action="handleAction"
        />
      </template>
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
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useBookmarks } from '@/composables/useBookmarks'
import { useAuth } from '@/composables/useAuth'
import { useAuthGuard } from '@/composables/useAuthGuard'
import { useToast } from '@/composables/useToast'
import { buildCategoryTree, getDescendantIds } from '@/utils/categoryTree.js'
import { buildCategoryBookmarkCounts } from '@/utils/categoryCounts.js'
import { debounce } from '@/utils/helpers'
import MenuCategoryRow from '@/components/settings/MenuCategoryRow.vue'
import CategoryCreateDialog from '@/components/CategoryCreateDialog.vue'
import MoveCategoryDialog from '@/components/MoveCategoryDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const emit = defineEmits(['migrate-bookmarks'])

const { categories, bookmarks, addCategory, updateCategory, deleteCategory } = useBookmarks()
const { isAuthenticated } = useAuth()
const { requireAuth } = useAuthGuard()
const { success: toastSuccess, error: toastError } = useToast()

const confirmDialog = ref(null)

const tree = computed(() => buildCategoryTree(categories.value).tree)
const categoryFlatList = computed(() => buildCategoryTree(categories.value).flatList)
const counts = computed(() => buildCategoryBookmarkCounts(categories.value, bookmarks.value))

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

const handleStartEdit = ({ id, field }) => {
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

  const result = await deleteCategory(category.id)
  if (result.success) {
    toastSuccess('分类已删除')
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
      const cascadeResult = await deleteCategory(category.id, { cascade: 'true' })
      if (cascadeResult.success) {
        toastSuccess(`分类已删除，${cascadeResult.deletedBookmarks ?? result.bookmarkCount} 个书签已一并删除`)
      } else {
        toastError(cascadeResult.error || '删除失败')
      }
    } else if (choice === 'migrate') {
      emit('migrate-bookmarks', { id: category.id, name: category.name })
    }
    return
  }

  toastError(result.error || '删除失败')
}

const handleAction = ({ action, node }) => {
  if (action === 'rename') {
    editing.value = { id: node.id, field: 'name' }
  } else if (action === 'description') {
    editing.value = { id: node.id, field: 'description' }
  } else if (action === 'create-child') {
    openCreate(node.id)
  } else if (action === 'move') {
    openMoveDialog(node)
  } else if (action === 'delete') {
    handleDeleteCategory(node)
  }
}

/* ===== 拖拽排序（Task 5） ===== */
const reorder = ref(null)
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
  padding: 12px 14px;
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

.menu-list {
  flex: 1;
  min-height: 0;
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
