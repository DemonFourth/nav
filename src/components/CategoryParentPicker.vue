<template>
  <div class="parent-picker" :class="{ 'is-fill': fill }">
    <div class="picker-search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        v-model="search"
        class="picker-search-input"
        type="text"
        :placeholder="searchPlaceholder"
        autocomplete="off"
      />
    </div>

    <div class="picker-list" ref="listEl" role="listbox" :aria-label="listLabel" :style="{ maxHeight }">
      <button
        type="button"
        class="picker-option is-root"
        :class="{ 'is-selected': modelValue === null }"
        role="option"
        :aria-selected="modelValue === null"
        :disabled="rootDisabled"
        :title="rootDisabled ? rootReason : ''"
        @click="select(null)"
      >
        <span class="picker-option-name">{{ rootLabel }}</span>
        <span v-if="rootDisabled && rootReason" class="picker-option-reason">{{ rootReason }}</span>
        <span v-else-if="rootCurrent" class="picker-option-current">当前位置</span>
      </button>

      <button
        v-for="option in filteredOptions"
        :key="option.id"
        type="button"
        class="picker-option"
        :class="{ 'is-selected': modelValue === option.id }"
        role="option"
        :aria-selected="modelValue === option.id"
        :style="{ paddingLeft: `${10 + (option.depth + 1) * 14}px` }"
        :disabled="option.disabled"
        :title="option.disabled ? option.reason : option.displayName"
        @click="select(option.id)"
      >
        <span class="picker-option-name">{{ option.displayName }}</span>
        <span v-if="option.disabled && option.reason" class="picker-option-reason">{{ option.reason }}</span>
        <span v-else-if="option.isCurrentParent" class="picker-option-current">当前位置</span>
      </button>

      <div v-if="filteredOptions.length === 0" class="picker-empty">{{ emptyText }}</div>
    </div>

    <p v-if="note" class="picker-note">{{ note }}</p>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'

const props = defineProps({
  modelValue: {
    type: [Number, String],
    default: null
  },
  options: {
    type: Array,
    default: () => []
  },
  rootLabel: {
    type: String,
    default: '作为根分类'
  },
  rootDisabled: {
    type: Boolean,
    default: false
  },
  rootReason: {
    type: String,
    default: ''
  },
  rootCurrent: {
    type: Boolean,
    default: false
  },
  note: {
    type: String,
    default: ''
  },
  emptyText: {
    type: String,
    default: '没有匹配的分类'
  },
  searchPlaceholder: {
    type: String,
    default: '搜索分类…'
  },
  listLabel: {
    type: String,
    default: '父分类'
  },
  maxHeight: {
    type: String,
    default: '260px'
  },
  // 由外层 flex 容器决定高度：列表吃剩余空间，maxHeight 退化成「上限」。
  // 需要父级链上都有一个纵向 flex 容器（见 BaseDialog 的 bodyFill）。
  fill: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const search = ref('')

// 根选项不参与搜索过滤：搜索时仍置顶，避免用户以为根分类不可选
const filteredOptions = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return props.options
  return props.options.filter(option => (option.displayName || '').toLowerCase().includes(query))
})

const select = (id) => {
  if (id === null && props.rootDisabled) return
  emit('update:modelValue', id)
}

// 打开弹窗时把当前选中的父级滚到列表中部（分类多、预填的是深层级时尤其重要）
const listEl = ref(null)

const scrollSelectedIntoView = () => {
  const list = listEl.value
  const selected = list?.querySelector('.picker-option.is-selected')
  if (!list || !selected) return
  // 用 scrollIntoView 而非手算 rect：弹窗入场有 scale 过渡，getBoundingClientRect 会失真
  // block: 'center' 让选中项上下都留出上下文；靠近首尾时浏览器自动夹到边界
  selected.scrollIntoView({ block: 'center' })
}

onMounted(async () => {
  await nextTick()
  scrollSelectedIntoView()
})
</script>

<style scoped>
.parent-picker {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--nav-border);
  border-radius: 10px;
  background: var(--nav-card-bg, transparent);
  overflow: hidden;
}

/* fill 模式：高度交给外层 flex 容器，列表弹性伸缩（maxHeight 成为上限）。
   搜索框与提示不允许被压缩，矮窗口下只有列表变短。 */
.parent-picker.is-fill {
  flex: 1 1 auto;
  min-height: 0;
}

.parent-picker.is-fill .picker-list {
  flex: 1 1 auto;
  /* 保底约 2 行，再挤压时改由外层 .dialog-body 滚动，不至于点不到 */
  min-height: 96px;
}

.picker-search {
  position: relative;
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  padding: 8px;
  border-bottom: 1px solid var(--card-border);
}

.picker-search svg {
  position: absolute;
  left: 18px;
  width: 13px;
  height: 13px;
  color: var(--text-tertiary);
  pointer-events: none;
}

.picker-search-input {
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
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.picker-search-input:focus {
  border-color: color-mix(in srgb, var(--nav-primary) 55%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.picker-list {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.picker-option {
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

.picker-option:hover:not(:disabled) {
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
}

.picker-option.is-selected {
  background: color-mix(in srgb, var(--nav-primary) 16%, transparent);
  color: var(--nav-primary);
}

.picker-option.is-root {
  color: var(--nav-text-secondary, var(--text-secondary));
  font-weight: 600;
  border-bottom: 1px dashed var(--card-border);
  border-radius: 7px 7px 0 0;
  margin-bottom: 4px;
}

.picker-option.is-root.is-selected {
  color: var(--nav-primary);
}

.picker-option:disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
  opacity: 0.65;
}

.picker-option-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-option-reason {
  flex-shrink: 0;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.picker-option-current {
  flex-shrink: 0;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 0.625rem;
  line-height: 17px;
  color: var(--nav-primary);
  background: color-mix(in srgb, var(--nav-primary) 14%, transparent);
}

.picker-empty {
  padding: 20px 10px;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.picker-note {
  flex: 0 0 auto;
  margin: 0;
  padding: 8px 10px;
  border-top: 1px solid var(--card-border);
  font-size: 0.6875rem;
  line-height: 1.5;
  color: var(--text-tertiary);
}
</style>
