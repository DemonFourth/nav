<template>
  <div class="nav-card-grid">
    <div v-if="totalCount > 0" :class="[isGrouped ? 'card-groups' : 'cards-container', animationClass, { 'grid-append': gridAppendActive }]" @dragover.prevent="handleGridDragOver" @drop="handleGridDrop">
      <template v-for="group in displayGroups" :key="group.key">
        <header
          v-if="group.categoryId !== undefined"
          class="card-group-header"
          :class="{ 'is-clickable': group.categoryId !== null }"
          @click="handleGroupClick(group)"
        >
          <span class="card-group-path">
            <span v-if="group.parentText" class="card-group-parent">{{ group.parentText }} / </span>
            <span class="card-group-leaf">{{ group.leaf }}</span>
          </span>
          <span class="card-group-count">{{ group.bookmarks.length }}</span>
        </header>

        <div v-if="isGrouped" class="cards-container">
          <NavCard
            v-for="(bookmark, index) in group.bookmarks"
            :key="bookmark.id"
            :bookmark="bookmark"
            :isAuthenticated="isAuthenticated"
            :reorderable="reorderable"
            :style="getCardStyle(index)"
            @tag-click="handleTagClick"
            @show-detail="handleShowDetail"
            @dragstart="handleDragStart"
            @dragend="handleDragEnd"
            @drop="handleCardDrop"
          />
        </div>
        <template v-else>
          <NavCard
            v-for="(bookmark, index) in group.bookmarks"
            :key="bookmark.id"
            :bookmark="bookmark"
            :isAuthenticated="isAuthenticated"
            :reorderable="reorderable"
            :style="getCardStyle(index)"
            @tag-click="handleTagClick"
            @show-detail="handleShowDetail"
            @dragstart="handleDragStart"
            @dragend="handleDragEnd"
            @drop="handleCardDrop"
          />
          <div v-if="gridAppendActive" class="nav-grid-append-cue">移动到末尾</div>
        </template>
      </template>
    </div>

    <div v-else class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <p>{{ emptyText }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import NavCard from './NavCard.vue'
import { useSettings } from '../composables/useSettings'
import { useTheme } from '../composables/useTheme'

const props = defineProps({
  bookmarks: {
    type: Array,
    default: () => []
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  },
  reorderable: {
    type: Boolean,
    default: false
  },
  groups: {
    type: Array,
    default: null
  },
  emptyText: {
    type: String,
    default: '该分类下暂无书签'
  }
})

const emit = defineEmits(['tag-click', 'show-detail', 'dragstart', 'dragend', 'reorder', 'group-click'])

const gridAppendActive = ref(false)

const isGrouped = computed(() => props.groups !== null)
const displayGroups = computed(() =>
  isGrouped.value
    ? props.groups
    : [{ key: '__flat__', categoryId: undefined, bookmarks: props.bookmarks }]
)
const totalCount = computed(() =>
  displayGroups.value.reduce((sum, group) => sum + group.bookmarks.length, 0)
)

const { navCardAnimation, navCardBlur, navCardOpacity } = useSettings()
const { isDark } = useTheme()

const animationClass = ref('')

watch(() => props.bookmarks.length, (newLen, oldLen) => {
  if (newLen > 0 && newLen !== oldLen) {
    animationClass.value = ''
    requestAnimationFrame(() => {
      animationClass.value = 'animate-slideUp'
    })
  }
})

function getCardStyle(index) {
  const baseAlpha = isDark.value ? 0.15 : 0.85
  const opacityFactor = navCardOpacity.value / 100
  const effectiveAlpha = baseAlpha * opacityFactor
  const style = {
    backdropFilter: `blur(${navCardBlur.value}px)`,
    WebkitBackdropFilter: `blur(${navCardBlur.value}px)`,
    background: `rgba(${isDark.value ? '0, 0, 0' : '255, 255, 255'}, ${effectiveAlpha})`
  }
  if (animationClass.value) {
    style.animationDelay = `${Math.min(0.03 + index * 0.035, 0.8)}s`
  }
  return style
}

const handleTagClick = (tag) => {
  emit('tag-click', tag)
}

const handleShowDetail = (payload) => {
  emit('show-detail', payload)
}

const handleGroupClick = (group) => {
  if (!group || group.categoryId == null) return
  emit('group-click', group)
}

// 排序拖拽：drop 时按 dropInfo 计算重排 items（仅当前分类内排序）
const handleCardDrop = (dropInfo) => {
  if (isGrouped.value) return
  if (!dropInfo || dropInfo.draggedId === dropInfo.targetId) {
    return
  }
  const draggedIndex = props.bookmarks.findIndex(b => b.id === dropInfo.draggedId)
  const targetIndex = props.bookmarks.findIndex(b => b.id === dropInfo.targetId)
  if (draggedIndex === -1 || targetIndex === -1) {
    return
  }
  const bookmarksCopy = [...props.bookmarks]
  let insertIndex = dropInfo.position === 'after' ? targetIndex + 1 : targetIndex
  const [removed] = bookmarksCopy.splice(draggedIndex, 1)
  if (draggedIndex < insertIndex) insertIndex -= 1
  bookmarksCopy.splice(insertIndex, 0, removed)
  const items = bookmarksCopy.map((b, index) => ({ id: b.id, position: index }))
  emit('reorder', items)
}

// 拖拽生命周期：向上转发，供父级在拖拽时隐藏顶部菜单
const handleDragStart = () => {
  emit('dragstart')
}

const handleDragEnd = () => {
  emit('dragend')
}

// 拖到卡片网格空白区域：把拖拽卡片移动到末尾（底部）
const handleGridDragOver = (e) => {
  if (!props.reorderable || isGrouped.value) return
  const onCard = !!(e.target && e.target.closest && e.target.closest('.nav-card-horizontal'))
  gridAppendActive.value = !onCard
}

const handleGridDrop = (e) => {
  if (!props.reorderable || isGrouped.value) return
  gridAppendActive.value = false
  const draggedId = e.dataTransfer?.getData('bookmarkId')
  if (!draggedId) return
  const id = parseInt(draggedId, 10)
  if (!props.bookmarks.some(b => b.id === id)) return
  if (props.bookmarks[props.bookmarks.length - 1]?.id === id) return
  const others = props.bookmarks.filter(b => b.id !== id)
  const dragged = props.bookmarks.find(b => b.id === id)
  const items = [...others, dragged].map((b, index) => ({ id: b.id, position: index }))
  emit('reorder', items)
}
</script>

<style scoped>
.nav-card-grid {
  width: 100%;
  display: flex;
  justify-content: center;
}

.cards-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 300px));
  gap: 16px;
  justify-content: center;
  width: 100%;
  position: relative;
}

.card-groups {
  width: 100%;
}

.card-group-header {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  margin: 16px 0 9px;
  padding: 0;
  background: none;
  border: 0;
  font-family: inherit;
  text-align: left;
}

.card-group-header:first-child {
  margin-top: 12px;
}

.card-group-header .card-group-path {
  font-size: 0.78rem;
  color: var(--nav-text);
}

.card-group-header .card-group-parent {
  color: var(--nav-text-secondary);
}

.card-group-header .card-group-leaf {
  font-weight: 600;
}

.card-group-header .card-group-count {
  font-size: 0.55rem;
  font-weight: 600;
  color: var(--nav-text-secondary);
  background: var(--nav-border);
  border-radius: 999px;
  padding: 1px 6px;
}

.card-group-header.is-clickable {
  cursor: pointer;
}

.card-group-header.is-clickable:hover .card-group-leaf {
  color: var(--nav-primary);
}

.cards-container.grid-append {
  outline: 2px dashed color-mix(in srgb, var(--nav-primary) 50%, transparent);
  outline-offset: 6px;
  border-radius: 12px;
}

.nav-grid-append-cue {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 14px;
  border-radius: 9999px;
  background: var(--nav-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  z-index: 12;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--nav-primary) 40%, transparent);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  margin: 0 auto;
  padding: 4rem 1rem;
  color: var(--nav-text-secondary);
  box-sizing: border-box;
  width: 100%;
  gap: 12px;
}

.empty-state svg {
  width: 48px;
  height: 48px;
  opacity: 0.3;
}

.empty-state p {
  font-size: 0.875rem;
  font-weight: 500;
}

.animate-slideUp :deep(.nav-card-horizontal) {
  animation: slideUpIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
  transform: translateY(20px);
}

@keyframes slideUpIn {
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
  .cards-container {
  max-width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .animate-slideUp :deep(.nav-card-horizontal) {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
