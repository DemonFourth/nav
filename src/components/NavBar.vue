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
                @click="handleSelectMenu(menu)"
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
                  @select="(item) => handleSelectSubmenu(menu, item)"
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
const autoCloseTimeout = ref(null)
const showUserMenu = ref(false)
const loginModalRef = ref(null)

const cancelAutoClose = () => {
  if (autoCloseTimeout.value) {
    clearTimeout(autoCloseTimeout.value)
    autoCloseTimeout.value = null
  }
}

const scheduleAutoClose = () => {
  cancelAutoClose()
  if (window.innerWidth <= 768) {
    autoCloseTimeout.value = setTimeout(() => {
      hoveredMenuId.value = null
    }, 2000)
  }
}

const showSubMenu = (menuId) => {
  cancelAutoClose()
  if (hideTimeout.value) {
    clearTimeout(hideTimeout.value)
    hideTimeout.value = null
  }
  hoveredMenuId.value = menuId
}

const keepSubmenu = (menuId) => {
  cancelAutoClose()
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

const handleSelectMenu = (menu) => {
  emit('select-menu', menu)
  scheduleAutoClose()
  if (window.innerWidth <= 768) {
    hoveredMenuId.value = menu.id
  }
}

const handleSelectSubmenu = (menu, item) => {
  emit('select-submenu', menu, item)
  scheduleAutoClose()
  if (window.innerWidth <= 768) {
    hoveredMenuId.value = menu.id
  }
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
  background: var(--nav-glass);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border-bottom: 1px solid var(--nav-border);
  box-shadow: inset 0 1px 0 var(--nav-border);
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
  color: var(--nav-text);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
  position: relative;
  opacity: 0.75;
}

.menu-trigger:hover {
  background: var(--nav-card-bg);
  color: var(--nav-text);
  opacity: 1;
}

.menu-trigger:active {
  transform: scale(0.97);
}

.menu-trigger.active {
  background: color-mix(in srgb, var(--nav-primary) 18%, transparent);
  color: var(--nav-primary);
  opacity: 1;
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
  background: var(--nav-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 14px;
  box-shadow: 0 20px 60px -12px var(--shadow-xl);
  border: 1px solid var(--nav-border);
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
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  border-radius: 10px;
  color: var(--nav-text-secondary);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-icon-btn:hover {
  background: var(--nav-card-hover);
  color: var(--nav-text);
  border-color: var(--nav-text-secondary);
}

.nav-icon-btn:active { transform: scale(0.93); }

.nav-icon-btn svg { width: 16px; height: 16px; }

.nav-auth-section { position: relative; }

.nav-auth-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  background: color-mix(in srgb, var(--nav-primary) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--nav-primary) 30%, transparent);
  border-radius: 999px;
  color: var(--nav-primary);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.nav-auth-btn:hover {
  background: color-mix(in srgb, var(--nav-primary) 25%, transparent);
  border-color: color-mix(in srgb, var(--nav-primary) 45%, transparent);
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
  border: 2px solid color-mix(in srgb, var(--nav-primary) 40%, transparent);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg, var(--nav-primary), var(--primary));
}

.nav-avatar-btn:hover {
  border-color: var(--nav-primary);
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
  background: var(--nav-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 14px;
  box-shadow: 0 20px 60px -12px var(--shadow-xl);
  border: 1px solid var(--nav-border);
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
  color: var(--nav-text);
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  opacity: 0.8;
}

.dropdown-item:hover {
  background: color-mix(in srgb, var(--nav-primary) 15%, transparent);
  color: var(--nav-primary);
  opacity: 1;
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
    position: absolute;
    left: 0;
    right: auto;
    min-width: 180px;
    max-width: min(280px, 90vw);
    transform: none;
    max-height: 60vh;
    overflow-y: auto;
  }
  .submenu-dropdown.show { transform: none; }
}
</style>
