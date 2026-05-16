<template>
  <div class="menu-editor-preview">
    <div class="preview-header">
      <h1>菜单编辑器预览</h1>
      <p>方案 A：双面板布局 - 左侧拖拽排序，右侧表单编辑</p>
    </div>

    <div class="editor-container">
      <!-- Left Panel: Draggable Category Tree -->
      <div class="left-panel">
        <div class="panel-header">
          <h2>菜单结构</h2>
          <button class="btn btn-primary btn-sm" @click="addCategory">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            新增分类
          </button>
        </div>

        <div class="category-tree">
          <div
            v-for="(category, index) in categories"
            :key="category.id"
            class="tree-section"
          >
            <!-- Root Category -->
            <div
              class="tree-item root-item"
              :class="{
                selected: selectedCategory?.id === category.id,
                dragging: draggingId === category.id,
                'drop-target': dropTargetId === category.id && dropPosition === 'before'
              }"
              draggable="true"
              @dragstart="handleDragStart($event, category, 'root', index)"
              @dragend="handleDragEnd"
              @dragover="handleDragOver($event, category, 'root', index)"
              @dragleave="handleDragLeave"
              @drop="handleDrop($event, category, 'root', index)"
              @click="selectCategory(category)"
            >
              <div class="item-drag-handle">
                <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                  <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                  <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                  <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                </svg>
              </div>
              <div class="item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M3 7h18M3 12h18M3 17h18"/>
                </svg>
              </div>
              <span class="item-name">{{ category.name }}</span>
              <span class="item-count">{{ category.children?.length || 0 }}</span>
              <button class="item-expand" @click.stop="toggleExpand(category.id)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"
                     :class="{ rotated: expandedIds.includes(category.id) }">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>

            <!-- Drop indicator for root level -->
            <div v-if="dropTargetId === category.id && dropPosition === 'before'" class="drop-indicator top"></div>

            <!-- Children -->
            <div v-if="expandedIds.includes(category.id) && category.children?.length" class="tree-children">
              <div
                v-for="(child, childIndex) in category.children"
                :key="child.id"
                class="tree-item child-item"
                :class="{
                  selected: selectedCategory?.id === child.id,
                  dragging: draggingId === child.id,
                  'drop-target': dropTargetId === child.id && dropPosition === 'after'
                }"
                draggable="true"
                @dragstart="handleDragStart($event, child, 'child', index, childIndex)"
                @dragend="handleDragEnd"
                @dragover="handleDragOver($event, child, 'child', index, childIndex)"
                @dragleave="handleDragLeave"
                @drop="handleDrop($event, child, 'child', index, childIndex)"
                @click="selectCategory(child)"
              >
                <div class="item-connector"></div>
                <div class="item-drag-handle">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                    <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                    <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                    <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                  </svg>
                </div>
                <div class="item-icon child-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                  </svg>
                </div>
                <span class="item-name">{{ child.name }}</span>
                <span class="item-count">{{ child.bookmarkCount }}</span>
              </div>
              <!-- Drop indicator for child level (at end) -->
              <div v-if="dropTargetId === category.id && dropPosition === 'after'" class="drop-indicator bottom"></div>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="categories.length === 0" class="empty-tree">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
              <path d="M3 7h18M3 12h18M3 17h18"/>
            </svg>
            <p>暂无分类</p>
            <button class="btn btn-primary" @click="addCategory">创建第一个分类</button>
          </div>
        </div>

        <!-- Root level drop zone (visual indicator only, not allowed) -->
        <div class="root-drop-zone" :class="{ active: isDragging && !draggingId?.includes('child') }">
          <span>拖放到此处可创建根分类</span>
        </div>
      </div>

      <!-- Right Panel: Category Details Form -->
      <div class="right-panel">
        <div class="panel-header">
          <h2>分类详情</h2>
        </div>

        <div v-if="selectedCategory" class="detail-form">
          <div class="form-group">
            <label>分类名称</label>
            <input
              type="text"
              v-model="editForm.name"
              placeholder="输入分类名称"
            />
          </div>

          <div class="form-group">
            <label>父分类</label>
            <select v-model="editForm.parentId" :disabled="isChangingParentDisabled">
              <option :value="null">无（根分类）</option>
              <option
                v-for="cat in availableParentCategories"
                :key="cat.id"
                :value="cat.id"
                :disabled="cat.id === selectedCategory.id || isDescendant(cat.id, selectedCategory.id)"
              >
                {{ cat.name }}
              </option>
            </select>
            <p class="form-hint" v-if="isChangingParentDisabled">
              通过拖拽调整顺序，通过表单变更父分类
            </p>
          </div>

          <div class="form-group">
            <label>位置</label>
            <div class="position-controls">
              <button
                class="icon-btn"
                @click="movePosition(-1)"
                :disabled="editForm.position <= 1"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14M12 5l-7 7 7 7"/>
                </svg>
              </button>
              <span class="position-value">{{ editForm.position }}</span>
              <button
                class="icon-btn"
                @click="movePosition(1)"
                :disabled="editForm.position >= maxPosition"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 12H5M12 19l7-7-7-7"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="form-group">
            <label>快捷操作</label>
            <div class="quick-actions">
              <button class="btn btn-secondary btn-sm" @click="moveToTop">
                置顶
              </button>
              <button class="btn btn-secondary btn-sm" @click="moveToBottom">
                置底
              </button>
            </div>
          </div>

          <div class="form-actions">
            <button class="btn btn-secondary" @click="resetForm">重置</button>
            <button class="btn btn-primary" @click="applyChanges">应用更改</button>
          </div>

          <div class="danger-zone">
            <h3>危险区域</h3>
            <button class="btn btn-danger" @click="deleteCategory">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
              删除此分类
            </button>
            <p class="danger-hint">删除分类将同时删除所有子分类和书签</p>
          </div>
        </div>

        <div v-else class="no-selection">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
            <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/>
          </svg>
          <p>选择左侧分类以编辑详情</p>
        </div>
      </div>
    </div>

    <!-- Pending Changes Bar -->
    <div class="pending-bar" :class="{ visible: pendingChanges.length > 0 }">
      <div class="pending-info">
        <span class="pending-count">{{ pendingChanges.length }}</span> 项待保存更改
      </div>
      <div class="pending-actions">
        <button class="btn btn-secondary" @click="discardChanges">放弃</button>
        <button class="btn btn-primary" @click="saveChanges">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
            <polyline points="17,21 17,13 7,13 7,21"/>
            <polyline points="7,3 7,8 15,8"/>
          </svg>
          保存更改
        </button>
      </div>
    </div>

    <!-- Toast Notification -->
    <Transition name="toast">
      <div v-if="toast.show" class="toast" :class="toast.type">
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'

const categories = ref([
  {
    id: '1',
    name: '技术文档',
    children: [
      { id: '1-1', name: 'Vue.js', bookmarkCount: 12 },
      { id: '1-2', name: 'React', bookmarkCount: 8 },
      { id: '1-3', name: 'TypeScript', bookmarkCount: 5 }
    ]
  },
  {
    id: '2',
    name: '设计资源',
    children: [
      { id: '2-1', name: 'Figma 资源', bookmarkCount: 24 },
      { id: '2-2', name: '图标库', bookmarkCount: 15 }
    ]
  },
  {
    id: '3',
    name: '效率工具',
    children: []
  },
  {
    id: '4',
    name: '新闻资讯',
    children: [
      { id: '4-1', name: '科技媒体', bookmarkCount: 7 },
      { id: '4-2', name: '行业报告', bookmarkCount: 3 },
      { id: '4-3', name: '开发者博客', bookmarkCount: 11 }
    ]
  }
])

const expandedIds = ref(['1', '2', '4'])
const selectedCategory = ref(null)
const draggingId = ref(null)
const dropTargetId = ref(null)
const dropPosition = ref(null)
const isDragging = ref(false)
const pendingChanges = ref([])

const editForm = reactive({
  name: '',
  parentId: null,
  position: 1
})

const toast = reactive({
  show: false,
  message: '',
  type: 'success'
})

const maxPosition = computed(() => {
  if (!selectedCategory.value) return 1
  const parent = categories.value.find(c => c.id === selectedCategory.value.id || c.children?.some(ch => ch.id === selectedCategory.value.id))
  if (parent?.children) return parent.children.length
  return categories.value.length
})

const isChangingParentDisabled = computed(() => {
  return true
})

const availableParentCategories = computed(() => {
  if (!selectedCategory.value) return []
  const result = []
  categories.value.forEach(cat => {
    if (cat.id !== selectedCategory.value.id && !isDescendant(cat.id, selectedCategory.value.id)) {
      result.push(cat)
    }
    cat.children?.forEach(child => {
      if (child.id !== selectedCategory.value.id && !isDescendant(child.id, selectedCategory.value.id)) {
        result.push(child)
      }
    })
  })
  return result
})

function showToast(message, type = 'success') {
  toast.message = message
  toast.type = type
  toast.show = true
  setTimeout(() => { toast.show = false }, 3000)
}

function selectCategory(category) {
  selectedCategory.value = category
  editForm.name = category.name
  editForm.parentId = null
  editForm.position = 1
}

function toggleExpand(id) {
  const index = expandedIds.value.indexOf(id)
  if (index > -1) {
    expandedIds.value.splice(index, 1)
  } else {
    expandedIds.value.push(id)
  }
}

function handleDragStart(event, category, type, parentIndex, childIndex) {
  draggingId.value = type === 'child' ? `${parentIndex}-${childIndex}` : `${parentIndex}`
  isDragging.value = true
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', JSON.stringify({ category, type, parentIndex, childIndex }))
}

function handleDragEnd() {
  draggingId.value = null
  dropTargetId.value = null
  dropPosition.value = null
  isDragging.value = false
}

function handleDragOver(event, category, type, parentIndex, childIndex) {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'

  const rect = event.currentTarget.getBoundingClientRect()
  const midY = rect.top + rect.height / 2

  if (event.clientY < midY) {
    dropTargetId.value = category.id
    dropPosition.value = 'before'
  } else {
    dropTargetId.value = category.id
    dropPosition.value = 'after'
  }
}

function handleDragLeave() {
}

function handleDrop(event, category, type, parentIndex, childIndex) {
  event.preventDefault()

  const data = JSON.parse(event.dataTransfer.getData('text/plain'))
  const { category: draggedCategory, type: draggedType, parentIndex: fromParentIndex, childIndex: fromChildIndex } = data

  if (draggedType === 'root' && type === 'root' && dropPosition.value === 'before') {
    if (parentIndex === fromParentIndex) return

    const fromIndex = categories.value.findIndex(c => c.id === draggedCategory.id)
    if (fromIndex > -1) {
      const [removed] = categories.value.splice(fromIndex, 1)
      const toIndex = categories.value.findIndex(c => c.id === category.id)
      categories.value.splice(toIndex, 0, removed)

      pendingChanges.value.push({
        type: 'reorder',
        id: draggedCategory.id,
        from: fromParentIndex,
        to: parentIndex
      })
    }
  }

  handleDragEnd()
}

function addCategory() {
  const newId = `new-${Date.now()}`
  const newCategory = {
    id: newId,
    name: '新分类',
    children: []
  }
  categories.value.push(newCategory)
  expandedIds.value.push(newId)
  selectCategory(newCategory)
  pendingChanges.value.push({ type: 'create', category: newCategory })
}

function movePosition(delta) {
  editForm.position = Math.max(1, Math.min(maxPosition.value, editForm.position + delta))
}

function moveToTop() {
  editForm.position = 1
}

function moveToBottom() {
  editForm.position = maxPosition.value
}

function resetForm() {
  if (selectedCategory.value) {
    editForm.name = selectedCategory.value.name
    editForm.parentId = null
    editForm.position = 1
  }
}

function applyChanges() {
  if (!selectedCategory.value) return

  selectedCategory.value.name = editForm.name

  pendingChanges.value.push({
    type: 'update',
    id: selectedCategory.value.id,
    changes: { ...editForm }
  })

  showToast('已应用更改', 'success')
}

function deleteCategory() {
  if (!selectedCategory.value) return

  const id = selectedCategory.value.id
  const parentIndex = categories.value.findIndex(c => c.id === id)
  if (parentIndex > -1) {
    categories.value.splice(parentIndex, 1)
  } else {
    categories.value.forEach(c => {
      const childIndex = c.children?.findIndex(ch => ch.id === id) ?? -1
      if (childIndex > -1) {
        c.children.splice(childIndex, 1)
      }
    })
  }

  pendingChanges.value.push({ type: 'delete', id })
  selectedCategory.value = null
  showToast('已删除分类', 'warning')
}

function discardChanges() {
  pendingChanges.value = []
  showToast('已放弃更改', 'warning')
}

function saveChanges() {
  console.log('Saving changes:', pendingChanges.value)
  pendingChanges.value = []
  showToast('保存成功！', 'success')
}

function isDescendant(parentId, childId) {
  const parent = categories.value.find(c => c.id === parentId)
  if (!parent?.children) return false
  return parent.children.some(c => c.id === childId)
}
</script>

<style scoped>
.menu-editor-preview {
  min-height: 100vh;
  background: var(--bg-secondary);
  padding: 2rem;
}

.preview-header {
  max-width: 1400px;
  margin: 0 auto 2rem;
  text-align: center;
}

.preview-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.5rem;
}

.preview-header p {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.editor-container {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  min-height: calc(100vh - 200px);
}

.left-panel,
.right-panel {
  background: var(--bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}

.panel-header h2 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: var(--transition);
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--border);
}

.btn-danger {
  background: var(--error);
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.icon-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.icon-btn:hover:not(:disabled) {
  background: var(--primary);
  color: white;
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.category-tree {
  padding: 1rem;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.tree-section {
  margin-bottom: 0.25rem;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
  position: relative;
  user-select: none;
}

.tree-item:hover {
  background: var(--bg-secondary);
}

.tree-item.selected {
  background: var(--primary-100);
  border: 1px solid var(--primary);
}

html.dark .tree-item.selected {
  background: var(--primary-900, rgba(99, 102, 241, 0.2));
}

.tree-item.dragging {
  opacity: 0.5;
  transform: scale(0.98);
}

.tree-item.drop-target {
  border: 2px dashed var(--primary);
}

.root-item {
  font-weight: 600;
  color: var(--text);
}

.child-item {
  color: var(--text-secondary);
  font-weight: 500;
  margin-left: 1.5rem;
}

.item-drag-handle {
  color: var(--text-tertiary);
  cursor: grab;
  opacity: 0;
  transition: opacity 0.2s;
}

.tree-item:hover .item-drag-handle {
  opacity: 1;
}

.item-drag-handle:active {
  cursor: grabbing;
}

.item-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
}

.child-icon {
  color: var(--text-tertiary);
}

.item-name {
  flex: 1;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-count {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
}

.item-expand {
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.item-expand svg {
  transition: transform 0.2s;
}

.item-expand svg.rotated {
  transform: rotate(90deg);
}

.tree-children {
  margin-top: 0.25rem;
}

.item-connector {
  position: absolute;
  left: -12px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border);
}

.drop-indicator {
  height: 3px;
  background: var(--primary);
  border-radius: 2px;
  margin: 0.25rem 0;
}

.drop-indicator.top {
  margin-bottom: 4px;
}

.drop-indicator.bottom {
  margin-top: 4px;
}

.root-drop-zone {
  margin: 1rem;
  padding: 1rem;
  border: 2px dashed var(--border);
  border-radius: var(--radius);
  text-align: center;
  color: var(--text-tertiary);
  font-size: 0.875rem;
  transition: var(--transition);
}

.root-drop-zone.active {
  border-color: var(--primary);
  background: var(--primary-50);
  color: var(--primary);
}

.empty-tree {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-tertiary);
}

.empty-tree svg {
  opacity: 0.5;
  margin-bottom: 1rem;
}

.empty-tree p {
  margin-bottom: 1rem;
}

.right-panel {
  display: flex;
  flex-direction: column;
}

.detail-form {
  padding: 1.25rem;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 0.5rem;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text);
  font-size: 0.9rem;
  transition: var(--transition);
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.form-group select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 0.375rem;
}

.position-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.position-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--primary);
  min-width: 2rem;
  text-align: center;
}

.quick-actions {
  display: flex;
  gap: 0.5rem;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  margin-top: 1.5rem;
}

.form-actions .btn {
  flex: 1;
}

.danger-zone {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
}

.danger-zone h3 {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--error);
  margin-bottom: 0.75rem;
}

.danger-zone .btn {
  width: 100%;
  justify-content: center;
}

.danger-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 0.5rem;
}

.no-selection {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--text-tertiary);
  text-align: center;
}

.no-selection svg {
  opacity: 0.3;
  margin-bottom: 1rem;
}

.pending-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg);
  border-top: 1px solid var(--border);
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transform: translateY(100%);
  transition: transform 0.3s ease;
  box-shadow: 0 -4px 12px var(--shadow);
  z-index: 100;
}

.pending-bar.visible {
  transform: translateY(0);
}

.pending-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text);
  font-weight: 500;
}

.pending-count {
  background: var(--primary);
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
}

.pending-actions {
  display: flex;
  gap: 0.75rem;
}

.toast {
  position: fixed;
  bottom: 5rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius);
  font-size: 0.875rem;
  font-weight: 500;
  z-index: 200;
  box-shadow: 0 4px 12px var(--shadow-lg);
}

.toast.success {
  background: var(--success);
  color: white;
}

.toast.warning {
  background: var(--warning);
  color: white;
}

.toast.error {
  background: var(--error);
  color: white;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 1rem);
}

@media (max-width: 1024px) {
  .editor-container {
    grid-template-columns: 1fr;
  }

  .right-panel {
    order: -1;
    max-height: 300px;
  }

  .category-tree {
    max-height: calc(100vh - 500px);
  }
}
</style>
