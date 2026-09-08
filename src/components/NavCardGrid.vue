<template>
  <div class="nav-card-grid">
    <div v-if="bookmarks.length > 0" class="cards-container" :class="animationClass">
      <NavCard
        v-for="(bookmark, index) in bookmarks"
        :key="bookmark.id"
        :bookmark="bookmark"
        :isAuthenticated="isAuthenticated"
        :style="getCardStyle(index)"
        @tag-click="handleTagClick"
        @show-detail="handleShowDetail"
      />
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
  }
})

const emit = defineEmits(['tag-click', 'show-detail'])

const { navCardAnimation, navCardBlur, navCardOpacity } = useSettings()
const { isDark } = useTheme()

const animationClass = ref('')

function triggerAnimation() {
  animationClass.value = ''
  if (!navCardAnimation.value || props.bookmarks.length === 0) {
    return
  }
  requestAnimationFrame(() => {
    animationClass.value = 'animate-slideUp'
  })
}

watch(() => props.bookmarks, triggerAnimation, { immediate: true })

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
</script>

<style scoped>
.nav-card-grid {
  width: 100%;
  display: flex;
  justify-content: center;
}

.cards-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  max-width: 80%;
  margin: 0 auto;
  width: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: 80%;
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

@media (max-width: 1024px) {
  .cards-container {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .cards-container {
    grid-template-columns: 1fr;
    max-width: 90%;
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
