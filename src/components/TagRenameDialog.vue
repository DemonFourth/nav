<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="dialog-overlay" @click="close">
        <div class="dialog-menu" @click.stop>
          <div class="dialog-header">
            <h3>重命名标签</h3>
            <button class="dialog-close" @click="close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="dialog-body">
            <div class="form-group">
              <label>当前标签名</label>
              <div class="current-name">{{ originalName }}</div>
            </div>

            <div class="form-group">
              <label>新标签名</label>
              <input
                v-model="newName"
                type="text"
                placeholder="请输入新标签名"
                maxlength="50"
                @input="checkNameExists"
                @keyup.enter="handleSubmit"
                ref="inputRef"
              >
              <span class="char-count">{{ newName.length }}/50</span>
            </div>

            <div v-if="nameExists" class="warning-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <span>标签"{{ newName }}"已存在，继续将合并标签</span>
            </div>

            <div v-if="error" class="error-message">{{ error }}</div>
          </div>

          <div class="dialog-footer">
            <button class="btn-secondary-sm" @click="close">取消</button>
            <button class="btn-primary-sm" @click="handleSubmit" :disabled="!canSubmit">
              {{ nameExists ? '确认合并' : '确认重命名' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'

const props = defineProps({
  tags: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['confirm'])

const show = ref(false)
const originalName = ref('')
const newName = ref('')
const nameExists = ref(false)
const error = ref('')
const inputRef = ref(null)

const canSubmit = computed(() => {
  return newName.value.trim() &&
         newName.value.trim() !== originalName.value &&
         !error.value
})

const open = (tag) => {
  originalName.value = tag.name
  newName.value = tag.name
  nameExists.value = false
  error.value = ''
  show.value = true

  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus()
      inputRef.value.select()
    }
  })
}

const close = () => {
  show.value = false
}

const checkNameExists = () => {
  error.value = ''
  const trimmed = newName.value.trim()

  if (!trimmed) {
    nameExists.value = false
    return
  }

  if (trimmed === originalName.value) {
    nameExists.value = false
    return
  }

  nameExists.value = props.tags.some(t => t.name === trimmed)
}

const handleSubmit = () => {
  const trimmed = newName.value.trim()

  if (!trimmed) {
    error.value = '请输入标签名'
    return
  }

  if (trimmed === originalName.value) {
    error.value = '新名称与原名称相同'
    return
  }

  if (trimmed.includes(',')) {
    error.value = '标签名不能包含逗号'
    return
  }

  emit('confirm', {
    oldName: originalName.value,
    newName: trimmed
  })

  close()
}

defineExpose({
  open
})
</script>

<style>
.dialog-menu {
  background: var(--nav-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--nav-border);
  border-radius: 16px;
  width: 90%;
  max-width: 440px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 48px var(--shadow-xl);
}
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--card-border);
}
.dialog-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}
.dialog-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.dialog-close:hover {
  background: color-mix(in srgb, var(--error) 12%, transparent);
  color: var(--error);
}
.dialog-body {
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--card-border);
}
.modal-enter-active,
.modal-leave-active {
  transition: all 0.25s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .dialog-menu,
.modal-leave-to .dialog-menu {
  transform: scale(0.95) translateY(10px);
}
</style>

<style scoped>
.current-name {
  padding: 0.65rem;
  background: var(--bg-secondary);
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.form-group {
  position: relative;
}

.char-count {
  position: absolute;
  right: 8px;
  top: 34px;
  font-size: 0.75rem;
  color: var(--text-secondary);
  pointer-events: none;
}

.warning-box {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  background: color-mix(in srgb, var(--warning) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 30%, transparent);
  border-radius: var(--radius-sm);
  color: var(--warning);
  font-size: 0.85rem;
  line-height: 1.4;
}

.warning-box svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}

.btn-primary-sm,
.btn-secondary-sm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
  border: none;
}

.btn-primary-sm {
  background: var(--primary);
  color: white;
}

.btn-primary-sm:hover:not(:disabled) {
  background: var(--primary-dark);
}

.btn-primary-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary-sm {
  background: var(--bg-secondary);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary-sm:hover {
  background: var(--bg-hover);
}
</style>
