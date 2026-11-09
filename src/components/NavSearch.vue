<template>
  <div class="nav-search">
    <div class="search-box-wrapper">
      <div class="search-container">
        <div class="engine-select-wrap" ref="engineWrapRef">
          <button
            ref="engineBtnRef"
            type="button"
            class="engine-trigger"
            :class="{ active: engineOpen }"
            @click.stop="toggleEngineDropdown"
            v-tooltip="'选择搜索引擎'"
          >
            <span class="engine-trigger-name">{{ selectedEngine.name }}</span>
            <svg class="engine-trigger-arrow" :class="{ open: engineOpen }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <Teleport to="body">
            <Transition name="dropdown">
              <div v-if="engineOpen" ref="engineDropdownRef" class="engine-dropdown" :style="engineDropdownStyle">
                <button
                  v-for="engine in engineOptions"
                  :key="engine.id"
                  type="button"
                  class="engine-option"
                  :class="{ active: selectedEngineId === engine.id }"
                  @click="selectEngine(engine.id)"
                >
                  {{ engine.name }}
                </button>
              </div>
            </Transition>
          </Teleport>
        </div>

        <input 
          v-model="searchQuery" 
          type="text" 
          :placeholder="searchPlaceholder" 
          class="search-input"
          @keyup.enter="handleSearch"
        />
        <button v-if="searchQuery" class="clear-btn" @click="clearSearch" aria-label="清空">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--nav-text-secondary)" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <div v-if="selectedEngine.id === 'site'" class="search-field-wrap" ref="searchFieldRef">
          <button ref="searchFieldBtnRef" class="search-field-btn" :class="{ active: searchField !== 'all' }" @click="openFieldDropdown" v-tooltip="'搜索范围: ' + (SEARCH_FIELD_OPTIONS.find(o => o.value === searchField)?.label || '全部字段')">
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
        <button @click="handleSearch" class="search-btn" v-tooltip="'搜索'">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useSearchEngines } from '../composables/useSearchEngines'
import { searchBookmarks, SEARCH_FIELD_OPTIONS } from '../utils/search'

const props = defineProps({
  bookmarks: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['search-results', 'clear-results'])

const { enabledSearchEnginesPanel, getAvailableEngines, openSearchEngine } = useSearchEngines()

const SITE_ENGINE = { id: 'site', name: '站内' }

const searchQuery = ref('')
const selectedEngineId = ref('site')
const searchResults = ref([])
const searchField = ref('all')
const searchFieldOpen = ref(false)
const searchFieldRef = ref(null)
const searchFieldBtnRef = ref(null)
const searchFieldDropdownRef = ref(null)
const dropdownStyle = ref({})

const engineOpen = ref(false)
const engineWrapRef = ref(null)
const engineBtnRef = ref(null)
const engineDropdownRef = ref(null)
const engineDropdownStyle = ref({})

// 站内固定第一项；关闭「搜索引擎列表」后只剩站内
const engineOptions = computed(() => {
  if (!enabledSearchEnginesPanel.value) return [SITE_ENGINE]
  return [
    SITE_ENGINE,
    ...getAvailableEngines().map(engine => ({ id: engine.id, name: engine.name }))
  ]
})

const selectedEngine = computed(() =>
  engineOptions.value.find(engine => engine.id === selectedEngineId.value) || SITE_ENGINE
)

const searchPlaceholder = computed(() =>
  selectedEngine.value.id === 'site' ? '搜索站内书签...' : `${selectedEngine.value.name} 搜索...`
)

watch(engineOptions, (list) => {
  if (!list.some(engine => engine.id === selectedEngineId.value)) {
    selectedEngineId.value = 'site'
  }
})

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

const toggleEngineDropdown = () => {
  engineOpen.value = !engineOpen.value
  if (!engineOpen.value) return
  nextTick(() => {
    const rect = engineBtnRef.value?.getBoundingClientRect()
    if (rect) {
      engineDropdownStyle.value = {
        position: 'fixed',
        top: rect.bottom + 6 + 'px',
        left: rect.left + 'px',
        zIndex: 99999
      }
    }
  })
}

const handleClickAway = (e) => {
  if (searchFieldOpen.value && searchFieldRef.value && !searchFieldRef.value.contains(e.target)) {
    if (searchFieldDropdownRef.value && searchFieldDropdownRef.value.contains(e.target)) return
    searchFieldOpen.value = false
  }
  if (engineOpen.value) {
    if (engineDropdownRef.value && engineDropdownRef.value.contains(e.target)) return
    if (engineWrapRef.value && engineWrapRef.value.contains(e.target)) return
    engineOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickAway))
onUnmounted(() => document.removeEventListener('click', handleClickAway))

const selectEngine = (engineId) => {
  engineOpen.value = false
  if (selectedEngineId.value === engineId) return
  selectedEngineId.value = engineId

  if (engineId === 'site') {
    if (searchQuery.value.trim()) searchInSite()
  } else {
    // 切到外部引擎时清掉站内结果，等待回车直接打开搜索页
    searchResults.value = []
    emit('clear-results')
  }
}

const clearSearch = () => {
  searchQuery.value = ''
  searchResults.value = []
  emit('clear-results')
}

// 父组件（NavItemView）点标签时需要清空搜索框文本
defineExpose({ clearSearch })

const handleSearch = () => {
  const query = searchQuery.value.trim()
  if (!query) return

  if (selectedEngine.value.id === 'site') {
    searchInSite()
  } else {
    openSearchEngine(selectedEngine.value.id, query)
  }
}

const searchInSite = () => {
  const query = searchQuery.value.trim()
  if (!query) return

  const results = searchBookmarks(props.bookmarks, searchQuery.value, { field: searchField.value })

  searchResults.value = results
  emit('search-results', results, query)
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
  justify-content: center;
}

.search-container {
  display: flex;
  align-items: center;
  background: var(--nav-card-bg);
  border-radius: 999px;
  padding: 3px 3px 3px 6px;
  width: 100%;
  max-width: 560px;
  border: 1px solid var(--nav-border);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.search-container:focus-within {
  border-color: color-mix(in srgb, var(--nav-primary) 35%, transparent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--nav-primary) 12%, transparent), 0 4px 20px color-mix(in srgb, var(--nav-primary) 10%, transparent);
  background: var(--nav-card-hover);
}

.engine-select-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding-right: 6px;
  border-right: 1px solid var(--nav-border);
}

.engine-trigger {
  display: flex;
  align-items: center;
  gap: 3px;
  max-width: 120px;
  padding: 6px 8px;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--nav-text-secondary);
  font-family: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.engine-trigger:hover,
.engine-trigger.active {
  color: var(--nav-primary);
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
}

.engine-trigger-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.engine-trigger-arrow {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.engine-trigger-arrow.open {
  transform: rotate(180deg);
}

.engine-dropdown {
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  border-radius: 10px;
  padding: 6px;
  min-width: 140px;
  max-height: 280px;
  overflow-y: auto;
  box-shadow: 0 8px 30px rgba(0,0,0,0.15);
}

.engine-option {
  display: block;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--nav-text);
  font-family: inherit;
  font-size: 0.85rem;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s;
}

.engine-option:hover {
  background: color-mix(in srgb, var(--nav-primary) 10%, transparent);
}

.engine-option.active {
  color: var(--nav-primary);
  background: color-mix(in srgb, var(--nav-primary) 14%, transparent);
  font-weight: 600;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 0.6rem 1rem;
  font-size: 1rem;
  color: var(--nav-text);
  outline: none;
  min-width: 0;
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
  flex-shrink: 0;
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
  flex-shrink: 0;
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
