import { ref, computed } from 'vue'
import { useAuth } from './useAuth'
import { useToast } from './useToast'

const CACHE_KEY = 'nav_bookmarks_cache'
const CACHE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

const categories = ref([])
const bookmarks = ref([])
const searchQuery = ref('')
const searchCategoryId = ref(null)
const searchTags = ref([])

function getCacheKey(isAuth) {
  return isAuth ? `${CACHE_KEY}_auth` : `${CACHE_KEY}_public`
}

function loadFromCache(isAuth) {
  try {
    const cacheKey = getCacheKey(isAuth)
    const cached = localStorage.getItem(cacheKey)
    if (!cached) return null

    const { data, timestamp } = JSON.parse(cached)
    const isExpired = Date.now() - timestamp > CACHE_EXPIRY_MS

    if (isExpired) {
      localStorage.removeItem(cacheKey)
      return null
    }

    return data
  } catch {
    return null
  }
}

function saveToCache(isAuth, data) {
  try {
    const cacheKey = getCacheKey(isAuth)
    const cacheData = {
      data,
      timestamp: Date.now()
    }
    localStorage.setItem(cacheKey, JSON.stringify(cacheData))
  } catch (e) {
    console.warn('Failed to save cache:', e)
  }
}

function clearCache() {
  localStorage.removeItem(`${CACHE_KEY}_auth`)
  localStorage.removeItem(`${CACHE_KEY}_public`)
}

export function useBookmarks() {
  const { getAuthHeaders, logout, apiRequest, isAuthenticated } = useAuth()
  const { error: toastError } = useToast()


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
    const { forceRefresh = false, background = false } = options
    const isAuth = isAuthenticated.value

    // Load from cache first (instant)
    if (!forceRefresh) {
      const cached = loadFromCache(isAuth)
      if (cached) {
        categories.value = cached.categories || []
        bookmarks.value = cached.bookmarks || []
      }
    }

    const doFetch = async () => {
      try {
        const authHeaders = getAuthHeaders()

        const categoriesRes = await fetch('/api/categories', {
          headers: authHeaders
        })

        if (categoriesRes.status === 401) {
          if (authHeaders.Authorization) {
            logout()
          }
          categories.value = []
          bookmarks.value = []
          clearCache()
          return
        }

        const categoriesData = await categoriesRes.json()
        categories.value = categoriesData.data || []

        const bookmarksRes = await fetch('/api/bookmarks', {
          headers: authHeaders
        })

        if (bookmarksRes.status === 401) {
          if (authHeaders.Authorization) {
            logout()
          }
          bookmarks.value = []
          return
        }

        const bookmarksData = await bookmarksRes.json()
        bookmarks.value = bookmarksData.data || []

        // Save to cache
        saveToCache(isAuth, {
          categories: categories.value,
          bookmarks: bookmarks.value
        })
      } catch (error) {
        console.error('Failed to fetch data:', error)
      }
    }

    if (background) {
      doFetch()
    } else {
      await doFetch()
    }
  }

  const addBookmark = async (data) => {
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
        await fetchData({ forceRefresh: true })
        return { success: true }
      }
      return { success: false, error: result.error || '添加失败' }
    } catch (error) {
      return { success: false, error: '网络错误' }
    }
  }

  const updateBookmark = async (id, data) => {
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
        fetchData({ forceRefresh: true })
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

  const deleteBookmark = async (id) => {
    try {
      const response = await apiRequest(`/api/bookmarks/${id}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      if (result.success) {
        await fetchData({ forceRefresh: true })
        return { success: true, id: result.id }
      }
      return { success: false, error: '删除失败' }
    } catch (error) {
      if (error.message === 'Token expired') {
        return { success: false, error: '登录已过期，请重新登录' }
      }
      return { success: false, error: '网络错误' }
    }
  }

  const addCategory = async (name, parentId = null, isPrivate = false) => {
    try {
      const body = { name, is_private: isPrivate }
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

  const updateCategory = async (id, name, parentId = undefined, isPrivate = undefined) => {
    try {
      const body = { name }
      if (parentId !== undefined) {
        body.parent_id = parentId
      }
      if (isPrivate !== undefined) {
        body.is_private = isPrivate
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
