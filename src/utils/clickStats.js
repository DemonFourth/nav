// 书签点击统计的纯逻辑：本地日期分桶、口径汇总、容量裁剪。
// 不依赖 Vue / localStorage，可直接被 Node 单测（tests/click-stats.test.js）。
//
// 存储结构（由 composable 落到 localStorage）：
// {
//   v: 1,
//   deviceId: 'd_xxx',
//   stats: { [bookmarkId]: { c: 全部累计, d: { 'YYYY-MM-DD': 当日次数 }, t: 最后打开毫秒 } }
// }

export const CLICK_STATS_VERSION = 1
export const CLICK_BUCKET_RETENTION_DAYS = 35
export const CLICK_STATS_MAX_ENTRIES = 2000

/**
 * 本地时区的日期键 YYYY-MM-DD。
 * @param {number} ms
 * @returns {string}
 */
export function toDateKey(ms) {
  const d = new Date(ms)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${date}`
}

/**
 * 所在自然周（周一）的日期键。
 * @param {number} ms
 * @returns {string}
 */
export function startOfWeekKey(ms) {
  const d = new Date(ms)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return toDateKey(d.getTime())
}

/**
 * 本地日期是否跨天（分钟级 tick 只在跨天时刷新「今日 / 本周」，
 * 避免每分钟把列表数据换成新数组、打断增量渲染与滚动位置）。
 * @param {number} prevMs
 * @param {number} nextMs
 * @returns {boolean}
 */
export function shouldAdvanceDay(prevMs, nextMs) {
  return toDateKey(prevMs) !== toDateKey(nextMs)
}

function defaultMakeDeviceId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return 'd_' + crypto.randomUUID()
    }
  } catch {
    // 非安全上下文等场景回退
  }
  return 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

function sanitizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null
  if (typeof entry.c !== 'number' || !Number.isFinite(entry.c) || entry.c < 0) return null
  const buckets = {}
  if (entry.d && typeof entry.d === 'object') {
    for (const [key, value] of Object.entries(entry.d)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        buckets[key] = value
      }
    }
  }
  const t = typeof entry.t === 'number' && Number.isFinite(entry.t) ? entry.t : 0
  return { c: entry.c, d: buckets, t }
}

/**
 * @param {{ deviceId?: string, now?: number }} [options]
 * @returns {{ v: number, deviceId: string, stats: Record<string, object> }}
 */
export function createClickState({ deviceId = '', now = Date.now() } = {}) {
  return {
    v: CLICK_STATS_VERSION,
    deviceId: deviceId ? String(deviceId) : defaultMakeDeviceId(),
    stats: {}
  }
}

/**
 * 容错解析存储内容；损坏、旧结构、字段非法时尽量保留可用部分。
 * @param {string|object|null|undefined} raw
 * @param {{ now?: number, makeDeviceId?: () => string }} [options]
 */
export function parseClickState(raw, { now = Date.now(), makeDeviceId = defaultMakeDeviceId } = {}) {
  let parsed = null
  if (typeof raw === 'string' && raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
  } else if (raw && typeof raw === 'object') {
    parsed = raw
  }

  const state = {
    v: CLICK_STATS_VERSION,
    deviceId: '',
    stats: {}
  }

  if (parsed && typeof parsed === 'object') {
    if (typeof parsed.v === 'number' && Number.isFinite(parsed.v)) state.v = parsed.v
    if (typeof parsed.deviceId === 'string' && parsed.deviceId) state.deviceId = parsed.deviceId
    if (parsed.stats && typeof parsed.stats === 'object') {
      for (const [key, entry] of Object.entries(parsed.stats)) {
        const clean = sanitizeEntry(entry)
        if (clean) state.stats[key] = clean
      }
    }
  }

  if (!state.deviceId) state.deviceId = makeDeviceId()
  return pruneClickStats(state, { now })
}

/**
 * 记一次点击；返回新 state，不修改入参。
 * @param {object} state
 * @param {number|string} id
 * @param {number} [now]
 */
export function recordClick(state, id, now = Date.now()) {
  const key = String(id)
  const current = state && state.stats ? state.stats[key] : null
  const total = current && typeof current.c === 'number' ? current.c : 0
  const buckets = current && current.d ? { ...current.d } : {}
  const dayKey = toDateKey(now)
  buckets[dayKey] = (buckets[dayKey] || 0) + 1

  return pruneClickStats({
    v: state && state.v ? state.v : CLICK_STATS_VERSION,
    deviceId: state && state.deviceId ? state.deviceId : defaultMakeDeviceId(),
    stats: {
      ...(state && state.stats ? state.stats : {}),
      [key]: { c: total + 1, d: buckets, t: now }
    }
  }, { now })
}

/**
 * @param {{ c?: number, d?: Record<string, number>, t?: number }|null|undefined} entry
 * @param {number} [now]
 * @returns {{ today: number, week: number, total: number, lastAt: number }}
 */
export function getClickSummary(entry, now = Date.now()) {
  if (!entry || typeof entry !== 'object') {
    return { today: 0, week: 0, total: 0, lastAt: 0 }
  }
  const todayKey = toDateKey(now)
  const weekStartKey = startOfWeekKey(now)
  const buckets = entry.d && typeof entry.d === 'object' ? entry.d : {}
  let week = 0
  for (const [key, value] of Object.entries(buckets)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue
    if (key >= weekStartKey && key <= todayKey) week += value
  }
  return {
    today: buckets[todayKey] || 0,
    week,
    total: typeof entry.c === 'number' && Number.isFinite(entry.c) ? entry.c : 0,
    lastAt: typeof entry.t === 'number' && Number.isFinite(entry.t) ? entry.t : 0
  }
}

/**
 * 裁掉过期日桶，并按最后打开时间淘汰超出上限的条目；累计值不裁剪。
 * @param {object} state
 * @param {{ now?: number, maxEntries?: number }} [options]
 */
export function pruneClickStats(state, { now = Date.now(), maxEntries = CLICK_STATS_MAX_ENTRIES } = {}) {
  const cutoffDate = new Date(now)
  cutoffDate.setDate(cutoffDate.getDate() - CLICK_BUCKET_RETENTION_DAYS)
  const cutoffKey = toDateKey(cutoffDate.getTime())

  const stats = {}
  const source = state && state.stats && typeof state.stats === 'object' ? state.stats : {}
  for (const [key, entry] of Object.entries(source)) {
    const clean = sanitizeEntry(entry)
    if (!clean) continue
    const buckets = {}
    for (const [bucketKey, value] of Object.entries(clean.d)) {
      if (bucketKey >= cutoffKey) buckets[bucketKey] = value
    }
    stats[key] = { c: clean.c, d: buckets, t: clean.t }
  }

  const keys = Object.keys(stats)
  if (keys.length > maxEntries) {
    keys.sort((a, b) => (stats[a].t || 0) - (stats[b].t || 0))
    for (const key of keys.slice(0, keys.length - maxEntries)) delete stats[key]
  }

  return {
    v: state && typeof state.v === 'number' ? state.v : CLICK_STATS_VERSION,
    deviceId: state && state.deviceId ? state.deviceId : '',
    stats
  }
}

/**
 * @param {object} state
 * @returns {string}
 */
export function serializeClickState(state) {
  return JSON.stringify(state)
}
