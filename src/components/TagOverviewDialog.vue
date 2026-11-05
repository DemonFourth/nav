<template>
  <BaseDialog :show="show" title="全部标签" max-width="640px" @close="emit('close')">
    <div class="tag-overview">
      <div class="tag-overview-toolbar">
        <div class="tag-overview-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref="searchInputRef"
            v-model="query"
            type="text"
            placeholder="搜索标签…"
            aria-label="搜索标签"
          />
        </div>
        <div class="tag-overview-sort">
          <button :class="{ active: sortBy === 'count' }" :aria-pressed="sortBy === 'count'" @click="sortBy = 'count'">数量 ↓</button>
          <button :class="{ active: sortBy === 'name' }" :aria-pressed="sortBy === 'name'" @click="sortBy = 'name'">名称</button>
        </div>
      </div>

      <div v-if="list.length" class="tag-overview-list">
        <button
          v-for="tag in list"
          :key="tag.name"
          class="tag-overview-item"
          :class="{ active: isActive(tag.name) }"
          @click="emit('select', tag.name)"
        >
          <span class="tag-overview-name">{{ tag.name }}</span>
          <span class="tag-overview-count">{{ tag.count }}</span>
        </button>
      </div>
      <p v-else class="tag-overview-empty">没有匹配的标签</p>
    </div>

    <template #footer>
      <div class="tag-overview-footer">
        <span>共 {{ tags.length }} 个标签 · 覆盖 {{ bookmarkCount }} 个书签</span>
        <span class="tag-overview-hint">点标签直接筛选 →</span>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import BaseDialog from './BaseDialog.vue'
import { filterAndSortTags } from '../utils/tagBrowse.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  tags: { type: Array, default: () => [] },
  activeTag: { type: String, default: null },
  bookmarkCount: { type: Number, default: 0 }
})
const emit = defineEmits(['close', 'select'])

const query = ref('')
const sortBy = ref('count')
const searchInputRef = ref(null)

const list = computed(() => filterAndSortTags(props.tags, query.value, sortBy.value))
const isActive = (name) =>
  !!props.activeTag && name.toLowerCase() === props.activeTag.toLowerCase()

watch(() => props.show, (visible) => {
  if (!visible) return
  // 每次打开重置为「数量」排序并清空搜索，便于键盘用户直接输入
  query.value = ''
  sortBy.value = 'count'
  nextTick(() => searchInputRef.value?.focus())
})
</script>

<style scoped>
.tag-overview-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.tag-overview-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 9px;
  border: 1px solid var(--nav-border);
  border-radius: 6px;
  color: var(--nav-text-secondary);
}
.tag-overview-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--nav-text);
  font-size: 0.8rem;
  outline: none;
}
.tag-overview-search input::placeholder {
  color: var(--nav-text-secondary);
  opacity: 0.75;
}
.tag-overview-sort {
  display: flex;
  gap: 2px;
}
.tag-overview-sort button {
  padding: 4px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--nav-text-secondary);
  font-size: 0.72rem;
  cursor: pointer;
}
.tag-overview-sort button.active {
  color: var(--nav-primary);
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
}
.tag-overview-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2px 8px;
  max-height: 50vh;
  overflow-y: auto;
}
.tag-overview-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 7px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--nav-text-secondary);
  font-family: inherit;
  font-size: 0.76rem;
  text-align: left;
  cursor: pointer;
}
.tag-overview-item:hover {
  background: var(--nav-card-hover);
}
.tag-overview-item.active {
  color: var(--nav-primary);
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
  font-weight: 600;
}
.tag-overview-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag-overview-count {
  flex-shrink: 0;
  font-size: 0.65rem;
  color: var(--nav-text-secondary);
}
.tag-overview-item.active .tag-overview-count {
  color: var(--nav-primary);
}
.tag-overview-empty {
  padding: 2rem 0;
  margin: 0;
  text-align: center;
  color: var(--nav-text-secondary);
  font-size: 0.8rem;
}
.tag-overview-footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  font-size: 0.72rem;
  color: var(--nav-text-secondary);
}
@media (max-width: 640px) {
  .tag-overview-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .tag-overview-footer {
    flex-wrap: wrap;
  }
}
</style>
