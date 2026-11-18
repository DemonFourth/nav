import { computed, reactive, ref } from 'vue'
import {
  getClickSummary,
  parseClickState,
  recordClick as applyClick,
  serializeClickState
} from '../utils/clickStats'

// 书签点击统计（本地版）。
// 只写 localStorage，不发请求；deviceId 与统计同存在一个 key 里，
// 清掉统计即视为新设备（避免以后上传时旧水位压住新数据）。

export const CLICK_STATS_KEY = 'bookmarkClickStats'

// 「今日」口径需要感知跨午夜，每分钟刷新一次 now
const TICK_MS = 60 * 1000

const state = reactive(loadState())
const now = ref(Date.now())

function loadState() {
  try {
    return parseClickState(localStorage.getItem(CLICK_STATS_KEY))
  } catch {
    return parseClickState(null)
  }
}

function persist() {
  try {
    localStorage.setItem(CLICK_STATS_KEY, serializeClickState(state))
  } catch (e) {
    // 隐私模式 / 配额满：统计丢失可以接受，绝不能影响正常打开书签
    console.warn('Failed to persist click stats:', e)
  }
}

if (typeof window !== 'undefined') {
  window.setInterval(() => {
    now.value = Date.now()
  }, TICK_MS)

  window.addEventListener('storage', (event) => {
    if (event.key !== CLICK_STATS_KEY) return
    Object.assign(state, parseClickState(event.newValue))
    now.value = Date.now()
  })
}

/**
 * 记一次点击。登录与否都记录（公开模式下常常不登录）。
 * @param {number|string} bookmarkId
 */
function recordClick(bookmarkId) {
  const id = Number(bookmarkId)
  if (!Number.isFinite(id)) return
  Object.assign(state, applyClick(state, id, Date.now()))
  persist()
}

/**
 * @param {number|string} bookmarkId
 * @returns {{ today: number, week: number, total: number, lastAt: number }}
 */
function summaryOf(bookmarkId) {
  const id = Number(bookmarkId)
  if (!Number.isFinite(id)) return { today: 0, week: 0, total: 0, lastAt: 0 }
  return getClickSummary(state.stats[String(id)], now.value)
}

export function useClickStats() {
  return {
    recordClick,
    summaryOf,
    deviceId: computed(() => state.deviceId),
    state
  }
}
