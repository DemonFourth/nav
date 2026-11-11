import { ref, computed } from 'vue'

const PING_URL = '/api/ping'
const TIMEOUT_MS = 5 * 1000
const REUSE_MS = 10 * 1000

// idle | loading | ok | fail | hidden（hidden = 后端无 ping 或返回非预计内容，不再探测）
const status = ref('idle')
const latency = ref(null)
const lastSuccessAt = ref(0)
const lastSuccessMs = ref(null)
const lastMeasuredAt = ref(0)
const failReason = ref('')

// 状态为模块级单例：导航栏只挂一个实例，避免重复监听与重复测速
let probeSupported = true
let inflight = null
let listenerBound = false

export function formatLatency(ms) {
  if (ms == null) return ''
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

export function formatRelativeTime(ts, now = Date.now()) {
  if (!ts) return ''
  const diff = Math.max(0, now - ts)
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
}

function levelOf(ms) {
  if (ms <= 500) return 'fast'
  if (ms <= 1500) return 'mid'
  return 'slow'
}

async function runProbe() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const start = performance.now()

  status.value = 'loading'
  failReason.value = ''

  try {
    const response = await fetch(PING_URL, { signal: controller.signal, cache: 'no-store' })

    // 老后端没有该路由，或被登录墙 / SPA 兜底接走：静默降级，不再反复探测
    if ([401, 403, 404, 405].includes(response.status)) {
      probeSupported = false
      latency.value = null
      status.value = 'hidden'
      return
    }

    if (!response.ok) {
      latency.value = null
      failReason.value = `HTTP ${response.status}`
      status.value = 'fail'
      return
    }

    // 200 不代表是 ping：别的站点可能返回 HTML，不能把整页下载时间当延迟
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      probeSupported = false
      latency.value = null
      status.value = 'hidden'
      return
    }

    let payload = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    if (!payload || payload.ok !== true) {
      probeSupported = false
      latency.value = null
      status.value = 'hidden'
      return
    }

    latency.value = Math.round(performance.now() - start)
    lastSuccessMs.value = latency.value
    lastSuccessAt.value = Date.now()
    status.value = 'ok'
  } catch (error) {
    latency.value = null
    failReason.value = error?.name === 'AbortError' ? `请求超时（${TIMEOUT_MS / 1000}s）` : '网络请求失败'
    status.value = 'fail'
  } finally {
    clearTimeout(timer)
    lastMeasuredAt.value = Date.now()
    inflight = null
  }
}

// force 用于面板里的「重新测速」；其余触发都在 10s 内复用结果，避免切标签页时反复请求
function measure({ force = false } = {}) {
  if (!probeSupported) return Promise.resolve()
  if (!force && lastMeasuredAt.value && Date.now() - lastMeasuredAt.value < REUSE_MS) {
    return Promise.resolve()
  }
  if (inflight) return inflight
  inflight = runProbe()
  return inflight
}

function handleVisibility() {
  if (document.visibilityState === 'visible') measure()
}

function startProbing() {
  if (!listenerBound) {
    listenerBound = true
    document.addEventListener('visibilitychange', handleVisibility)
  }
  setTimeout(() => {
    if (document.visibilityState === 'visible') measure()
  }, 300)
}

function stopProbing() {
  if (!listenerBound) return
  document.removeEventListener('visibilitychange', handleVisibility)
  listenerBound = false
}

export function useConnectionStatus() {
  const level = computed(() => (latency.value == null ? null : levelOf(latency.value)))

  return {
    status,
    latency,
    level,
    lastSuccessAt,
    lastSuccessMs,
    failReason,
    measure,
    startProbing,
    stopProbing
  }
}
