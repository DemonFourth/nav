import { ref, reactive, computed } from 'vue'
import {
  chunkUrls,
  isEntryFresh,
  pruneEntries,
  selectUrlsToCheck
} from '../utils/linkHealth'

// 书签可访问性检测（死链检测）的网页端状态。
// 检测请求由浏览器扩展发出，这里只负责：探测扩展、按需发批量请求、缓存结果。
// 结果只写 localStorage，不经过 /api/*，不消耗 Cloudflare 请求数。

const STORAGE_KEY = 'linkHealthCache'
const ENABLED_KEY = 'linkHealthEnabled'
// 软超时只用于结束「等待」，监听不撤，迟到的回包仍会写缓存；硬超时才丢弃
const REPLY_SOFT_BASE = 8000
const REPLY_HARD_TIMEOUT = 3 * 60 * 1000
const COOLDOWN_MS = 5 * 60 * 1000
// content script 默认在 document_idle 注入，慢网络下可能晚于首屏，轮询给足 10 秒
const EXT_POLL_TIMES = 40
const EXT_POLL_INTERVAL = 250

const cache = reactive(loadCache())
const hasExtension = ref(false)
const checksEnabled = ref(readEnabled())
const lastError = ref('')

// 同一 URL 的检测冷却，避免来回切菜单反复打请求
const inflightAt = new Map()
// 已发出但还没回包的批次：reqId -> { urls, settle, hardTimer }
const pendingBatches = new Map()
let replyListenerReady = false
let running = false
let pollStarted = false

function readEnabled() {
  try {
    return localStorage.getItem(ENABLED_KEY) !== 'false'
  } catch {
    return true
  }
}

function loadCache() {
  const map = {}
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    for (const [url, entry] of Object.entries(raw || {})) {
      if (entry && typeof entry.at === 'number' && entry.state) map[url] = entry
    }
  } catch {
    // ignore corrupted storage
  }
  return map
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cache }))
  } catch {
    // storage unavailable
  }
}

function replaceCache(next) {
  for (const key of Object.keys(cache)) delete cache[key]
  Object.assign(cache, next)
}

function canonicalKey(raw) {
  try {
    return new URL(raw).href
  } catch {
    return raw
  }
}

// 缓存键统一用去空白的原始 URL，与 selectUrlsToCheck 写入的口径一致
function cacheKey(raw) {
  return String(raw || '').trim()
}

function detectExtension() {
  if (pollStarted) return
  pollStarted = true
  let tries = 0
  const tick = () => {
    if (document.documentElement.dataset.bmExt) {
      hasExtension.value = true
      return
    }
    if (++tries >= EXT_POLL_TIMES) return
    setTimeout(tick, EXT_POLL_INTERVAL)
  }
  tick()
}

function applyResults(requested, results) {
  // 后台按 new URL().href 归一化（会补尾斜杠），一个 canonical 可能对应多条原始 URL
  const canonToRaws = new Map()
  for (const raw of requested) {
    const key = canonicalKey(raw)
    if (!canonToRaws.has(key)) canonToRaws.set(key, [])
    canonToRaws.get(key).push(raw)
  }

  const at = Date.now()
  for (const item of results) {
    if (!item || !item.url) continue
    const raws = canonToRaws.get(item.url) || (requested.includes(item.url) ? [item.url] : [])
    for (const raw of raws) {
      cache[raw] = {
        state: item.state,
        reason: item.reason || '',
        status: typeof item.status === 'number' ? item.status : null,
        at
      }
    }
  }

  replaceCache(pruneEntries({ ...cache }, at))
  persist()
}

// 单例监听：批次软超时后仍保留，迟到回包照样落缓存
function ensureReplyListener() {
  if (replyListenerReady) return
  replyListenerReady = true
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    const data = event.data
    if (!data || data.source !== 'bm-link-health-reply' || typeof data.reqId !== 'string') return

    const pending = pendingBatches.get(data.reqId)
    if (!pending) return
    pendingBatches.delete(data.reqId)
    clearTimeout(pending.hardTimer)

    const results = Array.isArray(data.results) ? data.results : []
    if (data.error) lastError.value = data.error
    else if (results.length) lastError.value = ''
    if (results.length) applyResults(pending.urls, results)
    pending.settle()
  })
}

// 后台整批跑完才回包：并发 5、单条 8s，按批大小放宽等待
function replySoftTimeout(count) {
  return REPLY_SOFT_BASE + Math.ceil(count / 5) * 8500
}

function runBatch(urls) {
  ensureReplyListener()
  return new Promise((resolve) => {
    const reqId = `lh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    let settled = false

    const settle = () => {
      if (settled) return
      settled = true
      clearTimeout(softTimer)
      resolve()
    }

    const softTimer = setTimeout(() => {
      lastError.value = '扩展响应较慢，结果到达后会自动更新'
      settle()
    }, replySoftTimeout(urls.length))

    const hardTimer = setTimeout(() => {
      pendingBatches.delete(reqId)
      lastError.value = '扩展无响应'
      settle()
    }, REPLY_HARD_TIMEOUT)

    pendingBatches.set(reqId, { urls, settle, hardTimer })
    window.postMessage({ source: 'bm-link-health', reqId, urls }, location.origin)
  })
}

async function checkBookmarks(list, { force = false } = {}) {
  if (!checksEnabled.value || !hasExtension.value) return { requested: 0 }
  if (running) return { requested: 0 }

  const now = Date.now()
  const urls = selectUrlsToCheck(list, cache, now, force).filter((url) => {
    if (force) return true
    const at = inflightAt.get(url)
    return !at || now - at > COOLDOWN_MS
  })
  if (urls.length === 0) return { requested: 0 }

  running = true
  try {
    for (const url of urls) inflightAt.set(url, now)
    for (const chunk of chunkUrls(urls)) {
      await runBatch(chunk)
    }
  } finally {
    running = false
  }
  return { requested: urls.length }
}

export function useLinkHealth() {
  detectExtension()

  const stats = computed(() => {
    let ok = 0
    let dead = 0
    let unsure = 0
    let lastCheckedAt = 0
    for (const entry of Object.values(cache)) {
      if (!entry || !entry.state) continue
      if (entry.state === 'ok') ok++
      else if (entry.state === 'dead') dead++
      else if (entry.state === 'unsure') unsure++
      if (entry.at > lastCheckedAt) lastCheckedAt = entry.at
    }
    return { ok, dead, unsure, lastCheckedAt }
  })

  return {
    hasExtension,
    checksEnabled,
    lastError,
    stats,
    setEnabled(value) {
      checksEnabled.value = !!value
      try {
        localStorage.setItem(ENABLED_KEY, checksEnabled.value ? 'true' : 'false')
      } catch {
        // storage unavailable
      }
    },
    stateOf(url) {
      const entry = cache[cacheKey(url)]
      return entry ? entry.state : ''
    },
    reasonOf(url) {
      const entry = cache[cacheKey(url)]
      return entry && entry.reason ? entry.reason : ''
    },
    checkedAtOf(url) {
      const entry = cache[cacheKey(url)]
      return entry && entry.at ? entry.at : 0
    },
    isFresh(url) {
      return isEntryFresh(cache[cacheKey(url)])
    },
    checkBookmarks
  }
}
