<template>
  <div class="nav-card-grid">
    <div v-if="bookmarks.length > 0" class="cards-container" :class="animationClass">
      <template v-for="(bookmark, index) in bookmarks" :key="bookmark.id">
        <div
          v-if="showPlaceholder && placeholderIndex === index && placeholderPosition === 'before' && currentDraggedId !== bookmark.id"
          class="nav-drag-placeholder"
        />
        <NavCard
          :bookmark="bookmark"
          :isAuthenticated="isAuthenticated"
          :reorderable="reorderable"
          :style="getCardStyle(index)"
          @tag-click="handleTagClick"
          @show-detail="handleShowDetail"
          @dragstart="handleDragStart"
          @dragend="handleDragEnd"
          @drop="handleCardDrop"
          @dragleave="handleCardDragLeave"
          @dragoverPosition="handleDragOverPosition"
        />
        <div
          v-if="showPlaceholder && placeholderIndex === index && placeholderPosition === 'after' && currentDraggedId !== bookmark.id"
          class="nav-drag-placeholder"
        />
      </template>
      <div v-if="showPlaceholder && placeholderIndex >= bookmarks.length" class="nav-drag-placeholder" />
    </div>

    <div v-else class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <p>该分类下暂无书签</p>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
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
  }
})

const emit = defineEmits(['tag-click', 'show-detail', 'reorder'])

const showPlaceholder = ref(false)
const placeholderIndex = ref(-1)
const placeholderPosition = ref('after')
const currentDraggedId = ref(null)

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

// 排序拖拽：占位符 + 插入位置计算（仅当前分类内排序）
const handleDragStart = (bookmark) => {
  currentDraggedId.value = bookmark.id
}

const handleDragEnd = () => {
  currentDraggedId.value = null
  showPlaceholder.value = false
  placeholderIndex.value = -1
}

const handleCardDragLeave = () => {
  setTimeout(() => {
    showPlaceholder.value = false
  }, 50)
}

const handleDragOverPosition = ({ id, position }) => {
  if (currentDraggedId.value === id) return
  const targetIndex = props.bookmarks.findIndex(b => b.id === id)
  if (targetIndex === -1) return
  showPlaceholder.value = true
  placeholderIndex.value = targetIndex
  placeholderPosition.value = position
}

const handleCardDrop = (dropInfo) => {
  if (!dropInfo || dropInfo.draggedId === dropInfo.targetId) {
    showPlaceholder.value = false
    return
  }
  const draggedIndex = props.bookmarks.findIndex(b => b.id === dropInfo.draggedId)
  const targetIndex = props.bookmarks.findIndex(b => b.id === dropInfo.targetId)
  if (draggedIndex === -1 || targetIndex === -1) {
    showPlaceholder.value = false
    return
  }
  const bookmarksCopy = [...props.bookmarks]
  let insertIndex = dropInfo.position === 'after' ? targetIndex + 1 : targetIndex
  const [removed] = bookmarksCopy.splice(draggedIndex, 1)
  if (draggedIndex < insertIndex) insertIndex -= 1
  bookmarksCopy.splice(insertIndex, 0, removed)
  const items = bookmarksCopy.map((b, index) => ({ id: b.id, position: index }))
  emit('reorder', items)
  showPlaceholder.value = false
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
}

.nav-drag-placeholder {
  min-height: 100px;
  border-radius: 12px;
  border: 2px dashed color-mix(in srgb, var(--nav-primary) 45%, transparent);
  background: color-mix(in srgb, var(--nav-primary) 8%, transparent);
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
