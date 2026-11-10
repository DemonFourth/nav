<template>
  <div class="nav-item-view" :class="{ 'drag-reordering': dragReorderActive }" :style="backgroundStyle">
    <NavBar 
      :menus="menuTree"
      :active-menu="tagFilterActive || searchResults ? null : activeMenu"
      :active-sub-menu="tagFilterActive || searchResults ? null : activeSubMenu"
      :custom-title="customTitle"
      :reorderable="isAuthenticated"
      :active-path="activePath"
      :bookmark-counts="categoryCountMap"
      @select-menu="handleSelectMenu"
      @select-submenu="handleSelectSubMenu"
      @reorder-categories="handleMenuReorder"
      @create-category="handleCreateCategory"
      @toggle-style="handleToggleStyle"
      @open-settings="handleOpenSettings"
      @logout="handleLogout"
      ref="navBarRef"
    />

    <div v-if="!needsLogin" class="search-section">
      <NavSearch 
        v-show="showSearch"
        ref="navSearchRef"
        :bookmarks="allBookmarks"
        @search-results="handleSearchResults"
        @clear-results="clearSearchResults"
      />
    </div>

    <div v-if="!needsLogin && searchResults" class="search-summary-bar">
      <span class="search-summary-text">
        找到 <strong>{{ searchMatchCount }}</strong> 个书签 · 来自 {{ searchCategoryCount }} 个分类
      </span>
      <button class="search-summary-clear" @click="clearSearchFromSummary">清除搜索</button>
    </div>

    <div v-if="needsLogin" class="nav-login-guide">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <p class="nav-login-title">需要登录才能访问</p>
      <p class="nav-login-hint">此书签站点处于非公开模式，请先登录</p>
      <button class="nav-login-btn" @click="requireAuth()">立即登录</button>
    </div>

    <div v-if="!needsLogin && tagStats.length" class="tag-filter-sticky" :class="{ 'is-pinned': tagFilterActive }">
      <div class="category-tabs">
        <button
          v-for="tag in topTags"
          :key="tag.name"
          class="cat-tab"
          :class="{ active: isTagActive(tag.name) }"
          :aria-pressed="isTagActive(tag.name)"
          @click="handleTagClick(tag.name)"
        >
          {{ tag.name }}
          <span class="cat-count">{{ tag.count }}</span>
        </button>
        <button class="cat-tab tag-all" @click="showTagOverview = true">
          全部标签
          <span class="cat-count">{{ tagStats.length }}</span>
          ›
        </button>
      </div>

      <div v-if="tagFilterActive" class="tag-filter-bar">
        <span v-for="name in activeTagLabels" :key="name" class="tag-filter-chip">
          {{ name }}
          <span class="tag-filter-count">{{ getTagCount(name) }}</span>
          <button
            class="tag-filter-remove"
            :aria-label="`移除标签 ${name}`"
            @click="removeTag(name)"
          >×</button>
        </span>
        <span class="tag-filter-meta">
          {{ tagMatchCount }} 个书签 · 来自 {{ tagCategoryCount }} 个分类
        </span>
        <button class="tag-filter-clear" @click="clearTagFilter">清除筛选</button>
      </div>
    </div>

    <div v-if="!needsLogin" class="content-section">
      <NavCardGrid 
        :key="animationKey" 
        :bookmarks="currentBookmarks"
        :groups="resultGroups"
        :empty-text="gridEmptyText"
        :isAuthenticated="isAuthenticated"
        :reorderable="canReorder"
        :show-add-card="showAddBookmarkCard"
        :add-card-hint="addBookmarkCardHint"
        :show-index="showCardIndex"
        @add-bookmark="openAddBookmark"
        @tag-click="handleTagClick"
        @group-click="handleGroupClick"
        @show-detail="handleShowDetail"
        @reorder="handleReorder"
        @dragstart="onNavDragStart"
        @dragend="onNavDragEnd"
      />
      <!-- columns prop removed: responsive breakpoints in NavCardGrid control column count -->
    </div>

    <footer v-if="footerContent" class="nav-footer">
      <div class="nav-footer-content" v-html="footerContent"></div>
    </footer>

    <NavBookmarkEditModal
      :show="showDetailModal"
      :category-options="categoryOptions"
      :all-tags="allTags"
      @close="showDetailModal = false"
      @save="handleSaveBookmark"
      @delete="handleDeleteBookmark"
      ref="navBookmarkEditModalRef"
    />

    <NavSettingsModal
      :show="showNavSettings"
      ref="navSettingsRef"
      @close="showNavSettings = false"
      @action="handleSettingsAction"
    />

    <ImportExportDialog ref="importExportDialog" />
    <BackupDialog ref="backupDialog" />
    <ConfirmDialog ref="confirmDialog" />
    <CategoryCreateDialog
      :show="showCreateCategory"
      :categories="categoryOptions"
      :default-parent-id="createCategoryParentId"
      :saving="categorySaving"
      @close="showCreateCategory = false"
      @confirm="handleConfirmCreateCategory"
    />

    <TagOverviewDialog
      :show="showTagOverview"
      :tags="tagStats"
      :active-tags="activeTags"
      :bookmark-count="bookmarkCountWithTags"
      :match-count="tagMatchCount"
      @close="showTagOverview = false"
      @toggle="handleTagClick"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import NavBar from '../components/NavBar.vue'
import NavSearch from '../components/NavSearch.vue'
import NavCardGrid from '../components/NavCardGrid.vue'
import NavSettingsModal from '../components/NavSettingsModal.vue'
import NavBookmarkEditModal from '../components/NavBookmarkEditModal.vue'
import ImportExportDialog from '../components/ImportExportDialog.vue'
import BackupDialog from '../components/BackupDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import CategoryCreateDialog from '../components/CategoryCreateDialog.vue'
import TagOverviewDialog from '../components/TagOverviewDialog.vue'
import { useBookmarks } from '../composables/useBookmarks'
import { useSettings } from '../composables/useSettings'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import { useAuthGuard } from '../composables/useAuthGuard'
import { buildCategoryTree } from '../utils/categoryTree'
import { buildTagStats, countBookmarksWithTags, buildTagGroups, buildCategoryGroups, toggleTagSelection, pruneMissingTags } from '../utils/tagBrowse.js'

const { categories, bookmarks, fetchData, searchTags, updateBookmark, addBookmark, deleteBookmark, addCategory, allTags, getEmptyCategories, cleanupEmptyCategories, reorderItems } = useBookmarks()
const { isAuthenticated, logout } = useAuth()
const { customTitle, navWallpaper, showSearch, hideEmptyCategories, randomWallpaper, wallpaperApi, applyWallpaper, publicMode, footerContent } = useSettings()
const { success: toastSuccess, error: errorToast } = useToast()
const { requireAuth } = useAuthGuard()

// 非公开模式且未登录：用锁屏引导替代浏览区域
const needsLogin = computed(() => !publicMode.value && !isAuthenticated.value)

const emit = defineEmits(['toggleStyle'])

const activeMenu = ref(null)
const activeSubMenu = ref(null)
const animationKey = ref(0)
const navSearchRef = ref(null)
const navBarRef = ref(null)
const showDetailModal = ref(false)
const showNavSettings = ref(false)
const navBookmarkEditModalRef = ref(null)
const confirmDialog = ref(null)
const showCreateCategory = ref(false)
const createCategoryParentId = ref(null)
const categorySaving = ref(false)
const navSettingsRef = ref(null)
const importExportDialog = ref(null)
const backupDialog = ref(null)
const activeTags = ref([])
const showTagOverview = ref(false)
const searchResults = ref(null)
const dragReorderActive = ref(false)

const categoryOptions = computed(() => {
  if (!categories.value.length) return []
  const { flatList } = buildCategoryTree(categories.value)
  return flatList.map(cat => ({
    id: cat.id,
    displayName: cat.displayName
  }))
})

const backgroundStyle = computed(() => {
  const style = {}
  if (randomWallpaper.value) {
    return style
  }
  if (navWallpaper.value) {
    style.backgroundImage = `url(${navWallpaper.value})`
    style.backgroundSize = 'cover'
    style.backgroundPosition = 'center'
    style.backgroundRepeat = 'no-repeat'
    style.backgroundAttachment = 'fixed'
  } else {
    style.backgroundColor = 'var(--nav-bg)'
  }
  return style
})

// 每个分类的书签数（含所有子孙分类），菜单计数与空分类过滤共用
const categoryCountMap = computed(() => {
  const { tree } = buildCategoryTree(categories.value)
  const directCounts = new Map()
  for (const bookmark of bookmarks.value) {
    if (bookmark.category_id == null) continue
    const key = Number(bookmark.category_id)
    directCounts.set(key, (directCounts.get(key) || 0) + 1)
  }

  const counts = {}
  const walk = (nodes) => nodes.reduce((sum, node) => {
    const total = (directCounts.get(Number(node.id)) || 0) + walk(node.children || [])
    counts[node.id] = total
    return sum + total
  }, 0)
  walk(tree)
  return counts
})

const menuTree = computed(() => {
  const { tree } = buildCategoryTree(categories.value)
  if (!hideEmptyCategories.value) return tree

  const currentId = activeSubMenu.value?.id ?? activeMenu.value?.id
  const prune = (nodes) => nodes.reduce((acc, node) => {
    const children = prune(node.children || [])
    const count = categoryCountMap.value[node.id] ?? 0
    // 整棵子树都没有书签的分类隐藏；当前正在浏览的分类及其祖先保留，避免入口消失
    if (count > 0 || node.id === currentId || children.length > 0) {
      acc.push({ ...node, children })
    }
    return acc
  }, [])
  return prune(tree)
})

// 从根到当前选中项的分类路径，用于逐级递减高亮祖先
const activePath = computed(() => {
  // 标签/搜索视图期间不高亮任何分类（activeMenu/activeSubMenu 仅用于清除筛选后恢复）
  if (tagFilterActive.value || searchResults.value) return []
  const targetId = activeSubMenu.value?.id ?? activeMenu.value?.id
  if (!targetId) return []
  const search = (nodes, trail) => {
    for (const node of nodes) {
      const next = [...trail, node.id]
      if (node.id === targetId) return next
      if (node.children?.length) {
        const found = search(node.children, next)
        if (found) return found
      }
    }
    return null
  }
  return search(menuTree.value, []) || [targetId]
})

const allBookmarks = computed(() => bookmarks.value)

const tagStats = computed(() => buildTagStats(bookmarks.value))
const topTags = computed(() => tagStats.value.slice(0, 10))
const tagCountMap = computed(() => new Map(
  tagStats.value.map(tag => [tag.name.toLowerCase(), tag.count])
))
const getTagCount = (name) => tagCountMap.value.get(String(name).toLowerCase()) ?? 0
const bookmarkCountWithTags = computed(() => countBookmarksWithTags(bookmarks.value))
const tagFilterActive = computed(() => activeTags.value.length > 0)

const isTagActive = (name) =>
  activeTags.value.some(tag => tag.toLowerCase() === String(name).toLowerCase())

// 卡片标签可能是任意大小写写法，展示时统一用首次出现的规范写法
const activeTagLabels = computed(() => {
  const canonical = new Map(tagStats.value.map(tag => [tag.name.toLowerCase(), tag.name]))
  return activeTags.value.map(name => canonical.get(name.toLowerCase()) ?? name)
})

// 标签结果优先；搜索结果其次；否则按当前分类
const tagGroups = computed(() =>
  tagFilterActive.value
    ? buildTagGroups(bookmarks.value, categories.value, activeTags.value)
    : null
)

const tagMatchCount = computed(() =>
  tagGroups.value
    ? tagGroups.value.reduce((sum, group) => sum + group.bookmarks.length, 0)
    : 0
)

const tagCategoryCount = computed(() =>
  tagGroups.value
    ? tagGroups.value.filter(group => group.categoryId !== null).length
    : 0
)

// 搜索结果按分类分组（与标签视图共用渲染）
const searchGroups = computed(() =>
  searchResults.value ? buildCategoryGroups(searchResults.value, categories.value) : null
)

const searchMatchCount = computed(() => searchResults.value?.length ?? 0)
const searchCategoryCount = computed(() => searchGroups.value?.length ?? 0)
const searchQueryText = ref('')

// 标签结果优先，其次搜索结果
const resultGroups = computed(() => tagGroups.value || searchGroups.value)

const getCategoryCount = (categoryId) => {
  return bookmarks.value.filter(b => b.category_id === categoryId).length
}

const currentBookmarks = computed(() => {
  if (tagGroups.value) {
    return tagGroups.value.flatMap(group => group.bookmarks)
  }

  if (searchResults.value) {
    return searchResults.value
  }

  if (!activeMenu.value) {
    return []
  }

  const categoryId = activeSubMenu.value?.id || activeMenu.value.id

  return bookmarks.value
    .filter(b => b.category_id === categoryId)
    .sort((a, b) => a.position - b.position)
})

const gridEmptyText = computed(() => {
  if (searchResults.value) {
    return searchQueryText.value
      ? `没有找到匹配“${searchQueryText.value}”的书签`
      : '没有找到匹配的书签'
  }
  if (!tagFilterActive.value) return '该分类下暂无书签'
  const names = activeTagLabels.value
  return names.length === 1
    ? `没有带“${names[0]}”标签的书签`
    : `没有同时带「${names.join('、')}」标签的书签`
})

// 仅已登录 + 浏览某分类 + 非搜索结果 + 非标签筛选时允许排序
const canReorder = computed(() => {
  return isAuthenticated.value && !searchResults.value && !tagFilterActive.value && !!activeMenu.value
})

// A3：登录后、分类浏览时在网格末尾显示「新增书签」卡片
const showAddBookmarkCard = computed(() => {
  if (!isAuthenticated.value) return false
  if (searchResults.value || tagFilterActive.value) return false
  return !!(activeSubMenu.value || activeMenu.value)
})

const addBookmarkCardHint = computed(() =>
  currentBookmarks.value.length === 0 ? '该分类下暂无书签' : ''
)

// 卡片序号：只在纯分类浏览时显示，搜索/标签结果不编号
const showCardIndex = computed(() =>
  !searchResults.value && !tagFilterActive.value
)

// 拖拽期间隐藏固定顶部菜单，露出最顶部卡片
const onNavDragStart = () => {
  dragReorderActive.value = true
}

const onNavDragEnd = () => {
  dragReorderActive.value = false
}

const handleToggleStyle = () => {
  emit('toggleStyle')
}

const handleOpenSettings = () => {
  showNavSettings.value = true
}

onMounted(() => {
  // App.vue 首屏已统一 fetchData，这里不再重复请求，避免 /api/categories、/api/bookmarks 各发两次
  if (menuTree.value.length > 0) {
    activeMenu.value = menuTree.value[0]
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      fetchData({ forceRefresh: true, background: true })
    }
  }
  document.addEventListener('visibilitychange', onVisible)
  onUnmounted(() => document.removeEventListener('visibilitychange', onVisible))
})

watch(menuTree, (newMenus) => {
  if (newMenus.length > 0 && !activeMenu.value) {
    activeMenu.value = newMenus[0]
  }
})

const clearSearchResults = () => {
  searchResults.value = null
  searchQueryText.value = ''
  activeTags.value = []
}

const clearSearchFromSummary = () => {
  navSearchRef.value?.clearSearch()
}

const handleSelectMenu = (menu) => {
  clearSearchResults()
  activeMenu.value = menu
  activeSubMenu.value = null
  animationKey.value++
}

const handleSelectSubMenu = (menu, sub) => {
  clearSearchResults()
  activeMenu.value = menu
  activeSubMenu.value = sub
  animationKey.value++
}

const handleSearchResults = (results, query = '') => {
  searchResults.value = results
  searchQueryText.value = query
  activeTags.value = []
  animationKey.value++
}

const handleTagClick = (name) => {
  // 顺序不可调换：clearSearch() 会同步 emit('clear-results') → clearSearchResults() 清空 activeTags。
  // 必须先基于当前选择算出 next，再清搜索框，否则累加会被抹掉。
  const next = toggleTagSelection(activeTags.value, name)
  navSearchRef.value?.clearSearch()
  activeTags.value = next
  searchResults.value = null
  animationKey.value++
}

const removeTag = (name) => {
  activeTags.value = toggleTagSelection(activeTags.value, name)
  animationKey.value++
}

const clearTagFilter = () => {
  activeTags.value = []
  animationKey.value++
}

const findCategoryInMenu = (id, nodes, root = null, trail = []) => {
  for (const node of nodes) {
    const currentRoot = root ?? node
    const nextTrail = [...trail, node]
    if (node.id === id) return { root: currentRoot, node, trail: nextTrail }
    if (node.children?.length) {
      const found = findCategoryInMenu(id, node.children, currentRoot, nextTrail)
      if (found) return found
    }
  }
  return null
}

const handleGroupClick = (group) => {
  if (group?.categoryId == null) return
  const found = findCategoryInMenu(group.categoryId, menuTree.value)
  if (!found) return
  activeTags.value = []
  activeMenu.value = found.root
  activeSubMenu.value = found.root === found.node ? null : found.node
  clearSearchResults()
  animationKey.value++
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 标签在当前数据中消失（他端删除）时自动移除该标签，其余选择保留
watch(tagStats, (list) => {
  if (!activeTags.value.length) return
  const next = pruneMissingTags(activeTags.value, list)
  if (next.length !== activeTags.value.length) {
    activeTags.value = next
    animationKey.value++
  }
})

const handleShowDetail = ({ tag, bookmark }) => {
  if (!requireAuth()) return
  if (navBookmarkEditModalRef.value) {
    navBookmarkEditModalRef.value.open(bookmark)
  }
  showDetailModal.value = true
}

// A3：网格末尾新增卡 → 打开新增弹窗并预填当前分类
const openAddBookmark = () => {
  if (!requireAuth()) return
  const categoryId = activeSubMenu.value?.id ?? activeMenu.value?.id ?? ''
  navBookmarkEditModalRef.value?.open(null, { categoryId })
  showDetailModal.value = true
}

const handleSaveBookmark = async (bookmark, formData) => {
  if (!requireAuth()) return

  // 新增模式：没有 id，走 addBookmark
  if (!bookmark?.id) {
    const result = await addBookmark(formData)
    if (!result.success) {
      errorToast(result.error || '添加失败')
      return
    }
    showDetailModal.value = false

    const targetId = formData.category_id === '' || formData.category_id == null
      ? null
      : Number(formData.category_id)
    const currentId = activeSubMenu.value?.id ?? activeMenu.value?.id ?? null
    const movedAway = targetId !== null && currentId !== null && targetId !== Number(currentId)
    if (movedAway) {
      const targetName = categoryOptions.value.find(c => c.id === targetId)?.displayName
      toastSuccess(targetName ? `已添加到「${targetName}」` : '书签已添加')
    } else {
      toastSuccess('书签已添加')
    }
    return
  }

  const originalBookmark = { ...bookmark }

  try {
    bookmarks.value = bookmarks.value.map(b => {
      if (b.id === bookmark.id) {
        return { ...b, ...formData }
      }
      return b
    })

    const result = await updateBookmark(bookmark.id, formData)

    if (!result.success) {
      bookmarks.value = bookmarks.value.map(b => {
        if (b.id === originalBookmark.id) return originalBookmark
        return b
      })
      if (result.error) errorToast(result.error)
      return
    }

    showDetailModal.value = false
  } catch (error) {
    bookmarks.value = bookmarks.value.map(b => {
      if (b.id === originalBookmark.id) return originalBookmark
      return b
    })
    errorToast('保存失败，请重试')
  }
}

const handleDeleteBookmark = async (bookmark) => {
  if (!requireAuth()) return
  const confirmed = await confirmDialog.value.open(
    `确定要删除书签"${bookmark.name}"吗？`,
    '删除书签'
  )
  if (!confirmed) return
  const result = await deleteBookmark(bookmark.id)
  if (result.success) {
    showDetailModal.value = false
    toastSuccess('书签已删除')
  } else {
    errorToast(result.error || '删除失败')
  }
}

const handleReorder = async (items) => {
  if (!items || !items.length) return
  if (!canReorder.value) return

  const originalPositions = {}
  items.forEach(item => {
    const b = bookmarks.value.find(b => b.id === item.id)
    if (b) originalPositions[item.id] = b.position
  })

  bookmarks.value = bookmarks.value.map(b => {
    const item = items.find(i => i.id === b.id)
    if (item) return { ...b, position: item.position }
    return b
  })

  const result = await reorderItems('bookmarks', items)
  if (!result.success) {
    bookmarks.value = bookmarks.value.map(b => {
      if (originalPositions[b.id] !== undefined) return { ...b, position: originalPositions[b.id] }
      return b
    })
    errorToast(result.error || '排序保存失败')
  }
}

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
    errorToast(result.error || '菜单排序保存失败')
  }
}

const handleCreateCategory = (parentId = null) => {
  if (!isAuthenticated.value) return
  createCategoryParentId.value = parentId
  showCreateCategory.value = true
}

const handleConfirmCreateCategory = async ({ name, parentId }) => {
  categorySaving.value = true
  try {
    const result = await addCategory(name, parentId)
    if (result.success) {
      showCreateCategory.value = false
      toastSuccess('分类已创建')
    } else {
      errorToast(result.error || '创建失败')
    }
  } finally {
    categorySaving.value = false
  }
}

const handleSettingsAction = async (action) => {
  switch (action) {
    case 'importExport':
      importExportDialog.value?.open()
      break
    case 'backup':
      backupDialog.value?.open()
      break
    case 'cleanupEmptyCategories':
      await handleCleanupEmptyCategories()
      break
  }
}

const handleCleanupEmptyCategories = async () => {
  const result = await getEmptyCategories()
  if (!result.success) {
    errorToast(result.error || '获取空分类失败')
    return
  }

  if (result.count === 0) {
    errorToast('当前没有空分类需要清理')
    return
  }

  const categoryNames = result.emptyCategories.map(cat => `"${cat.name}"`).join('、')
  const message = result.count === 1
    ? `确定要删除空分类 ${categoryNames} 吗？`
    : `确定要删除以下 ${result.count} 个空分类吗？\n\n${categoryNames}\n\n此操作不可恢复！`

  const confirmed = await confirmDialog.value.open(message, '清理空分类')
  if (!confirmed) return

  const cleanupResult = await cleanupEmptyCategories()
  if (!cleanupResult.success) {
    errorToast(cleanupResult.error || '清理空分类失败')
    return
  }

  if (cleanupResult.deletedCount === 0) {
    errorToast('没有空分类需要清理')
    return
  }

  toastSuccess(`已成功清理 ${cleanupResult.deletedCount} 个空分类`)
  navSettingsRef.value?.refreshEmptyCategoryCount()
}

const handleLogout = async () => {
  showNavSettings.value = false
  navBarRef.value?.closeUserMenu()

  const confirmed = await confirmDialog.value.open('确定要退出登录吗？', '退出登录')
  if (!confirmed) return

  logout()
  activeMenu.value = null
  activeSubMenu.value = null
  searchResults.value = null
  activeTags.value = []

  await fetchData({ forceRefresh: true })
  if (menuTree.value.length > 0) {
    activeMenu.value = menuTree.value[0]
  }
  animationKey.value++
}
</script>

<style scoped>
.nav-item-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  background-color: transparent;
}

.nav-item-view ::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}

.nav-item-view ::-webkit-scrollbar-track {
  background: transparent;
}

.nav-item-view ::-webkit-scrollbar-thumb {
  background: var(--nav-border);
  border-radius: 3px;
}

.nav-item-view ::-webkit-scrollbar-thumb:hover {
  background: var(--nav-border);
}

.search-section {
  padding: calc(var(--nav-bar-height, 56px) + 1rem) 10% 0.5rem;
  position: relative;
  z-index: 2;
  background: transparent;
}

/* 搜索结果摘要栏 */
.search-summary-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 0.45rem 10% 0;
  color: var(--nav-text-secondary);
  font-size: 0.8rem;
  position: relative;
  z-index: 2;
}

.search-summary-text strong {
  color: var(--nav-primary);
  font-variant-numeric: tabular-nums;
}

.search-summary-clear {
  padding: 2px 10px;
  border: 1px solid var(--nav-border);
  border-radius: 999px;
  background: transparent;
  color: var(--nav-text-secondary);
  font-size: 0.75rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}

.search-summary-clear:hover {
  color: var(--nav-primary);
  border-color: var(--nav-primary);
  background: color-mix(in srgb, var(--nav-primary) 10%, transparent);
}

/* 非公开模式未登录：锁屏引导 */
.nav-login-guide {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: calc(var(--nav-bar-height, 56px) + 3rem) 1rem 4rem;
  text-align: center;
  color: var(--nav-text-secondary);
}

.nav-login-guide > svg {
  width: 52px;
  height: 52px;
  opacity: 0.45;
}

.nav-login-title {
  margin: 0.5rem 0 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--nav-text);
}

.nav-login-hint {
  margin: 0;
  font-size: 0.875rem;
}

.nav-login-btn {
  margin-top: 0.75rem;
  padding: 0.5rem 1.4rem;
  border: none;
  border-radius: 10px;
  background: var(--nav-primary);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-login-btn:hover {
  filter: brightness(1.06);
  transform: translateY(-1px);
}

/* nav 页脚 */
.nav-footer {
  margin-top: auto;
  padding: 1.5rem 10%;
  background: var(--nav-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--nav-border);
  position: relative;
  z-index: 1;
}

.nav-footer-content {
  max-width: 1400px;
  margin: 0 auto;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--nav-text-secondary);
  text-align: center;
}

.nav-footer-content :deep(a) {
  color: var(--nav-primary);
  text-decoration: none;
  transition: opacity 0.2s ease;
}

.nav-footer-content :deep(a:hover) {
  opacity: 0.8;
}

/* 拖拽排序期间：隐藏固定顶部菜单，内容上移露出最顶部卡片 */
.nav-item-view.drag-reordering :deep(.nav-bar) {
  transform: translateY(-100%);
  opacity: 0;
  pointer-events: none;
}

.nav-item-view :deep(.nav-bar) {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.nav-item-view.drag-reordering .search-section {
  padding-top: 1rem;
}

.tag-filter-sticky {
  position: relative;
  z-index: 2;
}

/* 仅在有标签筛选时吸顶，普通浏览不占常驻空间 */
.tag-filter-sticky.is-pinned {
  position: sticky;
  top: var(--nav-bar-height, 56px);
  z-index: 60;
  background: var(--nav-glass);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border-bottom: 1px solid var(--nav-border);
  box-shadow: 0 8px 18px -16px rgba(0, 0, 0, 0.35);
  padding-bottom: 6px;
}

.tag-filter-sticky.is-pinned .tag-filter-bar {
  margin-bottom: 0;
}

.category-tabs {
  display: flex;
  justify-content: center;
  gap: 5px;
  padding: 8px 10% 4px;
  flex-wrap: wrap;
  position: relative;
  z-index: 2;
}

.cat-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  color: var(--nav-text-secondary);
  font-size: 0.68rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: inherit;
  white-space: nowrap;
}

.cat-tab:hover {
  background: var(--nav-card-hover);
  color: var(--nav-text);
}

.cat-tab.active {
  background: color-mix(in srgb, var(--nav-primary) 15%, transparent);
  border-color: color-mix(in srgb, var(--nav-primary) 30%, transparent);
  color: var(--nav-primary);
}

.cat-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--nav-border);
  font-size: 0.55rem;
  font-weight: 600;
  color: var(--nav-text-secondary);
  line-height: 1;
}

.cat-tab.active .cat-count {
  background: color-mix(in srgb, var(--nav-primary) 20%, transparent);
  color: var(--nav-primary);
}

.cat-tab.tag-all {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--nav-primary) 35%, transparent);
  color: var(--nav-primary);
}

.tag-filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  row-gap: 6px;
  gap: 8px;
  margin: 0 10% 10px;
  padding: 6px 10px;
  border: 1px solid var(--nav-border);
  border-radius: 8px;
  background: var(--nav-card-bg);
  font-size: 0.72rem;
  color: var(--nav-text-secondary);
  position: relative;
  z-index: 2;
}

.tag-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow-wrap: anywhere;
  padding: 2px 8px;
  border: 1px solid color-mix(in srgb, var(--nav-primary) 30%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
  color: var(--nav-primary);
  font-weight: 600;
}

.tag-filter-count {
  font-size: 0.6rem;
  padding: 0 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--nav-primary) 18%, transparent);
}

.tag-filter-remove {
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1;
  padding: 0;
}

.tag-filter-meta {
  flex: 1;
  min-width: 0;
}

.tag-filter-clear {
  border: 0;
  background: none;
  color: var(--nav-text-secondary);
  font-size: 0.7rem;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.tag-filter-clear:hover {
  color: var(--nav-primary);
}

.content-section {
  flex: 1;
  padding: 0 10% 2rem;
  position: relative;
  z-index: 2;
  width: 100%;
  background: transparent;
  min-height: calc(100vh - 180px);
}

@media (max-width: 778px) {
  .category-tabs {
    padding: 8px 16px 4px;
  }
  .tag-filter-bar {
    margin-left: 16px;
    margin-right: 16px;
  }
  .content-section {
    padding: 0 16px 2rem;
  }
}

@media (max-width: 640px) {
  .tag-filter-sticky.is-pinned .category-tabs {
    flex-wrap: nowrap;
    justify-content: flex-start;
    overflow-x: auto;
    padding-right: 16px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .tag-filter-sticky.is-pinned .category-tabs::-webkit-scrollbar {
    display: none;
  }
}

/* Detail Modal */
.detail-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--nav-glass);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 10vh 10vw;
}

.detail-modal {
  background: var(--nav-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 20px;
  width: 100%;
  max-width: 420px;
  border: 1px solid var(--nav-border);
  box-shadow:
    0 0 0 1px var(--nav-border),
    0 40px 120px -20px var(--shadow-xl);
  overflow: hidden;
  position: relative;
}

.detail-modal::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 20px;
  background: linear-gradient(145deg, rgba(57, 157, 255, 0.03) 0%, rgba(99, 102, 241, 0.02) 30%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}

.detail-modal > * {
  position: relative;
  z-index: 1;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  border-bottom: 1px solid var(--nav-border);
}

.detail-icon {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  flex-shrink: 0;
  overflow: hidden;
}

.detail-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.detail-icon .letter-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  font-weight: 700;
  font-size: 1.25rem;
}

.detail-title-wrap {
  flex: 1;
  min-width: 0;
}

.detail-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--nav-text);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-url {
  font-size: 0.8125rem;
  color: var(--nav-text-secondary);
  font-family: 'SF Mono', Monaco, monospace;
}

.detail-close {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  color: var(--nav-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.detail-close:hover {
  background: color-mix(in srgb, var(--error) 20%, transparent);
  border-color: color-mix(in srgb, var(--error) 40%, transparent);
  color: var(--error);
  transform: rotate(90deg);
}

.detail-close svg {
  width: 18px;
  height: 18px;
}

.detail-body {
  padding: 20px 24px;
}

.detail-section {
  margin-bottom: 16px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section-title {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--nav-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 10px;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-tag {
  padding: 6px 14px;
  background: color-mix(in srgb, var(--nav-primary) 15%, transparent);
  color: var(--nav-primary);
  border: 1px solid color-mix(in srgb, var(--nav-primary) 30%, transparent);
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.detail-tag:hover {
  background: color-mix(in srgb, var(--nav-primary) 25%, transparent);
  border-color: color-mix(in srgb, var(--nav-primary) 50%, transparent);
  transform: translateY(-1px);
}

.detail-tag.active {
  background: color-mix(in srgb, var(--nav-primary) 35%, transparent);
  border-color: var(--nav-primary);
}

.detail-description {
  font-size: 0.875rem;
  color: var(--nav-text-secondary);
  line-height: 1.6;
  padding: 14px;
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  border-radius: 10px;
}

.detail-notes {
  font-size: 0.875rem;
  color: var(--nav-text-secondary);
  line-height: 1.6;
  padding: 14px;
  background: color-mix(in srgb, var(--primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary) 20%, transparent);
  border-radius: 10px;
  font-style: italic;
}

.detail-category {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--nav-text-secondary);
  padding: 10px 14px;
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  border-radius: 10px;
}

.detail-category svg {
  width: 16px;
  height: 16px;
  color: var(--nav-primary);
}

.detail-private {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  color: var(--warning);
  padding: 10px 14px;
  background: color-mix(in srgb, var(--warning) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 25%, transparent);
  border-radius: 10px;
}

.detail-private svg {
  width: 16px;
  height: 16px;
}

.detail-input {
  width: 100%;
  padding: 10px 14px;
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  border-radius: 8px;
  color: var(--nav-text);
  font-size: 0.875rem;
  transition: all 0.2s;
  outline: none;
}

.detail-input:focus {
  border-color: color-mix(in srgb, var(--nav-primary) 50%, transparent);
  background: var(--nav-card-hover);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.detail-input::placeholder {
  color: var(--nav-text-secondary);
}

.detail-textarea {
  width: 100%;
  padding: 10px 14px;
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  border-radius: 8px;
  color: var(--nav-text);
  font-size: 0.875rem;
  transition: all 0.2s;
  outline: none;
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  line-height: 1.5;
}

.detail-textarea:focus {
  border-color: color-mix(in srgb, var(--nav-primary) 50%, transparent);
  background: var(--nav-card-hover);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.detail-textarea::placeholder {
  color: var(--nav-text-secondary);
}

.detail-checkbox {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.detail-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  margin-right: 10px;
  accent-color: #399dff;
  cursor: pointer;
}

.detail-checkbox .checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--nav-text-secondary);
}

.detail-checkbox .checkbox-label svg {
  width: 16px;
  height: 16px;
}

.detail-footer {
  display: flex;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid var(--nav-border);
}

.detail-btn {
  flex: 1;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.detail-btn.primary {
  background: linear-gradient(135deg, var(--nav-primary), var(--primary-dark));
  color: white;
  box-shadow: 0 4px 16px color-mix(in srgb, var(--nav-primary) 35%, transparent);
}

.detail-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--nav-primary) 45%, transparent);
}

.detail-btn.secondary {
  background: var(--nav-card-bg);
  color: var(--nav-text);
  border: 1px solid var(--nav-border);
}

.detail-btn.secondary:hover {
  background: var(--nav-card-hover);
  border-color: var(--nav-text-secondary);
}

.detail-btn svg {
  width: 18px;
  height: 18px;
}

.detail-select {
  width: 100%;
  padding: 10px 14px;
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  border-radius: 8px;
  color: var(--nav-text);
  font-size: 0.875rem;
  transition: all 0.2s;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.detail-select:focus {
  border-color: color-mix(in srgb, var(--nav-primary) 50%, transparent);
  background-color: var(--nav-card-hover);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.detail-select option {
  background: var(--nav-bg);
  color: var(--nav-text);
  padding: 10px;
}

.custom-select {
  position: relative;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.select-trigger:hover {
  border-color: var(--nav-text-secondary);
}

.custom-select.open .select-trigger {
  border-color: color-mix(in srgb, var(--nav-primary) 50%, transparent);
  background: var(--nav-card-hover);
}

.select-value {
  color: var(--nav-text);
  font-size: 0.875rem;
}

.select-value.placeholder {
  color: var(--nav-text-secondary);
}

.select-arrow {
  width: 16px;
  height: 16px;
  color: var(--nav-text-secondary);
  transition: transform 0.2s;
}

.custom-select.open .select-arrow {
  transform: rotate(180deg);
}

.select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--nav-bg);
  border: 1px solid var(--nav-border);
  border-radius: 10px;
  box-shadow: 0 10px 40px var(--shadow-lg);
  z-index: 100;
  overflow: hidden;
}

.select-search {
  width: 100%;
  padding: 12px 14px;
  background: var(--nav-card-bg);
  border: none;
  border-bottom: 1px solid var(--nav-border);
  color: var(--nav-text);
  font-size: 0.875rem;
  outline: none;
}

.select-search::placeholder {
  color: var(--nav-text-secondary);
}

.select-options {
  max-height: 240px;
  overflow-y: auto;
}

.select-option {
  padding: 10px 14px;
  color: var(--nav-text);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
}

.select-option:hover {
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
  color: var(--nav-text);
}

.select-option.selected {
  background: color-mix(in srgb, var(--nav-primary) 22%, transparent);
  color: var(--nav-primary);
}

.select-no-results {
  padding: 20px;
  text-align: center;
  color: var(--nav-text-secondary);
  font-size: 0.875rem;
}

.select-options::-webkit-scrollbar {
  width: 6px;
}

.select-options::-webkit-scrollbar-track {
  background: transparent;
}

.select-options::-webkit-scrollbar-thumb {
  background: var(--nav-border);
  border-radius: 3px;
}

.tags-input-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  border-radius: 8px;
  min-height: 44px;
  align-items: center;
  transition: all 0.2s;
}

.tags-input-container:focus-within {
  border-color: color-mix(in srgb, var(--nav-primary) 50%, transparent);
  background: var(--nav-card-hover);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: color-mix(in srgb, var(--nav-primary) 18%, transparent);
  color: var(--nav-primary);
  border: 1px solid color-mix(in srgb, var(--nav-primary) 35%, transparent);
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: all 0.2s;
}

.tag-item:hover {
  background: color-mix(in srgb, var(--nav-primary) 28%, transparent);
  border-color: color-mix(in srgb, var(--nav-primary) 55%, transparent);
}

.tag-item.editing {
  background: color-mix(in srgb, var(--nav-primary) 35%, transparent);
  border-color: var(--nav-primary);
}

.tag-edit-input {
  background: transparent;
  border: none;
  color: var(--nav-text);
  font-size: 0.8125rem;
  outline: none;
  width: 80px;
  padding: 0;
}

.tag-remove {
  background: none;
  border: none;
  color: color-mix(in srgb, var(--nav-primary) 65%, transparent);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
  transition: color 0.2s;
}

.tag-remove:hover {
  color: var(--error);
}

.tag-input {
  flex: 1;
  min-width: 120px;
  background: transparent;
  border: none;
  color: var(--nav-text);
  font-size: 0.875rem;
  outline: none;
  padding: 4px 0;
}

.tag-input::placeholder {
  color: var(--nav-text-secondary);
}

/* Modal Animation */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .detail-modal,
.modal-leave-to .detail-modal {
  transform: scale(0.95) translateY(20px);
}
</style>