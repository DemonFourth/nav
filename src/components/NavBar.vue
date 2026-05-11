<template>
  <nav class="nav-bar">
    <div class="nav-bar-content">
      <div class="nav-left">
        <button 
          class="settings-btn" 
          @click="$emit('openSettings')"
          title="设置"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        </button>
        <div class="nav-logo" @click="handleLogoClick">
          <span class="logo-text">{{ customTitle || '导航站' }}</span>
        </div>
      </div>

      <div class="nav-menu">
        <div 
          v-for="menu in menus" 
          :key="menu.id"
          class="nav-menu-item"
        >
          <button 
            class="menu-trigger"
            :class="{ active: activeMenu?.id === menu.id }"
            @click="handleMenuClick(menu)"
          >
            <span>{{ menu.name }}</span>
            <svg 
              v-if="menu.children && menu.children.length > 0"
              class="chevron-icon"
              :class="{ rotated: openMenuId === menu.id }"
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor"
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          <Transition name="dropdown">
            <div 
              v-if="openMenuId === menu.id && menu.children && menu.children.length > 0"
              class="submenu-dropdown"
            >
              <button 
                v-for="sub in menu.children"
                :key="sub.id"
                class="submenu-item"
                :class="{ active: activeSubMenu?.id === sub.id }"
                @click="handleSubMenuClick(menu, sub)"
              >
                {{ sub.name }}
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  menus: {
    type: Array,
    default: () => []
  },
  activeMenu: {
    type: Object,
    default: null
  },
  activeSubMenu: {
    type: Object,
    default: null
  },
  customTitle: {
    type: String,
    default: '导航站'
  }
})

const emit = defineEmits(['select-menu', 'select-submenu', 'openSettings'])

const openMenuId = ref(null)

const handleMenuClick = (menu) => {
  if (menu.children && menu.children.length > 0) {
    openMenuId.value = openMenuId.value === menu.id ? null : menu.id
  } else {
    openMenuId.value = null
    emit('select-menu', menu)
  }
}

const handleSubMenuClick = (menu, sub) => {
  openMenuId.value = null
  emit('select-submenu', menu, sub)
}

const handleLogoClick = () => {
  openMenuId.value = null
  if (props.menus.length > 0) {
    emit('select-menu', props.menus[0])
  }
}

const handleClickOutside = (event) => {
  if (!event.target.closest('.nav-menu')) {
    openMenuId.value = null
  }
}

const handleEscape = (event) => {
  if (event.key === 'Escape') {
    openMenuId.value = null
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  overflow: visible;
}

.nav-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0.6rem 1.5rem;
  width: 100%;
  box-sizing: border-box;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: var(--radius-sm);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
}

.settings-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.settings-btn svg {
  width: 20px;
  height: 20px;
}

.nav-logo {
  cursor: pointer;
  user-select: none;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.nav-menu {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.nav-menu::-webkit-scrollbar {
  display: none;
}

.nav-menu:hover {
  scrollbar-width: thin;
}

.nav-menu:hover::-webkit-scrollbar {
  display: block;
}

.nav-menu-item {
  position: relative;
}

.menu-trigger {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.menu-trigger:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.menu-trigger.active {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.chevron-icon {
  width: 16px;
  height: 16px;
  stroke-width: 2;
  transition: transform 0.2s ease;
}

.chevron-icon.rotated {
  transform: rotate(180deg);
}

.submenu-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 50%;
  transform: translateX(-50%);
  min-width: 160px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: var(--radius);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.5rem;
  z-index: 200;
}

html.dark .submenu-dropdown {
  background: rgba(30, 41, 59, 0.95);
  border-color: rgba(255, 255, 255, 0.1);
}

.submenu-item {
  display: block;
  width: 100%;
  padding: 0.6rem 1rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 0.9rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.submenu-item:hover {
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary);
}

.submenu-item.active {
  background: rgba(99, 102, 241, 0.15);
  color: var(--primary);
  font-weight: 600;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}

@media (max-width: 768px) {
  .nav-bar-content {
    padding: 0.5rem 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .nav-menu {
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .menu-trigger {
    padding: 0.4rem 0.75rem;
    font-size: 0.875rem;
  }

  .submenu-dropdown {
    position: fixed;
    left: 1rem;
    right: 1rem;
    transform: none;
    max-height: 60vh;
    overflow-y: auto;
  }

  .dropdown-enter-from,
  .dropdown-leave-to {
    transform: none;
  }
}
</style>