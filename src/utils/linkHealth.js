// 书签可访问性检测的纯逻辑：缓存新鲜度、批量切分、状态展示。
// 不依赖 Vue，可直接被 Node 单测（tests/link-health.test.js）。

export const LINK_HEALTH_TTL = 24 * 60 * 60 * 1000
export const LINK_HEALTH_MAX_AGE = 30 * 24 * 60 * 60 * 1000
export const LINK_HEALTH_MAX_ENTRIES = 2000
export const LINK_HEALTH_BATCH_SIZE = 40

export function isHttpUrl(raw) {
  try {
    const u = new URL(String(raw || ''))
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 缓存条目是否仍然新鲜（可在 TTL 内直接复用，不再请求）。
 * @param {{ at?: number }|null|undefined} entry
 * @param {number} [now]
 * @param {number} [ttl]
 * @returns {boolean}
 */
export function isEntryFresh(entry, now = Date.now(), ttl = LINK_HEALTH_TTL) {
  if (!entry || typeof entry.at !== 'number' || !Number.isFinite(entry.at)) return false
  return now - entry.at < ttl
}

/**
 * 从当前列表里挑出需要检测的 URL（去重、保持原顺序、跳过新鲜缓存）。
 * @param {Array<{ url?: string }>} bookmarks
 * @param {Record<string, { at?: number }>} cache
 * @param {number} [now]
 * @param {boolean} [force]
 * @returns {string[]}
 */
export function selectUrlsToCheck(bookmarks, cache, now = Date.now(), force = false) {
  const seen = new Set()
  const urls = []
  for (const bookmark of bookmarks || []) {
    const raw = bookmark && typeof bookmark.url === 'string' ? bookmark.url.trim() : ''
    if (!isHttpUrl(raw) || seen.has(raw)) continue
    seen.add(raw)
    if (!force && isEntryFresh(cache ? cache[raw] : null, now)) continue
    urls.push(raw)
  }
  return urls
}

/**
 * 按扩展单次上限切分。
 * @param {string[]} urls
 * @param {number} [size]
 * @returns {string[][]}
 */
export function chunkUrls(urls, size = LINK_HEALTH_BATCH_SIZE) {
  const list = Array.isArray(urls) ? urls : []
  const step = size > 0 ? size : LINK_HEALTH_BATCH_SIZE
  const chunks = []
  for (let i = 0; i < list.length; i += step) {
    chunks.push(list.slice(i, i + step))
  }
  return chunks
}

/**
 * 丢弃过期条目，并按检测时间保留最近的 N 条。
 * @param {Record<string, { at?: number }>} entries
 * @param {number} [now]
 * @returns {Record<string, object>}
 */
export function pruneEntries(entries, now = Date.now()) {
  const live = []
  for (const [url, entry] of Object.entries(entries || {})) {
    if (!entry || typeof entry.at !== 'number' || !Number.isFinite(entry.at)) continue
    if (now - entry.at > LINK_HEALTH_MAX_AGE) continue
    live.push([url, entry])
  }
  live.sort((a, b) => b[1].at - a[1].at)
  const result = {}
  for (const [url, entry] of live.slice(0, LINK_HEALTH_MAX_ENTRIES)) {
    result[url] = entry
  }
  return result
}

/**
 * 状态 → 展示元信息。颜色只用主题变量。
 * @param {'ok'|'dead'|'unsure'|undefined|null} state
 * @returns {{ label: string, color: string }}
 */
export function linkStateMeta(state) {
  if (state === 'ok') return { label: '可访问', color: 'var(--success)' }
  if (state === 'dead') return { label: '已失效', color: 'var(--error)' }
  if (state === 'unsure') return { label: '待确认', color: 'var(--text-tertiary)' }
  return { label: '', color: 'transparent' }
}

/**
 * 检测时间的短文案。
 * @param {number} at
 * @param {number} [now]
 * @returns {string}
 */
export function formatCheckedAt(at, now = Date.now()) {
  if (!at || !Number.isFinite(Number(at))) return ''
  const diff = Math.max(0, now - Number(at))
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
}
