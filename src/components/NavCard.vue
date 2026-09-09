<template>
  <div 
    class="nav-card-horizontal"
    @click="handleCardClick"
    :title="shouldShowTitle ? hoverTitle : undefined"
  >
    <!-- 第一行：图标 + 名称 + 描述 -->
    <div class="nav-card-top">
      <div class="nav-card-icon">
        <img 
          v-if="!iconError"
          :src="iconUrl"
          :alt="bookmark.name"
          loading="lazy"
          @error="handleIconError"
        />
        <div v-if="iconError" class="letter-icon">
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
    </div>
    
    <!-- 详情按钮 -->
    <button 
      v-if="isAuthenticated" 
      class="nav-card-detail-btn" 
      @click.stop="handleShowDetail"
      title="查看详情"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUpdated, nextTick } from 'vue'
import { useSettings } from '../composables/useSettings'

const props = defineProps({
  bookmark: {
    type: Object,
    required: true
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['tag-click', 'show-detail'])

const { iconSources, parseIconSourceUrl } = useSettings()

const iconError = ref(false)
const iconSourceIndex = ref(0)
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

// 图标相关
const getIconSources = () => {
  if (props.bookmark.icon && props.bookmark.icon.trim()) {
    return []
  }
  try {
    const enabledSources = iconSources.value.filter(s => s.enabled)
    return enabledSources.map(source => parseIconSourceUrl(source.url, props.bookmark.url))
  } catch {
    return []
  }
}

const iconUrl = computed(() => {
  if (props.bookmark.icon && props.bookmark.icon.trim()) {
    return props.bookmark.icon
  }
  const sources = getIconSources()
  if (sources.length > 0 && iconSourceIndex.value < sources.length) {
    return sources[iconSourceIndex.value]
  }
  return ''
})

const handleIconError = () => {
  const sources = getIconSources()
  if (iconSourceIndex.value < sources.length - 1) {
    iconSourceIndex.value++
  } else {
    iconError.value = true
  }
}

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

.nav-card-detail-btn {
  position: absolute;
  bottom: 12px;
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
</style>
