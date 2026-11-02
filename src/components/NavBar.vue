<template>
  <nav ref="navBarRef" class="nav-bar">
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
                :class="[{ active: activeMenu?.id === menu.id }, rootRowClasses(menu.id)]"
                :style="rootMarkStyle(menu.id)"
                @click="handleSelectMenu(menu)"
                @mouseenter="showSubMenu(menu.id)"
                @dragover="handleRootDragOver($event, menu)"
                @dragleave="handleRootDragLeave"
                @drop="handleRootDrop($event, menu)"
              >
                <span
                  v-if="reorderable"
                  class="drag-grip"
                  draggable="true"
                  aria-label="按住并拖动，调整同级顺序"
                  v-tooltip="'按住并拖动，调整同级顺序'"
                  @click.stop.prevent
                  @dragstart.stop="handleRootDragStart($event, menu)"
                  @dragend.stop="handleRootDragEnd"
                >
                  <svg viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
                    <circle cx="3" cy="3" r="1.3" /><circle cx="7" cy="3" r="1.3" />
                    <circle cx="3" cy="8" r="1.3" /><circle cx="7" cy="8" r="1.3" />
                    <circle cx="3" cy="13" r="1.3" /><circle cx="7" cy="13" r="1.3" />
                  </svg>
                </span>
                <span class="menu-text" :title="menu.description || ''">{{ menu.name }}</span>
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
                <span
                  v-if="menuReorder.dropCue(menu.id)"
                  class="menu-drop-cue"
                  :class="menuReorder.dropCue(menu.id)"
                >
                  {{ menuReorder.dropCue(menu.id) === 'before' ? '插入左侧' : '插入右侧' }}
                </span>
              </button>

              <button
                v-if="reorderable && (!menu.children || menu.children.length === 0)"
                class="menu-leaf-add"
                aria-label="新建子分类"
                v-tooltip="'新建子分类'"
                @click.stop="handleCreateCategory(menu.id)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>

              <div 
                v-if="menu.children && menu.children.length > 0"
                class="submenu-dropdown"
                :class="{ 'show': hoveredMenuId === menu.id, 'has-add': reorderable }"
                @mouseenter="keepSubmenu(menu.id)"
                @mouseleave="hideSubMenu(menu.id)"
              >
                <NavMenuItem 
                  v-for="sub in menu.children"
                  :key="sub.id"
                  :item="sub"
                  :parent-id="menu.id"
                  :depth="1"
                  :active-id="activeSubMenu?.id"
                  :active-path="activePath"
                  :reorderable="reorderable"
                  :reorder="menuReorder"
                  @select="(item) => handleSelectSubmenu(menu, item)"
                  @create-category="handleCreateCategory"
                />

                <button
                  v-if="reorderable"
                  class="submenu-add-trigger"
                  @click="handleCreateCategory(menu.id)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  新建子分类
                </button>
              </div>
            </div>

            <button
              v-if="reorderable"
              class="menu-trigger menu-add-trigger"
              aria-label="新建根分类"
              v-tooltip="'新建根分类'"
              @click="handleCreateCategory(null)"
            >
              <svg class="menu-add-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>
      </div>

    <div class="nav-right-area">
      <button class="nav-icon-btn" @click="$emit('toggleStyle')" v-tooltip="'切换风格'">
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

<div v-else class="nav-user-menu" v-click-outside="closeUserMenu">
            <button class="nav-avatar-btn" @click.stop="toggleUserMenu">
              <span class="avatar-letter">{{ (username || 'U').charAt(0).toUpperCase() }}</span>
            </button>

          <Transition name="dropdown">
            <div v-if="showUserMenu" class="nav-dropdown">
              <button class="dropdown-item" @click="handleOpenSettings">
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

  <Teleport to="body">
    <Transition name="reorder-hint">
      <div
        v-if="menuReorder.isActive.value"
        class="reorder-hint"
        :class="{ 'reorder-hint-invalid': menuReorder.isInvalid.value }"
      >
        {{ menuReorder.hintText.value }}
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import LoginModal from './LoginModal.vue'
import NavMenuItem from './NavMenuItem.vue'
import { useMenuReorder, resolveDropPosition } from '../composables/useMenuReorder'

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
  },
  reorderable: {
    type: Boolean,
    default: false
  },
  activePath: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['select-menu', 'select-submenu', 'toggle-style', 'open-settings', 'logout', 'reorder-categories', 'create-category'])

const { isAuthenticated, username, logout, validateAuthState } = useAuth()
const { warning: warningToast } = useToast()

const menuReorder = useMenuReorder({
  menus: () => props.menus,
  canReorder: () => props.reorderable,
  onReorder: (payload) => emit('reorder-categories', payload),
  onInvalidDrop: () => warningToast('只能在同一层级内排序')
})

const hoveredMenuId = ref(null)
const hideTimeout = ref(null)
const autoCloseTimeout = ref(null)
const showUserMenu = ref(false)
const loginModalRef = ref(null)
const navBarRef = ref(null)

const updateHeight = () => {
  if (navBarRef.value) {
    document.documentElement.style.setProperty('--nav-bar-height', `${navBarRef.value.offsetHeight}px`)
  }
}

let resizeObserver = null

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
      if (menuReorder.isActive.value) return
      hoveredMenuId.value = null
    }, 2000)
  }
}

const showSubMenu = (menuId) => {
  if (menuReorder.isActive.value) return
  cancelAutoClose()
  if (hideTimeout.value) {
    clearTimeout(hideTimeout.value)
    hideTimeout.value = null
  }
  hoveredMenuId.value = menuId
}

const keepSubmenu = (menuId) => {
  if (menuReorder.isActive.value) return
  cancelAutoClose()
  if (hideTimeout.value) {
    clearTimeout(hideTimeout.value)
    hideTimeout.value = null
  }
  hoveredMenuId.value = menuId
}

const hideSubMenu = (menuId) => {
  hideTimeout.value = setTimeout(() => {
    if (menuReorder.isActive.value) return
    if (hoveredMenuId.value === menuId) {
      hoveredMenuId.value = null
    }
  }, 200)
}

const handleCreateCategory = (parentId = null) => {
  emit('create-category', parentId)
}

const handleRootDragStart = (event, menu) => {
  event.currentTarget.dispatchEvent(new MouseEvent('mouseleave'))
  if (!menuReorder.beginDrag(event, menu, null)) return
  if (hideTimeout.value) {
    clearTimeout(hideTimeout.value)
    hideTimeout.value = null
  }
  cancelAutoClose()
  hoveredMenuId.value = null
}

const MARK_STRENGTH = ['100%', '55%', '35%', '22%', '15%']
const MARK_BG_STRENGTH = ['18%', '10%', '6%', '4%', '3%']

const rootMarkStyle = (id) => {
  const path = props.activePath || []
  if (!path.length || path[0] !== id) return null
  const distance = Math.min(path.length - 1, MARK_STRENGTH.length - 1)
  return {
    '--mark-strength': MARK_STRENGTH[distance],
    '--mark-bg-strength': MARK_BG_STRENGTH[distance]
  }
}

const rootRowClasses = (id) => {
  const state = menuReorder.rowState(id)
  return {
    'is-dragging': state.dragging,
    'drop-before': state.before,
    'drop-after': state.after,
    'drop-forbidden': state.forbidden
  }
}

const handleRootDragOver = (event, menu) => {
  if (!menuReorder.isActive.value) return
  event.preventDefault()
  menuReorder.hoverItem(menu, null, resolveDropPosition(event, event.currentTarget, 'horizontal'), 'horizontal')
}

const handleRootDragLeave = (event) => {
  if (!menuReorder.isActive.value) return
  const next = event.relatedTarget
  if (next && event.currentTarget.contains(next)) return
  menuReorder.clearTarget()
}

const handleRootDrop = (event, menu) => {
  if (!menuReorder.isActive.value) return
  event.preventDefault()
  menuReorder.dropItem(menu, null, resolveDropPosition(event, event.currentTarget, 'horizontal'))
}

const handleRootDragEnd = () => {
  menuReorder.endDrag()
}

const handleSelectMenu = (menu) => {
  if (menuReorder.wasJustDragging()) return
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

const handleOpenSettings = () => {
  closeUserMenu()
  if (!validateAuthState()) {
    warningToast('登录状态已失效，请重新登录')
    loginModalRef.value?.open()
    return
  }
  emit('open-settings')
}

const handleLogout = () => {
  emit('logout')
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

onMounted(() => {
  updateHeight()
  window.addEventListener('resize', updateHeight)
  if (navBarRef.value) {
    resizeObserver = new ResizeObserver(updateHeight)
    resizeObserver.observe(navBarRef.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateHeight)
  resizeObserver?.disconnect()
})

defineExpose({
  closeUserMenu
})
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
  background: color-mix(in srgb, var(--nav-primary) var(--mark-bg-strength, 18%), transparent);
  color: color-mix(in srgb, var(--nav-primary) var(--mark-strength, 100%), var(--nav-text));
  opacity: 1;
}

.menu-add-trigger {
  padding: 0.45rem 0.7rem;
  color: var(--nav-text-secondary);
  opacity: 0.7;
}

.menu-add-trigger:hover {
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
  color: var(--nav-primary);
  opacity: 1;
}

.menu-add-icon {
  width: 14px;
  height: 14px;
}

.menu-leaf-add {
  position: absolute;
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--nav-text-secondary);
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;
  z-index: 2;
}

.menu-trigger:hover ~ .menu-leaf-add { opacity: 0.7; }

.menu-leaf-add:hover {
  opacity: 1;
  color: var(--nav-primary);
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
}

.menu-leaf-add svg {
  width: 11px;
  height: 11px;
}

.submenu-dropdown.has-add {
  min-width: 156px;
}

.submenu-add-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  white-space: nowrap;
  margin-top: 4px;
  padding: 0.45rem 0.8rem 0.45rem 1rem;
  border: none;
  border-top: 1px solid var(--nav-border);
  border-radius: 0 0 6px 6px;
  background: transparent;
  color: var(--nav-text-secondary);
  font-size: 0.8125rem;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.submenu-add-trigger:hover {
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
  color: var(--nav-primary);
}

.submenu-add-trigger svg {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

.menu-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.drag-grip {
  position: absolute;
  top: 50%;
  left: 4px;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 10px;
  height: 16px;
  border-radius: 4px;
  color: var(--nav-text-secondary);
  opacity: 0;
  cursor: grab;
  transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;
  flex-shrink: 0;
}

.drag-grip svg {
  width: 10px;
  height: 16px;
}

.menu-trigger:hover .drag-grip { opacity: 0.7; }

.drag-grip:hover {
  opacity: 1;
  color: var(--nav-primary);
  background: color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.drag-grip:active { cursor: grabbing; }

.menu-trigger.is-dragging {
  background: color-mix(in srgb, var(--nav-primary) 14%, transparent);
  color: var(--nav-primary);
  outline: 1px dashed color-mix(in srgb, var(--nav-primary) 60%, transparent);
  outline-offset: -1px;
  opacity: 0.85;
}

.menu-trigger.is-dragging .drag-grip {
  opacity: 1;
  color: var(--nav-primary);
}

.menu-trigger.drop-before {
  outline: 2px solid var(--nav-primary);
  outline-offset: 2px;
  box-shadow: inset 4px 0 0 var(--nav-primary);
}

.menu-trigger.drop-after {
  outline: 2px solid var(--nav-primary);
  outline-offset: 2px;
  box-shadow: inset -4px 0 0 var(--nav-primary);
}

.menu-trigger.drop-forbidden {
  outline: 2px dashed color-mix(in srgb, var(--error) 60%, transparent);
  outline-offset: 2px;
  color: var(--error);
}

.menu-drop-cue {
  position: absolute;
  top: calc(100% + 6px);
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--nav-primary);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  pointer-events: none;
  z-index: 300;
  box-shadow: 0 2px 10px color-mix(in srgb, var(--nav-primary) 40%, transparent);
}

.menu-drop-cue.before { left: 0; }
.menu-drop-cue.after { right: 0; }

.reorder-hint {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 500;
  max-width: 90vw;
  padding: 8px 16px;
  border-radius: 999px;
  background: var(--nav-glass);
  border: 1px solid var(--nav-border);
  box-shadow: 0 8px 30px var(--shadow-lg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  color: var(--nav-text);
  font-size: 0.78rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}

.reorder-hint-invalid {
  color: var(--error);
  border-color: color-mix(in srgb, var(--error) 45%, transparent);
}

.reorder-hint-enter-active,
.reorder-hint-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.reorder-hint-enter-from,
.reorder-hint-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}

@media (hover: none) {
  .drag-grip { display: none; }
  .menu-leaf-add { display: none; }
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
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-2px);
  min-width: auto;
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
    min-width: auto;
    max-width: min(280px, 90vw);
    transform: none;
    max-height: 60vh;
    overflow-y: auto;
  }
  .submenu-dropdown.show { transform: none; }
}
</style>
