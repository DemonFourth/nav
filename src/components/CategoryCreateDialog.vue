<template>
  <BaseDialog :show="show" title="新增分类" max-width="440px" @close="handleClose">
    <div class="form-group-menu">
      <label>分类名称</label>
      <input
        ref="nameInput"
        v-model="name"
        type="text"
        class="setting-input"
        placeholder="输入分类名称"
        @keyup.enter="handleConfirm"
      />
    </div>

    <div class="form-group-menu">
      <label>父分类</label>
      <div class="custom-select" :class="{ open: selectOpen }">
        <div class="select-trigger" @mousedown.stop @click="toggleSelect">
          <span class="select-value" :class="{ placeholder: parentId === null }">
            {{ selectedParentName || '作为根分类' }}
          </span>
          <svg class="select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        <Teleport to="body">
          <div
            v-if="selectOpen"
            class="select-dropdown-fixed"
            :style="dropdownStyle"
            @click.stop
            @mousedown.stop
          >
            <input
              ref="searchInput"
              v-model="search"
              type="text"
              class="select-search"
              placeholder="搜索分类..."
              @click.stop
            />
            <div class="select-options">
              <div
                class="select-option"
                :class="{ selected: parentId === null }"
                @click="selectParent(null)"
              >
                作为根分类
              </div>
              <div
                v-for="category in filteredCategories"
                :key="category.id"
                class="select-option"
                :class="{ selected: category.id === parentId }"
                @click="selectParent(category.id)"
              >
                {{ category.displayName }}
              </div>
              <div v-if="filteredCategories.length === 0 && search" class="select-no-results">
                未找到分类
              </div>
            </div>
          </div>
        </Teleport>
      </div>
    </div>

    <template #footer>
      <button class="btn-secondary-sm" @click="handleClose">取消</button>
      <button class="btn-primary-sm" :disabled="!name.trim() || saving" @click="handleConfirm">
        {{ saving ? '创建中...' : '创建' }}
      </button>
    </template>
  </BaseDialog>
</template>

<script setup>
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import BaseDialog from './BaseDialog.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  categories: {
    type: Array,
    default: () => []
  },
  defaultParentId: {
    type: [String, Number],
    default: null
  },
  saving: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'confirm'])

const name = ref('')
const parentId = ref(null)
const selectOpen = ref(false)
const search = ref('')
const nameInput = ref(null)
const searchInput = ref(null)
const dropdownRect = reactive({ top: 0, left: 0, width: 0 })

const dropdownStyle = computed(() => (
  `top: ${dropdownRect.top}px; left: ${dropdownRect.left}px; min-width: ${dropdownRect.width}px;`
))

const filteredCategories = computed(() => {
  if (!search.value) return props.categories
  const query = search.value.toLowerCase()
  return props.categories.filter(category => (
    (category.displayName || '').toLowerCase().includes(query)
  ))
})

const selectedParentName = computed(() => {
  if (parentId.value === null) return ''
  return props.categories.find(category => category.id === parentId.value)?.displayName || ''
})

const toggleSelect = (event) => {
  const rect = event.currentTarget.getBoundingClientRect()
  dropdownRect.top = rect.bottom + 4
  dropdownRect.left = rect.left
  dropdownRect.width = rect.width
  selectOpen.value = !selectOpen.value
  if (selectOpen.value) {
    nextTick(() => searchInput.value?.focus())
  }
}

const selectParent = (id) => {
  parentId.value = id
  selectOpen.value = false
  search.value = ''
}

const closeSelect = () => {
  selectOpen.value = false
  search.value = ''
}

const handleClose = () => {
  closeSelect()
  emit('close')
}

const handleConfirm = () => {
  const trimmedName = name.value.trim()
  if (!trimmedName || props.saving) return
  emit('confirm', { name: trimmedName, parentId: parentId.value })
}

watch(() => props.show, (visible) => {
  if (!visible) {
    closeSelect()
    return
  }
  name.value = ''
  parentId.value = props.defaultParentId ?? null
  closeSelect()
  setTimeout(() => nameInput.value?.focus(), 100)
})

watch(selectOpen, (open) => {
  if (open) {
    document.addEventListener('mousedown', closeSelect)
  } else {
    document.removeEventListener('mousedown', closeSelect)
  }
})

onUnmounted(() => {
  document.removeEventListener('mousedown', closeSelect)
})
</script>

<style scoped>
.form-group-menu {
  margin-bottom: 14px;
}

.form-group-menu label {
  display: block;
  margin-bottom: 6px;
  color: var(--nav-text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
}

.setting-input {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 12px;
  border: 1px solid var(--nav-border);
  border-radius: 8px;
  background: var(--nav-card-bg);
  color: var(--nav-text);
  font-size: 0.875rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.setting-input:focus {
  border-color: color-mix(in srgb, var(--nav-primary) 55%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.setting-input::placeholder {
  color: var(--nav-text-secondary);
}

.custom-select {
  position: relative;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid var(--nav-border);
  border-radius: 8px;
  background: var(--nav-card-bg);
  color: var(--nav-text);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.select-trigger:hover {
  border-color: var(--nav-text-secondary);
}

.custom-select.open .select-trigger {
  border-color: color-mix(in srgb, var(--nav-primary) 55%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.select-value {
  min-width: 0;
  overflow: hidden;
  color: var(--nav-text);
  font-size: 0.875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-value.placeholder {
  color: var(--nav-text-secondary);
}

.select-arrow {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--nav-text-secondary);
  transition: transform 0.2s ease;
}

.custom-select.open .select-arrow {
  transform: rotate(180deg);
}

.select-dropdown-fixed {
  position: fixed;
  box-sizing: border-box;
  z-index: 100001;
  overflow: hidden;
  border: 1px solid var(--nav-border);
  border-radius: 10px;
  background: var(--nav-bg);
  box-shadow: 0 10px 40px var(--shadow-lg);
}

.select-search {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: none;
  border-bottom: 1px solid var(--nav-border);
  background: var(--nav-card-bg);
  color: var(--nav-text);
  font-size: 0.875rem;
  font-family: inherit;
  outline: none;
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
  transition: background-color 0.15s ease;
}

.select-option:hover {
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
}

.select-option.selected {
  background: color-mix(in srgb, var(--nav-primary) 20%, transparent);
  color: var(--nav-primary);
}

.select-no-results {
  padding: 16px;
  color: var(--nav-text-secondary);
  font-size: 0.875rem;
  text-align: center;
}

.select-options::-webkit-scrollbar {
  width: 6px;
}

.select-options::-webkit-scrollbar-track {
  background: transparent;
}

.select-options::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background: var(--nav-border);
}

.btn-secondary-sm,
.btn-primary-sm {
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.btn-secondary-sm {
  border: 1px solid var(--nav-border);
  background: transparent;
  color: var(--nav-text);
}

.btn-secondary-sm:hover {
  background: var(--nav-card-bg);
}

.btn-primary-sm {
  border: none;
  background: var(--nav-primary);
  color: #fff;
  font-weight: 600;
}

.btn-primary-sm:hover {
  background: color-mix(in srgb, var(--nav-primary) 85%, #0b2545);
}

.btn-primary-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
