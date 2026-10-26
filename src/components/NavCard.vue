<template>
  <div 
    class="nav-card-horizontal"
    :class="{
      'reorderable': reorderable,
      'drop-before': isDragOver && dropPosition === 'before',
      'drop-after': isDragOver && dropPosition === 'after'
    }"
    @click="handleCardClick"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
    v-tooltip="shouldShowTitle ? hoverTitle : ''"
  >
    <!-- 第一行：图标 + 名称 + 描述 -->
    <div class="nav-card-top">
      <div class="nav-card-icon">
        <LazyIcon v-if="getIconUrl(bookmark)" :size="40">
          <img
            :src="getIconUrl(bookmark)"
            :alt="bookmark.name"
            loading="lazy"
            @error="handleIconError(bookmark)"
          />
        </LazyIcon>
        <div v-else class="letter-icon">
          {{ bookmark.name.charAt(0) }}
        </div>
      </div>
      <div class="nav-card-info">
        <h3 ref="titleRef" class="nav-card-title">{{ bookmark.name }}</h3>
        <p v-if="bookmark.description" ref="descRef" class="nav-card-description">
          {{ bookmark.description }}
        </p>
      </div>
    </div>
    
    <!-- 第二行：标签 + URL -->
    <div class="nav-card-bottom">
      <div v-if="bookmark.tags && bookmark.tags.trim()" class="nav-card-tags">
        <span 
          v-for="(tag, index) in visibleTags" 
          :key="index"
          class="tag-badge"
          @click.stop="handleTagClick(tag)"
        >
          {{ tag }}
        </span>
        <span 
          v-if="remainingCount > 0" 
          class="tag-badge more-tags"
          @click.stop="toggleExpand"
        >
          {{ expanded ? '收起' : `+${remainingCount}` }}
        </span>
      </div>
      <div class="nav-card-url">{{ bookmark.url }}</div>
      <div v-if="bookmark.notes && bookmark.notes.trim()" class="nav-card-notes">
        {{ bookmark.notes }}
      </div>
    </div>
    
    <!-- 详情按钮 -->
    <button 
      v-if="isAuthenticated" 
      class="nav-card-detail-btn" 
      @click.stop="handleShowDetail"
      v-tooltip="'查看详情'"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    </button>

    <!-- 排序拖拽把手：hover 卡片时显现，仅可排序状态下出现 -->
    <div
      v-if="reorderable"
      class="nav-card-drag-handle"
      draggable="true"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @click.stop
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="9" cy="6" r="1"/>
        <circle cx="15" cy="6" r="1"/>
        <circle cx="9" cy="12" r="1"/>
        <circle cx="15" cy="12" r="1"/>
        <circle cx="9" cy="18" r="1"/>
        <circle cx="15" cy="18" r="1"/>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUpdated, nextTick } from 'vue'
import { getIconUrl, handleIconError } from '../composables/useIcon'
import LazyIcon from './LazyIcon.vue'

const props = defineProps({
  bookmark: {
    type: Object,
    required: true
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

const emit = defineEmits([
  'tag-click',
  'show-detail',
  'dragstart',
  'dragend',
  'drop',
  'dragleave',
  'dragoverPosition'
])

const isDragOver = ref(false)
const dropPosition = ref('after')
let dragPreviewEl = null

const expanded = ref(false)
const MAX_VISIBLE_TAGS = 6

const titleRef = ref(null)
const descRef = ref(null)
const isTitleTruncated = ref(false)
const isDescTruncated = ref(false)

const shouldShowTitle = computed(() => isTitleTruncated.value || isDescTruncated.value)

function checkTruncation() {
  nextTick(() => {
    const titleEl = titleRef.value
    const descEl = descRef.value
    isTitleTruncated.value = titleEl ? titleEl.scrollWidth > titleEl.clientWidth : false
    isDescTruncated.value = descEl ? descEl.scrollHeight > descEl.clientHeight : false
  })
}

onMounted(checkTruncation)
onUpdated(checkTruncation)

// 标签相关
const parsedTags = computed(() => {
  if (!props.bookmark.tags) return []
  return props.bookmark.tags.split(',').map(t => t.trim()).filter(Boolean)
})

const visibleTags = computed(() => {
  if (expanded.value) {
    return parsedTags.value
  }
  return parsedTags.value.slice(0, MAX_VISIBLE_TAGS)
})

const remainingCount = computed(() => {
  return Math.max(0, parsedTags.value.length - MAX_VISIBLE_TAGS)
})

const toggleExpand = () => {
  expanded.value = !expanded.value
}

// Tooltip
const hoverTitle = computed(() => {
  const parts = []
  if (props.bookmark.name) parts.push(`名称：${props.bookmark.name}`)
  if (props.bookmark.url) parts.push(`地址：${props.bookmark.url}`)
  if (props.bookmark.description) parts.push(`描述：${props.bookmark.description}`)
  if (props.bookmark.tags && props.bookmark.tags.trim()) parts.push(`标签：${props.bookmark.tags}`)
  if (props.bookmark.notes && props.bookmark.notes.trim()) parts.push(`备注：${props.bookmark.notes}`)
  return parts.join('\n')
})

// 事件处理
const handleCardClick = () => {
  window.open(props.bookmark.url, '_blank')
}

const handleTagClick = (tag) => {
  emit('tag-click', tag)
}

const handleShowDetail = () => {
  emit('show-detail', { tag: null, bookmark: props.bookmark })
}

// 排序拖拽：仅可排序状态生效
const createDragPreview = () => {
  const el = document.createElement('div')
  el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;padding:8px 14px;border-radius:10px;background:var(--nav-bg);border:1px solid var(--nav-border);box-shadow:0 12px 32px var(--shadow-lg);color:var(--nav-text);font-size:13px;font-weight:600;white-space:nowrap;z-index:100000;'
  el.textContent = props.bookmark.name
  document.body.appendChild(el)
  return el
}

const removeDragPreview = () => {
  if (dragPreviewEl?.parentNode) {
    dragPreviewEl.parentNode.removeChild(dragPreviewEl)
    dragPreviewEl = null
  }
}

const handleDragStart = (e) => {
  if (!props.reorderable) return
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('bookmarkId', props.bookmark.id.toString())
  e.dataTransfer.setData('bookmarkData', JSON.stringify({
    id: props.bookmark.id,
    category_id: props.bookmark.category_id,
    name: props.bookmark.name
  }))
  emit('dragstart', props.bookmark)
  dragPreviewEl = createDragPreview()
  e.dataTransfer.setDragImage(dragPreviewEl, 30, 12)
}

const handleDragEnd = () => {
  isDragOver.value = false
  removeDragPreview()
  emit('dragend', props.bookmark.id)
}

const handleDragOver = (e) => {
  if (!props.reorderable) return
  e.preventDefault()
  const rect = e.currentTarget.getBoundingClientRect()
  // Grid 布局：按垂直中线判断插入到卡片前/后
  dropPosition.value = (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after'
  isDragOver.value = true
  emit('dragoverPosition', { id: props.bookmark.id, position: dropPosition.value })
}

const handleDragLeave = () => {
  if (!props.reorderable) return
  isDragOver.value = false
  emit('dragleave', props.bookmark.id)
}

const handleDrop = (e) => {
  if (!props.reorderable) return
  e.preventDefault()
  e.stopPropagation()
  const draggedId = e.dataTransfer.getData('bookmarkId')
  if (!draggedId) return
  let draggedBookmarkData = null
  const str = e.dataTransfer.getData('bookmarkData')
  if (str) {
    try { draggedBookmarkData = JSON.parse(str) } catch (err) {}
  }
  emit('drop', {
    draggedId: parseInt(draggedId, 10),
    targetId: props.bookmark.id,
    position: dropPosition.value,
    draggedBookmark: draggedBookmarkData
  })
  isDragOver.value = false
}
</script>

<style scoped>
.nav-card-horizontal {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--nav-border);
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 100px;
  max-width: 300px;
  overflow: hidden;
}

.nav-card-top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-right: 28px;
}

.nav-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-card-bottom {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nav-card-horizontal::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--nav-primary) 5%, transparent) 0%, color-mix(in srgb, var(--primary) 3%, transparent) 50%, transparent 100%);
  opacity: 0;
  transition: opacity 0.4s;
  pointer-events: none;
}

.nav-card-horizontal::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 13px;
  background: conic-gradient(from 0deg at 50% 50%,
    transparent 0deg, color-mix(in srgb, var(--nav-primary) 18%, transparent) 45deg,
    transparent 90deg, transparent 270deg,
    color-mix(in srgb, var(--primary) 12%, transparent) 315deg, transparent 360deg
  );
  opacity: 0;
  transition: opacity 0.5s;
  pointer-events: none;
  mask: linear-gradient(#000, #000) content-box, linear-gradient(#000, #000);
  mask-composite: exclude;
  -webkit-mask: linear-gradient(#000, #000) content-box, linear-gradient(#000, #000);
  -webkit-mask-composite: xor;
  padding: 1px;
}

.nav-card-horizontal:hover {
  background: var(--nav-card-hover);
  transform: translateY(-4px);
  box-shadow: 0 12px 40px -8px var(--shadow-lg), 0 0 0 1px color-mix(in srgb, var(--nav-primary) 12%, transparent);
  border-color: color-mix(in srgb, var(--nav-primary) 20%, transparent);
}

.nav-card-horizontal:hover::before { opacity: 1; }
.nav-card-horizontal:hover::after { opacity: 1; }

.nav-card-horizontal:active {
  transform: translateY(-1px) scale(0.98);
}

.nav-card-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--nav-card-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 12px var(--shadow);
}

.nav-card-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.letter-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: white;
  font-weight: 700;
  font-size: 0.875rem;
}

.nav-card-horizontal:hover .nav-card-icon {
  transform: scale(1.08);
}

.nav-card-horizontal:hover .nav-card-title {
  color: var(--nav-primary);
}

.nav-card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--nav-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.3s ease;
}

.nav-card-description {
  font-size: 14px;
  color: var(--nav-text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.nav-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-badge {
  padding: 2px 8px;
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
  color: var(--nav-primary);
  border: none;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tag-badge:hover {
  background: color-mix(in srgb, var(--nav-primary) 25%, transparent);
}

.tag-badge.more-tags {
  cursor: pointer;
  background: var(--nav-card-bg);
  color: var(--nav-text-secondary);
}

.tag-badge.more-tags:hover {
  background: var(--nav-card-hover);
  color: var(--nav-text);
}

.nav-card-url {
  font-size: 12px;
  color: var(--nav-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-card-notes {
  font-size: 14px;
  color: var(--nav-text-secondary);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-card-detail-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--nav-card-bg);
  border: none;
  color: var(--nav-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s ease;
  z-index: 10;
}

.nav-card-detail-btn svg {
  width: 14px;
  height: 14px;
}

.nav-card-horizontal:hover .nav-card-detail-btn {
  opacity: 1;
}

.nav-card-detail-btn:hover {
  background: color-mix(in srgb, var(--nav-primary) 45%, transparent);
  color: var(--nav-text);
  transform: scale(1.1);
}

/* 排序拖拽把手 */
.reorderable .nav-card-top {
  padding-right: 68px;
}

.nav-card-drag-handle {
  position: absolute;
  top: 12px;
  right: 42px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--nav-card-bg);
  color: var(--nav-text-secondary);
  cursor: grab;
  opacity: 0;
  transition: opacity 0.2s ease, background 0.2s ease, color 0.2s ease;
  z-index: 11;
}

.nav-card-drag-handle svg {
  width: 15px;
  height: 15px;
}

.nav-card-horizontal:hover .nav-card-drag-handle {
  opacity: 1;
}

.nav-card-drag-handle:hover {
  background: color-mix(in srgb, var(--nav-primary) 20%, transparent);
  color: var(--nav-primary);
}

.nav-card-drag-handle:active {
  cursor: grabbing;
}

.nav-card-horizontal.drop-before,
.nav-card-horizontal.drop-after {
  outline: 2px solid color-mix(in srgb, var(--nav-primary) 55%, transparent);
  outline-offset: 2px;
}
</style>
