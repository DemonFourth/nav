import { ref, computed } from 'vue'
import { useAuth } from './useAuth'
import { useToast } from './useToast'
import { useBookmarks } from './useBookmarks'
import { buildTagStats, parseTags } from '@/utils/tagBrowse'

// 与旧 /api/tags 的 LIMIT 10 对齐：展开标签时最多列 10 条书签
const TAG_BOOKMARKS_LIMIT = 10

export function useTags() {
  const { apiRequest } = useAuth()
  const { success: toastSuccess, error: toastError } = useToast()
  const { bookmarks, refreshState, persistCache, fetchData } = useBookmarks()

  const searchQuery = ref('')
  const sortBy = ref('name')
  const sortOrder = ref('asc')
  const expandedTags = ref(new Set())

  // 标签列表直接由书签（含 localStorage 缓存）派生：
  // 首屏不再依赖 /api/tags，后台同步刷新书签后标签页自动跟着更新。
  const tags = computed(() => {
    const bookmarkLists = new Map()
    for (const bookmark of bookmarks.value) {
      for (const tag of parseTags(bookmark.tags)) {
        const key = tag.toLowerCase()
        const list = bookmarkLists.get(key) || []
        list.push(bookmark)
        bookmarkLists.set(key, list)
      }
    }

    return buildTagStats(bookmarks.value).map(({ name, count }) => ({
      name,
      count,
      bookmarks: (bookmarkLists.get(name.toLowerCase()) || [])
        .slice()
        .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
        .slice(0, TAG_BOOKMARKS_LIMIT)
    }))
  })

  // 只有“完全没数据且正在刷新”才显示加载态；有缓存就先渲染
  const loading = computed(
    () => bookmarks.value.length === 0 && refreshState.value === 'refreshing'
  )

  const filteredTags = computed(() => {
    let result = [...tags.value]

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      result = result.filter(tag => 
        tag.name.toLowerCase().includes(query)
      )
    }

    result.sort((a, b) => {
      let comparison = 0
      if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'count') {
        comparison = a.count - b.count
      }
      return sortOrder.value === 'asc' ? comparison : -comparison
    })

    return result
  })

  const normalizeTagSequence = (list) => {
    const seen = new Set()
    const result = []
    for (const tag of list) {
      const key = tag.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      result.push(tag)
    }
    return result
  }

  // 就地改写内存中的 bookmarks.tags，并立刻落缓存：
  // 服务端写成功后先本地生效，后台 fetchData 再对齐云端并刷新缓存。
  const writeTagToBookmarks = (mutator) => {
    let changed = false
    const next = bookmarks.value.map(bookmark => {
      const current = parseTags(bookmark.tags)
      if (current.length === 0) return bookmark
      const updated = mutator(current)
      if (!updated) return bookmark
      changed = true
      return { ...bookmark, tags: updated.join(',') }
    })
    if (changed) {
      bookmarks.value = next
      persistCache()
    }
    return changed
  }

  const applyTagRename = (oldName, newName) => {
    const target = oldName.toLowerCase()
    writeTagToBookmarks(list => {
      if (!list.some(tag => tag.toLowerCase() === target)) return null
      return normalizeTagSequence(
        list.map(tag => (tag.toLowerCase() === target ? newName : tag))
      )
    })

    if (expandedTags.value.has(oldName)) {
      const next = new Set(expandedTags.value)
      next.delete(oldName)
      next.add(newName)
      expandedTags.value = next
    }
  }

  const applyTagDelete = (name) => {
    const target = name.toLowerCase()
    writeTagToBookmarks(list => {
      if (!list.some(tag => tag.toLowerCase() === target)) return null
      return list.filter(tag => tag.toLowerCase() !== target)
    })

    if (expandedTags.value.has(name)) {
      const next = new Set(expandedTags.value)
      next.delete(name)
      expandedTags.value = next
    }
  }

  const renameTag = async (oldName, newName) => {
    try {
      const response = await apiRequest(`/api/tags/${encodeURIComponent(oldName)}`, {
        method: 'PUT',
        body: JSON.stringify({ newName })
      })
      const result = await response.json()
      
      if (result.success) {
        applyTagRename(oldName, newName)
        fetchData({ forceRefresh: true, silent: true }).catch(() => {})
        if (result.merged) {
          toastSuccess(`已将书签合并到"${newName}"`)
        } else {
          toastSuccess(`标签已重命名为"${newName}"`)
        }
        return { success: true, merged: result.merged }
      } else {
        toastError(result.error || '重命名失败')
        return { success: false, error: result.error }
      }
    } catch (error) {
      toastError('网络错误')
      return { success: false, error: '网络错误' }
    }
  }

  const deleteTag = async (name) => {
    try {
      const response = await apiRequest(`/api/tags/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      
      if (result.success) {
        applyTagDelete(name)
        fetchData({ forceRefresh: true, silent: true }).catch(() => {})
        toastSuccess(`已从${result.affectedCount}个书签中移除标签`)
        return { success: true }
      } else {
        toastError(result.error || '删除失败')
        return { success: false, error: result.error }
      }
    } catch (error) {
      toastError('网络错误')
      return { success: false, error: '网络错误' }
    }
  }

  const toggleExpand = (tagName) => {
    const next = new Set(expandedTags.value)
    if (next.has(tagName)) {
      next.delete(tagName)
    } else {
      next.add(tagName)
    }
    expandedTags.value = next
  }

  return {
    tags,
    loading,
    searchQuery,
    sortBy,
    sortOrder,
    expandedTags,
    filteredTags,
    renameTag,
    deleteTag,
    toggleExpand
  }
}
