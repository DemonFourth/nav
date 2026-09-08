# 标签管理功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现统一的标签管理功能，支持查看、重命名、删除标签，以及搜索和排序

**Architecture:** 混合实现 - 前端利用现有数据展示标签列表，后端新增API处理重命名/删除操作

**Tech Stack:** Vue 3 (Composition API), Cloudflare Workers, D1 (SQLite)

## Global Constraints

- Vue组件使用 `<script setup>` 语法
- API调用通过 `useAuth` 的 `apiRequest()` 添加认证头
- CSS使用项目现有的主题变量（`--nav-*`, `--text-*`, `--border` 等）
- 组件命名：PascalCase（`TagManagement.vue`）
- Composable命名：camelCase with `use` prefix（`useTags.js`）

---

## File Structure

### 前端文件（新增）

| 文件 | 职责 |
|------|------|
| `src/composables/useTags.js` | 标签管理状态和方法 |
| `src/components/TagManagement.vue` | 标签管理Tab组件 |
| `src/components/TagRenameDialog.vue` | 重命名标签弹窗 |

### 后端文件（新增）

| 文件 | 职责 |
|------|------|
| `functions/api/tags/index.js` | GET: 获取标签列表 |
| `functions/api/tags/[name].js` | PUT: 重命名 / DELETE: 删除 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/components/NavSettingsModal.vue` | 添加标签管理Tab |

---

## Task 1: 创建 useTags.js Composable

**Files:**
- Create: `src/composables/useTags.js`

**Interfaces:**
- Produces: `useTags()` composable，包含 `tags`, `loading`, `searchQuery`, `sortBy`, `sortOrder`, `expandedTags`, `filteredTags`, `fetchTags`, `renameTag`, `deleteTag`, `toggleExpand`

- [ ] **Step 1: 创建 useTags.js 文件**

```javascript
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
```

- [ ] **Step 2: 验证文件语法**

运行: `npm run build` 确保没有语法错误

- [ ] **Step 3: Commit**

```bash
git add src/composables/useTags.js
git commit -m "feat: add useTags composable for tag management"
```

---

## Task 2: 创建 TagRenameDialog.vue 组件

**Files:**
- Create: `src/components/TagRenameDialog.vue`

**Interfaces:**
- Consumes: `useTags` composable 的 `renameTag` 方法
- Produces: `TagRenameDialog` 组件，暴露 `open(tag)` 方法

- [ ] **Step 1: 创建 TagRenameDialog.vue 文件**

```vue
<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="dialog-overlay" @click="close">
        <div class="dialog-menu" @click.stop>
          <div class="dialog-header">
            <h3>重命名标签</h3>
            <button class="dialog-close" @click="close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          
          <div class="dialog-body">
            <div class="form-group">
              <label>当前标签名</label>
              <div class="current-name">{{ originalName }}</div>
            </div>
            
            <div class="form-group">
              <label>新标签名</label>
              <input 
                v-model="newName" 
                type="text" 
                placeholder="请输入新标签名"
                maxlength="50"
                @input="checkNameExists"
                @keyup.enter="handleSubmit"
                ref="inputRef"
              >
              <span class="char-count">{{ newName.length }}/50</span>
            </div>
            
            <div v-if="nameExists" class="warning-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <span>标签"{{ newName }}"已存在，继续将合并标签</span>
            </div>
            
            <div v-if="error" class="error-message">{{ error }}</div>
          </div>
          
          <div class="dialog-footer">
            <button class="btn btn-secondary" @click="close">取消</button>
            <button class="btn btn-primary" @click="handleSubmit" :disabled="!canSubmit">
              {{ nameExists ? '确认合并' : '确认重命名' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'

const props = defineProps({
  tags: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['confirm'])

const show = ref(false)
const originalName = ref('')
const newName = ref('')
const nameExists = ref(false)
const error = ref('')
const inputRef = ref(null)

const canSubmit = computed(() => {
  return newName.value.trim() && 
         newName.value.trim() !== originalName.value &&
         !error.value
})

const open = (tag) => {
  originalName.value = tag.name
  newName.value = tag.name
  nameExists.value = false
  error.value = ''
  show.value = true
  
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus()
      inputRef.value.select()
    }
  })
}

const close = () => {
  show.value = false
}

const checkNameExists = () => {
  error.value = ''
  const trimmed = newName.value.trim()
  
  if (!trimmed) {
    nameExists.value = false
    return
  }
  
  if (trimmed === originalName.value) {
    nameExists.value = false
    return
  }
  
  nameExists.value = props.tags.some(t => t.name === trimmed)
}

const handleSubmit = async () => {
  const trimmed = newName.value.trim()
  
  if (!trimmed) {
    error.value = '请输入标签名'
    return
  }
  
  if (trimmed === originalName.value) {
    error.value = '新名称与原名称相同'
    return
  }
  
  if (trimmed.includes(',')) {
    error.value = '标签名不能包含逗号'
    return
  }
  
  emit('confirm', {
    oldName: originalName.value,
    newName: trimmed
  })
  
  close()
}

defineExpose({
  open
})
</script>

<style>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: var(--nav-glass);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
}

.dialog-menu {
  background: var(--nav-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--nav-border);
  border-radius: 16px;
  width: 90%;
  max-width: 440px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 48px var(--shadow-xl);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--card-border);
}

.dialog-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.dialog-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.dialog-close:hover {
  background: color-mix(in srgb, var(--error) 12%, transparent);
  color: var(--error);
}

.dialog-body {
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--card-border);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text);
  font-size: 0.95rem;
  transition: var(--transition);
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent);
}

.current-name {
  padding: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 0.95rem;
}

.char-count {
  display: block;
  text-align: right;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 0.25rem;
}

.warning-box {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  background: color-mix(in srgb, var(--warning) 10%, transparent);
  border: 1px solid var(--warning);
  border-radius: var(--radius-sm);
  color: var(--warning);
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.warning-box svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}

.error-message {
  padding: 0.75rem;
  background: color-mix(in srgb, var(--error) 10%, transparent);
  border: 1px solid var(--error);
  border-radius: var(--radius-sm);
  color: var(--error);
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.btn {
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
  border: none;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--primary) 90%, black);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .dialog-menu,
.modal-leave-to .dialog-menu {
  transform: scale(0.95) translateY(10px);
}
</style>
```

- [ ] **Step 2: 验证组件语法**

运行: `npm run build` 确保没有语法错误

- [ ] **Step 3: Commit**

```bash
git add src/components/TagRenameDialog.vue
git commit -m "feat: add TagRenameDialog component"
```

---

## Task 3: 创建 TagManagement.vue 组件

**Files:**
- Create: `src/components/TagManagement.vue`

**Interfaces:**
- Consumes: `useTags` composable, `TagRenameDialog` 组件, `ConfirmDialog` 组件
- Produces: `TagManagement` 组件（设置页面的一个Tab）

- [ ] **Step 1: 创建 TagManagement.vue 文件**

```vue
<template>
  <div class="tag-management">
    <div class="panel-header">
      <h2 class="panel-title">标签管理</h2>
      <p class="panel-desc">管理书签标签，支持重命名和删除</p>
    </div>

    <div class="tag-toolbar">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="搜索标签..."
          class="search-input"
        >
      </div>
      
      <div class="sort-controls">
        <button 
          class="sort-btn" 
          :class="{ active: sortBy === 'name' }"
          @click="toggleSortBy('name')"
        >
          名称
          <svg v-if="sortBy === 'name'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14">
            <path v-if="sortOrder === 'asc'" d="M18 15l-6-6-6 6"/>
            <path v-else d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        
        <button 
          class="sort-btn" 
          :class="{ active: sortBy === 'count' }"
          @click="toggleSortBy('count')"
        >
          数量
          <svg v-if="sortBy === 'count'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14">
            <path v-if="sortOrder === 'asc'" d="M18 15l-6-6-6 6"/>
            <path v-else d="M6 9l6 6 6-6"/>
          </svg>
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <div v-else-if="filteredTags.length === 0" class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
        <line x1="7" y1="7" x2="7.01" y2="7"/>
      </svg>
      <p>{{ searchQuery ? '没有找到匹配的标签' : '暂无标签' }}</p>
    </div>

    <div v-else class="tag-list">
      <div class="tag-table-header">
        <span class="col-name">标签名</span>
        <span class="col-count">书签数量</span>
        <span class="col-actions">操作</span>
      </div>
      
      <div 
        v-for="tag in filteredTags" 
        :key="tag.name" 
        class="tag-row-wrapper"
      >
        <div 
          class="tag-row" 
          :class="{ expanded: expandedTags.has(tag.name) }"
          @click="toggleExpand(tag.name)"
        >
          <span class="col-name">
            <svg 
              class="expand-icon" 
              :class="{ rotated: expandedTags.has(tag.name) }"
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.5" 
              width="16" 
              height="16"
            >
              <path d="M9 18l6-6-6-6"/>
            </svg>
            {{ tag.name }}
          </span>
          <span class="col-count">
            <span class="count-badge">{{ tag.count }}</span>
          </span>
          <span class="col-actions" @click.stop>
            <button class="action-btn edit" @click="openRenameDialog(tag)" title="编辑">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="action-btn delete" @click="confirmDelete(tag)" title="删除">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </span>
        </div>
        
        <div v-if="expandedTags.has(tag.name)" class="expanded-content">
          <div v-if="tag.bookmarks && tag.bookmarks.length > 0" class="bookmark-list">
            <div 
              v-for="bookmark in tag.bookmarks" 
              :key="bookmark.id" 
              class="bookmark-item"
            >
              <span class="bookmark-name">{{ bookmark.name }}</span>
              <a :href="bookmark.url" target="_blank" rel="noopener" class="bookmark-url">
                {{ truncateUrl(bookmark.url) }}
              </a>
            </div>
          </div>
          <div v-else class="no-bookmarks">
            该标签下暂无书签
          </div>
        </div>
      </div>
    </div>

    <div class="tag-summary">
      共 {{ tags.length }} 个标签，{{ totalBookmarksWithTags }} 个书签使用标签
    </div>

    <TagRenameDialog 
      ref="renameDialogRef" 
      :tags="tags"
      @confirm="handleRenameConfirm"
    />
    
    <ConfirmDialog ref="confirmDialogRef" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTags } from '@/composables/useTags'
import TagRenameDialog from './TagRenameDialog.vue'
import ConfirmDialog from './ConfirmDialog.vue'

const {
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
} = useTags()

const renameDialogRef = ref(null)
const confirmDialogRef = ref(null)

const totalBookmarksWithTags = computed(() => {
  return tags.value.reduce((sum, tag) => sum + tag.count, 0)
})

const truncateUrl = (url) => {
  try {
    const u = new URL(url)
    return u.hostname + (u.pathname.length > 20 ? u.pathname.slice(0, 20) + '...' : u.pathname)
  } catch {
    return url.slice(0, 40) + (url.length > 40 ? '...' : '')
  }
}

const toggleSortBy = (field) => {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortOrder.value = 'asc'
  }
}

const openRenameDialog = (tag) => {
  renameDialogRef.value?.open(tag)
}

const handleRenameConfirm = async ({ oldName, newName }) => {
  await renameTag(oldName, newName)
}

const confirmDelete = async (tag) => {
  const confirmed = await confirmDialogRef.value?.open(
    `确定删除标签"${tag.name}"吗？将从${tag.count}个书签中移除该标签。`,
    '删除标签'
  )
  
  if (confirmed) {
    await deleteTag(tag.name)
  }
}

onMounted(() => {
  fetchTags()
})
</script>

<style scoped>
.tag-management {
  max-width: 800px;
}

.panel-header {
  margin-bottom: 1.5rem;
}

.panel-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 0.5rem 0;
}

.panel-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

.tag-toolbar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.search-box {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.search-box svg {
  position: absolute;
  left: 0.75rem;
  color: var(--text-tertiary);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.625rem 0.75rem 0.625rem 2.25rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text);
  font-size: 0.875rem;
  transition: var(--transition);
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent);
}

.sort-controls {
  display: flex;
  gap: 0.25rem;
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: var(--transition);
}

.sort-btn:hover {
  background: var(--bg-hover);
}

.sort-btn.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--text-secondary);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--text-tertiary);
}

.empty-state svg {
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
}

.tag-list {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.tag-table-header {
  display: grid;
  grid-template-columns: 1fr 100px 100px;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.tag-row-wrapper {
  border-bottom: 1px solid var(--border);
}

.tag-row-wrapper:last-child {
  border-bottom: none;
}

.tag-row {
  display: grid;
  grid-template-columns: 1fr 100px 100px;
  padding: 0.75rem 1rem;
  align-items: center;
  cursor: pointer;
  transition: var(--transition);
}

.tag-row:hover {
  background: var(--bg-hover);
}

.tag-row.expanded {
  background: var(--bg-secondary);
}

.col-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: var(--text);
}

.expand-icon {
  transition: transform 0.2s;
  flex-shrink: 0;
}

.expand-icon.rotated {
  transform: rotate(90deg);
}

.col-count {
  text-align: center;
}

.count-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.col-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
}

.action-btn:hover {
  background: var(--bg-hover);
}

.action-btn.edit:hover {
  color: var(--primary);
}

.action-btn.delete:hover {
  color: var(--error);
  background: color-mix(in srgb, var(--error) 10%, transparent);
}

.expanded-content {
  padding: 0 1rem 1rem 2.5rem;
  background: var(--bg-secondary);
}

.bookmark-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bookmark-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
}

.bookmark-name {
  flex: 1;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bookmark-url {
  color: var(--text-tertiary);
  text-decoration: none;
  font-size: 0.75rem;
}

.bookmark-url:hover {
  color: var(--primary);
  text-decoration: underline;
}

.no-bookmarks {
  padding: 1rem;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 0.875rem;
}

.tag-summary {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-align: center;
}

@media (max-width: 600px) {
  .tag-toolbar {
    flex-direction: column;
  }
  
  .tag-table-header,
  .tag-row {
    grid-template-columns: 1fr 70px 80px;
  }
  
  .col-actions {
    gap: 0.25rem;
  }
  
  .action-btn {
    width: 28px;
    height: 28px;
  }
}
</style>
```

- [ ] **Step 2: 验证组件语法**

运行: `npm run build` 确保没有语法错误

- [ ] **Step 3: Commit**

```bash
git add src/components/TagManagement.vue
git commit -m "feat: add TagManagement component"
```

---

## Task 4: 创建后端 API - GET /api/tags

**Files:**
- Create: `functions/api/tags/index.js`

**Interfaces:**
- Produces: GET `/api/tags` 端点，返回标签列表及书签数量

- [ ] **Step 1: 创建 functions/api/tags/index.js 文件**

```javascript
// GET list all tags with bookmark counts
export async function onRequestGet(context) {
  const { env, request } = context;
  
  try {
    // Check authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Query to split comma-separated tags and count occurrences
    const query = `
      WITH RECURSIVE SplitTags AS (
        SELECT 
          id,
          name,
          url,
          TRIM(SUBSTR(tags, 1, CASE WHEN INSTR(tags, ',') > 0 THEN INSTR(tags, ',') - 1 ELSE LENGTH(tags) END)) as tag,
          CASE 
            WHEN INSTR(tags, ',') > 0 THEN SUBSTR(tags, INSTR(tags, ',') + 1)
            ELSE NULL
          END as remaining
        FROM bookmarks
        WHERE tags != '' AND tags IS NOT NULL AND tags != ' '
        
        UNION ALL
        
        SELECT 
          id,
          name,
          url,
          TRIM(SUBSTR(remaining, 1, CASE WHEN INSTR(remaining, ',') > 0 THEN INSTR(remaining, ',') - 1 ELSE LENGTH(remaining) END)),
          CASE 
            WHEN INSTR(remaining, ',') > 0 THEN SUBSTR(remaining, INSTR(remaining, ',') + 1)
            ELSE NULL
          END
        FROM SplitTags
        WHERE remaining IS NOT NULL AND TRIM(remaining) != ''
      )
      SELECT 
        tag as name,
        COUNT(*) as count,
        GROUP_CONCAT(id) as bookmark_ids
      FROM SplitTags
      WHERE tag IS NOT NULL AND TRIM(tag) != ''
      GROUP BY tag
      ORDER BY tag
    `;

    const result = await env.DB.prepare(query).all();
    
    // Process results and fetch bookmark details for each tag
    const tags = [];
    
    for (const row of result.results) {
      const bookmarkIds = row.bookmark_ids.split(',').map(Number);
      
      // Fetch bookmark details
      const placeholders = bookmarkIds.map(() => '?').join(',');
      const bookmarksResult = await env.DB.prepare(
        `SELECT id, name, url FROM bookmarks WHERE id IN (${placeholders}) LIMIT 10`
      ).bind(...bookmarkIds).all();
      
      tags.push({
        name: row.name,
        count: row.count,
        bookmarks: bookmarksResult.results || []
      });
    }
    
    // Calculate summary
    const totalTags = tags.length;
    const totalBookmarksWithTags = tags.reduce((sum, tag) => sum + tag.count, 0);
    
    return new Response(JSON.stringify({ 
      success: true, 
      data: tags,
      summary: {
        totalTags,
        totalBookmarksWithTags
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to fetch tags:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch tags' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

- [ ] **Step 2: 验证API语法**

运行: `npm run build` 确保没有语法错误

- [ ] **Step 3: Commit**

```bash
git add functions/api/tags/index.js
git commit -m "feat: add GET /api/tags endpoint"
```

---

## Task 5: 创建后端 API - PUT/DELETE /api/tags/[name]

**Files:**
- Create: `functions/api/tags/[name].js`

**Interfaces:**
- Produces: PUT `/api/tags/:name` (重命名) 和 DELETE `/api/tags/:name` (删除)

- [ ] **Step 1: 创建 functions/api/tags/[name].js 文件**

```javascript
// PUT rename tag
export async function onRequestPut(context) {
  const { env, request, params } = context;
  const oldName = decodeURIComponent(params.name);
  
  try {
    // Check authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const body = await request.json();
    const { newName } = body;
    
    // Validate new name
    if (!newName || !newName.trim()) {
      return new Response(JSON.stringify({ error: '标签名不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (newName.includes(',')) {
      return new Response(JSON.stringify({ error: '标签名不能包含逗号' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const trimmedNewName = newName.trim();
    
    // Check if old tag exists
    const checkOldTag = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM bookmarks WHERE tags LIKE ?`
    ).bind(`%${oldName}%`).first();
    
    if (checkOldTag.count === 0) {
      return new Response(JSON.stringify({ error: '标签不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if new name already exists
    const checkNewTag = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM bookmarks WHERE tags LIKE ?`
    ).bind(`%${trimmedNewName}%`).first();
    
    const merged = checkNewTag.count > 0;
    
    // Update bookmarks - replace old tag with new tag
    const affectedResult = await env.DB.prepare(
      `UPDATE bookmarks 
       SET tags = TRIM(REPLACE(
         REPLACE(tags, ?, ?),
         ?, ?
       )),
       updated_at = CURRENT_TIMESTAMP
       WHERE tags LIKE ?`
    ).bind(
      `${oldName},`, `${trimmedNewName},`,
      `,${oldName}`, `,${trimmedNewName}`,
      `%${oldName}%`
    ).run();
    
    // Also handle case where old tag is the only tag
    await env.DB.prepare(
      `UPDATE bookmarks 
       SET tags = ?,
       updated_at = CURRENT_TIMESTAMP
       WHERE tags = ?`
    ).bind(trimmedNewName, oldName).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      merged,
      affectedCount: affectedResult.meta?.changes || 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to rename tag:', error);
    return new Response(JSON.stringify({ error: 'Failed to rename tag' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// DELETE remove tag
export async function onRequestDelete(context) {
  const { env, request, params } = context;
  const tagName = decodeURIComponent(params.name);
  
  try {
    // Check authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if tag exists
    const checkTag = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM bookmarks WHERE tags LIKE ?`
    ).bind(`%${tagName}%`).first();
    
    if (checkTag.count === 0) {
      return new Response(JSON.stringify({ error: '标签不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Remove tag from bookmarks
    // Handle: "tag, other" -> "other"
    const result1 = await env.DB.prepare(
      `UPDATE bookmarks 
       SET tags = TRIM(REPLACE(tags, ?, '')),
       updated_at = CURRENT_TIMESTAMP
       WHERE tags LIKE ?`
    ).bind(`${tagName},`, `%${tagName},%`).run();
    
    // Handle: "other, tag" -> "other"
    const result2 = await env.DB.prepare(
      `UPDATE bookmarks 
       SET tags = TRIM(REPLACE(tags, ?, '')),
       updated_at = CURRENT_TIMESTAMP
       WHERE tags LIKE ?`
    ).bind(`,${tagName}`, `%,${tagName}%`).run();
    
    // Handle: "tag" -> ""
    const result3 = await env.DB.prepare(
      `UPDATE bookmarks 
       SET tags = '',
       updated_at = CURRENT_TIMESTAMP
       WHERE tags = ?`
    ).bind(tagName).run();
    
    const totalAffected = (result1.meta?.changes || 0) + 
                          (result2.meta?.changes || 0) + 
                          (result3.meta?.changes || 0);
    
    return new Response(JSON.stringify({ 
      success: true, 
      affectedCount: totalAffected
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to delete tag:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete tag' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

- [ ] **Step 2: 验证API语法**

运行: `npm run build` 确保没有语法错误

- [ ] **Step 3: Commit**

```bash
git add functions/api/tags/[name].js
git commit -m "feat: add PUT/DELETE /api/tags/:name endpoints"
```

---

## Task 6: 集成到 NavSettingsModal.vue

**Files:**
- Modify: `src/components/NavSettingsModal.vue`

**Interfaces:**
- Consumes: `TagManagement` 组件

- [ ] **Step 1: 在 NavSettingsModal.vue 中添加标签管理Tab**

找到 `tabs` 数组定义，在 `bookmark` 和 `trend` 之间添加新tab：

```javascript
const tabs = [
  {
    id: 'appearance', name: '外观',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33"/><path d="M4.6 9a1.65 1.65 0 0 1-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 1 8.92 4.6"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>'
  },
  {
    id: 'data', name: '数据',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>'
  },
  {
    id: 'menu', name: '菜单',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>'
  },
  {
    id: 'bookmark', name: '书签',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>'
  },
  {
    id: 'tags', name: '标签',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>'
  },
  {
    id: 'trend', name: '趋势',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>'
  },
  // ... 其他tabs
];
```

- [ ] **Step 2: 添加 TagManagement 组件的导入和渲染**

在 `<script setup>` 中添加导入：

```javascript
import TagManagement from './settings/TagManagement.vue'
```

在 `<template>` 中的 `settings-content` 区域添加渲染：

```vue
<!-- Tags -->
<div v-show="activeTab === 'tags'" class="tab-panel">
  <TagManagement />
</div>
```

- [ ] **Step 3: 验证集成**

运行: `npm run dev` 启动开发服务器，验证标签管理Tab正常显示

- [ ] **Step 4: Commit**

```bash
git add src/components/NavSettingsModal.vue
git commit -m "feat: integrate TagManagement into NavSettingsModal"
```

---

## Task 7: 端到端测试

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 测试获取标签列表**

打开浏览器，访问 http://localhost:3000，登录后打开设置，点击"标签"Tab，验证：
- 标签列表正确显示
- 搜索功能正常
- 排序功能正常
- 展开/折叠功能正常

- [ ] **Step 3: 测试重命名标签**

点击某个标签的[编辑]按钮，验证：
- 弹窗正确显示
- 输入新名称后实时检查是否已存在
- 重命名成功后列表刷新
- Toast提示正确显示

- [ ] **Step 4: 测试删除标签**

点击某个标签的[删除]按钮，验证：
- 确认弹窗正确显示
- 删除成功后列表刷新
- 书签中的标签被正确移除

- [ ] **Step 5: 构建生产版本**

```bash
npm run build
```

确保没有构建错误。

---

## Self-Review Checklist

- [x] Spec coverage: 所有需求都有对应任务
- [x] Placeholder scan: 无TBD/TODO
- [x] Type consistency: 方法名、参数名一致
- [x] 文件结构清晰，职责分离
- [x] 错误处理完整
- [x] 验证规则前后端一致
