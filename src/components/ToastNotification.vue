<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toast-container" role="status" aria-live="polite">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="toast.type"
        @click="removeToast(toast.id)"
      >
        <div class="toast-icon">
          <span v-if="toast.type === 'loading'" class="toast-spinner"></span>
          <svg v-else-if="toast.type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <svg v-else-if="toast.type === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <svg v-else-if="toast.type === 'warning'" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </div>
        <div class="toast-content">
          <div v-if="toast.title" class="toast-title">{{ toast.title }}</div>
          <div class="toast-message">{{ toast.message }}</div>
        </div>
        <button class="toast-close" @click.stop="removeToast(toast.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'

const toasts = ref([])
const timers = new Map()
let nextId = 0

const clearTimer = (id) => {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
}

const removeToast = (id) => {
  clearTimer(id)
  const index = toasts.value.findIndex(t => t.id === id)
  if (index > -1) {
    toasts.value.splice(index, 1)
  }
}

const scheduleRemoval = (id, duration) => {
  clearTimer(id)
  if (duration > 0) {
    timers.set(id, setTimeout(() => removeToast(id), duration))
  }
}

const show = (message, type = 'info', title = '', duration = 3000) => {
  const id = nextId++
  const toast = { id, message, type, title }
  
  toasts.value.push(toast)
  scheduleRemoval(id, duration)
  
  return id
}

// 就地更新同一条 toast（用于「保存中 → 同步中 → 已同步」）
const update = (id, patch = {}) => {
  const toast = toasts.value.find(t => t.id === id)
  if (!toast) return false

  const { duration, ...fields } = patch
  Object.assign(toast, fields)
  if (duration !== undefined) {
    scheduleRemoval(id, duration)
  }
  return true
}

const success = (message, title = '', duration = 3000) => {
  return show(message, 'success', title, duration)
}

const error = (message, title = '', duration = 4000) => {
  return show(message, 'error', title, duration)
}

const warning = (message, title = '', duration = 3000) => {
  return show(message, 'warning', title, duration)
}

const info = (message, title = '', duration = 3000) => {
  return show(message, 'info', title, duration)
}

// 常驻进行中提示，由调用方用 update() 推进或结束
const loading = (message, title = '') => {
  return show(message, 'loading', title, 0)
}

defineExpose({
  show,
  success,
  error,
  warning,
  info,
  loading,
  update,
  removeToast
})
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 10001;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  min-width: 300px;
  max-width: 450px;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: auto;
  cursor: pointer;
  transition: all 0.3s ease;
  border-left: 4px solid;
}

.dark .toast {
  background: var(--bg-secondary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.toast:hover {
  transform: translateX(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.toast.success {
  border-left-color: #10b981;
}

.toast.error {
  border-left-color: #ef4444;
}

.toast.warning {
  border-left-color: #f59e0b;
}

.toast.info {
  border-left-color: #3b82f6;
}

.toast.loading {
  border-left-color: #3b82f6;
}

.toast-spinner {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgba(59, 130, 246, 0.25);
  border-top-color: #3b82f6;
  animation: toast-spin 0.8s linear infinite;
}

@keyframes toast-spin {
  to { transform: rotate(360deg); }
}

.toast-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-icon svg {
  width: 100%;
  height: 100%;
  stroke-width: 2;
}

.toast.success .toast-icon {
  color: #10b981;
}

.toast.error .toast-icon {
  color: #ef4444;
}

.toast.warning .toast-icon {
  color: #f59e0b;
}

.toast.info .toast-icon {
  color: #3b82f6;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
  color: var(--text);
}

.toast-message {
  font-size: 0.875rem;
  color: var(--text-secondary);
  word-wrap: break-word;
}

.toast-close {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 0;
  width: 20px;
  height: 20px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: color 0.2s ease;
}

.toast-close:hover {
  color: var(--text);
}

.toast-close svg {
  width: 100%;
  height: 100%;
  stroke-width: 2;
}

/* Toast animations */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

.toast-move {
  transition: transform 0.3s ease;
}

/* Mobile optimization */
@media (max-width: 768px) {
  .toast-container {
    top: auto;
    bottom: 1rem;
    left: 1rem;
    right: 1rem;
  }
  
  .toast {
    min-width: auto;
    max-width: 100%;
  }
  
  .toast-enter-from {
    transform: translateY(100%);
  }
  
  .toast-leave-to {
    transform: translateY(100%) scale(0.9);
  }
}
</style>

