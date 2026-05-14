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
                @mouseenter="keepSubmenu(menu.id)"
                @mouseleave="hideSubMenu(menu.id)"
              >
                <NavMenuItem 
                  v-for="sub in menu.children"
                  :key="sub.id"
                  :item="sub"
                  :active-id="activeSubMenu?.id"
                  @select="(item) => $emit('select-submenu', menu, item)"
                />
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
              <span class="avatar-letter">{{ (username || 'U').charAt(0).toUpperCase() }}</span>
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
import NavMenuItem from './NavMenuItem.vue'

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

const keepSubmenu = (menuId) => {
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
  }, 150)
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
  display: flex;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.nav-left-space { flex: 0 0 10%; }

.nav-bar-container {
  display: flex;
  align-items: center;
  flex: 0 0 80%;
  padding: 0.5rem 0;
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
  gap: 2px;
}

.nav-menu-item { position: relative; }

.menu-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0.45rem 1.1rem;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
  position: relative;
}

.menu-trigger:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.menu-trigger:active {
  transform: scale(0.97);
}

.menu-trigger.active {
  background: rgba(57, 157, 255, 0.15);
  color: #60a5fa;
}

.menu-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.chevron-icon {
  width: 12px;
  height: 12px;
  stroke-width: 2.5;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;
}

.chevron-icon.rotated { transform: rotate(180deg); }

.submenu-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
  min-width: 140px;
  background: rgba(15, 23, 42, 0.94);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 14px;
  box-shadow: 0 20px 60px -12px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 6px;
  z-index: 200;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.submenu-dropdown.show {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}

.nav-right-area {
  flex: 0 0 10%;
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-start;
}

.nav-icon-btn {
  width: 34px;
  height: 34px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-icon-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.15);
}

.nav-icon-btn:active { transform: scale(0.93); }

.nav-icon-btn svg { width: 16px; height: 16px; }

.nav-auth-section { position: relative; }

.nav-auth-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  background: rgba(57, 157, 255, 0.12);
  border: 1px solid rgba(57, 157, 255, 0.2);
  border-radius: 999px;
  color: #60a5fa;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.nav-auth-btn:hover {
  background: rgba(57, 157, 255, 0.22);
  border-color: rgba(57, 157, 255, 0.35);
}

.nav-auth-btn:active { transform: scale(0.97); }

.nav-auth-btn svg { width: 14px; height: 14px; }

.nav-user-menu {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.nav-avatar-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2px solid rgba(57, 157, 255, 0.3);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg, #399dff, #6366f1);
}

.nav-avatar-btn:hover {
  border-color: #60a5fa;
  transform: scale(1.08);
}

.nav-avatar-btn:active { transform: scale(0.95); }

.avatar-letter {
  color: white;
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1;
}

.nav-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 150px;
  background: rgba(15, 23, 42, 0.94);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 14px;
  box-shadow: 0 20px 60px -12px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 6px;
  z-index: 200;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.dropdown-item:hover {
  background: rgba(57, 157, 255, 0.12);
  color: #60a5fa;
}

.dropdown-item svg { width: 15px; height: 15px; flex-shrink: 0; }

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 768px) {
  .nav-bar-container { padding: 0.4rem 0.5rem; }
  .menu-trigger { padding: 0.35rem 0.6rem; font-size: 0.8125rem; }
  .submenu-dropdown {
    position: fixed;
    left: 1rem; right: 1rem;
    transform: none;
    max-height: 60vh;
    overflow-y: auto;
  }
  .submenu-dropdown.show { transform: none; }
}
</style>
