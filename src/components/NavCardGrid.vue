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
            v-for="(tag, index) in getVisibleTags(bookmark.tags)" 
            :key="index"
            class="tag-badge"
            @click.stop="handleTagClick(tag)"
          >
            {{ tag }}
          </span>
          <span 
            v-if="getRemainingCount(bookmark.tags) > 0" 
            class="tag-badge more-tags"
            @click.stop="toggleExpand(index)"
          >
            {{ expandedTagsIndex === index ? '收起' : `+${getRemainingCount(bookmark.tags)}` }}
          </span>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
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

const { iconSources, parseIconSourceUrl, navCardAnimation } = useSettings()

const iconErrors = ref({})
const iconSourceIndexes = ref({})
const animationClass = ref('')
const animationType = ref('slideUp')
const expandedTagsIndex = ref(null)
const MAX_VISIBLE_TAGS = 3

onMounted(() => {
  triggerAnimation()
})

function triggerAnimation() {
  if (!navCardAnimation.value || props.bookmarks.length === 0) {
    animationClass.value = ''
    return
  }

  const animations = ['slideUp', 'radial', 'fadeIn', 'slideLeft', 'slideRight', 'convergeIn', 'flipIn']
  const randomIndex = Math.floor(Math.random() * animations.length)
  animationType.value = animations[randomIndex]
  animationClass.value = `animate-${animationType.value}`
}

function getCardStyle(index) {
  if (!animationClass.value) return {}
  
  const isMobile = window.innerWidth <= 480
  if (isMobile) {
    return { animationDelay: '0s' }
  }
  
  if (animationType.value === 'slideUp') {
    return { animationDelay: `${index * 0.05}s` }
  } else if (animationType.value === 'radial') {
    const cols = window.innerWidth <= 768 ? 3 : (window.innerWidth <= 1200 ? 4 : 6)
    const row = Math.floor(index / cols)
    const col = index % cols
    const centerCol = Math.floor(cols / 2)
    const distance = Math.abs(col - centerCol) + row
    return { animationDelay: `${distance * 0.08}s` }
  } else if (animationType.value === 'fadeIn') {
    return { animationDelay: `${Math.random() * 0.5}s` }
  } else if (animationType.value === 'slideLeft') {
    const cols = window.innerWidth <= 768 ? 3 : (window.innerWidth <= 1200 ? 4 : 6)
    const row = Math.floor(index / cols)
    return { animationDelay: `${row * 0.1}s` }
  } else if (animationType.value === 'slideRight') {
    const cols = window.innerWidth <= 768 ? 3 : (window.innerWidth <= 1200 ? 4 : 6)
    const row = Math.floor(index / cols)
    const col = index % cols
    return { animationDelay: `${(row + (cols - col - 1) * 0.02) * 0.08}s` }
  } else if (animationType.value === 'convergeIn') {
    const cols = window.innerWidth <= 768 ? 3 : (window.innerWidth <= 1200 ? 4 : 6)
    const col = index % cols
    const centerCol = Math.floor(cols / 2)
    const distanceFromCenter = Math.abs(col - centerCol)
    return { animationDelay: `${(cols - distanceFromCenter - 1) * 0.08}s` }
  } else if (animationType.value === 'flipIn') {
    const cols = window.innerWidth <= 768 ? 3 : (window.innerWidth <= 1200 ? 4 : 6)
    const row = Math.floor(index / cols)
    const col = index % cols
    return { animationDelay: `${(row + col) * 0.06}s` }
  }
  
  return {}
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

const getVisibleTags = (tagsStr) => {
  const tags = parsedTags(tagsStr)
  if (expandedTagsIndex.value !== null) {
    return tags
  }
  return tags.slice(0, MAX_VISIBLE_TAGS)
}

const getRemainingCount = (tagsStr) => {
  const tags = parsedTags(tagsStr)
  return Math.max(0, tags.length - MAX_VISIBLE_TAGS)
}

const toggleExpand = (index) => {
  if (expandedTagsIndex.value === index) {
    expandedTagsIndex.value = null
  } else {
    expandedTagsIndex.value = index
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

.nav-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 0.5rem;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border-radius: 15px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 100px;
  height: auto;
  position: relative;
}

.nav-card:hover {
  background: rgba(255, 255, 255, 0.28);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
  border-color: rgba(255, 255, 255, 0.18);
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
  padding: 2px 6px;
  background: transparent;
  color: #60a5fa;
  border: 1px solid rgba(96, 165, 250, 0.5);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tag-badge:hover {
  background: rgba(96, 165, 250, 0.15);
  border-color: rgba(96, 165, 250, 0.8);
}

.tag-badge.more-tags {
  cursor: pointer;
  opacity: 0.8;
}

.tag-badge.more-tags:hover {
  opacity: 1;
  background: rgba(96, 165, 250, 0.25);
}

.empty-state p {
  text-align: center;
}

.empty-state {
  display: grid;
  place-items: center;
  max-width: 80%;
  margin: 0 auto;
  padding: 3rem 1rem;
  color: #ffffff;
  box-sizing: border-box;
  width: 100%;
}

/* 动画样式 */
.animate-slideUp .nav-card {
  animation: slideUpIn 0.6s ease-out forwards;
  opacity: 0;
  transform: translateY(30px);
}

@keyframes slideUpIn {
  0% {
    opacity: 0;
    transform: translateY(30px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-radial .nav-card {
  animation: radialIn 0.5s ease-out forwards;
  opacity: 0;
  transform: scale(0.3);
}

@keyframes radialIn {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fadeIn .nav-card {
  animation: fadeIn 0.6s ease-out forwards;
  opacity: 0;
}

@keyframes fadeIn {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slideLeft .nav-card {
  animation: slideLeftIn 0.6s ease-out forwards;
  opacity: 0;
  transform: translateX(-50px);
}

@keyframes slideLeftIn {
  0% {
    opacity: 0;
    transform: translateX(-50px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

.animate-slideRight .nav-card {
  animation: slideRightIn 0.6s ease-out forwards;
  opacity: 0;
  transform: translateX(50px);
}

@keyframes slideRightIn {
  0% {
    opacity: 0;
    transform: translateX(50px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

.animate-convergeIn .nav-card {
  animation: convergeIn 0.7s ease-out forwards;
  opacity: 0;
}

.animate-convergeIn .nav-card:nth-child(6n+1),
.animate-convergeIn .nav-card:nth-child(6n+6) {
  transform: translateX(-80px);
}

.animate-convergeIn .nav-card:nth-child(6n+2),
.animate-convergeIn .nav-card:nth-child(6n+5) {
  transform: translateX(-40px);
}

.animate-convergeIn .nav-card:nth-child(6n+3),
.animate-convergeIn .nav-card:nth-child(6n+4) {
  transform: translateY(-30px);
}

@keyframes convergeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
    transform: translate(0, 0);
  }
}

.animate-flipIn .nav-card {
  animation: flipIn 0.7s ease-out forwards;
  opacity: 0;
  transform: rotateY(-90deg);
}

@keyframes flipIn {
  0% {
    opacity: 0;
    transform: rotateY(-90deg);
  }
  50% {
    opacity: 1;
    transform: rotateY(-45deg);
  }
  100% {
    opacity: 1;
    transform: rotateY(0deg);
  }
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
    animation-duration: 0.4s;
  }
  
  .animate-radial .nav-card {
    animation-duration: 0.4s;
  }
  
  .animate-slideUp .nav-card,
  .animate-radial .nav-card {
    animation-delay: 0s !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .animate-slideUp .nav-card,
  .animate-radial .nav-card {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>