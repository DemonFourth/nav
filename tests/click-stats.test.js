import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createClickState,
  parseClickState,
  recordClick,
  getClickSummary,
  pruneClickStats,
  serializeClickState,
  toDateKey,
  startOfWeekKey,
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

test('pruneClickStats 裁掉 35 天前的桶但保留累计', () => {
  const now = day(2026, 11, 18)
  const state = {
    v: 1,
    deviceId: 'd',
    stats: { 1: { c: 9, d: { '2026-10-01': 4, '2026-10-15': 5 }, t: 1 } }
  }
  const pruned = pruneClickStats(state, { now })
  assert.deepEqual(pruned.stats['1'].d, { '2026-10-15': 5 })
  assert.equal(pruned.stats['1'].c, 9)
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

test('serializeClickState 可被 parse 回来', () => {
  const now = day(2026, 11, 18)
  const state = recordClick(createClickState({ deviceId: 'd', now }), 7, now)
  assert.deepEqual(parseClickState(serializeClickState(state), { now }), state)
})
