import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseTags,
  buildTagStats,
  countBookmarksWithTags,
  buildTagGroups,
  buildCategoryGroups,
  filterAndSortTags,
  normalizeTagList,
  toggleTagSelection,
  matchesAllTags,
  pruneMissingTags
} from '../src/utils/tagBrowse.js'

const categories = [
  { id: 1, name: '搜索引擎', parent_id: null, position: 0, depth: 0 },
  { id: 2, name: 'AI', parent_id: null, position: 1, depth: 0 },
  { id: 3, name: 'AI 对话', parent_id: 2, position: 0, depth: 1 },
  { id: 4, name: 'AI 编程', parent_id: 2, position: 1, depth: 1 },
  { id: 5, name: '未使用', parent_id: null, position: 2, depth: 0 }
]

const bookmarks = [
  { id: 1, name: '秘塔AI搜索', category_id: 1, tags: 'AI, 搜索', position: 0 },
  { id: 2, name: 'ChatGPT', category_id: 3, tags: 'AI, 对话', position: 1 },
  { id: 3, name: 'Claude', category_id: 3, tags: 'ai, AI', position: 0 },
  { id: 4, name: 'Cursor', category_id: 4, tags: 'AI, IDE', position: 0 },
  { id: 5, name: '无分类书签', category_id: null, tags: 'AI', position: 2 },
  { id: 6, name: '脏分类书签', category_id: 999, tags: 'AI', position: 1 },
  { id: 7, name: '无标签书签', category_id: 1, tags: '', position: 1 }
]

test('parseTags trims, drops empties and exact duplicates', () => {
  assert.deepEqual(parseTags(' AI , , 搜索 '), ['AI', '搜索'])
  assert.deepEqual(parseTags('AI,AI'), ['AI'])
  assert.deepEqual(parseTags(undefined), [])
  assert.deepEqual(parseTags('   '), [])
})

test('buildTagStats merges case-insensitively and counts each bookmark once', () => {
  const stats = buildTagStats([
    { tags: 'alpha, beta' },
    { tags: 'alpha, Beta' },
    { tags: 'gamma' }
  ])
  assert.deepEqual(stats, [
    { name: 'alpha', count: 2 },
    { name: 'beta', count: 2 },
    { name: 'gamma', count: 1 }
  ])
  assert.equal(buildTagStats([{ tags: 'AI, AI , ai' }])[0].count, 1)
})

test('countBookmarksWithTags ignores empty / whitespace tag fields', () => {
  assert.equal(countBookmarksWithTags([
    { tags: 'AI' },
    { tags: '' },
    { tags: ' , ' },
    { tags: null }
  ]), 1)
})

test('buildTagGroups orders groups by menu order and puts uncategorized last', () => {
  const groups = buildTagGroups(bookmarks, categories, 'AI')
  assert.deepEqual(
    groups.map(g => [g.leaf, g.bookmarks.map(b => b.id)]),
    [
      ['搜索引擎', [1]],
      ['AI 对话', [3, 2]],
      ['AI 编程', [4]],
      ['未分类', [6, 5]]
    ]
  )
})

test('buildTagGroups builds breadcrumb text and matches active tag case-insensitively', () => {
  const groups = buildTagGroups(bookmarks, categories, 'ai')
  const dialog = groups.find(g => g.categoryId === 3)
  assert.equal(dialog.leaf, 'AI 对话')
  assert.equal(dialog.parentText, 'AI')
  assert.deepEqual(dialog.path, ['AI', 'AI 对话'])
  assert.equal(groups[0].parentText, '')
  assert.deepEqual(buildTagGroups(bookmarks, categories, null), [])
})

test('buildTagGroups keeps missing positions last and falls back to name', () => {
  const groups = buildTagGroups([
    { id: 1, name: 'Zeta', category_id: 1, tags: 'AI', position: 2 },
    { id: 2, name: 'Alpha', category_id: 1, tags: 'AI' },
    { id: 3, name: 'Beta', category_id: 1, tags: 'AI', position: 2 }
  ], categories, 'AI')
  assert.deepEqual(groups[0].bookmarks.map(b => b.id), [3, 1, 2])
})

test('buildTagGroups renders deep paths as A / B / C', () => {
  const deepCategories = [
    { id: 1, name: 'A', parent_id: null, position: 0 },
    { id: 2, name: 'B', parent_id: 1, position: 0 },
    { id: 3, name: 'C', parent_id: 2, position: 0 }
  ]
  const groups = buildTagGroups(
    [{ id: 1, name: 'x', category_id: 3, tags: 'AI', position: 0 }],
    deepCategories,
    'AI'
  )
  assert.deepEqual(groups[0].path, ['A', 'B', 'C'])
  assert.equal(groups[0].parentText, 'A / B')
  assert.equal(groups[0].leaf, 'C')
})

test('filterAndSortTags searches case-insensitively and sorts by count or name', () => {
  const tags = [
    { name: 'alpha', count: 5 },
    { name: 'beta', count: 20 },
    { name: 'gamma', count: 5 }
  ]
  assert.deepEqual(filterAndSortTags(tags, '', 'count').map(t => t.name), ['beta', 'alpha', 'gamma'])
  assert.deepEqual(filterAndSortTags(tags, 'B', 'count').map(t => t.name), ['beta'])
  assert.deepEqual(filterAndSortTags(tags, '', 'name').map(t => t.name), ['alpha', 'beta', 'gamma'])
  assert.deepEqual(tags.map(t => t.name), ['alpha', 'beta', 'gamma'])
})

test('toggleTagSelection handles null selections', () => {
  assert.deepEqual(toggleTagSelection(null, 'AI'), ['AI'])
  assert.deepEqual(toggleTagSelection(undefined, 'AI'), ['AI'])
})

test('normalizeTagList trims, dedupes case-insensitively and keeps first spelling', () => {
  assert.deepEqual(normalizeTagList('  AI  '), ['AI'])
  assert.deepEqual(normalizeTagList([' AI ', 'ai', ' 搜索 ']), ['AI', '搜索'])
  assert.deepEqual(normalizeTagList(null), [])
  assert.deepEqual(normalizeTagList(undefined), [])
  assert.deepEqual(normalizeTagList([]), [])
})

test('toggleTagSelection adds, removes case-insensitively and keeps click order', () => {
  assert.deepEqual(toggleTagSelection([], 'AI'), ['AI'])
  assert.deepEqual(toggleTagSelection(['AI'], 'Cloudflare'), ['AI', 'Cloudflare'])
  assert.deepEqual(toggleTagSelection(['AI', 'Cloudflare'], 'ai'), ['Cloudflare'])
  assert.deepEqual(toggleTagSelection(['AI'], 'ai'), [])
  assert.deepEqual(toggleTagSelection(['AI'], '   '), ['AI'])
})

test('toggleTagSelection does not mutate the input array', () => {
  const original = ['AI']
  const next = toggleTagSelection(original, 'Cloudflare')
  assert.deepEqual(original, ['AI'])
  assert.deepEqual(next, ['AI', 'Cloudflare'])
})

test('matchesAllTags requires every tag (AND) and ignores case', () => {
  assert.equal(matchesAllTags({ tags: 'AI, 搜索' }, ['ai', '搜索']), true)
  assert.equal(matchesAllTags({ tags: 'AI, 搜索' }, ['ai', 'IDE']), false)
  assert.equal(matchesAllTags({ tags: 'AI, AI' }, ['AI']), true)
  assert.equal(matchesAllTags({ tags: '' }, []), true)
  assert.equal(matchesAllTags({ tags: null }, ['AI']), false)
  assert.equal(matchesAllTags({ tags: undefined }, ['AI']), false)
  assert.equal(matchesAllTags({ tags: 'AI' }, null), true)
  assert.equal(matchesAllTags({ tags: 'AI' }, undefined), true)
})

test('pruneMissingTags drops only the vanished tags', () => {
  const stats = buildTagStats([{ tags: 'AI' }, { tags: 'Cloudflare' }])
  assert.deepEqual(pruneMissingTags(['AI', 'Gone', 'Cloudflare'], stats), ['AI', 'Cloudflare'])
  assert.deepEqual(pruneMissingTags(['Gone'], stats), [])
})

test('buildTagGroups filters by all active tags and stays backward compatible', () => {
  const and = buildTagGroups(bookmarks, categories, ['AI', '对话'])
  assert.deepEqual(
    and.map(g => [g.leaf, g.bookmarks.map(b => b.id)]),
    [['AI 对话', [2]]]
  )
  const single = buildTagGroups(bookmarks, categories, 'AI')
  assert.deepEqual(single.map(g => g.leaf), ['搜索引擎', 'AI 对话', 'AI 编程', '未分类'])
  assert.deepEqual(buildTagGroups(bookmarks, categories, []), [])
  assert.deepEqual(buildTagGroups(bookmarks, categories, ['AI', '不存在']), [])
  // 重复选中项（大小写差异）不应改变结果
  assert.deepEqual(
    buildTagGroups(bookmarks, categories, ['AI', 'ai']).map(g => g.leaf),
    single.map(g => g.leaf)
  )
})

test('buildCategoryGroups groups by menu order, sorts by position and keeps uncategorized last', () => {
  const groups = buildCategoryGroups(bookmarks, categories)
  assert.deepEqual(
    groups.map(g => [g.leaf, g.bookmarks.map(b => b.id)]),
    [
      ['搜索引擎', [1, 7]],
      ['AI 对话', [3, 2]],
      ['AI 编程', [4]],
      ['未分类', [6, 5]]
    ]
  )
  assert.equal(groups[0].parentText, '')
  assert.deepEqual(groups[1].path, ['AI', 'AI 对话'])
  assert.equal(groups[1].parentText, 'AI')
  assert.equal(groups[3].categoryId, null)
  assert.deepEqual(buildCategoryGroups([], categories), [])
})
