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

const emit = defineEmits(['search-results'])

const { categories } = useBookmarks()

const searchQuery = ref('')
const selectedEngine = ref(null)
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
  emit('search-results', results)
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
  background: rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  padding: 3px 3px 3px 18px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  width: 100%;
  max-width: 520px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.search-container:focus-within {
  border-color: rgba(57, 157, 255, 0.3);
  box-shadow: 0 0 0 4px rgba(57, 157, 255, 0.08), 0 4px 20px rgba(57, 157, 255, 0.06);
  background: rgba(255, 255, 255, 0.08);
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
  background: rgba(57, 157, 255, 0.15);
  color: #60a5fa;
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;
}

.search-btn:hover {
  background: rgba(57, 157, 255, 0.25);
  transform: scale(1.06);
}

.search-btn:active {
  transform: scale(0.94);
}


</style>