<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="detail-modal-overlay" @click="handleClose">
        <div class="detail-modal" @click.stop>
          <div class="dialog-header">
            <div class="dialog-header-left">
              <div v-if="internalBookmark" class="header-icon">
                <img
                  v-if="!headerIconError && getDetailIconUrl(internalBookmark)"
                  :src="getDetailIconUrl(internalBookmark)"
                  :alt="internalBookmark?.name"
                  :key="(internalBookmark?.id || '') + '-' + (detailIconSourceIndexes[internalBookmark?.id || ''] || 0)"
                  @error="handleHeaderIconError"
                />
                <div v-else class="letter-icon-sm">{{ internalBookmark?.name?.charAt(0) || '?' }}</div>
              </div>
              <h3>{{ isEdit ? '编辑书签' : '新增书签' }}</h3>
            </div>
            <button class="dialog-close-btn" @click="handleClose">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="detail-body">
            <div class="form-grid">
              <div class="detail-section">
                <div class="detail-section-title">名称</div>
                <input v-model="form.name" type="text" class="detail-input" placeholder="书签名称" />
              </div>

              <div class="detail-section">
                <div class="detail-section-title">URL</div>
                <input v-model="form.url" type="text" class="detail-input" placeholder="https://..." />
              </div>

              <div class="detail-section">
                <div class="detail-section-title">分类</div>
                <div class="input-with-btn">
                  <div class="custom-select" :class="{ open: selectOpen }">
                    <div class="select-trigger" @click="selectOpen = !selectOpen">
                      <span class="select-value" :class="{ placeholder: !selectedCategoryName }">{{ selectedCategoryName || '请选择分类' }}</span>
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
                        <div v-if="filteredCategoryOptions.length === 0" class="select-no-results">未找到分类</div>
                      </div>
                    </div>
                  </div>
                  <button v-if="aiEnabled && props.categoryOptions.length" type="button" class="ai-btn" :disabled="suggestingCategory || !form.name || !form.url" @click="handleSuggestCategory" title="AI 推荐分类">
                    <svg v-if="!suggestingCategory" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M12 20v-6"/>
                      <path d="M6 14l6-6 6 6"/>
                      <path d="M4 10h16"/>
                    </svg>
                    <div v-else class="mini-spinner"></div>
                  </button>
                </div>
                <p v-if="aiSuggestion" class="ai-suggestion">{{ aiSuggestion }}</p>
              </div>

              <div class="detail-section">
                <div class="detail-section-title">标签</div>
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
                    ref="tagInputRef"
                    @input="tagSuggestionsOpen = true"
                    @keydown.enter.prevent="addTag"
                    @keydown.backspace="handleInputBackspace"
                    @mousedown="showAllTagSuggestions"
                    @blur="handleTagInputBlur"
                    @keydown.escape="tagSuggestionsOpen = false"
                  />
                  <div v-if="tagSuggestionsOpen && displayedTagSuggestions.length > 0" class="tag-suggestions">
                    <div
                      v-for="tag in displayedTagSuggestions"
                      :key="tag"
                      class="tag-suggestion-item"
                      @mousedown.prevent="selectTag(tag)"
                    >
                      {{ tag }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="detail-section full-width">
                <div class="detail-section-title">描述</div>
                <div class="input-with-btn">
                  <input v-model="form.description" type="text" class="detail-input" placeholder="添加描述" />
                  <button v-if="aiEnabled" type="button" class="ai-btn" :disabled="!form.name || !form.url || generatingDesc" @click="handleGenerateDescription">
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

              <div class="detail-section full-width">
                <div class="detail-section-title">备注</div>
                <textarea v-model="form.notes" class="detail-textarea" placeholder="添加备注信息"></textarea>
              </div>

              <div class="detail-section full-width">
                <label class="detail-checkbox">
                  <input v-model="form.is_private" type="checkbox" />
                  <span class="checkbox-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    私密书签
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div class="detail-footer">
            <div class="footer-left">
              <button v-if="isEdit" class="detail-btn danger" @click="handleDelete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
                删除
              </button>
            </div>
            <div class="footer-right">
              <button class="detail-btn secondary" @click="handleClose">取消</button>
              <button class="detail-btn primary" @click="handleSave">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, nextTick, watch, onMounted } from 'vue'
import { useSettings } from '@/composables/useSettings'
import { useAI } from '@/composables/useAI'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  show: { type: Boolean, default: false },
  categoryOptions: { type: Array, default: () => [] },
  allTags: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'save', 'delete'])

const { iconSources, parseIconSourceUrl } = useSettings()
const { aiEnabled, checkAIAvailability, generateDescription, suggestCategory } = useAI()
const { success: toastSuccess, error: toastError } = useToast()

const internalBookmark = ref(null)
const form = reactive({
  name: '',
  url: '',
  category_id: '',
  description: '',
  tags: '',
  notes: '',
  is_private: false
})
const tagItems = ref([])
const newTagInput = ref('')
const editingTagIndex = ref(null)
const tagEditInput = ref(null)
const selectOpen = ref(false)
const selectSearch = ref('')
const selectSearchInput = ref(null)
const headerIconError = ref(false)
const detailIconSourceIndexes = ref({})
const generatingDesc = ref(false)
const suggestingCategory = ref(false)
const aiSuggestion = ref('')
const tagSuggestionsOpen = ref(false)
const tagInputRef = ref(null)

const isEdit = computed(() => !!internalBookmark.value)

const selectedCategoryName = computed(() => {
  if (!form.category_id) return ''
  const cat = props.categoryOptions.find(c => c.id === form.category_id)
  return cat?.displayName || ''
})

const filteredCategoryOptions = computed(() => {
  if (!selectSearch.value) return props.categoryOptions
  const query = selectSearch.value.toLowerCase()
  return props.categoryOptions.filter(cat =>
    cat.displayName.toLowerCase().includes(query)
  )
})

const filteredTagSuggestions = computed(() => {
  if (!newTagInput.value) return []
  const query = newTagInput.value.toLowerCase()
  return props.allTags.filter(tag =>
    !tagItems.value.includes(tag) &&
    tag.toLowerCase().includes(query)
  )
})

const allTagSuggestions = computed(() => {
  return props.allTags.filter(tag => !tagItems.value.includes(tag))
})

const displayedTagSuggestions = computed(() => {
  if (newTagInput.value) {
    const query = newTagInput.value.toLowerCase()
    return props.allTags.filter(tag =>
      !tagItems.value.includes(tag) &&
      tag.toLowerCase().includes(query)
    )
  }
  return allTagSuggestions.value
})

const showAllTagSuggestions = () => {
  tagSuggestionsOpen.value = true
  nextTick(() => tagInputRef.value?.focus())
}

const open = (bookmark) => {
  internalBookmark.value = bookmark
  if (bookmark) {
    form.name = bookmark.name || ''
    form.url = bookmark.url || ''
    form.category_id = bookmark.category_id || ''
    form.description = bookmark.description || ''
    form.tags = bookmark.tags || ''
    form.notes = bookmark.notes || ''
    form.is_private = !!bookmark.is_private
    tagItems.value = bookmark.tags ? bookmark.tags.split(',').map(t => t.trim()).filter(Boolean) : []
  } else {
    form.name = ''
    form.url = ''
    form.category_id = ''
    form.description = ''
    form.tags = ''
    form.notes = ''
    form.is_private = false
    tagItems.value = []
  }
  newTagInput.value = ''
  editingTagIndex.value = null
  selectOpen.value = false
  selectSearch.value = ''
  headerIconError.value = false
  detailIconSourceIndexes.value = {}
  aiSuggestion.value = ''
  generatingDesc.value = false
  suggestingCategory.value = false
  tagSuggestionsOpen.value = false
  checkAIAvailability()
}

const handleClose = () => {
  emit('close')
}

const handleSave = () => {
  if (!form.name.trim() || !form.url.trim()) return
  const tagsStr = tagItems.value.join(',')
  const formData = {
    name: form.name.trim(),
    url: form.url.trim(),
    category_id: form.category_id,
    description: form.description.trim(),
    tags: tagsStr,
    notes: form.notes.trim(),
    is_private: form.is_private
  }
  emit('save', internalBookmark.value, formData)
}

const handleDelete = () => {
  emit('delete', internalBookmark.value)
}

const selectCategory = (cat) => {
  form.category_id = cat.id
  selectOpen.value = false
  selectSearch.value = ''
}

const addTag = (tag) => {
  const tagToAdd = tag !== undefined ? tag : newTagInput.value.trim()
  if (tagToAdd && !tagItems.value.includes(tagToAdd)) {
    tagItems.value.push(tagToAdd)
  }
  newTagInput.value = ''
  tagSuggestionsOpen.value = false
}

const selectTag = (tag) => {
  addTag(tag)
}

const removeTag = (index) => {
  tagItems.value.splice(index, 1)
}

const startEditTag = (index) => {
  editingTagIndex.value = index
  nextTick(() => {
    if (tagEditInput.value) {
      const input = Array.isArray(tagEditInput.value) ? tagEditInput.value[0] : tagEditInput.value
      input?.focus()
      input?.select()
    }
  })
}

const finishEditTag = () => {
  const trimmed = tagItems.value[editingTagIndex.value]?.trim()
  if (!trimmed) {
    tagItems.value.splice(editingTagIndex.value, 1)
  } else {
    tagItems.value[editingTagIndex.value] = trimmed
  }
  editingTagIndex.value = null
}

const handleTagBackspace = (index) => {
  if (editingTagIndex.value === index && tagItems.value[index].length === 0) {
    removeTag(index)
    editingTagIndex.value = null
  }
}

const handleInputBackspace = () => {
  if (newTagInput.value === '' && tagItems.value.length > 0 && editingTagIndex.value === null) {
    removeTag(tagItems.value.length - 1)
  }
}

const handleTagInputBlur = () => {
  setTimeout(() => {
    tagSuggestionsOpen.value = false
  }, 200)
}

const handleGenerateDescription = async () => {
  if (!form.name || !form.url) {
    toastError('请先输入名称和 URL')
    return
  }

  generatingDesc.value = true

  try {
    const result = await generateDescription(form.name, form.url)

    if (result.success && result.description) {
      form.description = result.description
      toastSuccess('AI 生成描述成功')
    } else {
      toastError(result.error || 'AI 生成描述失败')
    }
  } catch (err) {
    toastError('AI 生成描述失败')
  } finally {
    generatingDesc.value = false
  }
}

const handleSuggestCategory = async () => {
  if (!form.name || !form.url) {
    toastError('请先输入名称和 URL')
    return
  }

  if (!props.categoryOptions || props.categoryOptions.length === 0) {
    toastError('没有可用的分类')
    return
  }

  suggestingCategory.value = true
  aiSuggestion.value = ''

  try {
    const categoriesForAI = props.categoryOptions.map(cat => ({
      id: cat.id,
      name: cat.displayName,
      path: cat.displayName
    }))

    const result = await suggestCategory(
      form.name,
      form.url,
      form.description || '',
      categoriesForAI
    )

    if (result.success && result.categoryId) {
      const recommendedId = Number.parseInt(result.categoryId, 10)
      if (Number.isInteger(recommendedId)) {
        form.category_id = recommendedId
        const matchedCategory = props.categoryOptions.find(cat => cat.id === recommendedId)
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
    toastError('AI 推荐分类失败')
  } finally {
    suggestingCategory.value = false
  }
}

const getDetailIconSources = (bookmark) => {
  if (bookmark.icon && bookmark.icon.trim()) return []
  try {
    const enabledSources = iconSources.value.filter(s => s.enabled)
    return enabledSources.map(source => parseIconSourceUrl(source.url, bookmark.url))
  } catch {
    return []
  }
}

const getDetailIconUrl = (bookmark) => {
  if (bookmark.icon && bookmark.icon.trim()) return bookmark.icon
  const sources = getDetailIconSources(bookmark)
  const index = detailIconSourceIndexes.value[bookmark.id || ''] || 0
  if (sources.length > 0 && index < sources.length) return sources[index]
  return ''
}

const handleHeaderIconError = () => {
  if (!internalBookmark.value) return
  const bookmark = internalBookmark.value
  const sources = getDetailIconSources(bookmark)
  const currentIndex = detailIconSourceIndexes.value[bookmark.id || ''] || 0
  if (currentIndex < sources.length - 1) {
    detailIconSourceIndexes.value[bookmark.id || ''] = currentIndex + 1
  } else {
    headerIconError.value = true
  }
}

const getDisplayUrl = (url) => {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '')
  } catch {
    return url
  }
}

watch(selectOpen, (val) => {
  if (val) {
    nextTick(() => {
      if (selectSearchInput.value) {
        selectSearchInput.value.focus()
      }
    })
  }
})

onMounted(() => {
  checkAIAvailability()
})

defineExpose({ open })
</script>

<style scoped>
.detail-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--nav-glass, rgba(0,0,0,0.3));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 10vh 20vw;
}

.detail-modal {
  background: var(--nav-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 20px;
  width: 100%;
  max-width: 800px;
  max-height: 80vh;
  border: 1px solid var(--nav-border);
  box-shadow:
    0 0 0 1px var(--nav-border),
    0 40px 120px -20px var(--shadow-xl, rgba(0,0,0,0.3));
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.detail-modal::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 20px;
  background: linear-gradient(145deg, rgba(57, 157, 255, 0.03) 0%, rgba(99, 102, 241, 0.02) 30%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}

.detail-modal > * {
  position: relative;
  z-index: 1;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  border-bottom: 1px solid var(--nav-border);
}

.dialog-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.header-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
  overflow: hidden;
}

.header-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.letter-icon-sm {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  font-weight: 700;
  font-size: 0.75rem;
}

.dialog-header h3 {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--nav-text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dialog-close-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  color: var(--nav-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.dialog-close-btn:hover {
  background: color-mix(in srgb, var(--error, #ef4444) 20%, transparent);
  border-color: color-mix(in srgb, var(--error, #ef4444) 40%, transparent);
  color: var(--error, #ef4444);
  transform: rotate(90deg);
}

.dialog-close-btn svg {
  width: 16px;
  height: 16px;
}

.detail-body {
  padding: 16px 24px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-grid .full-width {
  grid-column: 1 / -1;
}

.detail-section {
  margin-bottom: 0;
}

.detail-section-title {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--nav-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
}

.detail-input {
  width: 100%;
  padding: 9px 12px;
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  border-radius: 8px;
  color: var(--nav-text);
  font-size: 0.875rem;
  transition: all 0.2s;
  outline: none;
  box-sizing: border-box;
}

.detail-input:focus {
  border-color: color-mix(in srgb, var(--nav-primary) 50%, transparent);
  background: var(--nav-card-hover);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.detail-input::placeholder {
  color: var(--nav-text-secondary);
}

.detail-textarea {
  width: 100%;
  padding: 9px 12px;
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  border-radius: 8px;
  color: var(--nav-text);
  font-size: 0.875rem;
  transition: all 0.2s;
  outline: none;
  resize: vertical;
  min-height: 56px;
  font-family: inherit;
  line-height: 1.5;
  box-sizing: border-box;
}

.detail-textarea:focus {
  border-color: color-mix(in srgb, var(--nav-primary) 50%, transparent);
  background: var(--nav-card-hover);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.detail-textarea::placeholder {
  color: var(--nav-text-secondary);
}

.detail-checkbox {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.detail-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  margin-right: 10px;
  accent-color: #399dff;
  cursor: pointer;
}

.detail-checkbox .checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--nav-text-secondary);
}

.detail-checkbox .checkbox-label svg {
  width: 16px;
  height: 16px;
}

.detail-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-top: 1px solid var(--nav-border);
}

.footer-left, .footer-right {
  display: flex;
  gap: 12px;
}

.detail-btn {
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: inherit;
}

.detail-btn.primary {
  background: linear-gradient(135deg, var(--nav-primary), var(--primary-dark, #2563eb));
  color: white;
  box-shadow: 0 4px 16px color-mix(in srgb, var(--nav-primary) 35%, transparent);
}

.detail-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--nav-primary) 45%, transparent);
}

.detail-btn.secondary {
  background: var(--nav-card-bg);
  color: var(--nav-text);
  border: 1px solid var(--nav-border);
}

.detail-btn.secondary:hover {
  background: var(--nav-card-hover);
  border-color: var(--nav-text-secondary);
}

.detail-btn.danger {
  flex: initial;
  background: transparent;
  color: var(--danger, #ef4444);
  border: 1px solid var(--danger, #ef4444);
  min-width: auto;
  padding: 10px 14px;
}

.detail-btn.danger:hover {
  background: color-mix(in srgb, var(--danger, #ef4444) 10%, transparent);
}

.detail-btn svg {
  width: 18px;
  height: 18px;
}

.custom-select {
  position: relative;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.select-trigger:hover {
  border-color: var(--nav-text-secondary);
}

.custom-select.open .select-trigger {
  border-color: color-mix(in srgb, var(--nav-primary) 50%, transparent);
  background: var(--nav-card-hover);
}

.select-value {
  color: var(--nav-text);
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.select-value.placeholder {
  color: var(--nav-text-secondary);
}

.select-arrow {
  width: 14px;
  height: 14px;
  color: var(--nav-text-secondary);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.custom-select.open .select-arrow {
  transform: rotate(180deg);
}

.select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--nav-bg);
  border: 1px solid var(--nav-border);
  border-radius: 10px;
  box-shadow: 0 10px 40px var(--shadow-lg, rgba(0,0,0,0.15));
  z-index: 100;
  overflow: hidden;
}

.select-search {
  width: 100%;
  padding: 10px 12px;
  background: var(--nav-card-bg);
  border: none;
  border-bottom: 1px solid var(--nav-border);
  color: var(--nav-text);
  font-size: 0.875rem;
  outline: none;
  box-sizing: border-box;
}

.select-search::placeholder {
  color: var(--nav-text-secondary);
}

.select-options {
  max-height: 200px;
  overflow-y: auto;
}

.select-option {
  padding: 9px 12px;
  color: var(--nav-text);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
}

.select-option:hover {
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
  color: var(--nav-text);
}

.select-option.selected {
  background: color-mix(in srgb, var(--nav-primary) 22%, transparent);
  color: var(--nav-primary);
}

.select-no-results {
  padding: 16px;
  text-align: center;
  color: var(--nav-text-secondary);
  font-size: 0.875rem;
}

.select-options::-webkit-scrollbar {
  width: 6px;
}

.select-options::-webkit-scrollbar-track {
  background: transparent;
}

.select-options::-webkit-scrollbar-thumb {
  background: var(--nav-border);
  border-radius: 3px;
}

.tags-input-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 10px;
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  border-radius: 8px;
  min-height: 38px;
  align-items: center;
  transition: all 0.2s;
  position: relative;
}

.tags-input-container:focus-within {
  border-color: color-mix(in srgb, var(--nav-primary) 50%, transparent);
  background: var(--nav-card-hover);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  background: color-mix(in srgb, var(--nav-primary) 18%, transparent);
  color: var(--nav-primary);
  border: 1px solid color-mix(in srgb, var(--nav-primary) 35%, transparent);
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: all 0.2s;
}

.tag-item:hover {
  background: color-mix(in srgb, var(--nav-primary) 28%, transparent);
  border-color: color-mix(in srgb, var(--nav-primary) 55%, transparent);
}

.tag-item.editing {
  background: color-mix(in srgb, var(--nav-primary) 35%, transparent);
  border-color: var(--nav-primary);
}

.tag-edit-input {
  background: transparent;
  border: none;
  color: var(--nav-text);
  font-size: 0.8125rem;
  outline: none;
  width: 60px;
  padding: 0;
}

.tag-remove {
  background: none;
  border: none;
  color: color-mix(in srgb, var(--nav-primary) 65%, transparent);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
  transition: color 0.2s;
}

.tag-remove:hover {
  color: var(--error, #ef4444);
}

.tag-input {
  flex: 1;
  min-width: 80px;
  background: transparent;
  border: none;
  color: var(--nav-text);
  font-size: 0.8125rem;
  outline: none;
  padding: 3px 0;
}

.tag-input::placeholder {
  color: var(--nav-text-secondary);
}

.tag-suggestions {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--nav-bg);
  border: 1px solid var(--nav-border);
  border-radius: 8px;
  box-shadow: 0 10px 40px var(--shadow-lg, rgba(0,0,0,0.15));
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
}

.tag-suggestion-item {
  padding: 8px 12px;
  color: var(--nav-text);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.15s;
}

.tag-suggestion-item:hover {
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
  color: var(--nav-primary);
}

.tag-suggestion-item:first-child {
  border-radius: 8px 8px 0 0;
}

.tag-suggestion-item:last-child {
  border-radius: 0 0 8px 8px;
}

.tag-suggestions::-webkit-scrollbar {
  width: 6px;
}

.tag-suggestions::-webkit-scrollbar-track {
  background: transparent;
}

.tag-suggestions::-webkit-scrollbar-thumb {
  background: var(--nav-border);
  border-radius: 3px;
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .detail-modal,
.modal-leave-to .detail-modal {
  transform: scale(0.95) translateY(20px);
}

.input-with-btn {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.input-with-btn > .detail-input,
.input-with-btn > .custom-select {
  flex: 1;
  min-width: 0;
}

.ai-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 14px;
  background: linear-gradient(135deg, var(--nav-primary), color-mix(in srgb, var(--nav-primary) 70%, #000));
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  font-family: inherit;
  flex-shrink: 0;
}

.ai-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--nav-primary) 40%, transparent);
}

.ai-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-btn svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.ai-suggestion {
  grid-column: 1 / -1;
  margin: 4px 0 0;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--nav-primary) 10%, transparent);
  border-left: 3px solid var(--nav-primary);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--nav-text-secondary);
  line-height: 1.4;
}

.mini-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>