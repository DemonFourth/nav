<template>
  <div class="nav-item-view" :style="backgroundStyle">
    <NavBar 
      :menus="menuTree"
      :active-menu="activeMenu"
      :active-sub-menu="activeSubMenu"
      :custom-title="customTitle"
      @select-menu="handleSelectMenu"
      @select-submenu="handleSelectSubMenu"
      @toggle-style="handleToggleStyle"
      @open-settings="handleOpenSettings"
      @logout="handleLogout"
      ref="navBarRef"
    />

    <div class="search-section">
      <NavSearch 
        v-show="showSearch"
        ref="navSearchRef"
        :bookmarks="allBookmarks"
        @search-results="handleSearchResults"
        @clear-results="clearSearchResults"
      />
    </div>

    <div class="category-tabs">
      <button
        v-for="tag in topTags"
        :key="tag"
        class="cat-tab"
        :class="{ active: selectedFilterTag === tag }"
        @click="handleTagTabClick(tag)"
      >
        {{ tag }}
        <span class="cat-count">{{ getTagCount(tag) }}</span>
      </button>
    </div>

    <div class="content-section">
      <NavCardGrid 
        :key="animationKey" 
        :bookmarks="currentBookmarks"
        :isAuthenticated="isAuthenticated"
        @tag-click="handleTagClick"
        @show-detail="handleShowDetail"
      />
    </div>

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
      @close="showNavSettings = false"
      @action="handleSettingsAction"
    />

    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import NavBar from '../components/NavBar.vue'
import NavSearch from '../components/NavSearch.vue'
import NavCardGrid from '../components/NavCardGrid.vue'
import NavSettingsModal from '../components/NavSettingsModal.vue'
import NavBookmarkEditModal from '../components/NavBookmarkEditModal.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useBookmarks } from '../composables/useBookmarks'
import { useSettings } from '../composables/useSettings'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import { useAuthGuard } from '../composables/useAuthGuard'
import { buildCategoryTree } from '../utils/categoryTree'

const { categories, bookmarks, fetchData, searchTags, updateBookmark, deleteBookmark, allTags } = useBookmarks()
const { isAuthenticated, logout } = useAuth()
const { customTitle, navWallpaper, showSearch, randomWallpaper, wallpaperApi, applyWallpaper } = useSettings()
const { success: toastSuccess, error: errorToast } = useToast()
const { requireAuth } = useAuthGuard()

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
const selectedFilterTag = ref(null)
const searchResults = ref(null)

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

const menuTree = computed(() => {
  const { tree } = buildCategoryTree(categories.value)
  return tree
})

const allBookmarks = computed(() => bookmarks.value)

const topTags = computed(() => {
  const tagCount = {}
  bookmarks.value.forEach(b => {
    if (!b.tags) return
    b.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => {
      tagCount[t] = (tagCount[t] || 0) + 1
    })
  })
  return Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag)
})

const getTagCount = (tag) => {
  return bookmarks.value.filter(b => b.tags && b.tags.split(',').map(t => t.trim()).includes(tag)).length
}

const handleTagTabClick = (tag) => {
  if (navSearchRef.value && navSearchRef.value.openSearchWithTags) {
    try {
      navSearchRef.value.openSearchWithTags([tag])
    } catch (e) {
      console.warn('Tag search failed:', e)
    }
  }
}

const getCategoryCount = (categoryId) => {
  return bookmarks.value.filter(b => b.category_id === categoryId).length
}

const currentBookmarks = computed(() => {
  if (searchResults.value) {
    return searchResults.value
  }

  if (!activeMenu.value) {
    return []
  }

  const categoryId = activeSubMenu.value?.id || activeMenu.value.id
  
  let result = bookmarks.value
    .filter(b => b.category_id === categoryId)
    .sort((a, b) => a.position - b.position)

  if (selectedFilterTag.value) {
    result = result.filter(b => {
      if (!b.tags) return false
      const tags = b.tags.split(',').map(t => t.trim())
      return tags.includes(selectedFilterTag.value)
    })
  }

  return result
})

const handleToggleStyle = () => {
  emit('toggleStyle')
}

const handleOpenSettings = () => {
  showNavSettings.value = true
}

onMounted(async () => {
  await fetchData()
  
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
}

const handleSelectMenu = (menu) => {
  clearSearchResults()
  activeMenu.value = menu
  activeSubMenu.value = null
  selectedFilterTag.value = null
  animationKey.value++
}

const handleSelectSubMenu = (menu, sub) => {
  clearSearchResults()
  activeMenu.value = menu
  activeSubMenu.value = sub
  selectedFilterTag.value = null
  animationKey.value++
}

const handleSearchResults = (results) => {
  searchResults.value = results
  animationKey.value++
}

const handleTagClick = (tag) => {
  if (navSearchRef.value && navSearchRef.value.openSearchWithTags) {
    try {
      navSearchRef.value.openSearchWithTags([tag])
    } catch (e) {
      console.warn('Tag search failed:', e)
    }
  }
}

const handleShowDetail = ({ tag, bookmark }) => {
  if (!requireAuth()) return
  if (navBookmarkEditModalRef.value) {
    navBookmarkEditModalRef.value.open(bookmark)
  }
  showDetailModal.value = true
}

const handleSaveBookmark = async (bookmark, formData) => {
  if (!bookmark?.id) return
  if (!requireAuth()) return

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

const handleSettingsAction = (action) => {
  showNavSettings.value = false
  navBarRef.value?.closeUserMenu()
}

const handleLogout = () => {
  showNavSettings.value = false
  navBarRef.value?.closeUserMenu()
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
  padding: 8.5rem 1rem 0.5rem;
  position: relative;
  z-index: 2;
  background: transparent;
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

.content-section {
  flex: 1;
  padding: 0 1rem 2rem;
  position: relative;
  z-index: 2;
  width: 100%;
  background: transparent;
  min-height: calc(100vh - 180px);
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