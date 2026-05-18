<template>
  <div class="nav-submenu-wrapper">
    <button 
      class="submenu-trigger"
      :class="{ active: activeId === item.id }"
      @click="handleSelect"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    >
      <span class="submenu-text">{{ item.name }}</span>
      <svg 
        v-if="item.children && item.children.length > 0"
        class="submenu-arrow"
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor"
      >
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>

    <div 
      v-if="item.children && item.children.length > 0"
      class="submenu-children"
      :class="{ 'show': isHovered }"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    >
      <NavMenuItem 
        v-for="child in item.children"
        :key="child.id"
        :item="child"
        :active-id="activeId"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineOptions({
  name: 'NavMenuItem'
})

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  activeId: {
    type: [String, Number],
    default: null
  }
})

const emit = defineEmits(['select'])

const isHovered = ref(false)
let hoverTimeout = null

const handleSelect = () => {
  emit('select', props.item)
}

const handleMouseEnter = () => {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  }
  isHovered.value = true
}

const handleMouseLeave = () => {
  hoverTimeout = setTimeout(() => {
    isHovered.value = false
  }, 100)
}
</script>

<style scoped>
.nav-submenu-wrapper {
  position: relative;
}

.submenu-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.5rem 0.8rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--nav-text);
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.submenu-trigger:hover {
  background: color-mix(in srgb, var(--nav-primary) 28%, transparent);
  color: var(--nav-text);
}

.submenu-trigger.active {
  background: color-mix(in srgb, var(--nav-primary) 38%, transparent);
  color: var(--nav-primary);
  font-weight: 500;
}

.submenu-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.submenu-arrow {
  width: 12px;
  height: 12px;
  stroke-width: 2;
  opacity: 0.6;
  flex-shrink: 0;
}

.submenu-children {
  position: absolute;
  top: 0;
  left: calc(100% + 8px);
  min-width: auto;
  background: var(--nav-glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 12px;
  box-shadow: 0 10px 40px var(--shadow-xl);
  border: 1px solid var(--nav-border);
  padding: 0.5rem;
  z-index: 250;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
}

.submenu-children.show {
  opacity: 1;
  visibility: visible;
  transform: translateX(4px);
}

@media (max-width: 768px) {
  .submenu-children {
    position: static;
    box-shadow: none;
    border: none;
    padding: 0 0 0 0.75rem;
    margin-top: 2px;
    background: transparent;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    max-height: 0;
    overflow: hidden;
    opacity: 1;
    visibility: visible;
    transition: all 0.2s ease;
  }
  .submenu-children.show {
    max-height: 500px;
    padding: 0.25rem 0 0.25rem 0.75rem;
    opacity: 1;
    visibility: visible;
    transform: none;
  }
  .submenu-trigger {
    padding: 0.4rem 0.6rem;
    font-size: 0.8125rem;
  }
}
</style>
