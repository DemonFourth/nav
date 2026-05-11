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
                <p>未找到匹配的书签</p>
              </div>
              <div v-else class="results-list">
                <div 
                  v-for="result in searchResults"
                  :key="result.id"
                  class="result-item"
                  @click="handleResultClick(result)"
                >
                  <div class="result-icon">
                    <img v-if="result.icon" :src="result.icon" :alt="result.name" @error="handleIconError" />
                    <div v-else class="letter-icon">{{ result.name.charAt(0) }}</div>
                  </div>
                  <div class="result-info">
                    <div class="result-name">{{ result.name }}</div>
                    <div class="result-url">{{ getDisplayUrl(result.url) }}</div>
                    <div v-if="result.description" class="result-desc">{{ result.description }}</div>
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

const props = defineProps({
  bookmarks: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['result-click'])

const searchQuery = ref('')
const selectedEngine = ref(null)
const showSearchModal = ref(false)
const searchResults = ref([])

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

const searchInSite = () => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) return

  searchResults.value = props.bookmarks.filter(bookmark => 
    bookmark.name.toLowerCase().includes(query) ||
    bookmark.url.toLowerCase().includes(query) ||
    (bookmark.description && bookmark.description.toLowerCase().includes(query)) ||
    (bookmark.tags && bookmark.tags.toLowerCase().includes(query)) ||
    (bookmark.notes && bookmark.notes.toLowerCase().includes(query))
  )

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
    return parsed.hostname
  } catch {
    return url
  }
}

const handleIconError = (event) => {
  event.target.style.display = 'none'
  event.target.nextElementSibling.style.display = 'flex'
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
  gap: 0.75rem;
}

.search-engine-select {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.engine-btn {
  border: none;
  background: none;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.85rem;
  padding: 0.35rem 0.85rem;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.engine-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.engine-btn.active {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.4);
}

.search-container {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 25px;
  padding: 0.4rem;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  width: 100%;
  max-width: 500px;
  border: 1px solid rgba(255, 255, 255, 0.1);
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
  color: rgba(255, 255, 255, 0.5);
}

.clear-btn {
  background: none;
  border: none;
  outline: none;
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
  align-items: center;
}

.search-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.search-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

/* Search Modal */
.search-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.search-modal {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 16px;
  width: 100%;
  max-width: 600px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

html.dark .search-modal {
  background: rgba(30, 41, 59, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  color: var(--text-secondary);
  transition: all 0.2s;
  display: flex;
  align-items: center;
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--error);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.no-results {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--bg);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.result-item:hover {
  background: var(--bg-hover);
  border-color: var(--primary);
  transform: translateY(-2px);
}

.result-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
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
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: white;
  font-weight: 600;
  font-size: 1rem;
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-name {
  font-weight: 600;
  color: var(--text);
  font-size: 0.95rem;
  margin-bottom: 0.2rem;
}

.result-url {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 0.2rem;
}

.result-desc {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.modal-enter-from .search-modal,
.modal-leave-to .search-modal {
  transform: scale(0.95) translateY(20px);
}

@media (max-width: 768px) {
  .search-modal {
    max-height: 80vh;
  }

  .engine-btn {
    font-size: 0.8rem;
    padding: 0.3rem 0.7rem;
  }
}
</style>