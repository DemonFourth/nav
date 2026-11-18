<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="dialog-overlay" @click="emit('close')" @keydown.esc="emit('close')">
        <div class="dialog-menu" :style="menuStyle" role="dialog" aria-modal="true" :aria-label="title" @click.stop>
          <div class="dialog-header">
            <h3>{{ title }}</h3>
            <button class="dialog-close" aria-label="关闭" @click="emit('close')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="dialog-body" :class="{ 'is-fill': bodyFill }"><slot /></div>
          <div v-if="$slots.footer" class="dialog-footer"><slot name="footer" /></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
// 模块级：多个 BaseDialog 同时打开时共享同一把 body 滚动锁
let bodyLockCount = 0
let savedBodyOverflow = ''
</script>

<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  show: Boolean,
  title: String,
  maxWidth: { type: String, default: '440px' },
  // 让 body 成为纵向 flex 容器：内容里的「可伸缩区块」吃掉剩余高度，
  // 弹窗被 80vh 夹住时由该区块自己缩短，避免 body 滚动把内容底部裁掉
  bodyFill: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const menuStyle = computed(() => ({
  maxWidth: props.maxWidth
}))

/* 打开时锁住页面滚动，避免滚轮/触摸在弹窗边缘透传到背后页面 */
const lockBodyScroll = () => {
  if (bodyLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  bodyLockCount += 1
}

const unlockBodyScroll = () => {
  if (bodyLockCount === 0) return
  bodyLockCount -= 1
  if (bodyLockCount === 0) {
    document.body.style.overflow = savedBodyOverflow
  }
}

watch(() => props.show, (visible) => {
  if (visible) lockBodyScroll()
  else unlockBodyScroll()
}, { immediate: true })

onBeforeUnmount(() => {
  if (props.show) unlockBodyScroll()
})
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
  overscroll-behavior: contain;
  flex: 1;
}
/* bodyFill：body 变成纵向 flex 容器，插槽里加了 .is-grow 的区块吃剩余高度。
   否则「弹窗定高 + 内部列表定高」会叠出两层滚动，矮窗口下把列表底部裁掉。
   容器仍保留 overflow-y: auto 作为兜底：子项缩到 min-height 以下时改为整体滚动。
   只给 .is-grow 设 flex，避免和子组件自己的 flex 规则抢特异性。 */
.dialog-body.is-fill {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.dialog-body.is-fill > .is-grow {
  flex: 1 1 auto;
  min-height: 0;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--card-border);
}
/* 共享小号按钮：BaseDialog 内的 footer 插槽内容来自各弹窗组件，
   scoped 样式无法跨组件生效，因此在弹窗骨架里统一提供一份兜底定义 */
.btn-secondary-sm,
.btn-primary-sm {
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.btn-secondary-sm {
  border: 1px solid var(--nav-border);
  background: transparent;
  color: var(--nav-text);
}
.btn-secondary-sm:hover {
  background: var(--nav-card-bg);
}
.btn-primary-sm {
  border: none;
  background: var(--nav-primary);
  color: #fff;
  font-weight: 600;
}
.btn-primary-sm:hover {
  background: color-mix(in srgb, var(--nav-primary) 85%, #0b2545);
}
.btn-primary-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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