<template>
  <BaseDialog :show="show" :title="dialogTitle" max-width="480px" @close="emit('close')">
    <div class="move-dialog">
      <div class="move-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          v-model="search"
          class="move-search-input"
          type="text"
          placeholder="搜索目标分类…"
          autocomplete="off"
        />
      </div>

      <div class="move-list" role="listbox" aria-label="目标分类">
        <button
          v-for="option in filteredOptions"
          :key="option.key"
          type="button"
          class="move-option"
          :class="{
            'is-selected': selectedParentId === option.id,
            'is-current': option.isCurrentParent,
            'is-disabled': option.disabled
          }"
          :style="{ paddingLeft: `${10 + (option.depth + 1) * 14}px` }"
          :disabled="option.disabled"
          :title="option.disabled ? option.reason : ''"
          :aria-selected="selectedParentId === option.id"
          role="option"
          @click="select(option)"
        >
          <span class="move-option-name">{{ option.displayName }}</span>
          <span v-if="option.reason" class="move-option-reason">{{ option.reason }}</span>
          <span v-else-if="option.isCurrentParent" class="move-option-current">当前位置</span>
        </button>
        <div v-if="filteredOptions.length === 0" class="move-empty">没有匹配的分类</div>
      </div>

      <p class="move-note">换父级后分类会追加到目标分类末尾，可在列表中拖拽微调顺序。</p>
    </div>

    <template #footer>
      <div class="move-footer">
        <span class="move-current">当前：{{ currentPathLabel }}</span>
        <div class="move-footer-actions">
          <button type="button" class="btn-secondary-sm" @click="emit('close')">取消</button>
          <button type="button" class="btn-primary-sm" :disabled="!canConfirm" @click="confirm">
            {{ saving ? '移动中…' : '移动' }}
          </button>
        </div>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import BaseDialog from '@/components/BaseDialog.vue'
import { buildMoveTargets, canMoveToParent } from '@/utils/categoryMove.js'
import { buildCategoryTree, getCategoryPath } from '@/utils/categoryTree.js'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  category: {
    type: Object,
    default: null
  },
  categories: {
    type: Array,
    default: () => []
  },
  saving: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'confirm'])

const search = ref('')
const selectedParentId = ref(null)

const currentParentId = computed(() => props.category?.parent_id ?? null)

const dialogTitle = computed(() =>
  props.category ? `移动「${props.category.name}」到…` : '移动到…'
)

const rootOption = computed(() => {
  if (!props.category) return null
  const check = canMoveToParent(props.categories, props.category.id, null)
  return {
    key: 'root',
    id: null,
    displayName: '作为根分类',
    depth: -1,
    disabled: !check.ok,
    reason: check.reason,
    isCurrentParent: currentParentId.value === null
  }
})

const targets = computed(() =>
  props.category ? buildMoveTargets(props.categories, props.category.id) : []
)

const options = computed(() => {
  const list = []
  if (rootOption.value) list.push(rootOption.value)
  for (const target of targets.value) {
    list.push({ key: `cat-${target.id}`, ...target })
  }
  return list
})

const filteredOptions = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return options.value
  return options.value.filter(option => option.displayName.toLowerCase().includes(query))
})

const currentPathLabel = computed(() => {
  if (!props.category) return '根分类'
  if (currentParentId.value === null) return '根分类'
  const { map } = buildCategoryTree(props.categories)
  const path = getCategoryPath(currentParentId.value, map)
  return path.length ? path.map(item => item.name).join(' / ') : '根分类'
})

const canConfirm = computed(() =>
  !props.saving &&
  props.category != null &&
  selectedParentId.value !== currentParentId.value
)

const select = (option) => {
  if (option.disabled) return
  selectedParentId.value = option.id
}

const confirm = () => {
  if (!canConfirm.value) return
  emit('confirm', { parentId: selectedParentId.value })
}

watch(() => props.show, (visible) => {
  if (!visible) return
  search.value = ''
  selectedParentId.value = currentParentId.value
})
</script>

<style scoped>
.move-dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.move-search {
  position: relative;
  display: flex;
  align-items: center;
}

.move-search svg {
  position: absolute;
  left: 10px;
  width: 13px;
  height: 13px;
  color: var(--text-tertiary);
  pointer-events: none;
}

.move-search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 10px 7px 30px;
  border: 1px solid var(--nav-border);
  border-radius: 8px;
  background: var(--input-bg, var(--bg-secondary));
  color: var(--text);
  font-size: 0.8125rem;
  font-family: inherit;
  outline: none;
}

.move-search-input:focus {
  border-color: color-mix(in srgb, var(--nav-primary) 55%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.move-list {
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--nav-border);
  border-radius: 10px;
  padding: 4px;
  background: var(--nav-card-bg, transparent);
}

.move-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  padding: 7px 10px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text);
  font-size: 0.8125rem;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease;
}

.move-option:hover:not(:disabled) {
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
}

.move-option.is-selected {
  background: color-mix(in srgb, var(--nav-primary) 16%, transparent);
  color: var(--nav-primary);
}

.move-option.is-disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
  opacity: 0.65;
}

.move-option-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.move-option-reason {
  flex-shrink: 0;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.move-option-current {
  flex-shrink: 0;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 0.625rem;
  line-height: 17px;
  color: var(--nav-primary);
  background: color-mix(in srgb, var(--nav-primary) 14%, transparent);
}

.move-empty {
  padding: 20px 10px;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.move-note {
  margin: 0;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: var(--text-tertiary);
}

.move-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.move-current {
  flex: 1;
  min-width: 0;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.move-footer-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
