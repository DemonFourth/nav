<template>
  <nav class="nav-bar">
    <div class="nav-left-space"></div>
    <div class="nav-bar-container">
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
      </div>

    <div class="nav-right-area">
      <button class="nav-icon-btn" @click="$emit('toggleStyle')" title="切换风格">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
        </svg>
      </button>

      <div class="nav-auth-section">
        <button v-if="!isAuthenticated" class="nav-auth-btn" @click="loginModalRef.open()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span>登录</span>
        </button>

<div v-else class="nav-user-menu" @click.stop="toggleUserMenu" v-click-outside="closeUserMenu">
            <button class="nav-avatar-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </button>

          <Transition name="dropdown">
            <div v-if="showUserMenu" class="nav-dropdown">
              <button class="dropdown-item" @click="$emit('open-settings'); closeUserMenu()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                设置
              </button>
              <button class="dropdown-item" @click="handleLogout">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                退出登录
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <LoginModal ref="loginModalRef" />
  </nav>
</template>

<script setup>
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import LoginModal from './LoginModal.vue'

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

const emit = defineEmits(['select-menu', 'select-submenu', 'toggle-style', 'open-settings'])

const { isAuthenticated, username, logout } = useAuth()

const hoveredMenuId = ref(null)
const hideTimeout = ref(null)
const showUserMenu = ref(false)
const loginModalRef = ref(null)

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

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}

const closeUserMenu = () => {
  showUserMenu.value = false
}

const handleLogout = () => {
  logout()
  closeUserMenu()
}

const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (event) => {
      if (!el.contains(event.target)) {
        binding.value()
      }
    }
    document.addEventListener('click', el._clickOutside)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside)
  }
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
  display: flex;
}

.nav-bar::-webkit-scrollbar {
  display: none;
}

.nav-left-space {
  flex: 0 0 10%;
}

.nav-bar-container {
  display: flex;
  align-items: center;
  flex: 0 0 80%;
  padding: 0.6rem 0;
}

.nav-menu-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
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

.nav-right-area {
  flex: 0 0 10%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: flex-start;
}

.nav-icon-btn {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-sm);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-icon-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.3);
}

.nav-icon-btn svg {
  width: 18px;
  height: 18px;
}

.nav-auth-section {
  position: relative;
}

.nav-auth-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  background: rgba(57, 157, 255, 0.2);
  border: 1px solid rgba(57, 157, 255, 0.3);
  border-radius: 20px;
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-auth-btn:hover {
  background: rgba(57, 157, 255, 0.35);
  border-color: rgba(57, 157, 255, 0.5);
  transform: translateY(-1px);
}

.nav-auth-btn svg {
  width: 16px;
  height: 16px;
}

.nav-user-menu {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.nav-avatar-btn {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-avatar-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.35);
}

.nav-avatar-btn svg {
  width: 18px;
  height: 18px;
}

.nav-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  min-width: 140px;
  background: rgba(30, 41, 59, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: var(--radius);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 0.5rem;
  z-index: 200;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.6rem 0.8rem;
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

.dropdown-item:hover {
  background: rgba(57, 157, 255, 0.2);
  color: #399dff;
}

.dropdown-item svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 768px) {
  .nav-bar-container {
    padding: 0.5rem 1rem;
    gap: 0.5rem;
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
