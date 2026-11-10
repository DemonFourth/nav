import { ref, watch } from 'vue'
import { useAuth } from './useAuth'
import { fetchSettingsShared } from '../utils/settingsFetch'

const SEARCH_ENGINES = [
  {
    id: 'google',
    name: 'Google',
    icon: 'https://www.faviconextractor.com/favicon/www.google.com',
    url: 'https://www.google.com/search?q='
  },
  {
    id: 'bing',
    name: 'Bing',
    icon: 'https://www.faviconextractor.com/favicon/www.bing.com',
    url: 'https://www.bing.com/search?q='
  },
  {
    id: 'baidu',
    name: '百度',
    icon: 'https://www.faviconextractor.com/favicon/www.baidu.com',
    url: 'https://www.baidu.com/s?wd='
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    icon: 'https://www.faviconextractor.com/favicon/duckduckgo.com',
    url: 'https://duckduckgo.com/?q='
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: 'https://www.faviconextractor.com/favicon/github.com',
    url: 'https://github.com/search?q='
  },
  {
    id: 'stackoverflow',
    name: 'Stack Overflow',
    icon: 'https://www.faviconextractor.com/favicon/stackoverflow.com',
    url: 'https://stackoverflow.com/search?q='
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    icon: 'https://www.faviconextractor.com/favicon/en.wikipedia.org',
    url: 'https://en.wikipedia.org/w/index.php?search='
  },
  {
    id: 'npm',
    name: 'NPM',
    icon: 'https://www.faviconextractor.com/favicon/www.npmjs.com',
    url: 'https://www.npmjs.com/search?q='
  }
]

const enabledEngines = ref(localStorage.getItem('enabledSearchEngines')
  ? JSON.parse(localStorage.getItem('enabledSearchEngines'))
  : SEARCH_ENGINES.slice(0, 4).map(e => e.id))

// 已与数据库同步过的值，用于避免加载时把同样的数据又 POST 回去
let syncedEnginesSnapshot = JSON.stringify(enabledEngines.value)

const enabledSearchEnginesPanel = ref(localStorage.getItem('enabledSearchEnginesPanel') !== 'false')

const isLoadingFromDB = ref(false)

// 只有一个模块级 watcher：多个组件各自 useSearchEngines() 时不会重复写库
const { isAuthenticated: isAuthedForEngines, apiRequest: apiRequestForEngines } = useAuth()
watch(enabledEngines, async (newValue) => {
  const serialized = JSON.stringify(newValue)
  // 与已同步值一致说明只是加载/回填，不需要写回数据库
  if (serialized === syncedEnginesSnapshot) return
  syncedEnginesSnapshot = serialized

  if (!isAuthedForEngines.value) return
  try {
    await apiRequestForEngines('/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        settings: { enabledSearchEngines: serialized }
      })
    })
  } catch (error) {
    if (error.message !== 'Token expired') {
      console.error('Failed to save search engines settings:', error)
    }
  }
}, { deep: true })

export function useSearchEngines() {
  const { isAuthenticated, getAuthHeaders, apiRequest } = useAuth()

  const getAvailableEngines = () => {
    return SEARCH_ENGINES.filter(engine => enabledEngines.value.includes(engine.id))
  }

  const getEngineUrl = (engineId, query) => {
    const engine = SEARCH_ENGINES.find(e => e.id === engineId)
    if (!engine) return null

    return engine.url + encodeURIComponent(query)
  }

  const openSearchEngine = (engineId, query) => {
    const url = getEngineUrl(engineId, query)
    if (url) {
      window.open(url, '_blank')
    }
  }

  const toggleEngine = async (engineId) => {
    const index = enabledEngines.value.indexOf(engineId)
    if (index > -1) {
      enabledEngines.value.splice(index, 1)
    } else {
      enabledEngines.value.push(engineId)
    }

    localStorage.setItem('enabledSearchEngines', JSON.stringify(enabledEngines.value))

    // 数据库写入由上面的模块级 watch 统一处理，这里不再重复 POST
  }

  const toggleSearchEnginesPanel = async () => {
    enabledSearchEnginesPanel.value = !enabledSearchEnginesPanel.value
    localStorage.setItem('enabledSearchEnginesPanel', String(enabledSearchEnginesPanel.value))

    if (isAuthenticated.value) {
      try {
        await apiRequest('/api/settings', {
          method: 'POST',
          body: JSON.stringify({
            settings: { enabledSearchEnginesPanel: String(enabledSearchEnginesPanel.value) }
          })
        })
      } catch (error) {
        if (error.message !== 'Token expired') {
          console.error('Failed to save search engines panel settings:', error)
        }
      }
    }
  }

  const loadSettingsFromDB = async () => {
    isLoadingFromDB.value = true
    try {
      const settingsData = await fetchSettingsShared(
        isAuthenticated.value ? getAuthHeaders() : {}
      )

      if (settingsData) {
        if (settingsData.enabledSearchEngines) {
          enabledEngines.value = JSON.parse(settingsData.enabledSearchEngines)
          // 来自数据库的值无需再回写，避免加载过程触发 watch 保存
          syncedEnginesSnapshot = JSON.stringify(enabledEngines.value)
          localStorage.setItem('enabledSearchEngines', JSON.stringify(enabledEngines.value))
        }
        if (settingsData.enabledSearchEnginesPanel) {
          enabledSearchEnginesPanel.value = settingsData.enabledSearchEnginesPanel !== 'false'
          localStorage.setItem('enabledSearchEnginesPanel', settingsData.enabledSearchEnginesPanel)
        }
      }
    } catch (error) {
      console.error('Failed to load search engines settings from database:', error)
    } finally {
      isLoadingFromDB.value = false
    }
  }

  return {
    SEARCH_ENGINES,
    enabledEngines,
    enabledSearchEnginesPanel,
    getAvailableEngines,
    getEngineUrl,
    openSearchEngine,
    toggleEngine,
    toggleSearchEnginesPanel,
    loadSettingsFromDB
  }
}
