<template>
  <div class="nav-card-grid">
    <div v-if="bookmarks.length > 0" class="cards-container" :class="animationClass">
      <div 
        v-for="(bookmark, index) in bookmarks" 
        :key="bookmark.id"
        class="nav-card"
        :style="getCardStyle(index)"
        @click="handleCardClick(bookmark)"
        :title="bookmark.name + '\n' + bookmark.url"
      >
        <button v-if="isAuthenticated" class="card-detail-btn" @click.stop="handleShowDetail(bookmark)" title="查看详情">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </button>
        <div class="card-icon">
          <img 
            v-if="!iconErrors[bookmark.id]"
            :src="getIconUrl(bookmark)"
            :alt="bookmark.name"
            loading="lazy"
            :key="bookmark.id + '-' + (iconSourceIndexes[bookmark.id] || 0)"
            @error="handleIconError(bookmark.id)"
          />
          <div v-if="iconErrors[bookmark.id]" class="letter-icon">
            {{ bookmark.name.charAt(0) }}
          </div>
        </div>
        <div class="card-title">{{ bookmark.name }}</div>
        <div v-if="bookmark.tags && bookmark.tags.trim()" class="card-tags">
          <span 
            v-for="(tag, tIdx) in getVisibleTags(bookmark.tags, bookmark.id)" 
            :key="tIdx"
            class="tag-badge"
            @click.stop="handleTagClick(tag)"
          >
            {{ tag }}
          </span>
          <span 
            v-if="getRemainingCount(bookmark.tags) > 0" 
            class="tag-badge more-tags"
            @click.stop="toggleExpand(bookmark.id)"
          >
            {{ expandedBookmarks[bookmark.id] ? '收起' : `+${getRemainingCount(bookmark.tags)}` }}
          </span>
        </div>
      </div>
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
import { ref, onMounted } from 'vue'
import { useSettings } from '../composables/useSettings'

const props = defineProps({
  bookmarks: {
    type: Array,
    default: () => []
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['tag-click', 'show-detail'])

const { iconSources, parseIconSourceUrl, navCardAnimation, navCardBlur, navCardOpacity } = useSettings()

const iconErrors = ref({})
const iconSourceIndexes = ref({})
const animationClass = ref('')
const animationType = ref('slideUp')
const expandedBookmarks = ref({})
const MAX_VISIBLE_TAGS = 3

onMounted(() => {
  triggerAnimation()
})

function triggerAnimation() {
  if (!navCardAnimation.value || props.bookmarks.length === 0) {
    animationClass.value = ''
    return
  }
  animationType.value = 'slideUp'
  animationClass.value = 'animate-slideUp'
}

function getCardStyle(index) {
  const style = {
    backdropFilter: `blur(${navCardBlur.value}px)`,
    WebkitBackdropFilter: `blur(${navCardBlur.value}px)`,
    background: `rgba(255, 255, 255, ${navCardOpacity.value / 100})`
  }
  if (animationClass.value) {
    style.animationDelay = `${Math.min(0.03 + index * 0.035, 0.8)}s`
  }
  return style
}

const getIconSources = (bookmark) => {
  if (bookmark.icon && bookmark.icon.trim()) {
    return []
  }
  try {
    const enabledSources = iconSources.value.filter(s => s.enabled)
    return enabledSources.map(source => parseIconSourceUrl(source.url, bookmark.url))
  } catch {
    return []
  }
}

const getIconUrl = (bookmark) => {
  if (bookmark.icon && bookmark.icon.trim()) {
    return bookmark.icon
  }
  const sources = getIconSources(bookmark)
  const index = iconSourceIndexes.value[bookmark.id] || 0
  if (sources.length > 0 && index < sources.length) {
    return sources[index]
  }
  return ''
}

const handleIconError = (bookmarkId) => {
  const bookmark = props.bookmarks.find(b => b.id === bookmarkId)
  if (!bookmark) return
  const sources = getIconSources(bookmark)
  const currentIndex = iconSourceIndexes.value[bookmarkId] || 0
  if (currentIndex < sources.length - 1) {
    iconSourceIndexes.value[bookmarkId] = currentIndex + 1
  } else {
    iconErrors.value[bookmarkId] = true
  }
}

const handleCardClick = (bookmark) => {
  window.open(bookmark.url, '_blank')
}

const parsedTags = (tagsStr) => {
  if (!tagsStr) return []
  return tagsStr.split(',').map(t => t.trim()).filter(Boolean)
}

const getVisibleTags = (tagsStr, bookmarkId) => {
  const tags = parsedTags(tagsStr)
  if (expandedBookmarks.value[bookmarkId]) {
    return tags
  }
  return tags.slice(0, MAX_VISIBLE_TAGS)
}

const getRemainingCount = (tagsStr) => {
  const tags = parsedTags(tagsStr)
  return Math.max(0, tags.length - MAX_VISIBLE_TAGS)
}

const toggleExpand = (bookmarkId) => {
  expandedBookmarks.value = {
    ...expandedBookmarks.value,
    [bookmarkId]: !expandedBookmarks.value[bookmarkId]
  }
}

const handleTagClick = (tag) => {
  emit('tag-click', tag)
}

const handleShowDetail = (bookmark) => {
  emit('show-detail', { tag: null, bookmark })
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
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 15px;
  max-width: 80%;
  margin: 0 auto;
  width: 100%;
}

.card-detail-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s ease;
  z-index: 10;
}

.card-detail-btn svg {
  width: 14px;
  height: 14px;
}

.nav-card:hover .card-detail-btn {
  opacity: 1;
}

.card-detail-btn:hover {
  background: rgba(57, 157, 255, 0.4);
  color: #fff;
  transform: scale(1.1);
}

.card-icon {
  width: 40px;
  height: 40px;
  margin: 4px auto;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.card-icon img {
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

.card-title {
  cursor: pointer;
  padding-right: 4px;
  padding-left: 4px;
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
  text-align: center;
  word-break: break-all;
  max-width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  line-height: 1;
  min-height: 1.5em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
  margin-top: 6px;
  max-width: 100%;
}

.tag-badge {
  padding: 2px 7px;
  background: rgba(96, 165, 250, 0.1);
  color: #60a5fa;
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tag-badge:hover {
  background: rgba(96, 165, 250, 0.22);
  border-color: rgba(96, 165, 250, 0.5);
}

.tag-badge.more-tags {
  cursor: pointer;
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
}

.tag-badge.more-tags:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: 80%;
  margin: 0 auto;
  padding: 4rem 1rem;
  color: rgba(255, 255, 255, 0.4);
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

.animate-slideUp .nav-card {
  animation: slideUpIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
  transform: translateY(20px);
}

@keyframes slideUpIn {
  to { opacity: 1; transform: translateY(0); }
}

.nav-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 0.5rem;
  border-radius: 15px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  min-height: 100px;
  height: auto;
}

.nav-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 15px;
  background: linear-gradient(135deg, rgba(57, 157, 255, 0.03) 0%, rgba(99, 102, 241, 0.02) 50%, transparent 100%);
  opacity: 0;
  transition: opacity 0.4s;
  pointer-events: none;
}

.nav-card::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 16px;
  background: conic-gradient(from 0deg at 50% 50%,
    transparent 0deg, rgba(57, 157, 255, 0.12) 45deg,
    transparent 90deg, transparent 270deg,
    rgba(99, 102, 241, 0.08) 315deg, transparent 360deg
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

.nav-card:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-3px);
  box-shadow: 0 12px 40px -8px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(57, 157, 255, 0.08);
  border-color: rgba(57, 157, 255, 0.15);
}

.nav-card:hover::before { opacity: 1; }
.nav-card:hover::after { opacity: 1; }

.nav-card:active {
  transform: translateY(-1px) scale(0.98);
}

.nav-card:hover .card-icon {
  transform: scale(1.08);
}

@media (max-width: 768px) {
  .cards-container {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
    max-width: 90%;
  }
  
  .nav-card {
    min-height: 90px;
    padding: 0.625rem 0.4rem;
  }
  
.card-icon {
    width: 32px;
    height: 32px;
  }
  
  .card-title {
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .cards-container {
    grid-template-columns: repeat(3, 1fr);
  }
  .animate-slideUp .nav-card {
    animation-duration: 0.35s;
    animation-delay: 0s !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .animate-slideUp .nav-card {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>