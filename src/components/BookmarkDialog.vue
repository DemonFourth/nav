<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="dialog-overlay" @click="close">
        <div class="dialog-box bookmark-dialog" @click.stop>
          <h3 class="dialog-title">{{ isEdit ? '编辑书签' : '添加书签' }}</h3>
          
          <div class="form-group">
            <label>名称 *</label>
            <input v-model="form.name" type="text" placeholder="请输入名称">
          </div>
          
          <div class="form-group">
            <label>URL *</label>
            <div class="url-input-group">
              <input v-model="form.url" type="text" placeholder="https://example.com">
              <button 
                type="button"
                class="fetch-btn" 
                :disabled="!form.url || fetching"
                @click="fetchMetadata"
              >
                <svg v-if="!fetching" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                </svg>
                <div v-else class="mini-spinner"></div>
                {{ fetching ? '获取中...' : '自动获取' }}
              </button>
            </div>
          </div>
          
          <div class="form-group">
            <label>描述</label>
            <div class="description-input-group">
              <input v-model="form.description" type="text" placeholder="可选">
              <button 
                v-if="aiEnabled"
                type="button"
                class="ai-generate-btn" 
                :disabled="!form.name || !form.url || generatingDesc"
                @click="handleGenerateDescription"
                :title="'AI 生成描述'"
              >
                <svg v-if="!generatingDesc" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
                <div v-else class="mini-spinner"></div>
                {{ generatingDesc ? 'AI生成中...' : 'AI生成' }}
              </button>
            </div>
          </div>
          
          <div class="form-group">
            <label>图标URL</label>
            <input v-model="form.icon" type="text" placeholder="可选，留空自动获取">
          </div>
          
          <div class="form-group">
            <label>分类 *</label>
            <div class="category-input-group">
              <div class="custom-select" :class="{ open: selectOpen }">
                <div class="select-trigger" @click="selectOpen = !selectOpen">
                  <span class="select-value">{{ selectedCategoryName || '请选择分类' }}</span>
                  <svg class="select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </div>
                <div v-if="selectOpen" class="select-dropdown">
                  <input 
                    v-model="selectSearch"
                    type="text"
                    class="select-search"
                    placeholder="搜索分类..."
                    @click.stop
                    ref="selectSearchInput"
                  />
                  <div class="select-options">
                    <div 
                      v-for="cat in filteredCategoryOptions" 
                      :key="cat.id"
                      class="select-option"
                      :class="{ selected: cat.id === form.category_id }"
                      @click="selectCategory(cat)"
                    >
                      {{ cat.displayName }}
                    </div>
                    <div v-if="filteredCategoryOptions.length === 0" class="select-no-results">
                      未找到分类
                    </div>
                  </div>
                </div>
              </div>
              <button
                v-if="aiEnabled && categoryOptions.length"
                type="button"
                class="ai-generate-btn"
                :disabled="suggestingCategory || !form.name || !form.url"
                @click="handleSuggestCategory"
                :title="'AI 推荐分类'"
              >
                <svg v-if="!suggestingCategory" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M12 20v-6"/>
                  <path d="M6 14l6-6 6 6"/>
                  <path d="M4 10h16"/>
                </svg>
                <div v-else class="mini-spinner"></div>
                {{ suggestingCategory ? 'AI 推荐中...' : 'AI 推荐' }}
              </button>
            </div>
            <p v-if="aiSuggestion" class="ai-suggestion">{{ aiSuggestion }}</p>
          </div>
          
          <div class="form-group">
            <label>标签</label>
            <div class="tags-input-container">
              <div class="tags-list">
                <span 
                  v-for="(tag, index) in tagItems" 
                  :key="index"
                  class="tag-item"
                  :class="{ editing: editingTagIndex === index }"
                  @dblclick="startEditTag(index)"
                >
                  <input 
                    v-if="editingTagIndex === index"
                    v-model="tagItems[index]"
                    type="text"
                    class="tag-edit-input"
                    @keydown.enter="finishEditTag"
                    @keydown.backspace="handleTagBackspace(index)"
                    @blur="finishEditTag"
                    ref="tagEditInput"
                  />
                  <span v-else>{{ tag }}</span>
                  <button v-if="editingTagIndex !== index" class="tag-remove" @click="removeTag(index)">×</button>
                </span>
              </div>
              <input 
                v-model="newTagInput"
                type="text"
                class="tag-input"
                placeholder="输入标签后回车添加"
                @keydown.enter.prevent="addTag"
                @keydown.backspace="handleInputBackspace"
              />
            </div>
            <p class="field-hint">💡 双击标签可编辑，回车保存</p>
          </div>
          
          <div class="form-group">
            <label>备注</label>
            <textarea v-model="form.notes" rows="3" placeholder="添加备注信息（可选）"></textarea>
          </div>
          
          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input v-model="form.is_private" type="checkbox">
              <span class="checkbox-text">
                <svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                私密书签
              </span>
              <span class="checkbox-description">仅登录后可见</span>
            </label>
          </div>
          
          <p v-if="error" class="error-message">{{ error }}</p>
          
          <div class="dialog-buttons">
            <button class="btn btn-secondary" @click="close">取消</button>
            <button class="btn btn-primary" @click="handleSubmit">
              {{ isEdit ? '更新' : '添加' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useBookmarks } from '../composables/useBookmarks'
import { useToast } from '../composables/useToast'
import { useAI } from '../composables/useAI'
import { buildCategoryTree, getCategoryPath } from '../utils/categoryTree'

const { categories, addBookmark, updateBookmark } = useBookmarks()
const { success: toastSuccess, error: toastError } = useToast()
const { aiEnabled, checkAIAvailability, generateDescription, suggestCategory } = useAI()

const show = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const error = ref('')
const fetching = ref(false)
const generatingDesc = ref(false)
const suggestingCategory = ref(false)
const aiSuggestion = ref('')
const selectOpen = ref(false)
const selectSearch = ref('')
const tagItems = ref([])
const newTagInput = ref('')
const editingTagIndex = ref(null)
const tagEditInput = ref(null)
const selectSearchInput = ref(null)

const form = ref({
  name: '',
  url: '',
  description: '',
  icon: '',
  category_id: '',
  is_private: false,
  tags: '',
  notes: ''
})

const categoryOptions = computed(() => {
  if (!categories.value.length) {
    return []
  }
  const { flatList, map } = buildCategoryTree(categories.value)
  return flatList.map(cat => ({
    id: cat.id,
    displayName: getCategoryPath(cat.id, map).map(item => item.name).join('/')
  }))
})

const selectedCategoryName = computed(() => {
  if (!form.value.category_id) return ''
  const cat = categoryOptions.value.find(c => c.id === form.value.category_id)
  return cat?.displayName || ''
})

const filteredCategoryOptions = computed(() => {
  if (!selectSearch.value) return categoryOptions.value
  const query = selectSearch.value.toLowerCase()
  return categoryOptions.value.filter(cat =>
    cat.displayName.toLowerCase().includes(query)
  )
})

const selectCategory = (cat) => {
  form.value.category_id = cat.id
  selectOpen.value = false
  selectSearch.value = ''
}

const addTag = () => {
  const tag = newTagInput.value.trim()
  if (tag && !tagItems.value.includes(tag)) {
    tagItems.value.push(tag)
    newTagInput.value = ''
  }
}

const removeTag = (index) => {
  tagItems.value.splice(index, 1)
}

const startEditTag = (index) => {
  editingTagIndex.value = index
  nextTick(() => {
    if (tagEditInput.value && tagEditInput.value[index]) {
      tagEditInput.value[index].focus()
    }
  })
}

const finishEditTag = () => {
  editingTagIndex.value = null
}

const handleTagBackspace = (index) => {
  if (editingTagIndex.value === null && newTagInput.value === '' && tagItems.value.length > 0) {
    tagItems.value.pop()
  }
}

const handleInputBackspace = () => {
  if (newTagInput.value === '' && tagItems.value.length > 0 && editingTagIndex.value === null) {
    tagItems.value.pop()
  }
}

const open = (bookmark = null, options = {}) => {
  if (bookmark) {
    isEdit.value = true
    editId.value = bookmark.id
    form.value = {
      name: bookmark.name,
      url: bookmark.url,
      description: bookmark.description || '',
      icon: bookmark.icon || '',
      category_id: bookmark.category_id,
      is_private: !!bookmark.is_private,
      tags: bookmark.tags || '',
      notes: bookmark.notes || ''
    }
    tagItems.value = bookmark.tags ? bookmark.tags.split(',').map(t => t.trim()).filter(Boolean) : []
  } else {
    isEdit.value = false
    editId.value = null
    const presetCategoryId = options.categoryId ?? categories.value[0]?.id ?? ''
    form.value = {
      name: '',
      url: '',
      description: '',
      icon: '',
      category_id: presetCategoryId,
      is_private: false,
      tags: '',
      notes: ''
    }
    tagItems.value = []
  }
  
  error.value = ''
  aiSuggestion.value = ''
  selectOpen.value = false
  selectSearch.value = ''
  newTagInput.value = ''
  editingTagIndex.value = null
  show.value = true
}

const close = () => {
  show.value = false
  aiSuggestion.value = ''
  generatingDesc.value = false
  suggestingCategory.value = false
  selectOpen.value = false
  selectSearch.value = ''
  newTagInput.value = ''
  editingTagIndex.value = null
}

const fetchMetadata = async () => {
  if (!form.value.url) {
    toastError('请先输入URL')
    return
  }
  
  // 验证URL格式
  try {
    new URL(form.value.url)
  } catch {
    toastError('URL格式不正确')
    return
  }
  
  fetching.value = true
  error.value = ''
  
  try {
    const response = await fetch(`/api/fetch-metadata?url=${encodeURIComponent(form.value.url)}`)
    const data = await response.json()
    
    if (data.success) {
      if (data.title && !form.value.name) {
        form.value.name = data.title
      }
      if (data.description && !form.value.description) {
        form.value.description = data.description
      }
      toastSuccess('信息获取成功')
    } else {
      toastError(data.error || '获取失败')
    }
  } catch (err) {
    toastError('网络错误，请手动输入')
  } finally {
    fetching.value = false
  }
}

const handleGenerateDescription = async () => {
  if (!form.value.name || !form.value.url) {
    toastError('请先输入名称和 URL')
    return
  }

  if (!aiEnabled.value) {
    toastError('AI 功能未启用，请先在设置中配置 API Key')
    return
  }

  generatingDesc.value = true
  error.value = ''

  try {
    const result = await generateDescription(form.value.name, form.value.url)

    if (result.success && result.description) {
      form.value.description = result.description
      toastSuccess('AI 生成描述成功')
    } else {
      toastError(result.error || 'AI 生成描述失败')
    }
  } catch (err) {
    toastError(err.message || 'AI 生成描述失败')
  } finally {
    generatingDesc.value = false
  }
}

const handleSuggestCategory = async () => {
  if (!form.value.name || !form.value.url) {
    toastError('请先输入名称和 URL')
    return
  }

  if (!aiEnabled.value) {
    toastError('AI 功能未启用，请先在设置中配置 API Key')
    return
  }

  if (!categoryOptions.value || categoryOptions.value.length === 0) {
    toastError('没有可用的分类')
    return
  }

  suggestingCategory.value = true
  aiSuggestion.value = ''

  try {
    const categoriesForAI = categoryOptions.value.map(cat => ({
      id: cat.id,
      name: cat.displayName,
      path: cat.displayName
    }))

    const result = await suggestCategory(
      form.value.name,
      form.value.url,
      form.value.description || '',
      categoriesForAI,
      form.value.tags || '',
      form.value.notes || ''
    )

    if (result.success && result.categoryId) {
      const recommendedId = Number.parseInt(result.categoryId, 10)
      if (Number.isInteger(recommendedId)) {
        form.value.category_id = recommendedId
        const matchedCategory = categoryOptions.value.find(cat => cat.id === recommendedId)
        const reasonText = result.reason ? `（${result.reason}）` : ''
        aiSuggestion.value = matchedCategory
          ? `💡 AI 推荐分类：${matchedCategory.displayName}${reasonText}`
          : `💡 AI 推荐分类 ID：${recommendedId}${reasonText}`
        toastSuccess('AI 推荐分类成功')
      } else {
        toastError('AI 返回的分类无效')
      }
    } else {
      toastError(result.error || 'AI 推荐分类失败')
    }
  } catch (err) {
    toastError(err.message || 'AI 推荐分类失败')
  } finally {
    suggestingCategory.value = false
  }
}

const handleSubmit = async () => {
  if (!form.value.name || !form.value.url || !form.value.category_id) {
    error.value = '请填写必填项'
    return
  }
  
  const parsedCategoryId = typeof form.value.category_id === 'number'
    ? form.value.category_id
    : Number.parseInt(form.value.category_id, 10)
  
  if (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0) {
    error.value = '请选择有效的分类'
    return
  }
  
  const payload = {
    ...form.value,
    category_id: parsedCategoryId,
    is_private: !!form.value.is_private,
    tags: tagItems.value.join(',')
  }
  
  const result = isEdit.value
    ? await updateBookmark(editId.value, payload)
    : await addBookmark(payload)
  
  if (result.success) {
    toastSuccess(isEdit.value ? '书签已更新' : '书签已添加')
    close()
  } else if (result.duplicate) {
    // 处理重复 URL 的情况
    error.value = result.error || '该 URL 已存在'
    toastError(result.error || '该 URL 已存在')
  } else {
    error.value = result.error || '操作失败'
    toastError(error.value)
  }
}

onMounted(() => {
  void checkAIAvailability().catch(() => {})
})

defineExpose({
  open,
  close
})
</script>

<style scoped>
.bookmark-dialog {
  max-width: 420px;
}

.url-input-group,
.description-input-group,
.category-input-group {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.url-input-group input,
.description-input-group input {
  flex: 1;
}

.category-input-group select {
  flex: 1;
}

.fetch-btn,
.ai-generate-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.65rem 0.875rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
  white-space: nowrap;
}

.ai-generate-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.ai-generate-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #5568d3 0%, #5e3d85 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}

.fetch-btn:hover:not(:disabled) {
  background: var(--primary-dark);
}

.fetch-btn:disabled,
.ai-generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.fetch-btn svg,
.ai-generate-btn svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
  flex-shrink: 0;
}

.ai-suggestion {
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(102, 126, 234, 0.1);
  border-left: 3px solid #667eea;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.mini-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.checkbox-group {
  background: var(--bg-secondary);
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  border: 2px solid var(--border);
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  margin-top: 0.125rem;
  flex-shrink: 0;
}

.checkbox-text {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 500;
  font-size: 0.85rem;
  color: var(--text);
}

.lock-icon {
  width: 14px;
  height: 14px;
  stroke-width: 2;
  color: var(--primary);
}

.checkbox-description {
  display: block;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 0.2rem;
  margin-left: 24px;
}

.field-hint {
  margin: 0.4rem 0 0 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.custom-select {
  position: relative;
  flex: 1;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.875rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
}

.select-trigger:hover {
  border-color: var(--primary);
}

.custom-select.open .select-trigger {
  border-color: var(--primary);
}

.select-value {
  color: var(--text);
  font-size: 0.9rem;
}

.select-trigger .select-value:empty::before {
  content: '请选择分类';
  color: var(--text-secondary);
}

.select-arrow {
  width: 16px;
  height: 16px;
  stroke-width: 2;
  color: var(--text-secondary);
  transition: transform 0.2s;
}

.custom-select.open .select-arrow {
  transform: rotate(180deg);
}

.select-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.25rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.select-search {
  width: 100%;
  padding: 0.65rem 0.875rem;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  font-size: 0.9rem;
  color: var(--text);
  outline: none;
}

.select-options {
  max-height: 200px;
  overflow-y: auto;
}

.select-option {
  padding: 0.65rem 0.875rem;
  cursor: pointer;
  transition: var(--transition);
  color: var(--text);
}

.select-option:hover {
  background: var(--bg-secondary);
}

.select-option.selected {
  background: var(--primary);
  color: white;
}

.select-no-results {
  padding: 0.65rem 0.875rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
  text-align: center;
}

.tags-input-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  min-height: 32px;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.5rem;
  background: var(--primary);
  color: white;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  cursor: pointer;
}

.tag-item.editing {
  background: var(--bg-secondary);
  color: var(--text);
}

.tag-edit-input {
  width: 80px;
  padding: 0.2rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  background: white;
  color: var(--text);
}

.tag-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  background: rgba(255, 255, 255, 0.3);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1;
}

.tag-remove:hover {
  background: rgba(255, 255, 255, 0.5);
}

.tag-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  background: var(--bg);
  color: var(--text);
  outline: none;
  transition: var(--transition);
}

.tag-input:focus {
  border-color: var(--primary);
}

/* Mobile optimization */
@media (max-width: 768px) {
  .bookmark-dialog {
    max-width: 95%;
  }
  
  .url-input-group,
  .description-input-group,
  .category-input-group {
    flex-direction: column;
  }
  
  .fetch-btn,
  .ai-generate-btn {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .bookmark-dialog {
    max-width: 95%;
    padding: 1rem;
  }
}
</style>

