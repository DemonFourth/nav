import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CACHE_FRESH_MS,
  CACHE_MAX_AGE_MS,
  LEGACY_CACHE_KEYS,
  isCacheExpired,
  isCacheFresh,
  parseCacheEntry,
  resolveCacheKey
} from '../src/utils/cacheMeta.js'

test('访客与不同账号使用不同缓存键', () => {
  assert.equal(resolveCacheKey({ isAuth: false }), 'nav_bookmarks_cache_v2_public')
  assert.notEqual(
    resolveCacheKey({ isAuth: true, username: 'alice' }),
    resolveCacheKey({ isAuth: true, username: 'bob' })
  )
  assert.equal(
    resolveCacheKey({ isAuth: true, username: 'a b/c' }),
    'nav_bookmarks_cache_v2_user_a%20b%2Fc'
  )
  // 未登录时即使带用户名也不进入账号桶
  assert.equal(resolveCacheKey({ isAuth: false, username: 'alice' }), 'nav_bookmarks_cache_v2_public')
})

test('旧缓存键清单包含两个历史桶', () => {
  assert.deepEqual(LEGACY_CACHE_KEYS, ['nav_bookmarks_cache_auth', 'nav_bookmarks_cache_public'])
})

test('parseCacheEntry 解析合法缓存', () => {
  const now = 1_700_000_000_000
  const raw = JSON.stringify({ data: { categories: [{ id: 1 }], bookmarks: [] }, timestamp: now - 5000 })
  const entry = parseCacheEntry(raw, now)
  assert.deepEqual(entry.data.categories, [{ id: 1 }])
  assert.equal(entry.savedAt, now - 5000)
  assert.equal(entry.age, 5000)
})

test('parseCacheEntry 对空值/坏 JSON/缺字段返回 null', () => {
  const now = 1_700_000_000_000
  assert.equal(parseCacheEntry(null, now), null)
  assert.equal(parseCacheEntry('', now), null)
  assert.equal(parseCacheEntry('{oops', now), null)
  assert.equal(parseCacheEntry(JSON.stringify({ data: {} }), now), null)
  assert.equal(parseCacheEntry(JSON.stringify({ timestamp: now }), now), null)
  assert.equal(parseCacheEntry(JSON.stringify({ data: [], timestamp: now }), now), null)
  assert.equal(parseCacheEntry(JSON.stringify({ data: {}, timestamp: 'x' }), now), null)
})

test('未来时间戳的缓存按 0 岁处理', () => {
  const now = 1_700_000_000_000
  const entry = parseCacheEntry(JSON.stringify({ data: {}, timestamp: now + 60_000 }), now)
  assert.equal(entry.age, 0)
})

test('7 天硬上限', () => {
  assert.equal(CACHE_MAX_AGE_MS, 7 * 24 * 60 * 60 * 1000)
  assert.equal(isCacheExpired(CACHE_MAX_AGE_MS), false)
  assert.equal(isCacheExpired(CACHE_MAX_AGE_MS + 1), true)
})

test('10 分钟新鲜窗口', () => {
  assert.equal(CACHE_FRESH_MS, 10 * 60 * 1000)
  assert.equal(isCacheFresh(0), true)
  assert.equal(isCacheFresh(CACHE_FRESH_MS - 1), true)
  assert.equal(isCacheFresh(CACHE_FRESH_MS), false)
  assert.equal(isCacheFresh(6 * 24 * 60 * 60 * 1000), false)
})
