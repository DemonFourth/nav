import test from 'node:test'
import assert from 'node:assert/strict'
import { getUrlComparisonVariants } from '../functions/api/bookmarks/_shared.js'

const canonical = (url) => {
  const variants = getUrlComparisonVariants(url)
  // 去掉解析器自身归一化带来的干扰，只看是否覆盖目标形式
  return new Set(variants)
}

test('keeps the raw input as a variant', () => {
  assert.ok(canonical('https://example.com/a?x=1#h').has('https://example.com/a?x=1#h'))
})

test('treats a trailing slash as the same URL on any path', () => {
  const variants = canonical('https://www.expreview.com/ketang')
  assert.ok(variants.has('https://www.expreview.com/ketang/'))

  const reversed = canonical('https://www.expreview.com/ketang/')
  assert.ok(reversed.has('https://www.expreview.com/ketang'))
})

test('treats http and https as the same URL', () => {
  const variants = canonical('https://www.expreview.com/ketang')
  assert.ok(variants.has('http://www.expreview.com/ketang'))
})

test('treats www and non-www as the same URL', () => {
  const variants = canonical('https://www.expreview.com/ketang')
  assert.ok(variants.has('https://expreview.com/ketang'))

  const reversed = canonical('https://expreview.com/ketang')
  assert.ok(reversed.has('https://www.expreview.com/ketang'))
})

test('covers the combination of all three differences', () => {
  const variants = canonical('https://www.expreview.com/ketang')
  assert.ok(variants.has('http://expreview.com/ketang/'))
})

test('keeps query and hash when normalising', () => {
  const variants = canonical('https://example.com/a/?p=1#top')
  assert.ok(variants.has('https://example.com/a?p=1#top'))
})

test('does not merge different paths or queries', () => {
  const variants = canonical('https://example.com/a')
  assert.equal(variants.has('https://example.com/b'), false)
  assert.equal(variants.has('https://example.com/a?x=1'), false)
})

test('ignores empty and non-http input', () => {
  assert.deepEqual(getUrlComparisonVariants('   '), [])
  assert.deepEqual(getUrlComparisonVariants('chrome://extensions'), ['chrome://extensions'])
})
