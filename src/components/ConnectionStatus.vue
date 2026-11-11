<template>
  <div v-if="status !== 'hidden'" class="connection-status">
    <button
      ref="capsuleRef"
      type="button"
      class="conn-capsule"
      :class="dotClass"
      :aria-expanded="panelOpen"
      v-tooltip="capsuleTitle"
      @click.stop="togglePanel"
    >
      <span class="conn-dot"></span>
      <span class="conn-text">{{ capsuleText }}</span>
    </button>

    <Transition name="conn-fade">
      <div v-if="panelOpen" ref="panelRef" class="conn-panel" @click.stop>
        <div class="conn-state" :class="dotClass">
          <span class="conn-dot"></span>
          <span>{{ stateText }}</span>
        </div>

        <div class="conn-sep"></div>

        <div class="conn-row">
          <span>最近测速成功</span>
          <strong>{{ lastSuccessText }}</strong>
        </div>
        <div v-if="status === 'fail'" class="conn-row">
          <span>失败原因</span>
          <strong>{{ failReason || '未知' }}</strong>
        </div>

        <div class="conn-sep"></div>

        <p class="conn-note">{{ noteText }}</p>

        <button type="button" class="conn-retry" :class="{ busy: measuring }" :disabled="measuring" @click="retry">
          {{ measuring ? '测速中…' : '重新测速' }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  useConnectionStatus,
  formatLatency,
  formatRelativeTime
} from '@/composables/useConnectionStatus'

const {
  status,
  latency,
  level,
  lastSuccessAt,
  lastSuccessMs,
  failReason,
  measure,
  startProbing,
  stopProbing
} = useConnectionStatus()

const capsuleRef = ref(null)
const panelRef = ref(null)
const panelOpen = ref(false)
const panelNow = ref(Date.now())

let panelTimer = null

const measuring = computed(() => status.value === 'loading')
const dotClass = computed(() => (status.value === 'ok' ? level.value : status.value))

const capsuleText = computed(() => {
  if (status.value === 'ok') return formatLatency(latency.value)
  if (status.value === 'fail') return '连接失败'
  return '连接中…'
})

const capsuleTitle = computed(() => {
  if (status.value === 'ok') return `连接正常 · ${formatLatency(latency.value)}，点击查看详情`
  if (status.value === 'fail') return '连接失败，点击查看详情'
  return '正在检测连接…'
})

const stateText = computed(() => {
  if (status.value === 'ok') return `连接正常 · ${formatLatency(latency.value)}`
  if (status.value === 'fail') return '连接失败'
  return '测速中…'
})

const lastSuccessText = computed(() => {
  if (!lastSuccessAt.value) return '暂无'
  return `${formatRelativeTime(lastSuccessAt.value, panelNow.value)}（${formatLatency(lastSuccessMs.value)}）`
})

const noteText = computed(() => {
  if (status.value === 'fail') return '如果书签列表仍能打开，说明只是测速请求失败，稍后重试即可。'
  if (status.value === 'ok') return '延迟取自 /api/ping 纯连接耗时，不含书签、分类等数据的加载时间。'
  return '正在测量与服务器的连接耗时。'
})

const togglePanel = () => {
  panelOpen.value = !panelOpen.value
  if (panelOpen.value) panelNow.value = Date.now()
}

const retry = () => {
  measure({ force: true })
}

const handlePointerDown = (event) => {
  if (!panelOpen.value) return
  if (panelRef.value?.contains(event.target)) return
  if (capsuleRef.value?.contains(event.target)) return
  panelOpen.value = false
}

const handleKeydown = (event) => {
  if (event.key === 'Escape') panelOpen.value = false
}

watch(status, () => {
  panelNow.value = Date.now()
})

// 面板打开期间只更新本地相对时间文案，不触发任何网络请求
watch(panelOpen, (open) => {
  clearInterval(panelTimer)
  panelTimer = null
  if (!open) return
  panelNow.value = Date.now()
  panelTimer = setInterval(() => {
    panelNow.value = Date.now()
  }, 30000)
})

onMounted(() => {
  startProbing()
  document.addEventListener('pointerdown', handlePointerDown, true)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  stopProbing()
  clearInterval(panelTimer)
  document.removeEventListener('pointerdown', handlePointerDown, true)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.connection-status {
  position: relative;
  display: flex;
  align-items: center;
}

.conn-capsule {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  background: var(--nav-card-bg);
  border: 1px solid var(--nav-border);
  border-radius: 999px;
  color: var(--nav-text-secondary);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.conn-capsule:hover {
  background: var(--nav-card-hover);
  color: var(--nav-text);
}

.conn-capsule:active {
  transform: scale(0.96);
}

.conn-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #cbd5e1;
}

.fast .conn-dot {
  background: var(--success);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.mid .conn-dot {
  background: var(--warning);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
}

.slow .conn-dot,
.fail .conn-dot {
  background: var(--error);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}

.loading .conn-dot,
.idle .conn-dot {
  background: #cbd5e1;
  animation: conn-pulse 1.1s ease-in-out infinite;
}

.loading,
.idle {
  color: var(--text-tertiary);
}

@keyframes conn-pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}

.conn-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 268px;
  padding: 12px 14px;
  background: var(--nav-glass);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border: 1px solid var(--nav-border);
  border-radius: 14px;
  box-shadow: 0 18px 40px -12px var(--shadow-xl);
  z-index: 300;
}

.conn-state {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  color: var(--nav-text);
}

.conn-sep {
  height: 1px;
  background: var(--nav-border);
  margin: 10px 0;
}

.conn-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: var(--nav-text-secondary);
}

.conn-row + .conn-row {
  margin-top: 8px;
}

.conn-row strong {
  color: var(--nav-text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.conn-note {
  margin: 0 0 10px;
  font-size: 11px;
  line-height: 1.55;
  color: var(--nav-text-secondary);
}

.conn-retry {
  width: 100%;
  height: 30px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--nav-primary) 28%, transparent);
  color: var(--nav-primary);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.conn-retry:hover:not(:disabled) {
  background: color-mix(in srgb, var(--nav-primary) 20%, transparent);
}

.conn-retry.busy,
.conn-retry:disabled {
  color: var(--text-tertiary);
  border-color: var(--nav-border);
  background: rgba(148, 163, 184, 0.1);
  cursor: default;
}

.conn-fade-enter-active,
.conn-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.conn-fade-enter-from,
.conn-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 768px) {
  .connection-status {
    display: none;
  }
}
</style>
