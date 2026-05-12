<template>
  <nav class="nav-bar">
    <div class="nav-bar-content">
      <div class="nav-menu-wrapper">
        <div class="nav-menu">
          <div 
            v-for="menu in menus" 
            :key="menu.id"
            class="nav-menu-item"
            @mouseenter="showSubMenu(menu.id)"
            @mouseleave="hideSubMenu(menu.id)"
          >
            <button 
              class="menu-trigger"
              :class="{ active: activeMenu?.id === menu.id }"
              @click="$emit('select-menu', menu)"
            >
              <span class="menu-text">{{ menu.name }}</span>
              <svg 
                v-if="menu.children && menu.children.length > 0"
                class="chevron-icon"
                :class="{ rotated: hoveredMenuId === menu.id }"
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor"
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            <div 
              v-if="menu.children && menu.children.length > 0"
              class="submenu-dropdown"
              :class="{ 'show': hoveredMenuId === menu.id }"
            >
              <button 
                v-for="sub in menu.children"
                :key="sub.id"
                class="submenu-item"
                :class="{ active: activeSubMenu?.id === sub.id }"
                @click="$emit('select-submenu', menu, sub)"
              >
                {{ sub.name }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <button 
        class="settings-btn-floating" 
        @click="$emit('toggleStyle')"
        title="切换到默认风格"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
        </svg>
      </button>
    </div>
  </nav>
</template>

<script setup>
import { ref } from 'vue'

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

const emit = defineEmits(['select-menu', 'select-submenu', 'toggleStyle'])

const hoveredMenuId = ref(null)
const hideTimeout = ref(null)

const showSubMenu = (menuId) => {
  if (hideTimeout.value) {
    clearTimeout(hideTimeout.value)
    hideTimeout.value = null
  }
  hoveredMenuId.value = menuId
}

const hideSubMenu = (menuId) => {
  hideTimeout.value = setTimeout(() => {
    if (hoveredMenuId.value === menuId) {
      hoveredMenuId.value = null
    }
  }, 100)
}
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

.nav-bar::-webkit-scrollbar {
  display: none;
}

.nav-bar-content {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  padding: 0.6rem 1.5rem;
  gap: 0.5rem;
}

.nav-menu-wrapper {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  width: 100%;
}

.settings-btn-floating {
  position: absolute;
  top: 0.6rem;
  right: 1.5rem;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: var(--radius-sm);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0;
  pointer-events: none;
  z-index: 201;
}

.nav-bar:hover .settings-btn-floating {
  opacity: 1;
  pointer-events: auto;
}

.settings-btn-floating:hover {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

.settings-btn-floating svg {
  width: 20px;
  height: 20px;
}

.nav-menu {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.nav-menu-item {
  position: relative;
}

.menu-trigger {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.5rem 0.8rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.menu-trigger:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.menu-trigger.active {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.menu-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.chevron-icon {
  width: 14px;
  height: 14px;
  stroke-width: 2;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.chevron-icon.rotated {
  transform: rotate(180deg);
}

.submenu-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 50%;
  transform: translateX(-50%);
  min-width: 120px;
  background: rgba(30, 41, 59, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: var(--radius);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 0.5rem;
  z-index: 200;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
}

.submenu-dropdown.show {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(2px);
}

.submenu-item {
  display: block;
  width: 100%;
  padding: 0.5rem 0.8rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.submenu-item:hover {
  background: rgba(57, 157, 255, 0.25);
  color: #399dff;
}

.submenu-item.active {
  background: rgba(57, 157, 255, 0.35);
  color: #399dff;
  font-weight: 500;
}

@media (max-width: 768px) {
  .nav-bar-content {
    padding: 0.5rem 1rem;
  }

  .settings-btn-floating {
    top: 0.5rem;
    right: 1rem;
  }

  .menu-trigger {
    padding: 0.4rem 0.6rem;
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

  .submenu-dropdown.show {
    transform: none;
  }
}
</style>