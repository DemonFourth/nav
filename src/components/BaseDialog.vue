<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="dialog-overlay" @click="emit('close')">
        <div class="dialog-menu" @click.stop>
          <div class="dialog-header">
            <h3>{{ title }}</h3>
            <button class="dialog-close" @click="emit('close')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="dialog-body"><slot /></div>
          <div v-if="$slots.footer" class="dialog-footer"><slot name="footer" /></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  show: Boolean,
  title: String,
  maxWidth: { type: String, default: '440px' }
})

const emit = defineEmits(['close'])

const menuStyle = computed(() => ({
  maxWidth: props.maxWidth
}))
</script>

<style>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: var(--nav-glass);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
}
.dialog-menu {
  background: var(--nav-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--nav-border);
  border-radius: 16px;
  width: 90%;
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