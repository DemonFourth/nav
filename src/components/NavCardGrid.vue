<template>
  <div class="nav-card-grid">
    <div class="cards-container">
      <div 
        v-for="bookmark in bookmarks" 
        :key="bookmark.id"
        class="nav-card"
        @click="handleCardClick(bookmark)"
        :title="bookmark.name + '\n' + bookmark.url"
      >
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
      </div>
    </div>

    <div v-if="bookmarks.length === 0" class="empty-state">
      <p>该分类下暂无书签</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useSettings } from '../composables/useSettings'

const props = defineProps({
  bookmarks: {
    type: Array,
    default: () => []
  }
})

const { iconSources, proxyUrl, parseIconSourceUrl } = useSettings()

const iconErrors = ref({})
const iconSourceIndexes = ref({})

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
</script>

<style scoped>
.nav-card-grid {
  width: 100%;
  padding: 0 1rem;
}

.cards-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
}

.nav-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.25rem 1rem;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

html.dark .nav-card {
  background: rgba(30, 41, 59, 0.5);
  border-color: rgba(255, 255, 255, 0.15);
}

.nav-card:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  border-color: rgba(255, 255, 255, 0.4);
}

html.dark .nav-card:hover {
  background: rgba(30, 41, 59, 0.7);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 0.75rem;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
  font-size: 1.25rem;
}

.card-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: #ffffff;
  text-align: center;
  line-height: 1.3;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: rgba(255, 255, 255, 0.7);
}

@media (max-width: 768px) {
  .cards-container {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.75rem;
  }

  .nav-card {
    padding: 1rem 0.75rem;
  }

  .card-icon {
    width: 40px;
    height: 40px;
  }

  .card-title {
    font-size: 0.8rem;
  }
}
</style>