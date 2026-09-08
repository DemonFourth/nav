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
              <div class="bookmark-icon">
                <img
                  v-if="bookmark.url && getBookmarkHostname(bookmark.url) && !iconErrors[bookmark.id]"
                  :src="`https://www.google.com/s2/favicons?domain=${getBookmarkHostname(bookmark.url)}&sz=32`"
                  alt=""
                  @error="() => handleIconError(bookmark.id)"
                />
                <div v-if="!bookmark.url || !getBookmarkHostname(bookmark.url) || iconErrors[bookmark.id]" class="letter-icon">
                  {{ bookmark.name.charAt(0) }}
                </div>
              </div>
              <div class="bookmark-info">
                <div class="bookmark-name">{{ bookmark.name }}</div>
                <div class="bookmark-meta">{{ getCategoryPathForBookmark(bookmark.category_id) }}</div>
              </div>
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
import { useBookmarks } from '@/composables/useBookmarks'
import { buildCategoryTree, getCategoryPath } from '@/utils/categoryTree'
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

const { categories } = useBookmarks()

const renameDialogRef = ref(null)
const confirmDialogRef = ref(null)
const iconErrors = ref({})

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

const getBookmarkHostname = (url) => {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

const handleIconError = (id) => {
  iconErrors.value[id] = true
}

function getCategoryPathForBookmark(categoryId) {
  if (!categoryId) return '无分类'
  const { map } = buildCategoryTree(categories.value)
  const path = getCategoryPath(categoryId, map)
  return path.map(c => c.name).join(' / ')
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
  width: 100%;
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
  padding: 0;
  background: var(--bg-secondary);
}

.bookmark-list {
  display: flex;
  flex-direction: column;
}

.bookmark-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid var(--border);
}

.bookmark-item:last-child {
  border-bottom: none;
}

.bookmark-item:hover {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.bookmark-icon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  flex-shrink: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bookmark-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.letter-icon {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.bookmark-info {
  flex: 1;
  min-width: 0;
}

.bookmark-name {
  font-size: 0.85rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bookmark-meta {
  display: inline-block;
  font-size: 0.7rem;
  color: var(--text-secondary);
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: 9999px;
  background: color-mix(in srgb, var(--bg-secondary) 60%, transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  margin-top: 2px;
}

.bookmark-url {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-tertiary);
  text-decoration: none;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bookmark-url:hover {
  color: var(--primary);
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
