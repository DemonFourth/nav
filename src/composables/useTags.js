import { ref, computed } from 'vue'
import { useAuth } from './useAuth'
import { useToast } from './useToast'
import { useBookmarks } from './useBookmarks'

export function useTags() {
  const { apiRequest } = useAuth()
  const { success: toastSuccess, error: toastError } = useToast()
  const { fetchData } = useBookmarks()

  const tags = ref([])
  const loading = ref(false)
  const searchQuery = ref('')
  const sortBy = ref('name')
  const sortOrder = ref('asc')
  const expandedTags = ref(new Set())

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

  const fetchTags = async () => {
    loading.value = true
    try {
      const response = await apiRequest('/api/tags')
      const result = await response.json()
      if (result.success) {
        tags.value = result.data
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error)
      toastError('获取标签列表失败')
    } finally {
      loading.value = false
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
        await fetchTags()
        await fetchData({ forceRefresh: true })
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
        await fetchTags()
        await fetchData({ forceRefresh: true })
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
    if (expandedTags.value.has(tagName)) {
      expandedTags.value.delete(tagName)
    } else {
      expandedTags.value.add(tagName)
    }
  }

  return {
    tags,
    loading,
    searchQuery,
    sortBy,
    sortOrder,
    expandedTags,
    filteredTags,
    fetchTags,
    renameTag,
    deleteTag,
    toggleExpand
  }
}
