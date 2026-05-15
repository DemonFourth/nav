<template>
  <div class="tree-section-menu">
    <div
      class="tree-item-menu"
      :class="{
        selected: selectedId === node.id,
        dragging: dragState.draggingId === node.id,
        'drop-target': dragState.dropTargetId === node.id && dragState.dropPosition === 'child'
      }"
      :style="itemStyle"
      draggable="true"
      @dragstart="$emit('drag-start', $event, node)"
      @dragend="$emit('drag-end')"
      @dragover.prevent="$emit('drag-over', $event, node)"
      @drop="$emit('drop', $event, node)"
      @click="$emit('select', node)"
    >
      <span v-if="depth > 0" class="item-connector-menu" :style="connectorStyle"></span>
      <span class="drag-handle-menu">
        <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
          <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
          <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
        </svg>
      </span>
      <div class="item-icon-menu" :class="iconClass">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
          <path v-if="depth === 0" d="M3 7h18M3 12h18M3 17h18"/>
          <path v-else-if="depth === 1" d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
          <path v-else d="M7 7h10v10H7z"/>
        </svg>
      </div>
      <span class="item-name-menu">{{ node.name }}</span>
      <span class="item-count-menu">{{ node.children?.length || 0 }}</span>
      <div class="item-move-btns">
        <button class="move-btn" :disabled="siblingIndex === 0" @click.stop="$emit('move-item', node, -1)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path d="M5 15l7-7 7 7"/></svg>
        </button>
        <button class="move-btn" :disabled="siblingIndex >= siblingCount - 1" @click.stop="$emit('move-item', node, 1)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path d="M19 9l-7 7-7-7"/></svg>
        </button>
      </div>
      <button class="item-expand-menu" @click.stop="$emit('toggle-expand', node.id)" v-if="node.children?.length">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"
             :class="{ rotated: isExpanded }">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
    </div>

    <div v-if="dragState.dropTargetId === node.id && dragState.dropPosition === 'before'" class="drop-indicator-menu top"></div>

    <div v-if="isExpanded && node.children?.length" class="tree-children-menu">
      <MenuTreeNode
        v-for="(child, childIdx) in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :sibling-index="childIdx"
        :sibling-count="node.children.length"
        :selected-id="selectedId"
        :expanded-ids="expandedIds"
        :drag-state="dragState"
        @select="handleSelect"
        @drag-start="handleChildDragStart"
        @drag-end="handleDragEnd"
        @drag-over="handleChildDragOver"
        @drop="handleChildDrop"
        @toggle-expand="handleToggleExpand"
        @move-item="handleMoveItem"
      />
    </div>

    <div v-if="dragState.dropTargetId === node.id && dragState.dropPosition === 'after'" class="drop-indicator-menu bottom"></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({
  name: 'MenuTreeNode'
})

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  depth: {
    type: Number,
    default: 0
  },
  siblingIndex: {
    type: Number,
    default: 0
  },
  siblingCount: {
    type: Number,
    default: 1
  },
  selectedId: {
    type: [String, Number],
    default: null
  },
  expandedIds: {
    type: Array,
    default: () => []
  },
  dragState: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['select', 'drag-start', 'drag-end', 'drag-over', 'drop', 'toggle-expand', 'move-item'])

const isExpanded = computed(() => props.expandedIds.includes(props.node.id))

const handleSelect = (node) => emit('select', node)
const handleToggleExpand = (id) => emit('toggle-expand', id)
const handleDragEnd = () => emit('drag-end')
const handleChildDragStart = (event, node) => emit('drag-start', event, node)
const handleChildDragOver = (event, node) => emit('drag-over', event, node)
const handleChildDrop = (event, node) => emit('drop', event, node)
const handleMoveItem = (node, direction) => emit('move-item', node, direction)

const itemStyle = computed(() => ({
  '--tree-depth': props.depth,
  '--tree-indent': `${props.depth * 1.125 + 0.625}rem`
}))

const connectorStyle = computed(() => ({
  left: `calc(${props.depth * 1.125}rem + 0.25rem)`
}))

const iconClass = computed(() => {
  if (props.depth === 0) return 'root-icon-menu'
  if (props.depth === 1) return 'child-icon-menu'
  return 'deep-icon-menu'
})
</script>

<style scoped>
.tree-section-menu {
  margin-bottom: 1px;
}

.tree-item-menu {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.5rem var(--tree-indent, 0.625rem);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  font-weight: 400;
  color: var(--text);
}

.tree-item-menu:hover {
  background: var(--nav-bg-hover);
}

.tree-item-menu.selected {
  background: var(--accent-alpha-10);
  box-shadow: inset 0 0 0 1.5px var(--accent);
}

.tree-item-menu.dragging {
  opacity: 0.5;
}

.tree-item-menu.drop-target {
  box-shadow: inset 0 0 0 2px var(--accent);
  background: var(--accent-alpha-5);
}

.drag-handle-menu {
  color: var(--text-muted);
  cursor: grab;
  width: 12px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.tree-item-menu:hover .drag-handle-menu {
  opacity: 1;
}

.item-icon-menu {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  color: var(--accent);
  flex-shrink: 0;
}

.root-icon-menu {
  color: var(--accent);
}

.child-icon-menu {
  color: var(--text-muted);
}

.deep-icon-menu {
  color: var(--text-muted);
  opacity: 0.6;
}

.item-name-menu {
  flex: 1;
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-count-menu {
  font-size: 0.7rem;
  color: var(--text-muted);
  background: var(--card-border);
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  flex-shrink: 0;
}

.item-expand-menu {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.item-expand-menu:hover {
  background: var(--accent-alpha-10);
  border-color: var(--accent);
  color: var(--accent);
}

.item-expand-menu svg {
  width: 10px;
  height: 10px;
  transition: transform 0.2s;
}

.item-expand-menu svg.rotated {
  transform: rotate(90deg);
}

.item-connector-menu {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--card-border);
}

.item-move-btns {
  display: flex;
  gap: 1px;
  flex-shrink: 0;
}

.move-btn {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 4px;
  padding: 2px;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  transition: all 0.15s;
}

.move-btn:hover:not(:disabled) {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--ov-bg);
}

.move-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.tree-children-menu {
  margin-top: 2px;
}

.drop-indicator-menu {
  height: 2px;
  background: var(--accent);
  border-radius: 1px;
  margin: 2px 0;
}

.drop-indicator-menu.top {
  margin-bottom: 4px;
}

.drop-indicator-menu.bottom {
  margin-top: 4px;
}
</style>
