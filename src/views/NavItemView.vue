<template>
  <div class="nav-item-view" :style="backgroundStyle">
    <NavBar 
      :menus="menuTree"
      :active-menu="activeMenu"
      :active-sub-menu="activeSubMenu"
      :custom-title="customTitle"
      @select-menu="handleSelectMenu"
      @select-submenu="handleSelectSubMenu"
      @toggle-style="handleToggleStyle"
      @open-settings="handleOpenSettings"
    />

    <div class="search-section">
      <NavSearch 
        ref="navSearchRef"
        :bookmarks="allBookmarks"
        @result-click="handleSearchResultClick"
      />
    </div>

    <div class="content-section">
      <NavCardGrid 
      :key="animationKey" 
      :bookmarks="currentBookmarks"
      @tag-click="handleTagClick"
    />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import NavBar from '../components/NavBar.vue'
import NavSearch from '../components/NavSearch.vue'
import NavCardGrid from '../components/NavCardGrid.vue'
import { useBookmarks } from '../composables/useBookmarks'
import { useSettings } from '../composables/useSettings'
import { buildCategoryTree } from '../utils/categoryTree'

const { categories, bookmarks, fetchData, searchTags } = useBookmarks()
const { customTitle, navWallpaper } = useSettings()

const emit = defineEmits(['open-settings'])

const activeMenu = ref(null)
const activeSubMenu = ref(null)
const animationKey = ref(0)
const navSearchRef = ref(null)

const backgroundStyle = computed(() => {
  const style = {}
  if (navWallpaper.value) {
    style.backgroundImage = `url(${navWallpaper.value})`
    style.backgroundSize = 'cover'
    style.backgroundPosition = 'center'
    style.backgroundRepeat = 'no-repeat'
    style.backgroundAttachment = 'fixed'
  } else {
    style.backgroundColor = '#222'
  }
  return style
})

const menuTree = computed(() => {
  const { tree } = buildCategoryTree(categories.value)
  return tree
})

const allBookmarks = computed(() => bookmarks.value)

const currentBookmarks = computed(() => {
  if (!activeMenu.value) {
    return []
  }

  const categoryId = activeSubMenu.value?.id || activeMenu.value.id
  
  return bookmarks.value
    .filter(b => b.category_id === categoryId)
    .sort((a, b) => a.position - b.position)
})

const handleToggleStyle = () => {
  emit('toggleStyle')
}

const handleOpenSettings = () => {
  emit('open-settings')
}

onMounted(async () => {
  await fetchData()
  
  if (menuTree.value.length > 0) {
    activeMenu.value = menuTree.value[0]
  }
})

watch(menuTree, (newMenus) => {
  if (newMenus.length > 0 && !activeMenu.value) {
    activeMenu.value = newMenus[0]
  }
})

const handleSelectMenu = (menu) => {
  activeMenu.value = menu
  activeSubMenu.value = null
  animationKey.value++
}

const handleSelectSubMenu = (menu, sub) => {
  activeMenu.value = menu
  activeSubMenu.value = sub
  animationKey.value++
}

const handleSearchResultClick = (result) => {
  const category = categories.value.find(c => c.id === result.category_id)
  if (category) {
    const parentCategory = findParentCategory(category.id)
    if (parentCategory) {
      handleSelectSubMenu(parentCategory, category)
    } else {
      handleSelectMenu(category)
    }
  }
}

const handleTagClick = (tag) => {
  if (navSearchRef.value) {
    navSearchRef.value.openSearchWithTags([tag])
  }
}

const findParentCategory = (categoryId) => {
  const category = categories.value.find(c => c.id === categoryId)
  if (!category) return null
  if (!category.parent_id) return category
  
  return categories.value.find(c => c.id === category.parent_id)
}
</script>

<style scoped>
.nav-item-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  background-color: transparent;
}

.search-section {
  padding: 8.5rem 1rem 1.25rem;
  position: relative;
  z-index: 2;
  background: transparent;
}

.content-section {
  flex: 1;
  padding: 0 1rem 2rem;
  position: relative;
  z-index: 2;
  width: 100%;
  background: transparent;
  min-height: calc(100vh - 180px);
}
</style>