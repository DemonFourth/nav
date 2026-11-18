<template>
  <div class="menu-row-wrapper">
    <div
      class="menu-row"
      :class="[
        {
          'is-expanded': isExpanded,
          'has-desc': !!node.description,
          'is-editing-name': isEditingName,
          'is-editing-desc': isEditingDesc
        },
        dragClasses
      ]"
      :style="{ '--depth': depth }"
      role="treeitem"
      :aria-expanded="hasChildren ? String(isExpanded) : undefined"
      tabindex="0"
      :data-category-id="node.id"
      @click="handleRowClick"
      @dblclick.stop="handleRowDblClick"
      @keydown.enter.space="handleRowKeydown"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <span
        class="row-grip"
        :class="{ 'is-static': !canDrag }"
        :draggable="canDrag"
        aria-hidden="true"
        @click.stop
        @dragstart.stop="handleDragStart"
        @dragend.stop="handleDragEnd"
      >
        <svg viewBox="0 0 10 16" fill="currentColor">
          <circle cx="3" cy="3" r="1.3" /><circle cx="7" cy="3" r="1.3" />
          <circle cx="3" cy="8" r="1.3" /><circle cx="7" cy="8" r="1.3" />
          <circle cx="3" cy="13" r="1.3" /><circle cx="7" cy="13" r="1.3" />
        </svg>
      </span>

      <button
        v-if="hasChildren"
        class="row-toggle"
        type="button"
        :aria-label="isExpanded ? '收起子分类' : '展开子分类'"
        @click.stop="emit('toggle', node.id)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <span v-else class="row-toggle-spacer"></span>

      <div class="row-main">
        <input
          v-if="isEditingName"
          ref="nameInputRef"
          v-model="editValue"
          class="row-name-input"
          maxlength="40"
          @click.stop
          @keyup.enter.stop="commit('name')"
          @keyup.esc.stop="cancelEdit"
          @blur="commit('name')"
        />
        <span v-else class="row-name">
          <template v-for="(part, index) in nameParts" :key="index">
            <mark v-if="part.match" class="row-name-hit">{{ part.text }}</mark><template v-else>{{ part.text }}</template>
          </template>
        </span>

        <div v-if="isEditingDesc" class="row-desc-editor" @click.stop>
          <input
            ref="descInputRef"
            v-model="editValue"
            class="row-desc-input"
            maxlength="50"
            placeholder="可选，导航栏悬浮时显示"
            @keyup.enter.stop="commit('description')"
            @keyup.esc.stop="cancelEdit"
            @blur="commit('description')"
          />
          <span class="row-desc-count">{{ editValue.length }}/50</span>
        </div>
        <span v-else-if="node.description" class="row-desc">{{ node.description }}</span>
      </div>

      <span class="row-count" :title="`${counts[node.id] ?? 0} 个书签（含子分类）`">{{ counts[node.id] ?? 0 }}</span>
      <span v-if="hasChildren" class="row-subcount">{{ totalChildren }}子</span>
      <button
        ref="moreBtnRef"
        class="row-more"
        type="button"
        aria-label="分类操作"
        v-tooltip="'更多操作'"
        @click.stop="toggleMenu"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>

      <span v-if="dropCue" class="row-drop-cue" :class="dropCue">
        {{ dropCue === 'before' ? '插入上方' : '插入下方' }}
      </span>
    </div>

    <div
      v-if="hasChildren && isExpanded"
      class="menu-row-children"
      role="group"
    >
      <MenuCategoryRow
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :expanded-ids="expandedIds"
        :counts="counts"
        :editing="editing"
        :reorder="reorder"
        :reorderable="reorderable"
        :highlight="highlight"
        @toggle="$emit('toggle', $event)"
        @start-edit="$emit('start-edit', $event)"
        @save-edit="$emit('save-edit', $event)"
        @cancel-edit="$emit('cancel-edit')"
        @action="$emit('action', $event)"
      />
    </div>

    <Teleport to="body">
      <div
        v-if="menuOpen"
        class="row-menu"
        :style="menuStyle"
        @click.stop
      >
        <button type="button" class="row-menu-item" @click="menuAction('rename')">重命名</button>
        <button type="button" class="row-menu-item" @click="menuAction('description')">编辑描述</button>
        <button type="button" class="row-menu-item" @click="menuAction('create-child')">新建子分类</button>
        <button type="button" class="row-menu-item" @click="menuAction('move')">移动到…</button>
        <button type="button" class="row-menu-item is-danger" @click="menuAction('delete')">删除</button>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { resolveDropPosition } from '@/composables/useMenuReorder'

defineOptions({
  name: 'MenuCategoryRow'
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
  expandedIds: {
    type: Array,
    default: () => []
  },
  counts: {
    type: Object,
    default: () => ({})
  },
  editing: {
    type: Object,
    default: null
  },
  reorder: {
    type: Object,
    default: null
  },
  reorderable: {
    type: Boolean,
    default: false
  },
  highlight: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['toggle', 'start-edit', 'save-edit', 'cancel-edit', 'action'])

const hasChildren = computed(() => (props.node.children?.length || 0) > 0)
const totalChildren = computed(() => props.node.totalChildren ?? (props.node.children?.length || 0))
const isExpanded = computed(() => props.expandedIds.includes(props.node.id))
const canDrag = computed(() => props.reorderable && !!props.reorder)

const nameParts = computed(() => {
  const name = props.node.name || ''
  const query = (props.highlight || '').trim()
  if (!query) return [{ text: name, match: false }]

  const lowerName = name.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const parts = []
  let cursor = 0
  while (cursor < name.length) {
    const hit = lowerName.indexOf(lowerQuery, cursor)
    if (hit === -1) {
      parts.push({ text: name.slice(cursor), match: false })
      break
    }
    if (hit > cursor) parts.push({ text: name.slice(cursor, hit), match: false })
    parts.push({ text: name.slice(hit, hit + query.length), match: true })
    cursor = hit + query.length
  }
  return parts.length ? parts : [{ text: name, match: false }]
})

const isEditingName = computed(() => props.editing?.id === props.node.id && props.editing?.field === 'name')
const isEditingDesc = computed(() => props.editing?.id === props.node.id && props.editing?.field === 'description')

const nameInputRef = ref(null)
const descInputRef = ref(null)
const moreBtnRef = ref(null)

const editValue = ref('')
const committed = ref(false)

watch([isEditingName, isEditingDesc], async ([nameEditing, descEditing]) => {
  if (nameEditing || descEditing) {
    const field = nameEditing ? 'name' : 'description'
    editValue.value = field === 'name' ? (props.node.name || '') : (props.node.description || '')
    committed.value = false
    await nextTick()
    const input = field === 'name' ? nameInputRef.value : descInputRef.value
    input?.focus()
    input?.select?.()
  }
}, { immediate: true })

const startEdit = (field) => {
  if (props.reorder?.wasJustDragging?.()) return
  emit('start-edit', { id: props.node.id, field })
}

const cancelEdit = () => {
  if (isEditingName.value || isEditingDesc.value) {
    committed.value = true
    emit('cancel-edit')
  }
}

const commit = (field) => {
  if (committed.value) return
  if (field === 'name' && !isEditingName.value) return
  if (field === 'description' && !isEditingDesc.value) return
  committed.value = true

  const value = editValue.value.trim()
  const current = field === 'name'
    ? (props.node.name || '').trim()
    : (props.node.description || '').trim()

  if (field === 'name' && !value) {
    emit('cancel-edit')
    return
  }
  if (value === current) {
    emit('cancel-edit')
    return
  }
  emit('save-edit', { id: props.node.id, field, value })
}

const handleRowClick = (event) => {
  if (props.reorder?.wasJustDragging?.()) return
  if (event.target.closest('button, input, .row-menu')) return
  if (!hasChildren.value) return
  emit('toggle', props.node.id)
}

const handleRowDblClick = (event) => {
  if (event.target.closest('input, textarea, button, .row-desc-editor')) return
  startEdit('name')
}

const handleRowKeydown = (event) => {
  if (event.target !== event.currentTarget) return
  event.preventDefault()
  if (!hasChildren.value) return
  emit('toggle', props.node.id)
}

/* ===== 行内操作菜单 ===== */
const menuOpen = ref(false)
const menuStyle = ref({})

const toggleMenu = () => {
  if (menuOpen.value) {
    closeMenu()
    return
  }
  const rect = moreBtnRef.value?.getBoundingClientRect()
  if (!rect) return
  const width = 168
  const height = 5 * 32 + 10
  const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
  let top = rect.bottom + 4
  if (top + height > window.innerHeight - 8) {
    top = Math.max(8, rect.top - height - 4)
  }
  menuStyle.value = { top: `${top}px`, left: `${left}px`, width: `${width}px` }
  menuOpen.value = true
  window.addEventListener('pointerdown', handleOutsidePointerDown, true)
  window.addEventListener('scroll', closeMenu, true)
  window.addEventListener('resize', closeMenu)
}

const closeMenu = () => {
  if (!menuOpen.value) return
  menuOpen.value = false
  window.removeEventListener('pointerdown', handleOutsidePointerDown, true)
  window.removeEventListener('scroll', closeMenu, true)
  window.removeEventListener('resize', closeMenu)
}

const handleOutsidePointerDown = (event) => {
  if (event.target?.closest?.('.row-menu, .row-more')) return
  closeMenu()
}

const menuAction = (action) => {
  const node = props.node
  closeMenu()
  emit('action', { action, node })
}

onBeforeUnmount(closeMenu)

/* ===== 拖拽（与导航栏同一套语义：仅同级排序） ===== */
const isDragActive = () => props.reorder?.isActive?.value === true

const dragClasses = computed(() => {
  if (!props.reorder) return {}
  const state = props.reorder.rowState(props.node.id)
  return {
    'is-dragging': state.dragging,
    'drop-before': state.before,
    'drop-after': state.after,
    'drop-forbidden': state.forbidden
  }
})

const dropCue = computed(() => props.reorder?.dropCue?.(props.node.id) || null)
const parentId = () => props.node.parent_id ?? null

const handleDragStart = (event) => {
  if (!canDrag.value) return
  props.reorder?.beginDrag(event, props.node, parentId())
}

const handleDragOver = (event) => {
  if (!isDragActive()) return
  event.preventDefault()
  props.reorder?.hoverItem(
    props.node,
    parentId(),
    resolveDropPosition(event, event.currentTarget, 'vertical'),
    'vertical'
  )
}

const handleDragLeave = (event) => {
  if (!isDragActive()) return
  const next = event.relatedTarget
  if (next && event.currentTarget.contains(next)) return
  props.reorder?.clearTarget()
}

const handleDrop = (event) => {
  if (!isDragActive()) return
  event.preventDefault()
  props.reorder?.dropItem(
    props.node,
    parentId(),
    resolveDropPosition(event, event.currentTarget, 'vertical')
  )
}

const handleDragEnd = () => {
  props.reorder?.endDrag()
}
</script>

<style scoped>
.menu-row-wrapper {
  position: relative;
}

.menu-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 4px 8px 4px calc(6px + var(--depth, 0) * 18px);
  border-radius: 8px;
  color: var(--nav-text, var(--text-secondary));
  transition: background 0.12s ease, color 0.12s ease;
  outline: none;
}

.menu-row:hover {
  background: var(--nav-bg-hover, var(--bg-hover));
  color: var(--text);
}

.menu-row:focus-visible {
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--nav-primary) 60%, transparent);
}

.menu-row.has-desc {
  align-items: flex-start;
  padding-top: 6px;
  padding-bottom: 6px;
}

.row-grip {
  flex: 0 0 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  opacity: 0;
  cursor: grab;
  transition: opacity 0.12s ease, color 0.12s ease;
  user-select: none;
}

.row-grip svg {
  width: 10px;
  height: 16px;
}

.row-grip.is-static {
  cursor: default;
  pointer-events: none;
}

.menu-row:hover .row-grip,
.menu-row:focus-visible .row-grip {
  opacity: 1;
}

.row-grip:active {
  cursor: grabbing;
}

.row-toggle,
.row-toggle-spacer {
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
}

.row-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 4px;
}

.row-toggle:hover {
  color: var(--text);
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
}

.row-toggle svg {
  width: 13px;
  height: 13px;
  transition: transform 0.15s ease;
}

.menu-row.is-expanded > .row-toggle svg {
  transform: rotate(90deg);
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.row-name {
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-name-hit {
  color: var(--nav-primary);
  background: color-mix(in srgb, var(--nav-primary) 16%, transparent);
  border-radius: 3px;
  padding: 0 1px;
}

.row-name-input {  width: 100%;
  box-sizing: border-box;
  padding: 2px 6px;
  border: 1px solid color-mix(in srgb, var(--nav-primary) 55%, transparent);
  border-radius: 6px;
  background: var(--input-bg, var(--bg-secondary));
  color: var(--text);
  font-size: 0.8125rem;
  font-family: inherit;
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.row-desc {
  font-size: 0.6875rem;
  line-height: 1.35;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-desc-editor {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
}

.row-desc-input {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  padding: 2px 6px;
  border: 1px solid color-mix(in srgb, var(--nav-primary) 55%, transparent);
  border-radius: 6px;
  background: var(--input-bg, var(--bg-secondary));
  color: var(--text);
  font-size: 0.6875rem;
  font-family: inherit;
  outline: none;
}

.row-desc-count {
  flex-shrink: 0;
  font-size: 0.625rem;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.row-count {
  flex-shrink: 0;
  min-width: 18px;
  text-align: right;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.row-subcount {
  flex-shrink: 0;
  padding: 0 5px;
  border-radius: 999px;
  font-size: 0.625rem;
  line-height: 16px;
  color: var(--text-tertiary);
  border: 1px solid var(--nav-border, var(--border));
}

.row-more {
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease, background 0.12s ease, color 0.12s ease;
}

.row-more svg {
  width: 14px;
  height: 14px;
}

.menu-row:hover .row-more,
.menu-row:focus-within .row-more {
  opacity: 1;
}

.row-more:hover {
  background: color-mix(in srgb, var(--nav-primary) 14%, transparent);
  color: var(--nav-primary);
}

/* 拖拽状态：与导航栏保持一致 */
.menu-row.is-dragging {
  background: color-mix(in srgb, var(--nav-primary) 14%, transparent);
  color: var(--nav-primary);
  outline: 1px dashed color-mix(in srgb, var(--nav-primary) 60%, transparent);
  outline-offset: -1px;
  opacity: 0.85;
}

.menu-row.is-dragging .row-grip {
  opacity: 1;
  color: var(--nav-primary);
}

.menu-row.drop-before {
  outline: 2px solid var(--nav-primary);
  outline-offset: -2px;
  box-shadow: inset 0 4px 0 var(--nav-primary);
}

.menu-row.drop-after {
  outline: 2px solid var(--nav-primary);
  outline-offset: -2px;
  box-shadow: inset 0 -4px 0 var(--nav-primary);
}

.menu-row.drop-forbidden {
  outline: 1.5px dashed var(--error);
  outline-offset: -2px;
}

.row-drop-cue {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.625rem;
  line-height: 16px;
  color: #fff;
  background: var(--nav-primary);
  box-shadow: 0 2px 10px color-mix(in srgb, var(--nav-primary) 40%, transparent);
  pointer-events: none;
  z-index: 2;
  white-space: nowrap;
}

.row-drop-cue.before {
  top: -9px;
}

.row-drop-cue.after {
  bottom: -9px;
}

/* 行内操作菜单（Teleport 到 body） */
.row-menu {
  position: fixed;
  z-index: 10050;
  padding: 4px;
  border-radius: 10px;
  background: var(--nav-glass, var(--bg));
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border: 1px solid var(--nav-border, var(--border));
  box-shadow: 0 12px 32px -12px var(--shadow-lg, rgba(0, 0, 0, 0.35));
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.row-menu-item {
  display: block;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--nav-text, var(--text));
  font-size: 0.75rem;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.row-menu-item:hover {
  background: var(--nav-bg-hover, var(--bg-hover));
  color: var(--text);
}

.row-menu-item.is-danger {
  color: var(--error);
}

.row-menu-item.is-danger:hover {
  background: color-mix(in srgb, var(--error) 12%, transparent);
}

@media (hover: none) {
  .row-grip {
    display: none;
  }

  .row-more {
    opacity: 1;
  }
}
</style>
