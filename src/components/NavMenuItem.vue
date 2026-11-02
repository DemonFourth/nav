<template>
  <div class="nav-submenu-wrapper">
    <button 
      class="submenu-trigger"
      :class="[{ active: activeId === item.id }, dragClasses]"
      @click="handleSelect"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <span
        v-if="reorderable && reorder"
        class="drag-grip"
        draggable="true"
        aria-label="按住并拖动，调整同级顺序"
        v-tooltip="'按住并拖动，调整同级顺序'"
        @click.stop.prevent
        @dragstart.stop="handleDragStart"
        @dragend.stop="handleDragEnd"
      >
        <svg viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
          <circle cx="3" cy="3" r="1.3" /><circle cx="7" cy="3" r="1.3" />
          <circle cx="3" cy="8" r="1.3" /><circle cx="7" cy="8" r="1.3" />
          <circle cx="3" cy="13" r="1.3" /><circle cx="7" cy="13" r="1.3" />
        </svg>
      </span>
      <span class="submenu-text" :title="item.description || ''">{{ item.name }}</span>
      <svg 
        v-if="item.children && item.children.length > 0"
        class="submenu-arrow"
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor"
      >
        <polyline points="9 18 15 12 9 6"/>
      </svg>
      <span
        v-if="dropCue"
        class="submenu-drop-cue"
        :class="dropCue"
      >
        {{ dropCue === 'before' ? '插入上方' : '插入下方' }}
      </span>
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
        :parent-id="item.id"
        :active-id="activeId"
        :reorderable="reorderable"
        :reorder="reorder"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { resolveDropPosition } from '../composables/useMenuReorder'

defineOptions({
  name: 'NavMenuItem'
})

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  parentId: {
    type: [String, Number],
    default: null
  },
  activeId: {
    type: [String, Number],
    default: null
  },
  reorderable: {
    type: Boolean,
    default: false
  },
  reorder: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['select'])

const isHovered = ref(false)
let hoverTimeout = null

const isDragActive = () => props.reorder?.isActive?.value === true

const dragClasses = computed(() => {
  if (!props.reorder) return {}
  const state = props.reorder.rowState(props.item.id)
  return {
    'is-dragging': state.dragging,
    'drop-before': state.before,
    'drop-after': state.after,
    'drop-forbidden': state.forbidden
  }
})

const dropCue = computed(() => props.reorder?.dropCue?.(props.item.id) || null)

const handleSelect = () => {
  if (props.reorder?.wasJustDragging?.()) return
  emit('select', props.item)
}

const handleMouseEnter = () => {
  if (isDragActive()) return
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  }
  isHovered.value = true
}

const handleMouseLeave = () => {
  if (isDragActive()) return
  hoverTimeout = setTimeout(() => {
    if (isDragActive()) return
    isHovered.value = false
  }, 100)
}

const handleDragStart = (event) => {
  event.currentTarget.dispatchEvent(new MouseEvent('mouseleave'))
  props.reorder?.beginDrag(event, props.item, props.parentId ?? null)
}

const handleDragOver = (event) => {
  if (!isDragActive()) return
  event.preventDefault()
  props.reorder.hoverItem(
    props.item,
    props.parentId ?? null,
    resolveDropPosition(event, event.currentTarget, 'vertical'),
    'vertical'
  )
}

const handleDragLeave = (event) => {
  if (!isDragActive()) return
  const next = event.relatedTarget
  if (next && event.currentTarget.contains(next)) return
  props.reorder.clearTarget()
}

const handleDrop = (event) => {
  if (!isDragActive()) return
  event.preventDefault()
  props.reorder.dropItem(
    props.item,
    props.parentId ?? null,
    resolveDropPosition(event, event.currentTarget, 'vertical')
  )
}

const handleDragEnd = () => {
  props.reorder?.endDrag()
}
</script>

<style scoped>
.nav-submenu-wrapper {
  position: relative;
}

.submenu-trigger {
  position: relative;
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

.drag-grip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 16px;
  margin-right: 4px;
  border-radius: 4px;
  color: var(--nav-text-secondary);
  opacity: 0;
  cursor: grab;
  flex-shrink: 0;
  transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}

.drag-grip svg {
  width: 10px;
  height: 14px;
}

.submenu-trigger:hover .drag-grip { opacity: 0.7; }

.drag-grip:hover {
  opacity: 1;
  color: var(--nav-primary);
  background: color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.drag-grip:active { cursor: grabbing; }

.submenu-trigger.is-dragging { opacity: 0.4; }

.submenu-trigger.drop-before {
  outline: 2px solid var(--nav-primary);
  outline-offset: -2px;
  box-shadow: inset 0 4px 0 var(--nav-primary);
}

.submenu-trigger.drop-after {
  outline: 2px solid var(--nav-primary);
  outline-offset: -2px;
  box-shadow: inset 0 -4px 0 var(--nav-primary);
}

.submenu-trigger.drop-forbidden {
  outline: 2px dashed color-mix(in srgb, var(--error) 60%, transparent);
  outline-offset: -2px;
  color: var(--error);
}

.submenu-drop-cue {
  position: absolute;
  right: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--nav-primary);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  pointer-events: none;
  z-index: 12;
  box-shadow: 0 2px 10px color-mix(in srgb, var(--nav-primary) 40%, transparent);
}

.submenu-drop-cue.before { top: -9px; }
.submenu-drop-cue.after { bottom: -9px; }

@media (hover: none) {
  .drag-grip { display: none; }
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

.submenu-children::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  right: 100%;
  width: 12px;
  z-index: 250;
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
