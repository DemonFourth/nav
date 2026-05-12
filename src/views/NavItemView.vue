<template>
  <div class="nav-item-view">
    <NavBar 
      :menus="menuTree"
      :active-menu="activeMenu"
      :active-sub-menu="activeSubMenu"
      :custom-title="customTitle"
      @select-menu="handleSelectMenu"
      @select-submenu="handleSelectSubMenu"
      @open-settings="handleOpenSettings"
    />

    <div class="search-section">
      <NavSearch 
        :bookmarks="allBookmarks"
        @result-click="handleSearchResultClick"
      />
    </div>

    <div class="content-section">
      <NavCardGrid :bookmarks="currentBookmarks" />
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

const { categories, bookmarks, fetchData } = useBookmarks()
const { customTitle } = useSettings()

const emit = defineEmits(['open-settings'])

const activeMenu = ref(null)
const activeSubMenu = ref(null)

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

const handleOpenSettings = () => {
  emit('open-settings')
}

const openSettings = () => {
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
}

const handleSelectSubMenu = (menu, sub) => {
  activeMenu.value = menu
  activeSubMenu.value = sub
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
}

.search-section {
  padding: 7rem 1rem 2rem;
  position: relative;
  z-index: 2;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.content-section {
  flex: 1;
  padding: 1rem;
  position: relative;
  z-index: 2;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  min-height: calc(100vh - 180px);
  border-radius: var(--radius-lg) 0 0 0;
}
</style>