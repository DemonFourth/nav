import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createClickState,
  parseClickState,
  recordClick,
  getClickSummary,
  getClickTotals,
  clearClickStats,
  formatLastOpenedAt,
  pruneClickStats,
  serializeClickState,
  toDateKey,
  startOfWeekKey,
  shouldAdvanceDay,
  CLICK_STATS_MAX_ENTRIES
} from '../src/utils/clickStats.js'

const day = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime()

test('toDateKey 用本地日期', () => {
  assert.equal(toDateKey(day(2026, 11, 18)), '2026-11-18')
})

test('startOfWeekKey 取周一', () => {
  assert.equal(startOfWeekKey(day(2026, 11, 18)), '2026-11-16') // 周三
  assert.equal(startOfWeekKey(day(2026, 11, 22)), '2026-11-16') // 周日
  assert.equal(startOfWeekKey(day(2026, 11, 16)), '2026-11-16') // 周一
})

test('parseClickState 容错并生成 deviceId', () => {
  const makeDeviceId = () => 'd_test'
  assert.deepEqual(parseClickState(null, { makeDeviceId }).stats, {})
  assert.deepEqual(parseClickState('not-json', { makeDeviceId }).stats, {})
  assert.equal(parseClickState('{}', { makeDeviceId }).deviceId, 'd_test')
  assert.equal(
    parseClickState('{"v":1,"deviceId":"d_keep","stats":{}}', { makeDeviceId }).deviceId,
    'd_keep'
  )
})

test('parseClickState 丢弃非法条目', () => {
  const raw = JSON.stringify({
    v: 1,
    deviceId: 'd_a',
    stats: {
      a: { c: '12', d: {}, t: 1 },
      b: { c: 3, d: { '2026-11-18': 2 }, t: 5 },
      c: { c: -1, d: {}, t: 2 }
    }
  })
  const state = parseClickState(raw, { makeDeviceId: () => 'd_x' })
  assert.deepEqual(Object.keys(state.stats), ['b'])
  assert.deepEqual(state.stats.b, { c: 3, d: { '2026-11-18': 2 }, t: 5 })
})

test('recordClick 累加今日桶且不改入参', () => {
  const now = day(2026, 11, 18)
  const base = createClickState({ deviceId: 'd', now })
  const once = recordClick(base, 1164, now)
  const twice = recordClick(once, 1164, now)
  assert.equal(base.stats['1164'], undefined)
  assert.equal(twice.stats['1164'].c, 2)
  assert.equal(twice.stats['1164'].d['2026-11-18'], 2)
  assert.equal(twice.stats['1164'].t, now)
})

test('getClickSummary 口径：今日 / 本周 / 全部', () => {
  const entry = { c: 12, d: { '2026-11-18': 2, '2026-11-16': 3, '2026-11-15': 7 }, t: 99 }
  assert.deepEqual(getClickSummary(entry, day(2026, 11, 18)), {
    today: 2, week: 5, total: 12, lastAt: 99
  })
  assert.deepEqual(getClickSummary(entry, day(2026, 11, 23)), {
    today: 0, week: 0, total: 12, lastAt: 99
  })
  assert.deepEqual(getClickSummary(undefined, day(2026, 11, 18)), {
    today: 0, week: 0, total: 0, lastAt: 0
  })
})

test('pruneClickStats 不再按时间删除日桶（永久保留）', () => {
  const now = day(2026, 11, 18)
  const state = {
    v: 1,
    deviceId: 'd',
    stats: { 1: { c: 9, d: { '2024-01-05': 4, '2026-10-15': 5 }, t: 1 } }
  }
  const pruned = pruneClickStats(state, { now })
  assert.deepEqual(pruned.stats['1'].d, { '2024-01-05': 4, '2026-10-15': 5 })
  assert.equal(pruned.stats['1'].c, 9)
})

test('clearClickStats 清空记录但保留 deviceId', () => {
  const state = {
    v: 1,
    deviceId: 'd_keep',
    stats: { 1: { c: 3, d: { '2026-11-18': 3 }, t: 1 } }
  }
  const cleared = clearClickStats(state)
  assert.deepEqual(cleared.stats, {})
  assert.equal(cleared.deviceId, 'd_keep')
  assert.equal(cleared.v, 1)
})

test('formatLastOpenedAt 按时间跨度切换文案', () => {
  const now = day(2026, 11, 18, 12)
  assert.equal(formatLastOpenedAt(0, now), '—')
  assert.equal(formatLastOpenedAt(now - 5000, now), '刚刚')
  assert.equal(formatLastOpenedAt(now - 3 * 60 * 1000, now), '3 分钟前')
  assert.equal(formatLastOpenedAt(now - 5 * 60 * 60 * 1000, now), '5 小时前')
  assert.equal(formatLastOpenedAt(now - 3 * 24 * 60 * 60 * 1000, now), '3 天前')
  assert.equal(formatLastOpenedAt(day(2025, 1, 2), now), '2025-01-02')
})

test('pruneClickStats 超出上限淘汰最旧', () => {
  const now = day(2026, 11, 18)
  const state = {
    v: 1,
    deviceId: 'd',
    stats: {
      1: { c: 1, d: {}, t: 1 },
      2: { c: 1, d: {}, t: 2 },
      3: { c: 1, d: {}, t: 3 }
    }
  }
  const pruned = pruneClickStats(state, { now, maxEntries: 2 })
  assert.deepEqual(Object.keys(pruned.stats).sort(), ['2', '3'])
  assert.equal(CLICK_STATS_MAX_ENTRIES, 2000)
})

test('shouldAdvanceDay 只在本地日期变化时为真', () => {
  assert.equal(shouldAdvanceDay(day(2026, 11, 18, 0, 1), day(2026, 11, 18, 23, 59)), false)
  assert.equal(shouldAdvanceDay(day(2026, 11, 18, 23, 59), day(2026, 11, 19, 0, 1)), true)
})

test('serializeClickState 可被 parse 回来', () => {
  const now = day(2026, 11, 18)
  const state = recordClick(createClickState({ deviceId: 'd', now }), 7, now)
  assert.deepEqual(parseClickState(serializeClickState(state), { now }), state)
})

test('getClickTotals 汇总三口径并按总次数排序', () => {
  const now = day(2026, 11, 18)
  const state = {
    v: 1,
    deviceId: 'd',
    stats: {
      1: { c: 12, d: { '2026-11-18': 1, '2026-11-17': 2 }, t: day(2026, 11, 18) },
      2: { c: 5, d: { '2026-11-18': 3 }, t: day(2026, 11, 18) },
      3: { c: 0, d: {}, t: 0 }
    }
  }
  const totals = getClickTotals(state, now)
  assert.equal(totals.total, 17)
  assert.equal(totals.today, 4)
  assert.equal(totals.week, 6) // 11-17 与 11-18 同属本周（周一 11-16）
  assert.equal(totals.tracked, 2) // 0 次条目不参与
  assert.deepEqual(totals.top.map(x => x.id), [1, 2])
  assert.equal(totals.top[0].total, 12)
})

test('getClickTotals 支持空状态与 top 截断', () => {
  assert.deepEqual(getClickTotals(null, day(2026, 11, 18)), { today: 0, week: 0, total: 0, tracked: 0, top: [], recent: [] })
  const now = day(2026, 11, 18)
  const state = {
    v: 1,
    deviceId: 'd',
    stats: Object.fromEntries(
      [1, 2, 3, 4].map(i => [i, { c: i, d: { '2026-11-18': i }, t: day(2026, 11, 18) }])
    )
  }
  assert.equal(getClickTotals(state, now, { top: 2 }).top.length, 2)
})
