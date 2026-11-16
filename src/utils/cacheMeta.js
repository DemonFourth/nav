export const CACHE_KEY_PREFIX = 'nav_bookmarks_cache_v2'
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
export const CACHE_FRESH_MS = 10 * 60 * 1000

export const LEGACY_CACHE_KEYS = [
  'nav_bookmarks_cache_auth',
  'nav_bookmarks_cache_public'
]

export function resolveCacheKey({ isAuth = false, username = '' } = {}) {
  if (!isAuth) return `${CACHE_KEY_PREFIX}_public`
  return `${CACHE_KEY_PREFIX}_user_${encodeURIComponent(username || '')}`
}

export function parseCacheEntry(raw, now = Date.now()) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) return null
    if (typeof parsed.timestamp !== 'number' || !Number.isFinite(parsed.timestamp)) return null
    // 系统时钟回拨时不让“未来”缓存一直新鲜
    const age = Math.max(0, now - parsed.timestamp)
    return { data: parsed.data, savedAt: parsed.timestamp, age }
  } catch {
    return null
  }
}

export function isCacheExpired(age, maxAge = CACHE_MAX_AGE_MS) {
  return age > maxAge
}

export function isCacheFresh(age, freshMs = CACHE_FRESH_MS) {
  return age >= 0 && age < freshMs
}
