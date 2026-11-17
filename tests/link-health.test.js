import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LINK_HEALTH_TTL,
  isEntryFresh,
  selectUrlsToCheck,
  chunkUrls,
  pruneEntries,
  linkStateMeta,
  formatCheckedAt
} from '../src/utils/linkHealth.js'

const DAY = 24 * 60 * 60 * 1000

test('isEntryFresh respects ttl and missing entries', () => {
  const now = 1_000_000_000_000
  assert.equal(isEntryFresh(null, now), false)
  assert.equal(isEntryFresh({ at: now - 1000 }, now), true)
  assert.equal(isEntryFresh({ at: now - LINK_HEALTH_TTL - 1 }, now), false)
})

test('selectUrlsToCheck skips fresh entries and dedupes', () => {
  const now = 1_000_000_000_000
  const bookmarks = [
    { url: 'https://a.com' },
    { url: 'https://a.com' },
    { url: 'https://b.com' },
    { url: '' },
    { url: 'ftp://c.com' }
  ]
  const cache = { 'https://a.com': { state: 'ok', at: now - 1000 } }
  assert.deepEqual(selectUrlsToCheck(bookmarks, cache, now), ['https://b.com'])
  assert.deepEqual(selectUrlsToCheck(bookmarks, cache, now, true), ['https://a.com', 'https://b.com'])
})

test('chunkUrls never exceeds batch size', () => {
  const urls = Array.from({ length: 95 }, (_, i) => `https://x${i}.com`)
  const chunks = chunkUrls(urls)
  assert.equal(chunks.length, 5)
  assert.equal(chunks[0].length, 20)
  assert.equal(chunks[4].length, 15)
})

test('pruneEntries drops expired and caps count', () => {
  const now = 1_000_000_000_000
  const entries = {
    old: { state: 'ok', at: now - 31 * DAY },
    fresh: { state: 'ok', at: now - DAY }
  }
  assert.deepEqual(Object.keys(pruneEntries(entries, now)), ['fresh'])

  const many = {}
  for (let i = 0; i < 2100; i++) many[`u${i}`] = { state: 'ok', at: now - i }
  assert.equal(Object.keys(pruneEntries(many, now)).length, 2000)
})

test('linkStateMeta returns themed colors only', () => {
  assert.deepEqual(linkStateMeta('ok'), { label: '可访问', color: 'var(--success)' })
  assert.deepEqual(linkStateMeta('dead'), { label: '已失效', color: 'var(--error)' })
  assert.deepEqual(linkStateMeta('unsure'), { label: '待确认', color: 'var(--text-tertiary)' })
  assert.deepEqual(linkStateMeta(undefined), { label: '', color: 'transparent' })
})

test('formatCheckedAt stays short', () => {
  const now = 1_000_000_000_000
  assert.equal(formatCheckedAt(0, now), '')
  assert.equal(formatCheckedAt(now - 30_000, now), '刚刚')
  assert.equal(formatCheckedAt(now - 3 * 60 * 60 * 1000, now), '3 小时前')
  assert.equal(formatCheckedAt(now - 2 * DAY, now), '2 天前')
})
