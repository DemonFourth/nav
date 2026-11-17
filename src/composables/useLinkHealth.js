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
const REPLY_TIMEOUT = 10 * 1000
const COOLDOWN_MS = 5 * 60 * 1000
const EXT_POLL_TIMES = 15
const EXT_POLL_INTERVAL = 100

const cache = reactive(loadCache())
const hasExtension = ref(false)
const checksEnabled = ref(readEnabled())
const lastError = ref('')

// 同一 URL 的检测冷却，避免来回切菜单反复打请求
const inflightAt = new Map()
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
  const canonToRaw = new Map()
  for (const raw of requested) canonToRaw.set(canonicalKey(raw), raw)

  const at = Date.now()
  for (const item of results) {
    if (!item || !item.url) continue
    const raw = canonToRaw.get(item.url) || (requested.includes(item.url) ? item.url : '')
    if (!raw) continue
    cache[raw] = {
      state: item.state,
      reason: item.reason || '',
      status: typeof item.status === 'number' ? item.status : null,
      at
    }
  }

  replaceCache(pruneEntries({ ...cache }, at))
  persist()
}

function runBatch(urls) {
  return new Promise((resolve) => {
    const reqId = `lh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    let settled = false

    const finish = (results, error) => {
      if (settled) return
      settled = true
      window.removeEventListener('message', onReply)
      clearTimeout(timer)
      lastError.value = error || ''
      if (results.length) applyResults(urls, results)
      resolve()
    }

    const onReply = (event) => {
      if (event.source !== window) return
      const data = event.data
      if (!data || data.source !== 'bm-link-health-reply' || data.reqId !== reqId) return
      finish(Array.isArray(data.results) ? data.results : [], data.error || '')
    }

    const timer = setTimeout(() => finish([], '扩展无响应'), REPLY_TIMEOUT)
    window.addEventListener('message', onReply)
    window.postMessage({ source: 'bm-link-health', reqId, urls }, location.origin)
  })
}

async function checkBookmarks(list, { force = false } = {}) {
  if (!checksEnabled.value || !hasExtension.value) return

  const now = Date.now()
  const urls = selectUrlsToCheck(list, cache, now, force).filter((url) => {
    const at = inflightAt.get(url)
    return !at || now - at > COOLDOWN_MS
  })
  if (urls.length === 0) return

  for (const url of urls) inflightAt.set(url, now)

  for (const chunk of chunkUrls(urls)) {
    await runBatch(chunk)
  }
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
      const entry = cache[url]
      return entry ? entry.state : ''
    },
    reasonOf(url) {
      const entry = cache[url]
      return entry && entry.reason ? entry.reason : ''
    },
    checkedAtOf(url) {
      const entry = cache[url]
      return entry && entry.at ? entry.at : 0
    },
    isFresh(url) {
      return isEntryFresh(cache[url])
    },
    checkBookmarks
  }
}
