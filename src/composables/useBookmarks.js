import { ref, computed } from 'vue'
import { useAuth } from './useAuth'
import { useToast } from './useToast'
import {
  CACHE_KEY_PREFIX,
  LEGACY_CACHE_KEYS,
  isCacheExpired,
  isCacheFresh,
  parseCacheEntry,
  resolveCacheKey
} from '@/utils/cacheMeta'

const RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 500

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function fetchWithRetry(url, options) {
  let lastError = null
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, options)
      if (response.status >= 500) {
        lastError = new Error(`Server error ${response.status}`)
        if (attempt < RETRY_ATTEMPTS - 1) {
          const delay = RETRY_DELAY_MS * (attempt + 1)
          await sleep(delay)
          continue
        }
        break
      }
      return response
    } catch (error) {
      lastError = error
      if (attempt < RETRY_ATTEMPTS - 1) {
        const delay = RETRY_DELAY_MS * (attempt + 1)
        await sleep(delay)
        continue
      }
    }
  }
  throw lastError
}

const categories = ref([])
const bookmarks = ref([])
const searchQuery = ref('')
const searchCategoryId = ref(null)
const searchTags = ref([])

// 数据来源与刷新状态：empty | cache | network；idle | refreshing | failed
const dataSource = ref('empty')
const cacheUpdatedAt = ref(0)
const refreshState = ref('idle')
const cacheWriteFailed = ref(false)

// 旧版 5 分钟缓存留着只会占空间，模块加载时清掉
try {
  LEGACY_CACHE_KEYS.forEach(key => localStorage.removeItem(key))
} catch {
  // localStorage 不可用时忽略
}

function loadFromCache(cacheKey) {
  try {
    const entry = parseCacheEntry(localStorage.getItem(cacheKey))
    if (!entry) {
      localStorage.removeItem(cacheKey)
      return null
    }
    if (isCacheExpired(entry.age)) {
      localStorage.removeItem(cacheKey)
      return null
    }
    return entry
  } catch {
    return null
  }
}

function saveToCache(cacheKey, data) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }))
    cacheWriteFailed.value = false
    return true
  } catch (e) {
    cacheWriteFailed.value = true
    console.warn('Failed to save cache:', e)
    return false
  }
}

function clearCache() {
  try {
    Object.keys(localStorage)
      .filter(key => key.startsWith(CACHE_KEY_PREFIX) || LEGACY_CACHE_KEYS.includes(key))
      .forEach(key => localStorage.removeItem(key))
  } catch {
    // localStorage 不可用时忽略
  }
}

export function useBookmarks() {
  const { getAuthHeaders, logout, apiRequest, isAuthenticated, username } = useAuth()
  const { error: toastError } = useToast()

  const currentCacheKey = () => resolveCacheKey({
    isAuth: isAuthenticated.value,
    username: username.value
  })

  // 写成功后先把内存结果落到缓存，避免随后 GET 失败导致下次打开看到旧数据
  const persistCache = () => {
    saveToCache(currentCacheKey(), {
      categories: categories.value,
      bookmarks: bookmarks.value
    })
  }


  const filteredBookmarks = computed(() => {
    let result = bookmarks.value

    if (searchCategoryId.value) {
      // 收集选中分类及其所有后代分类的 ID
      const ids = new Set()
      const visit = (id) => {
        if (ids.has(id)) return
        ids.add(id)
        categories.value
          .filter(c => c.parent_id === id)
          .forEach(child => visit(child.id))
      }
      visit(Number(searchCategoryId.value))
      result = result.filter(bookmark => ids.has(Number(bookmark.category_id)))
    }

    if (searchTags.value && searchTags.value.length > 0) {
      result = result.filter(bookmark => {
        if (!bookmark.tags) return false
        const bookmarkTags = bookmark.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
        return searchTags.value.some(searchTag =>
          bookmarkTags.includes(searchTag.toLowerCase())
        )
      })
    }

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      result = result.filter(bookmark =>
        bookmark.name.toLowerCase().includes(query) ||
        bookmark.url.toLowerCase().includes(query) ||
        (bookmark.description && bookmark.description.toLowerCase().includes(query)) ||
        (bookmark.tags && bookmark.tags.toLowerCase().includes(query)) ||
        (bookmark.notes && bookmark.notes.toLowerCase().includes(query))
      )
    }

    return result
  })

  const bookmarksByCategory = computed(() => {
    const result = {}
    categories.value.forEach(category => {
      result[category.id] = filteredBookmarks.value
        .filter(b => b.category_id === category.id)
        .sort((a, b) => a.position - b.position)
    })
    return result
  })

  const allTags = computed(() => {
    const tagsSet = new Set()
    bookmarks.value.forEach(bookmark => {
      if (bookmark.tags) {
        const tags = bookmark.tags.split(',').map(t => t.trim()).filter(Boolean)
        tags.forEach(tag => tagsSet.add(tag))
      }
    })
    return Array.from(tagsSet).sort()
  })

  const fetchData = async (options = {}) => {
    const { forceRefresh = false, silent = false } = options
    const cacheKey = currentCacheKey()

    if (!forceRefresh) {
      const cached = loadFromCache(cacheKey)
      if (cached) {
        categories.value = cached.data.categories || []
        bookmarks.value = cached.data.bookmarks || []
        dataSource.value = 'cache'
        cacheUpdatedAt.value = cached.savedAt
        // 新鲜窗口内直接沿用缓存，不发请求；超过窗口才后台拉新
        if (isCacheFresh(cached.age)) {
          refreshState.value = 'idle'
          return true
        }
      } else {
        dataSource.value = 'empty'
      }
    }

    refreshState.value = 'refreshing'

    try {
      const authHeaders = getAuthHeaders()

      const categoriesRes = await fetchWithRetry('/api/categories', {
        headers: authHeaders
      })

      if (categoriesRes.status === 401) {
        if (authHeaders.Authorization) {
          logout()
        }
        categories.value = []
        bookmarks.value = []
        dataSource.value = 'empty'
        cacheUpdatedAt.value = 0
        refreshState.value = 'idle'
        return false
      }

      const categoriesData = await categoriesRes.json()

      const bookmarksRes = await fetchWithRetry('/api/bookmarks', {
        headers: authHeaders
      })

      if (bookmarksRes.status === 401) {
        if (authHeaders.Authorization) {
          logout()
        }
        categories.value = []
        bookmarks.value = []
        dataSource.value = 'empty'
        cacheUpdatedAt.value = 0
        refreshState.value = 'idle'
        return false
      }

      const bookmarksData = await bookmarksRes.json()

      // 请求期间登录状态变了：丢弃这批数据，避免把上一个账号的数据写进当前缓存
      if (currentCacheKey() !== cacheKey) {
        return false
      }

      categories.value = categoriesData.data || []
      bookmarks.value = bookmarksData.data || []
      dataSource.value = 'network'
      cacheUpdatedAt.value = Date.now()
      refreshState.value = 'idle'
      saveToCache(cacheKey, {
        categories: categories.value,
        bookmarks: bookmarks.value
      })
      return true
    } catch (error) {
      console.error('Failed to fetch data (after retries):', error)
      refreshState.value = 'failed'
      // 有缓存/已有数据时不再弹 toast，由连接面板体现；完全没数据才提示
      if (!silent && dataSource.value === 'empty') {
        toastError('数据加载失败，请刷新页面重试')
      }
      return false
    }
  }

  const addBookmark = async (data, options = {}) => {
    const { onPhase } = options
    onPhase?.('saving')
    try {
      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(data)
      })

      if (response.status === 401) {
        logout()
        return { success: false, error: '未授权' }
      }

      const result = await response.json()

      if (response.status === 409 && result.duplicate) {
        return {
          success: false,
          duplicate: true,
          error: `该 URL 已存在于"${result.existingBookmark.category_name}"分类中`,
          existingBookmark: result.existingBookmark
        }
      }

      if (result.success) {
        const categoryId = data.category_id == null ? null : Number(data.category_id)
        const nextPosition = bookmarks.value
          .filter(b => (b.category_id ?? null) === categoryId)
          .reduce((max, b) => Math.max(max, Number(b.position) || 0), -1) + 1
        bookmarks.value = [
          ...bookmarks.value,
          {
            ...data,
            id: result.id,
            category_id: categoryId,
            position: nextPosition,
            category_name: categories.value.find(c => c.id === categoryId)?.name || ''
          }
        ]
        persistCache()

        onPhase?.('syncing')
        const synced = await fetchData({ forceRefresh: true, silent: !!onPhase })
        onPhase?.(synced ? 'done' : 'sync-failed')
        return { success: true, syncFailed: !synced }
      }
      return { success: false, error: result.error || '添加失败' }
    } catch (error) {
      return { success: false, error: '网络错误' }
    }
  }

  const updateBookmark = async (id, data, options = {}) => {
    const { onPhase } = options
    onPhase?.('saving')
    try {
      const response = await apiRequest(`/api/bookmarks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (response.status === 409 && result.duplicate) {
        return {
          success: false,
          duplicate: true,
          error: `该 URL 已被其他书签使用（位于"${result.existingBookmark.category_name}"分类）`,
          existingBookmark: result.existingBookmark
        }
      }

      if (result.success) {
        bookmarks.value = bookmarks.value.map(b =>
          b.id === id ? { ...b, ...data } : b
        )
        persistCache()

        onPhase?.('syncing')
        fetchData({ forceRefresh: true, silent: !!onPhase }).then(synced => {
          onPhase?.(synced ? 'done' : 'sync-failed')
        })
        return { success: true }
      }
      return { success: false, error: result.error || '更新失败' }
    } catch (error) {
      if (error.message === 'Token expired') {
        return { success: false, error: '登录已过期，请重新登录' }
      }
      return { success: false, error: '网络错误' }
    }
  }

  const deleteBookmark = async (id, options = {}) => {
    const { onPhase } = options
    onPhase?.('saving')
    try {
      const response = await apiRequest(`/api/bookmarks/${id}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      if (result.success) {
        bookmarks.value = bookmarks.value.filter(b => b.id !== id)
        persistCache()

        onPhase?.('syncing')
        const synced = await fetchData({ forceRefresh: true, silent: !!onPhase })
        onPhase?.(synced ? 'done' : 'sync-failed')
        return { success: true, id: result.id, syncFailed: !synced }
      }
      return { success: false, error: '删除失败' }
    } catch (error) {
      if (error.message === 'Token expired') {
        return { success: false, error: '登录已过期，请重新登录' }
      }
      return { success: false, error: '网络错误' }
    }
  }

  const addCategory = async (name, parentId = null, isPrivate = false, description = '') => {
    try {
      const body = { name, is_private: isPrivate, description }
      if (parentId !== null) {
        body.parent_id = parentId
      }

      const response = await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify(body)
      })

      const result = await response.json()
      if (result.success) {
        await fetchData({ forceRefresh: true })
        return { success: true }
      }
      return { success: false, error: result.error || '添加失败' }
    } catch (error) {
      if (error.message === 'Token expired') {
        return { success: false, error: '登录已过期，请重新登录' }
      }
      return { success: false, error: '网络错误' }
    }
  }

  const updateCategory = async (id, name, parentId = undefined, isPrivate = undefined, description = undefined) => {
    try {
      const body = { name }
      if (parentId !== undefined) {
        body.parent_id = parentId
      }
      if (isPrivate !== undefined) {
        body.is_private = isPrivate
      }
      if (description !== undefined) {
        body.description = description
      }

      const response = await apiRequest(`/api/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
      })

      const result = await response.json()
      if (result.success) {
        await fetchData({ forceRefresh: true })
        return { success: true }
      }
      return { success: false, error: result.error || '更新失败' }
    } catch (error) {
      if (error.message === 'Token expired') {
        return { success: false, error: '登录已过期，请重新登录' }
      }
      return { success: false, error: error.message || '网络错误' }
    }
  }

  const deleteCategory = async (id, options = {}) => {
    try {
      const { cascade = 'ask' } = options
      const query = cascade === 'true' || cascade === 'false'
        ? `?cascade=${cascade}`
        : ''
      const response = await apiRequest(`/api/categories/${id}${query}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      if (result.success) {
        await fetchData({ forceRefresh: true })
        return { success: true, deletedBookmarks: result.deletedBookmarks }
      }
      if (result.needsDecision) {
        return {
          success: false,
          needsDecision: true,
          hasBookmarks: true,
          bookmarkCount: result.bookmarkCount
        }
      }
      return { success: false, error: '删除失败' }
    } catch (error) {
      if (error.message === 'Token expired') {
        return { success: false, error: '登录已过期，请重新登录' }
      }
      return { success: false, error: '网络错误' }
    }
  }

  const reorderItems = async (type, items) => {
    try {
      const response = await apiRequest('/api/reorder', {
        method: 'POST',
        body: JSON.stringify({ type, items })
      })

      const result = await response.json()
      if (result.success) {
        persistCache()
        await fetchData({ forceRefresh: true })
        return { success: true }
      }
      return { success: false, error: '排序失败' }
    } catch (error) {
      if (error.message === 'Token expired') {
        return { success: false, error: '登录已过期，请重新登录' }
      }
      return { success: false, error: '网络错误' }
    }
  }

  const batchOperation = async (operation, bookmarkIds, data = {}, categoryIds = null) => {
    try {
      const body = { operation, data }
      if (bookmarkIds) {
        body.bookmarkIds = bookmarkIds
      }
      if (categoryIds) {
        body.categoryIds = categoryIds
      }

      const response = await apiRequest('/api/batch-operations', {
        method: 'POST',
        body: JSON.stringify(body)
      })

      const result = await response.json()
      if (result.success) {
        await fetchData({ forceRefresh: true })
        return { success: true }
      }
      return { success: false, error: '批量操作失败' }
    } catch (error) {
      if (error.message === 'Token expired') {
        return { success: false, error: '登录已过期，请重新登录' }
      }
      return { success: false, error: '网络错误' }
    }
  }

  const getEmptyCategories = async () => {
    try {
      const response = await apiRequest('/api/cleanup-empty-categories', {
        method: 'GET'
      })

      const result = await response.json()
      if (result.success) {
        return {
          success: true,
          emptyCategories: result.emptyCategories || [],
          count: result.count || 0
        }
      }
      return { success: false, error: result.error || '获取空分类失败' }
    } catch (error) {
      if (error.message === 'Token expired') {
        return { success: false, error: '登录已过期，请重新登录' }
      }
      return { success: false, error: '网络错误' }
    }
  }

  const cleanupEmptyCategories = async () => {
    try {
      const response = await apiRequest('/api/cleanup-empty-categories', {
        method: 'POST'
      })

      const result = await response.json()
      if (result.success) {
        await fetchData({ forceRefresh: true })
        return {
          success: true,
          deletedCount: result.deletedCount || 0,
          deletedCategories: result.deletedCategories || []
        }
      }
      return { success: false, error: result.error || '清理空分类失败' }
    } catch (error) {
      if (error.message === 'Token expired') {
        return { success: false, error: '登录已过期，请重新登录' }
      }
      return { success: false, error: '网络错误' }
    }
  }

  return {
    categories,
    bookmarks,
    searchQuery,
    searchCategoryId,
    searchTags,
    dataSource,
    cacheUpdatedAt,
    refreshState,
    cacheWriteFailed,
    filteredBookmarks,
    bookmarksByCategory,
    allTags,
    fetchData,
    addBookmark,
    updateBookmark,
    deleteBookmark,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderItems,
    batchOperation,
    getEmptyCategories,
    cleanupEmptyCategories,
    clearCache
  }
}
