<template>
  <div class="nav-search">
    <div class="search-box-wrapper">
      <div class="search-engine-select">
        <button 
          v-for="engine in searchEngines" 
          :key="engine.name"
          :class="['engine-btn', { active: selectedEngine.name === engine.name }]"
          @click="selectEngine(engine)"
        >
          {{ engine.label }}
        </button>
      </div>
      
      <div class="search-container">
        <input 
          v-model="searchQuery" 
          type="text" 
          :placeholder="selectedEngine.placeholder" 
          class="search-input"
          @keyup.enter="handleSearch"
        />
        <button v-if="searchQuery" class="clear-btn" @click="clearSearch" aria-label="清空">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <button @click="handleSearch" class="search-btn" title="搜索">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showSearchModal" class="search-modal-overlay" @click="closeSearchModal">
          <div class="search-modal" @click.stop>
            <div class="modal-header">
              <h3>站内搜索结果</h3>
              <button class="close-btn" @click="closeSearchModal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <div v-if="searchResults.length === 0" class="no-results">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
                <p>未找到匹配的书签</p>
              </div>
              <div v-else class="results-list">
                <div 
                  v-for="result in searchResults"
                  :key="result.id"
                  class="result-item"
                >
                  <div class="result-row-main">
                    <div class="result-icon" @click="handleResultClick(result)">
                      <img 
                        v-if="!searchIconErrors[result.id] && getSearchResultIconUrl(result)" 
                        :src="getSearchResultIconUrl(result)" 
                        :alt="result.name" 
                        :key="result.id + '-' + (searchIconSourceIndexes[result.id] || 0)"
                        @error="handleIconError($event, result.id)" 
                      />
                      <div v-else class="letter-icon">{{ result.name.charAt(0) }}</div>
                    </div>
                    <div class="result-name" :title="result.name">{{ result.name }}</div>
                    <div class="result-action" @click.stop="openUrl(result.url)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </div>
                  </div>
                  <div class="result-row-sub">
                    <div v-if="getCategoryDisplayPath(result.category_id)" class="result-category" :title="getCategoryDisplayPath(result.category_id)">{{ getCategoryDisplayPath(result.category_id) }}</div>
                    <div class="result-url" :title="result.url">{{ getDisplayUrl(result.url) }}</div>
                    <div v-if="result.notes" class="result-notes" :title="result.notes">{{ result.notes }}</div>
                    <div v-if="result.description" class="result-desc" :title="result.description">{{ result.description }}</div>
                    <div v-if="result.tags" class="result-tags">
                      <span 
                        v-for="tag in result.tags.split(',').slice(0, 3)" 
                        :key="tag"
                        class="result-tag"
                      >
                        {{ tag.trim() }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useBookmarks } from '../composables/useBookmarks'
import { useSettings } from '../composables/useSettings'
import { buildCategoryTree, getCategoryPath } from '../utils/categoryTree'

const props = defineProps({
  bookmarks: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['result-click'])

const { categories } = useBookmarks()

const searchQuery = ref('')
const selectedEngine = ref(null)
const showSearchModal = ref(false)
const searchResults = ref([])
const searchIconErrors = ref({})
const searchIconSourceIndexes = ref({})

const { iconSources, parseIconSourceUrl } = useSettings()

const categoryMap = computed(() => {
  const { map } = buildCategoryTree(categories.value)
  return map
})

const getCategoryDisplayPath = (categoryId) => {
  if (!categoryId || !categoryMap.value[categoryId]) return ''
  const path = getCategoryPath(categoryId, categoryMap.value)
  return path.map(c => c.name).join(' / ')
}

defineExpose({
  openSearchWithTags: (tags) => {
    if (tags && tags.length > 0) {
      searchQuery.value = tags.join(',')
      searchInSite(tags)
    }
  }
})

const searchEngines = [
  {
    name: 'google',
    label: 'Google',
    placeholder: 'Google 搜索...',
    url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`
  },
  {
    name: 'baidu',
    label: '百度',
    placeholder: '百度搜索...',
    url: (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`
  },
  {
    name: 'bing',
    label: 'Bing',
    placeholder: 'Bing 搜索...',
    url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`
  },
  {
    name: 'github',
    label: 'GitHub',
    placeholder: 'GitHub 搜索...',
    url: (q) => `https://github.com/search?q=${encodeURIComponent(q)}&type=repositories`
  },
  {
    name: 'site',
    label: '站内',
    placeholder: '站内搜索...',
    url: () => ''
  }
]

selectedEngine.value = searchEngines[0]

const selectEngine = (engine) => {
  selectedEngine.value = engine
  if (searchQuery.value.trim()) {
    handleSearch()
  }
}

const clearSearch = () => {
  searchQuery.value = ''
}

const handleSearch = () => {
  if (!searchQuery.value.trim()) return

  if (selectedEngine.value.name === 'site') {
    searchInSite()
  } else {
    const url = selectedEngine.value.url(searchQuery.value)
    window.open(url, '_blank')
  }
}

const searchInSite = (tags = null) => {
  let results = []

  if (tags && tags.length > 0) {
    const tagQueries = tags.map(t => t.toLowerCase().trim())
    results = props.bookmarks.filter(bookmark => {
      if (!bookmark.tags) return false
      const bookmarkTags = bookmark.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      return tagQueries.some(tag => bookmarkTags.includes(tag))
    })
  } else {
    const query = searchQuery.value.toLowerCase().trim()
    if (!query) return
    results = props.bookmarks.filter(bookmark => 
      bookmark.name.toLowerCase().includes(query) ||
      bookmark.url.toLowerCase().includes(query) ||
      (bookmark.description && bookmark.description.toLowerCase().includes(query)) ||
      (bookmark.tags && bookmark.tags.toLowerCase().includes(query)) ||
      (bookmark.notes && bookmark.notes.toLowerCase().includes(query))
    )
  }

  searchIconErrors.value = {}
  searchIconSourceIndexes.value = {}
  searchResults.value = results
  showSearchModal.value = true
}

const closeSearchModal = () => {
  showSearchModal.value = false
}

const handleResultClick = (result) => {
  emit('result-click', result)
  closeSearchModal()
  searchQuery.value = ''
}

const getDisplayUrl = (url) => {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname + parsed.search
    if (path === '/' || path.length <= 1) {
      return parsed.hostname
    }
    return parsed.hostname + (path.length > 30 ? path.slice(0, 30) + '...' : path)
  } catch {
    return url.length > 40 ? url.slice(0, 40) + '...' : url
  }
}

const handleIconError = (event, resultId) => {
  const sources = getSearchResultIconSources(props.bookmarks.find(b => b.id === resultId))
  const currentIndex = searchIconSourceIndexes.value[resultId] || 0
  if (currentIndex < sources.length - 1) {
    searchIconSourceIndexes.value[resultId] = currentIndex + 1
  } else {
    searchIconErrors.value[resultId] = true
  }
}

const getSearchResultIconSources = (bookmark) => {
  if (!bookmark) return []
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

const getSearchResultIconUrl = (bookmark) => {
  if (!bookmark) return ''
  if (bookmark.icon && bookmark.icon.trim()) {
    return bookmark.icon
  }
  const sources = getSearchResultIconSources(bookmark)
  const index = searchIconSourceIndexes.value[bookmark.id] || 0
  if (sources.length > 0 && index < sources.length) {
    return sources[index]
  }
  return ''
}

const openUrl = (url) => {
  window.open(url, '_blank')
}
</script>

<style scoped>
.nav-search {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
}

.search-box-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.search-engine-select {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  position: relative;
  z-index: 3;
}

.engine-btn {
  border: none;
  background: none;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.8rem;
  padding: 2px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.engine-btn:hover {
  color: var(--nav-primary);
  background: rgba(255, 255, 255, 0.1);
}

.engine-btn.active {
  color: var(--nav-primary);
  background: rgba(255, 255, 255, 0.15);
}

.search-container {
  display: flex;
  align-items: center;
  background: rgba(179, 183, 184, 0.23);
  border-radius: 20px;
  padding: 0.3rem;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  width: 100%;
  max-width: 480px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 0.6rem 1rem;
  font-size: 1rem;
  color: #ffffff;
  outline: none;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.clear-btn {
  background: none;
  border: none;
  outline: none;
  cursor: pointer;
  margin-right: 0.2rem;
  display: flex;
  align-items: center;
  padding: 0;
}

.search-btn {
  background: rgba(233, 233, 235, 0);
  color: #ffffff;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-right: 0.1rem;
}

.search-btn:hover {
  background: #3367d6;
  transform: scale(1.05);
}

/* Search Modal */
.search-modal-overlay {
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

.search-modal {
  background: linear-gradient(165deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 20px;
  width: 100%;
  height: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 25px 80px rgba(0, 0, 0, 0.5),
    0 0 120px rgba(57, 157, 255, 0.1);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #f1f5f9;
  letter-spacing: -0.02em;
}

.close-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  padding: 0.625rem;
  border-radius: 10px;
  color: #94a3b8;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #f87171;
  transform: rotate(90deg);
}

.close-btn svg {
  width: 18px;
  height: 18px;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 2rem;
}

.modal-body::-webkit-scrollbar {
  width: 6px;
}

.modal-body::-webkit-scrollbar-track {
  background: transparent;
}

.modal-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

.no-results {
  text-align: center;
  padding: 4rem 2rem;
  color: #64748b;
}

.no-results svg {
  width: 64px;
  height: 64px;
  margin-bottom: 1rem;
  opacity: 0.4;
}

.no-results p {
  font-size: 1rem;
  font-weight: 500;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.result-item {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 1rem 1.25rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.result-item::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(57, 157, 255, 0.1), rgba(139, 92, 246, 0.05));
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.result-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(57, 157, 255, 0.3);
  transform: translateY(-2px);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(57, 157, 255, 0.1);
}

.result-item:hover::before {
  opacity: 1;
}

.result-row-main {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.result-row-sub {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-left: 3.5rem;
  flex-wrap: wrap;
  min-height: 1.5rem;
}

.result-category {
  font-size: 0.75rem;
  color: #60a5fa;
  background: rgba(57, 157, 255, 0.12);
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
  flex-shrink: 0;
}

.result-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  position: relative;
  z-index: 1;
}

.result-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.letter-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: -0.02em;
}

.result-name {
  flex: 1;
  min-width: 0;
  font-weight: 700;
  color: #f1f5f9;
  font-size: 1rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.01em;
  display: block;
  width: 100%;
}

.result-url {
  font-size: 0.75rem;
  color: #94a3b8;
  font-family: 'SF Mono', Monaco, monospace;
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
  flex-shrink: 0;
  display: block;
  width: 100%;
}

.result-notes {
  font-size: 0.75rem;
  color: #94a3b8;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
  flex-shrink: 0;
  display: block;
  width: 100%;
}

.result-desc {
  font-size: 0.75rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
  flex-shrink: 1;
  display: block;
  width: 100%;
}

.result-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.result-tag {
  padding: 2px 8px;
  background: rgba(57, 157, 255, 0.15);
  color: #60a5fa;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  border: 1px solid rgba(57, 157, 255, 0.2);
}

.result-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(57, 157, 255, 0.1);
  border: 1px solid rgba(57, 157, 255, 0.2);
  color: #60a5fa;
  flex-shrink: 0;
  transition: all 0.2s ease;
  position: relative;
  z-index: 1;
}

.result-action svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

.result-item:hover .result-action {
  background: rgba(57, 157, 255, 0.25);
  border-color: rgba(57, 157, 255, 0.5);
  transform: scale(1.1);
  box-shadow: 0 0 20px rgba(57, 157, 255, 0.3);
}

/* Modal Animation */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .search-modal,
.modal-leave-to .search-modal {
  transform: scale(0.95) translateY(20px) scale(0.98);
  filter: blur(10px);
}
</style>