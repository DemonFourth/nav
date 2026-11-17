import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCategoryBookmarkCounts } from '../src/utils/categoryCounts.js'

const cats = [
  { id: 1, parent_id: null, position: 1, name: '甲' },
  { id: 2, parent_id: 1, position: 1, name: '甲一' },
  { id: 3, parent_id: 2, position: 1, name: '甲一一' },
  { id: 4, parent_id: null, position: 2, name: '乙' },
  { id: 5, parent_id: 999, position: 3, name: '孤儿' }
]

test('没有书签时全为 0', () => {
  const counts = buildCategoryBookmarkCounts(cats, [])
  assert.equal(counts[1], 0)
  assert.equal(counts[3], 0)
  assert.equal(counts[5], 0)
})

test('后代书签汇总到祖先', () => {
  const bookmarks = [
    { id: 'a', category_id: 3 },
    { id: 'b', category_id: 3 },
    { id: 'c', category_id: 2 },
    { id: 'd', category_id: 4 }
  ]
  const counts = buildCategoryBookmarkCounts(cats, bookmarks)
  assert.equal(counts[3], 2)
  assert.equal(counts[2], 3)
  assert.equal(counts[1], 3)
  assert.equal(counts[4], 1)
})

test('category_id 为空的记录会被忽略', () => {
  const counts = buildCategoryBookmarkCounts(cats, [{ id: 'a', category_id: null }, { id: 'b', category_id: 1 }])
  assert.equal(counts[1], 1)
  assert.equal(counts[4], 0)
})

test('parent 指向不存在分类时按根分类计数', () => {
  const counts = buildCategoryBookmarkCounts(cats, [{ id: 'a', category_id: 5 }])
  assert.equal(counts[5], 1)
})

test('不修改传入数组', () => {
  const categories = JSON.parse(JSON.stringify(cats))
  buildCategoryBookmarkCounts(categories, [{ id: 'a', category_id: 1 }])
  assert.deepEqual(categories, cats)
})
