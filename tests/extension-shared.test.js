import test from 'node:test'
import assert from 'node:assert/strict'
import '../browser-extension/shared.js'

const B = globalThis.BMExt
const MIN = 60 * 1000
const DAY = 24 * 60 * MIN

test('parseTokenExpiry honours short/long type', () => {
  assert.equal(B.parseTokenExpiry('1700000000000.short.abc'), 1700000000000 + 30 * MIN)
  assert.equal(B.parseTokenExpiry('1700000000000.long.abc'), 1700000000000 + 30 * DAY)
  assert.equal(B.parseTokenExpiry('1700000000000.abcdef'), 1700000000000 + 30 * MIN)
  assert.equal(B.parseTokenExpiry('not-a-token'), null)
})

test('shouldRenewToken only inside the threshold window', () => {
  const now = 1000000
  assert.equal(B.shouldRenewToken(now + 2 * MIN, now), true)
  assert.equal(B.shouldRenewToken(now + 10 * MIN, now), false)
  assert.equal(B.shouldRenewToken(now - MIN, now), false)
})

test('cacheState separates fresh / stale / old / none', () => {
  const now = Date.now()
  assert.equal(B.cacheState(now - 30 * 1000, now), 'fresh')
  assert.equal(B.cacheState(now - 5 * MIN, now), 'stale')
  assert.equal(B.cacheState(now - 8 * DAY, now), 'old')
  assert.equal(B.cacheState(0, now), 'none')
  assert.equal(B.cacheState(undefined, now), 'none')
})

test('latency level and formatting', () => {
  assert.equal(B.latencyLevel(120), 'fast')
  assert.equal(B.latencyLevel(900), 'medium')
  assert.equal(B.latencyLevel(2000), 'slow')
  assert.equal(B.latencyLevel(null), 'error')
  assert.equal(B.formatLatency(320), '320ms')
  assert.equal(B.formatLatency(2100), '2.1s')
  assert.equal(B.formatLatency(undefined), '超时')
})

test('duplicate hint falls back to 未分类', () => {
  assert.match(B.buildDuplicateHint({ category_name: '开发/前端' }), /已在「开发\/前端」保存过/)
  assert.match(B.buildDuplicateHint({}), /未分类/)
  assert.match(B.buildDuplicateHint(null), /未分类/)
})

test('getTokenType only treats explicit long as long', () => {
  assert.equal(B.getTokenType('1.long.abc'), 'long')
  assert.equal(B.getTokenType('1.short.abc'), 'short')
  assert.equal(B.getTokenType('1.abc'), 'short')
  assert.equal(B.getTokenType(''), 'short')
})

test('boundary values stay on the documented side', () => {
  const now = Date.now()
  assert.equal(B.cacheState(now - 59999, now), 'fresh')
  assert.equal(B.cacheState(now - 60000, now), 'stale')
  assert.equal(B.cacheState(now - 7 * DAY + 1, now), 'stale')
  assert.equal(B.cacheState(now - 7 * DAY, now), 'old')

  assert.equal(B.latencyLevel(500), 'fast')
  assert.equal(B.latencyLevel(501), 'medium')
  assert.equal(B.latencyLevel(1500), 'medium')
  assert.equal(B.latencyLevel(1501), 'slow')

  assert.equal(B.formatLatency(999), '999ms')
  assert.equal(B.formatLatency(1000), '1.0s')

  assert.equal(B.shouldRenewToken(now + B.RENEW_THRESHOLD, now), false)
  assert.equal(B.shouldRenewToken(now + B.RENEW_THRESHOLD - 1, now), true)
})
