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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--nav-text-secondary)" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <div v-if="selectedEngine.name === 'site'" class="search-field-wrap" ref="searchFieldRef">
          <button ref="searchFieldBtnRef" class="search-field-btn" :class="{ active: searchField !== 'all' }" @click="openFieldDropdown" :title="'搜索范围: ' + (SEARCH_FIELD_OPTIONS.find(o => o.value === searchField)?.label || '全部字段')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 3v18M3 12h18"/>
              <circle cx="10" cy="10" r="3"/>
              <circle cx="14" cy="14" r="3"/>
            </svg>
            <span class="search-field-label">{{ SEARCH_FIELD_OPTIONS.find(o => o.value === searchField)?.label }}</span>
          </button>
          <Teleport to="body">
            <Transition name="dropdown">
              <div v-if="searchFieldOpen" ref="searchFieldDropdownRef" class="search-field-dropdown" :style="dropdownStyle">
                <div
                  v-for="opt in SEARCH_FIELD_OPTIONS"
                  :key="opt.value"
                  class="search-field-option"
                  :class="{ active: searchField === opt.value }"
                  @click="searchField = opt.value; searchFieldOpen = false"
                >
                  <span class="field-radio" :class="{ checked: searchField === opt.value }"></span>
                  {{ opt.label }}
                </div>
              </div>
            </Transition>
          </Teleport>
        </div>
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
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useBookmarks } from '../composables/useBookmarks'
import { useSettings } from '../composables/useSettings'
import { buildCategoryTree, getCategoryPath } from '../utils/categoryTree'
import { searchBookmarks, SEARCH_FIELD_OPTIONS } from '../utils/search'

const props = defineProps({
  bookmarks: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['search-results', 'clear-results'])

const { categories } = useBookmarks()

const searchQuery = ref('')
const selectedEngine = ref(null)
const searchResults = ref([])
const searchIconErrors = ref({})
const searchIconSourceIndexes = ref({})
const searchField = ref('all')
const searchFieldOpen = ref(false)
const searchFieldRef = ref(null)
const searchFieldBtnRef = ref(null)
const searchFieldDropdownRef = ref(null)
const dropdownStyle = ref({})

const openFieldDropdown = () => {
  searchFieldOpen.value = !searchFieldOpen.value
  if (!searchFieldOpen.value) return
  nextTick(() => {
    const rect = searchFieldBtnRef.value?.getBoundingClientRect()
    if (rect) {
      dropdownStyle.value = {
        position: 'fixed',
        top: rect.bottom + 6 + 'px',
        right: document.documentElement.clientWidth - rect.right + 'px',
        zIndex: 99999
      }
    }
  })
}

const handleClickAway = (e) => {
  if (searchFieldRef.value && !searchFieldRef.value.contains(e.target)) {
    if (searchFieldDropdownRef.value && searchFieldDropdownRef.value.contains(e.target)) return
    searchFieldOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickAway))
onUnmounted(() => document.removeEventListener('click', handleClickAway))

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
  emit('clear-results')
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
    results = searchBookmarks(props.bookmarks, searchQuery.value, { field: searchField.value })
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
  color: var(--nav-text-secondary);
  font-size: 0.8rem;
  padding: 2px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.engine-btn:hover {
  color: var(--nav-primary);
  background: var(--nav-card-bg);
}

.engine-btn.active {
  color: var(--nav-primary);
  background: color-mix(in srgb, var(--nav-primary) 18%, transparent);
}

.search-container {
  display: flex;
  align-items: center;
  background: var(--nav-card-bg);
  border-radius: 999px;
  padding: 3px 3px 3px 18px;
  width: 100%;
  max-width: 520px;
  border: 1px solid var(--nav-border);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.search-container:focus-within {
  border-color: color-mix(in srgb, var(--nav-primary) 35%, transparent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--nav-primary) 12%, transparent), 0 4px 20px color-mix(in srgb, var(--nav-primary) 10%, transparent);
  background: var(--nav-card-hover);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 0.6rem 1rem;
  font-size: 1rem;
  color: var(--nav-text);
  outline: none;
}

.search-input::placeholder {
  color: var(--nav-text-secondary);
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
  background: color-mix(in srgb, var(--nav-primary) 18%, transparent);
  color: var(--nav-primary);
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
  background: color-mix(in srgb, var(--nav-primary) 30%, transparent);
  transform: scale(1.06);
}

.search-btn:active {
  transform: scale(0.94);
}

.search-field-wrap {
  position: relative;
  margin-right: 0.2rem;
}

.search-field-btn {
  background: none;
  border: none;
  outline: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 6px;
  color: var(--nav-text-secondary);
  transition: all 0.2s;
  font-size: 0.8rem;
}

.search-field-btn:hover {
  color: var(--nav-primary);
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
}

.search-field-btn.active {
  color: var(--nav-primary);
  background: color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.search-field-label {
  font-size: 0.75rem;
  line-height: 1;
}

.search-field-dropdown {
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  border-radius: 10px;
  padding: 6px;
  min-width: 120px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.15);
}

.search-field-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 0.85rem;
  color: var(--nav-text);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
  white-space: nowrap;
}

.search-field-option:hover {
  background: color-mix(in srgb, var(--nav-primary) 10%, transparent);
}

.search-field-option.active {
  color: var(--nav-primary);
}

.field-radio {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--nav-text-secondary);
  flex-shrink: 0;
  transition: all 0.2s;
}

.field-radio.checked {
  border-color: var(--nav-primary);
  background: var(--nav-primary);
  box-shadow: inset 0 0 0 3px var(--nav-card-bg);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>