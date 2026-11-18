import test from 'node:test'
import assert from 'node:assert/strict'
import { buildParentOptions } from '../src/utils/categoryParents.js'

const tree = [
  { id: 1, parent_id: null, position: 1, name: 'L1', depth: 0 },
  { id: 2, parent_id: 1, position: 1, name: 'L2', depth: 1 },
  { id: 3, parent_id: 2, position: 1, name: 'L3', depth: 2 },
  { id: 4, parent_id: 3, position: 1, name: 'L4', depth: 3 },
  { id: 5, parent_id: 4, position: 1, name: 'L5', depth: 4 },
  { id: 6, parent_id: 5, position: 1, name: 'L6', depth: 5 },
  { id: 7, parent_id: null, position: 2, name: '独立', depth: 0 }
]

const indexById = options => Object.fromEntries(options.map(option => [option.id, option]))

test('新建模式：depth=5 的父级不可选，并给出原因', () => {
  const options = buildParentOptions(tree)
  const byId = indexById(options)
  assert.equal(byId[5].disabled, false)
  assert.equal(byId[6].disabled, true)
  assert.equal(byId[6].reason, '已达最大层级（5 层）')
  assert.equal(options.some(option => option.isCurrentParent), false)
})

test('新建模式：返回全部分类，按树序并带完整路径', () => {
  const options = buildParentOptions(tree)
  assert.equal(options.length, tree.length)
  assert.deepEqual(options.map(option => option.id), [1, 2, 3, 4, 5, 6, 7])
  assert.equal(indexById(options)[3].displayName, 'L1 / L2 / L3')
  assert.equal(indexById(options)[3].depth, 2)
})

test('移动模式：自身与后代置灰，当前父级被标记', () => {
  const options = buildParentOptions(tree, { excludeId: 2, currentParentId: 1 })
  const byId = indexById(options)
  assert.equal(byId[2].disabled, true)
  assert.equal(byId[2].reason, '不能移动到自身')
  assert.equal(byId[3].disabled, true)
  assert.equal(byId[3].reason, '不能移动到自己的子分类')
  assert.equal(byId[1].isCurrentParent, true)
  assert.equal(byId[7].disabled, false)
})

test('移动模式：子树过高时目标置灰', () => {
  const options = buildParentOptions(tree, { excludeId: 1, currentParentId: null })
  const byId = indexById(options)
  assert.equal(byId[7].disabled, true)
  assert.equal(byId[7].reason, '超过最大嵌套深度（5层）')
})

test('空分类列表不会抛错', () => {
  assert.deepEqual(buildParentOptions([]), [])
  assert.deepEqual(buildParentOptions(undefined), [])
})
