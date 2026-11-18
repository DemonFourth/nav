import test from 'node:test'
import assert from 'node:assert/strict'
import { canMoveToParent, getSubtreeHeight } from '../src/utils/categoryMove.js'

const deep = [
  { id: 1, parent_id: null, position: 1, name: 'L1', depth: 0 },
  { id: 2, parent_id: 1, position: 1, name: 'L2', depth: 1 },
  { id: 3, parent_id: 2, position: 1, name: 'L3', depth: 2 },
  { id: 4, parent_id: 3, position: 1, name: 'L4', depth: 3 },
  { id: 5, parent_id: 4, position: 1, name: 'L5', depth: 4 },
  { id: 6, parent_id: 5, position: 1, name: 'L6', depth: 5 },
  { id: 7, parent_id: null, position: 2, name: '独立', depth: 0 }
]

test('叶子高度为 0，逐层递增', () => {
  assert.equal(getSubtreeHeight(deep, 6), 0)
  assert.equal(getSubtreeHeight(deep, 5), 1)
  assert.equal(getSubtreeHeight(deep, 1), 5)
  assert.equal(getSubtreeHeight(deep, 404), -1)
})

test('不能移动到自身', () => {
  assert.deepEqual(canMoveToParent(deep, 2, 2), { ok: false, reason: '不能移动到自身' })
})

test('不能移动到自己的后代', () => {
  assert.deepEqual(canMoveToParent(deep, 1, 6), { ok: false, reason: '不能移动到自己的子分类' })
})

test('子树过高时拒绝，刚好不超过时允许', () => {
  // 把 5 层高的 L1 挂到根分类下 → 最深 1 + 5 = 6 > 5
  assert.deepEqual(canMoveToParent(deep, 1, 7), { ok: false, reason: '超过最大嵌套深度（5层）' })
  // 把 4 层高的 L2 挂到根分类下 → 最深 1 + 4 = 5，正好允许
  assert.equal(canMoveToParent(deep, 2, 7).ok, true)
  // 移动到根目录总是允许
  assert.equal(canMoveToParent(deep, 6, null).ok, true)
})
