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

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDetailModal" class="detail-modal-overlay" @click="closeDetailModal">
          <div class="detail-modal" @click.stop>
            <div class="detail-header">
              <div class="detail-icon">
                <img 
                  v-if="!detailIconError && getDetailIconUrl(detailData.bookmark)" 
                  :src="getDetailIconUrl(detailData.bookmark)" 
                  :alt="detailData.bookmark?.name" 
                  :key="detailData.bookmark?.id + '-' + (detailIconSourceIndexes[detailData.bookmark?.id] || 0)"
                  @error="handleDetailIconError" 
                />
                <div v-else class="letter-icon">{{ detailData.bookmark?.name?.charAt(0) || '?' }}</div>
              </div>
              <div class="detail-title-wrap">
                <div class="detail-title">{{ detailData.bookmark?.name }}</div>
                <div class="detail-url">{{ getDisplayUrl(detailData.bookmark?.url) }}</div>
              </div>
              <button class="detail-close" @click="closeDetailModal">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div class="detail-body">
              <div class="detail-section">
                <div class="detail-section-title">分类</div>
                <div class="custom-select" :class="{ open: selectOpen }">
                  <div class="select-trigger" @click="selectOpen = !selectOpen">
                    <span class="select-value">{{ selectedCategoryName || '请选择分类' }}</span>
                    <svg class="select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </div>
                  <div v-if="selectOpen" class="select-dropdown">
                    <input 
                      v-model="selectSearch"
                      type="text"
                      class="select-search"
                      placeholder="搜索分类..."
                      @click.stop
                      ref="selectSearchInput"
                    />
                    <div class="select-options">
                      <div 
                        v-for="cat in filteredCategoryOptions" 
                        :key="cat.id"
                        class="select-option"
                        :class="{ selected: cat.id === editForm.category_id }"
                        @click="selectCategory(cat)"
                      >
                        {{ cat.displayName }}
                      </div>
                      <div v-if="filteredCategoryOptions.length === 0" class="select-no-results">
                        未找到分类
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="detail-section">
                <div class="detail-section-title">描述</div>
                <input v-model="editForm.description" type="text" class="detail-input" placeholder="添加描述" />
              </div>
              
              <div class="detail-section">
                <div class="detail-section-title">标签</div>
                <div class="tags-input-container">
                  <div class="tags-list">
                    <span 
                      v-for="(tag, index) in tagItems" 
                      :key="index"
                      class="tag-item"
                      :class="{ editing: editingTagIndex === index }"
                      @dblclick="startEditTag(index)"
                    >
                      <input 
                        v-if="editingTagIndex === index"
                        v-model="tagItems[index]"
                        type="text"
                        class="tag-edit-input"
                        @keydown.enter="finishEditTag"
                        @keydown.backspace="handleTagBackspace(index)"
                        @blur="finishEditTag"
                        ref="tagEditInput"
                      />
                      <span v-else>{{ tag }}</span>
                      <button v-if="editingTagIndex !== index" class="tag-remove" @click="removeTag(index)">×</button>
                    </span>
                  </div>
                  <input 
                    v-model="newTagInput"
                    type="text"
                    class="tag-input"
                    placeholder="输入标签后回车添加"
                    @keydown.enter.prevent="addTag"
                    @keydown.backspace="handleInputBackspace"
                  />
                </div>
              </div>
              
              <div class="detail-section">
                <div class="detail-section-title">备注</div>
                <textarea v-model="editForm.notes" class="detail-textarea" placeholder="添加备注信息"></textarea>
              </div>
              
              <div class="detail-section">
                <label class="detail-checkbox">
                  <input v-model="editForm.is_private" type="checkbox" />
                  <span class="checkbox-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    私密书签
                  </span>
                </label>
              </div>
            </div>
            <div class="detail-footer">
              <button class="detail-btn secondary" @click="closeDetailModal">取消</button>
              <button class="detail-btn primary" @click="saveBookmark">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                保存
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <NavSettingsModal
      :show="showNavSettings"
      @close="showNavSettings = false"
      @action="handleSettingsAction"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import NavBar from '../components/NavBar.vue'
import NavSearch from '../components/NavSearch.vue'
import NavCardGrid from '../components/NavCardGrid.vue'
import NavSettingsModal from '../components/NavSettingsModal.vue'
import { useBookmarks } from '../composables/useBookmarks'
import { useSettings } from '../composables/useSettings'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import { buildCategoryTree, getCategoryPath } from '../utils/categoryTree'

const { categories, bookmarks, fetchData, searchTags, updateBookmark } = useBookmarks()
const { isAuthenticated } = useAuth()
const { customTitle, navWallpaper, iconSources, parseIconSourceUrl, showSearch, randomWallpaper, wallpaperApi, applyWallpaper } = useSettings()
const { error: errorToast } = useToast()

const emit = defineEmits(['toggleStyle'])

const activeMenu = ref(null)
const activeSubMenu = ref(null)
const animationKey = ref(0)
const navSearchRef = ref(null)
const showDetailModal = ref(false)
const showNavSettings = ref(false)
const detailData = ref({ tag: null, bookmark: null })
const selectedFilterTag = ref(null)
const detailIconError = ref(false)
const detailIconSourceIndexes = ref({})
const editForm = ref({
  category_id: '',
  description: '',
  tags: '',
  notes: '',
  is_private: false
})
const tagItems = ref([])
const newTagInput = ref('')
const editingTagIndex = ref(null)
const tagEditInput = ref(null)
const selectOpen = ref(false)
const selectSearch = ref('')
const selectSearchInput = ref(null)
const searchResults = ref(null)

const allTags = computed(() => {
  if (!detailData.value.bookmark?.tags) return []
  return detailData.value.bookmark.tags.split(',').map(t => t.trim()).filter(Boolean)
})

const categoryOptions = computed(() => {
  if (!categories.value.length) {
    return []
  }
  const { flatList, map } = buildCategoryTree(categories.value)
  return flatList.map(cat => ({
    id: cat.id,
    displayName: getCategoryPath(cat.id, map).map(item => item.name).join('/')
  }))
})

const selectedCategoryName = computed(() => {
  if (!editForm.value.category_id) return ''
  const cat = categoryOptions.value.find(c => c.id === editForm.value.category_id)
  return cat?.displayName || ''
})

const filteredCategoryOptions = computed(() => {
  if (!selectSearch.value) return categoryOptions.value
  const query = selectSearch.value.toLowerCase()
  return categoryOptions.value.filter(cat => 
    cat.displayName.toLowerCase().includes(query)
  )
})

const selectCategory = (cat) => {
  editForm.value.category_id = cat.id
  selectOpen.value = false
  selectSearch.value = ''
}

const categoryName = computed(() => {
  if (!detailData.value.bookmark?.category_id) return '未分类'
  const cat = categories.value.find(c => c.id === detailData.value.bookmark.category_id)
  return cat ? cat.name : '未分类'
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
    style.backgroundColor = '#222'
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
  detailData.value = { tag, bookmark }
  editForm.value = {
    category_id: bookmark?.category_id || '',
    description: bookmark?.description || '',
    tags: bookmark?.tags || '',
    notes: bookmark?.notes || '',
    is_private: bookmark?.is_private || false
  }
  tagItems.value = bookmark?.tags ? bookmark.tags.split(',').map(t => t.trim()).filter(Boolean) : []
  newTagInput.value = ''
  editingTagIndex.value = null
  selectOpen.value = false
  selectSearch.value = ''
  detailIconError.value = false
  detailIconSourceIndexes.value = {}
  showDetailModal.value = true
}

const closeDetailModal = () => {
  showDetailModal.value = false
  selectOpen.value = false
  selectSearch.value = ''
  selectedFilterTag.value = null
}

const addTag = () => {
  const tag = newTagInput.value.trim()
  if (tag && !tagItems.value.includes(tag)) {
    tagItems.value.push(tag)
  }
  newTagInput.value = ''
}

const removeTag = (index) => {
  tagItems.value.splice(index, 1)
}

const startEditTag = (index) => {
  editingTagIndex.value = index
  nextTick(() => {
    if (tagEditInput.value) {
      const input = Array.isArray(tagEditInput.value) ? tagEditInput.value[0] : tagEditInput.value
      input?.focus()
      input?.select()
    }
  })
}

const finishEditTag = () => {
  const trimmed = tagItems.value[editingTagIndex.value]?.trim()
  if (!trimmed) {
    tagItems.value.splice(editingTagIndex.value, 1)
  } else {
    tagItems.value[editingTagIndex.value] = trimmed
  }
  editingTagIndex.value = null
}

const handleTagBackspace = (index) => {
  if (editingTagIndex.value === index && tagItems.value[index].length === 0) {
    removeTag(index)
    editingTagIndex.value = null
  }
}

const handleInputBackspace = () => {
  if (newTagInput.value === '' && tagItems.value.length > 0 && editingTagIndex.value === null) {
    removeTag(tagItems.value.length - 1)
  }
}

const saveBookmark = async () => {
  if (!detailData.value.bookmark?.id) return
  if (!isAuthenticated.value) return

  const originalBookmark = { ...detailData.value.bookmark }

  try {
    const tagsStr = tagItems.value.join(',')

    bookmarks.value = bookmarks.value.map(b => {
      if (b.id === detailData.value.bookmark.id) {
        return {
          ...b,
          category_id: editForm.value.category_id,
          description: editForm.value.description,
          tags: tagsStr,
          notes: editForm.value.notes,
          is_private: editForm.value.is_private
        }
      }
      return b
    })

    const result = await updateBookmark(detailData.value.bookmark.id, {
      name: detailData.value.bookmark.name,
      url: detailData.value.bookmark.url,
      category_id: editForm.value.category_id,
      description: editForm.value.description,
      tags: tagsStr,
      notes: editForm.value.notes,
      is_private: editForm.value.is_private
    })

    if (!result.success) {
      bookmarks.value = bookmarks.value.map(b => {
        if (b.id === originalBookmark.id) return originalBookmark
        return b
      })
      if (result.error) {
        errorToast(result.error)
      }
      return
    }

    closeDetailModal()
  } catch (error) {
    bookmarks.value = bookmarks.value.map(b => {
      if (b.id === originalBookmark.id) return originalBookmark
      return b
    })
    console.error('Failed to update bookmark:', error)
    errorToast('保存失败，请重试')
  }
}

const openBookmarkUrl = () => {
  if (detailData.value.bookmark?.url) {
    window.open(detailData.value.bookmark.url, '_blank')
  }
}

const getDisplayUrl = (url) => {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '')
  } catch {
    return url
  }
}

const findParentCategory = (categoryId) => {
  const category = categories.value.find(c => c.id === categoryId)
  if (!category) return null
  if (!category.parent_id) return category
  
  return categories.value.find(c => c.id === category.parent_id)
}

const getDetailIconSources = (bookmark) => {
  if (bookmark.icon && bookmark.icon.trim()) {
    return []
  }
  try {
    const enabledSources = iconSources.value.filter(s => s.enabled)
    return enabledSources.map(source => parseIconSourceUrl(source.url, bookmark.url))
  } catch {
    return []
  }
}

const getDetailIconUrl = (bookmark) => {
  if (bookmark.icon && bookmark.icon.trim()) {
    return bookmark.icon
  }
  const sources = getDetailIconSources(bookmark)
  const index = detailIconSourceIndexes.value[bookmark.id] || 0
  if (sources.length > 0 && index < sources.length) {
    return sources[index]
  }
  return ''
}

const handleDetailIconError = () => {
  const bookmark = detailData.value.bookmark
  if (!bookmark) return
  const sources = getDetailIconSources(bookmark)
  const currentIndex = detailIconSourceIndexes.value[bookmark.id] || 0
  if (currentIndex < sources.length - 1) {
    detailIconSourceIndexes.value[bookmark.id] = currentIndex + 1
  } else {
    detailIconError.value = true
  }
}

const handleSettingsAction = (action) => {
  console.log('Settings action:', action)
  showNavSettings.value = false
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
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

.nav-item-view ::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
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
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.68rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: inherit;
  white-space: nowrap;
}

.cat-tab:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
}

.cat-tab.active {
  background: rgba(57, 157, 255, 0.1);
  border-color: rgba(57, 157, 255, 0.2);
  color: #60a5fa;
}

.cat-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 0.55rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.35);
  line-height: 1;
}

.cat-tab.active .cat-count {
  background: rgba(57, 157, 255, 0.15);
  color: #60a5fa;
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
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 10vh 10vw;
}

.detail-modal {
  background: rgba(11, 15, 25, 0.92);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 20px;
  width: 100%;
  max-width: 420px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 
    0 0 0 1px rgba(255, 255, 255, 0.04),
    0 40px 120px -20px rgba(0, 0, 0, 0.8);
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
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
  color: #f1f5f9;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-url {
  font-size: 0.8125rem;
  color: #64748b;
  font-family: 'SF Mono', Monaco, monospace;
}

.detail-close {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.detail-close:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #f87171;
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
  color: #64748b;
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
  background: rgba(57, 157, 255, 0.1);
  color: #60a5fa;
  border: 1px solid rgba(57, 157, 255, 0.25);
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.detail-tag:hover {
  background: rgba(57, 157, 255, 0.2);
  border-color: rgba(57, 157, 255, 0.5);
  transform: translateY(-1px);
}

.detail-tag.active {
  background: rgba(57, 157, 255, 0.3);
  border-color: #60a5fa;
}

.detail-description {
  font-size: 0.875rem;
  color: #94a3b8;
  line-height: 1.6;
  padding: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
}

.detail-notes {
  font-size: 0.875rem;
  color: #94a3b8;
  line-height: 1.6;
  padding: 14px;
  background: rgba(139, 92, 246, 0.05);
  border: 1px solid rgba(139, 92, 246, 0.15);
  border-radius: 10px;
  font-style: italic;
}

.detail-category {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: #94a3b8;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
}

.detail-category svg {
  width: 16px;
  height: 16px;
  color: #60a5fa;
}

.detail-private {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  color: #fbbf24;
  padding: 10px 14px;
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.2);
  border-radius: 10px;
}

.detail-private svg {
  width: 16px;
  height: 16px;
}

.detail-input {
  width: 100%;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #f1f5f9;
  font-size: 0.875rem;
  transition: all 0.2s;
  outline: none;
}

.detail-input:focus {
  border-color: rgba(57, 157, 255, 0.5);
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 3px rgba(57, 157, 255, 0.1);
}

.detail-input::placeholder {
  color: #475569;
}

.detail-textarea {
  width: 100%;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #f1f5f9;
  font-size: 0.875rem;
  transition: all 0.2s;
  outline: none;
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  line-height: 1.5;
}

.detail-textarea:focus {
  border-color: rgba(57, 157, 255, 0.5);
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 3px rgba(57, 157, 255, 0.1);
}

.detail-textarea::placeholder {
  color: #475569;
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
  color: #94a3b8;
}

.detail-checkbox .checkbox-label svg {
  width: 16px;
  height: 16px;
}

.detail-footer {
  display: flex;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
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
  background: linear-gradient(135deg, #399dff, #0066cc);
  color: white;
  box-shadow: 0 4px 16px rgba(57, 157, 255, 0.3);
}

.detail-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(57, 157, 255, 0.4);
}

.detail-btn.secondary {
  background: rgba(255, 255, 255, 0.08);
  color: #f1f5f9;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.detail-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
}

.detail-btn svg {
  width: 18px;
  height: 18px;
}

.detail-select {
  width: 100%;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #f1f5f9;
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
  border-color: rgba(57, 157, 255, 0.5);
  background-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 3px rgba(57, 157, 255, 0.1);
}

.detail-select option {
  background: #1e293b;
  color: #f1f5f9;
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
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.select-trigger:hover {
  border-color: rgba(255, 255, 255, 0.2);
}

.custom-select.open .select-trigger {
  border-color: rgba(57, 157, 255, 0.5);
  background: rgba(255, 255, 255, 0.08);
}

.select-value {
  color: #f1f5f9;
  font-size: 0.875rem;
}

.select-value.placeholder {
  color: #475569;
}

.select-arrow {
  width: 16px;
  height: 16px;
  color: #64748b;
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
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  z-index: 100;
  overflow: hidden;
}

.select-search {
  width: 100%;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: #f1f5f9;
  font-size: 0.875rem;
  outline: none;
}

.select-search::placeholder {
  color: #64748b;
}

.select-options {
  max-height: 240px;
  overflow-y: auto;
}

.select-option {
  padding: 10px 14px;
  color: #94a3b8;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
}

.select-option:hover {
  background: rgba(57, 157, 255, 0.1);
  color: #f1f5f9;
}

.select-option.selected {
  background: rgba(57, 157, 255, 0.2);
  color: #60a5fa;
}

.select-no-results {
  padding: 20px;
  text-align: center;
  color: #64748b;
  font-size: 0.875rem;
}

.select-options::-webkit-scrollbar {
  width: 6px;
}

.select-options::-webkit-scrollbar-track {
  background: transparent;
}

.select-options::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.tags-input-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  min-height: 44px;
  align-items: center;
  transition: all 0.2s;
}

.tags-input-container:focus-within {
  border-color: rgba(57, 157, 255, 0.5);
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 0 0 3px rgba(57, 157, 255, 0.1);
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
  background: rgba(57, 157, 255, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(57, 157, 255, 0.3);
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: all 0.2s;
}

.tag-item:hover {
  background: rgba(57, 157, 255, 0.25);
  border-color: rgba(57, 157, 255, 0.5);
}

.tag-item.editing {
  background: rgba(57, 157, 255, 0.3);
  border-color: #60a5fa;
}

.tag-edit-input {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 0.8125rem;
  outline: none;
  width: 80px;
  padding: 0;
}

.tag-remove {
  background: none;
  border: none;
  color: rgba(96, 165, 250, 0.6);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
  transition: color 0.2s;
}

.tag-remove:hover {
  color: #f87171;
}

.tag-input {
  flex: 1;
  min-width: 120px;
  background: transparent;
  border: none;
  color: #f1f5f9;
  font-size: 0.875rem;
  outline: none;
  padding: 4px 0;
}

.tag-input::placeholder {
  color: #475569;
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