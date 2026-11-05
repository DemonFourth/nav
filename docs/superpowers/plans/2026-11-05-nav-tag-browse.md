# nav 模式标签浏览 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 nav 模式里补上「看全部标签 → 点标签查书签 → 结果按分类路径分组」的完整浏览路径，且不改动导航栏、卡片内部结构和后端。

**Architecture:** 全部在前端完成。标签统计与分组抽成纯函数放 `src/utils/tagBrowse.js`（Node 内置 test runner 单测）；新增 `TagOverviewDialog.vue`（复用 `BaseDialog`）承载全部标签；`NavCardGrid.vue` 增加可选的 `groups` 渲染分支；`NavItemView.vue` 负责状态互斥、标签行、上下文栏与把所有部件接起来。标签数据来自内存中的 `bookmarks`，不调 `/api/tags`。

**Tech Stack:** Vue 3 `<script setup>` + Vite 6；Node `node --test`（项目已有，见 `package.json` 的 `test:ext`）；Cloudflare Pages Functions 已就绪但本次不改；无新增依赖。

**Spec:** `docs/superpowers/specs/2026-11-05-nav-tag-browse-design.md`

## Global Constraints

- 不改 `functions/**`、数据库、`src/components/NavCard.vue`，不新增 npm 依赖。
- 不主动 `git push`；每个任务完成即本地 commit。
- 所有新 UI 必须在**未登录**状态下可用（数据只来自公开的 `bookmarks`）。
- 颜色一律使用现有 nav 主题变量（`--nav-primary`、`--nav-border`、`--nav-text`、`--nav-text-secondary` 等），不硬编码色值。
- 中文文案与文档一致：`全部标签`、`清除筛选`、`未分类`、`没有带“X”标签的书签`、`没有匹配的标签`。
- 标签匹配与聚合**忽略大小写**；展示用首次出现的写法。
- 标签结果视图**禁用拖拽**；分类浏览的拖拽必须保持原样。
- 现有 `npm run build` 必须通过。

## Review Focus

1. **未登录访客**打开标签行 / 全部标签弹窗 / 标签结果：不出现 401、不空白；数据只读公开书签。
2. **分类缺失或已删除**（`category_id` 指向不存在的分类、`category_id` 为 null）：归入「未分类」且不抛错，组头不可点。
3. **标签 / 搜索 / 分类三者互斥**：任意顺序操作后只能有一套结果，顶部菜单高亮不残留、清除后能恢复原分类。
4. **标签名大小写、同一书签重复标签、空字符串、多余空格**：计数不重复、不丢标签、匹配命中。
5. **深层 / 超长分类路径**（5 层、长名称）：组头单行不撑破布局，移动端仍可读。

---

### Task 1: 标签统计、分组与筛选纯函数

**Files:**
- Create: `src/utils/tagBrowse.js`
- Create: `tests/tag-browse.test.js`
- Modify: `package.json`（新增 `test:tags` script）

**Interfaces:**
- Consumes: `buildCategoryTree(categories)`、`getCategoryPath(id, map)`（`src/utils/categoryTree.js`，均为纯函数）
- Produces:
  - `parseTags(raw: string | null | undefined): string[]` — 去空白、去空项、去完全重复，保留原始大小写
  - `buildTagStats(bookmarks: Array<{ tags?: string }>): Array<{ name: string, count: number }>` — 按小写合并，`name` 取首次出现的写法；`count` 降序、同数按 `localeCompare(zh)` 升序
  - `countBookmarksWithTags(bookmarks): number` — 至少有一个标签的书签数
  - `buildTagGroups(bookmarks, categories, activeTag: string | null): TagGroup[]`；`TagGroup = { key: number | 'none', categoryId: number | null, path: string[], leaf: string, parentText: string, bookmarks: Bookmark[] }`；`activeTag` 为空返回 `[]`
  - `filterAndSortTags(tags, query: string, sortBy: 'count' | 'name'): Array<{ name, count }>` — 不改动入参数组

- [ ] **Step 1: 写失败的测试**

Create `tests/tag-browse.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseTags,
  buildTagStats,
  countBookmarksWithTags,
  buildTagGroups,
  filterAndSortTags
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
  assert.deepEqual(groups[0].bookmarks.map(b => b.id), [2, 3, 1])
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
```

- [ ] **Step 2: 运行测试，确认因为模块不存在而失败**

Run: `node --test tests/tag-browse.test.js`
Expected: FAIL，报 `ERR_MODULE_NOT_FOUND`（找不到 `src/utils/tagBrowse.js`）

- [ ] **Step 3: 实现 `src/utils/tagBrowse.js`**

```js
import { buildCategoryTree, getCategoryPath } from './categoryTree.js'

export function parseTags(raw) {
  if (!raw) return []
  return [...new Set(String(raw).split(',').map(t => t.trim()).filter(Boolean))]
}

export function buildTagStats(bookmarks = []) {
  const map = new Map()
  for (const bookmark of bookmarks) {
    for (const tag of parseTags(bookmark.tags)) {
      const key = tag.toLowerCase()
      const hit = map.get(key)
      if (hit) hit.count++
      else map.set(key, { name: tag, count: 1 })
    }
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh')
  )
}

export function countBookmarksWithTags(bookmarks = []) {
  return bookmarks.filter(bookmark => parseTags(bookmark.tags).length > 0).length
}

export function buildTagGroups(bookmarks = [], categories = [], activeTag = null) {
  if (!activeTag) return []
  const norm = String(activeTag).toLowerCase()
  const matched = bookmarks.filter(bookmark =>
    parseTags(bookmark.tags).some(tag => tag.toLowerCase() === norm)
  )

  const { map, flatList } = buildCategoryTree(categories)
  const order = new Map(flatList.map((category, index) => [category.id, index]))
  const buckets = new Map()

  for (const bookmark of matched) {
    const key = bookmark.category_id != null && map[bookmark.category_id]
      ? bookmark.category_id
      : 'none'
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(bookmark)
  }

  return [...buckets.entries()]
    .map(([key, items]) => {
      const isUncategorized = key === 'none'
      const category = isUncategorized ? null : map[key]
      const path = category
        ? getCategoryPath(category.id, map).map(node => node.name)
        : []
      return {
        key,
        categoryId: isUncategorized ? null : category.id,
        path,
        leaf: isUncategorized ? '未分类' : category.name,
        parentText: path.slice(0, -1).join(' / '),
        bookmarks: [...items].sort(
          (a, b) =>
            (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
            String(a.name).localeCompare(String(b.name), 'zh')
        )
      }
    })
    .sort((a, b) => {
      if (a.categoryId === null) return 1
      if (b.categoryId === null) return -1
      return (order.get(a.categoryId) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.categoryId) ?? Number.MAX_SAFE_INTEGER)
    })
}

export function filterAndSortTags(tags = [], query = '', sortBy = 'count') {
  const keyword = String(query).trim().toLowerCase()
  const list = keyword
    ? tags.filter(tag => tag.name.toLowerCase().includes(keyword))
    : [...tags]
  return list.sort((a, b) =>
    sortBy === 'name'
      ? a.name.localeCompare(b.name, 'zh')
      : b.count - a.count || a.name.localeCompare(b.name, 'zh')
  )
}
```

- [ ] **Step 4: 运行测试，确认全部通过**

Run: `node --test tests/tag-browse.test.js`
Expected: 7 个 test 全部 PASS，0 fail

- [ ] **Step 5: 加 npm script 并验证**

在 `package.json` 的 `scripts` 中 `test:ext` 之后新增：

```json
"test:tags": "node --test tests/tag-browse.test.js",
```

Run: `npm run test:tags`
Expected: 同上全部 PASS

- [ ] **Step 6: 提交**

```bash
git add src/utils/tagBrowse.js tests/tag-browse.test.js package.json
git commit -m "feat(nav): add tag stats and grouping helpers"
```

---

### Task 2: 全部标签弹窗组件

**Files:**
- Create: `src/components/TagOverviewDialog.vue`
- Test: 无组件测试设施；本任务验证为 `npm run build`，交互验证在 Task 4 完成后进行

**Interfaces:**
- Consumes: `BaseDialog`（props `show`、`title`、`maxWidth`；emit `close`）；`filterAndSortTags(tags, query, sortBy)`
- Produces: `<TagOverviewDialog :show :tags :active-tag :bookmark-count @close @select="(name) => …" />`

- [ ] **Step 1: 创建组件**

`src/components/TagOverviewDialog.vue` 的模板结构：

```vue
<template>
  <BaseDialog :show="show" title="全部标签" max-width="640px" @close="emit('close')">
    <div class="tag-overview">
      <div class="tag-overview-toolbar">
        <div class="tag-overview-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input v-model="query" type="text" placeholder="搜索标签…" />
        </div>
        <div class="tag-overview-sort">
          <button :class="{ active: sortBy === 'count' }" @click="sortBy = 'count'">数量 ↓</button>
          <button :class="{ active: sortBy === 'name' }" @click="sortBy = 'name'">名称</button>
        </div>
      </div>

      <div v-if="list.length" class="tag-overview-list">
        <button
          v-for="tag in list"
          :key="tag.name"
          class="tag-overview-item"
          :class="{ active: isActive(tag.name) }"
          @click="emit('select', tag.name)"
        >
          <span class="tag-overview-name">{{ tag.name }}</span>
          <span class="tag-overview-count">{{ tag.count }}</span>
        </button>
      </div>
      <p v-else class="tag-overview-empty">没有匹配的标签</p>
    </div>

    <template #footer>
      <div class="tag-overview-footer">
        <span>共 {{ tags.length }} 个标签 · 覆盖 {{ bookmarkCount }} 个书签</span>
        <span class="tag-overview-hint">点标签直接筛选 →</span>
      </div>
    </template>
  </BaseDialog>
</template>
```

脚本：

```js
import { ref, computed, watch } from 'vue'
import BaseDialog from './BaseDialog.vue'
import { filterAndSortTags } from '../utils/tagBrowse.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  tags: { type: Array, default: () => [] },
  activeTag: { type: String, default: null },
  bookmarkCount: { type: Number, default: 0 }
})
const emit = defineEmits(['close', 'select'])

const query = ref('')
const sortBy = ref('count')

const list = computed(() => filterAndSortTags(props.tags, query.value, sortBy.value))
const isActive = (name) =>
  !!props.activeTag && name.toLowerCase() === props.activeTag.toLowerCase()

watch(() => props.show, (visible) => {
  if (visible) query.value = ''
})
```

样式要点（scoped，颜色只用变量）：
- `.tag-overview-toolbar`：`display:flex; gap:8px; align-items:center; margin-bottom:12px`
- `.tag-overview-search`：flex 1、`border:1px solid var(--nav-border)`、`border-radius:6px`、内高 30px、`input { border:0; background:transparent; color:var(--nav-text); flex:1; outline:none; font-size:0.8rem }`
- `.tag-overview-sort button`：`font-size:0.72rem`、透明底、次级文字；`.active` 用主色浅底 + 主色文字
- `.tag-overview-list`：`display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:2px 8px; max-height:50vh; overflow-y:auto`
- `.tag-overview-item`：flex 两端对齐、`padding:5px 7px`、透明底、圆角 5px、`color:var(--nav-text-secondary)`；`:hover` 背景 `var(--nav-card-hover)`；`.active` 背景 `color-mix(in srgb, var(--nav-primary) 12%, transparent)`、文字 `var(--nav-primary)`、`font-weight:600`
- `.tag-overview-count`：`font-size:0.65rem`、次级文字
- `.tag-overview-footer`：`display:flex; justify-content:space-between; width:100%; font-size:0.72rem; color:var(--nav-text-secondary)`
- 移动端 `@media (max-width: 640px)`：列表 `grid-template-columns:repeat(2,minmax(0,1fr))`
- `.tag-overview-empty`：居中、次级文字、`padding:2rem 0`

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 构建成功，无与 `TagOverviewDialog.vue` 相关的编译错误

- [ ] **Step 3: 提交**

```bash
git add src/components/TagOverviewDialog.vue
git commit -m "feat(nav): add all-tags overview dialog"
```

---

### Task 3: NavCardGrid 支持按分类分组渲染

**Files:**
- Modify: `src/components/NavCardGrid.vue`

**Interfaces:**
- Consumes: `TagGroup` 结构（见 Task 1）
- Produces:
  - 新 prop `groups: TagGroup[] | null`（默认 `null`；`null` 表示现有平铺模式）
  - 新 prop `emptyText: string`（默认 `'该分类下暂无书签'`）
  - 新 emit `group-click`，payload 为对应 `TagGroup`
  - 平铺模式下模板、DOM、拖拽行为保持不变

- [ ] **Step 1: 增加 props / emits / 计算属性**

在现有 props 里追加：

```js
groups: { type: Array, default: null },
emptyText: { type: String, default: '该分类下暂无书签' }
```

`defineEmits` 追加 `'group-click'`。新增：

```js
const isGrouped = computed(() => props.groups !== null)
const displayGroups = computed(() =>
  isGrouped.value
    ? props.groups
    : [{ key: '__flat__', categoryId: undefined, bookmarks: props.bookmarks }]
)
const totalCount = computed(() =>
  displayGroups.value.reduce((sum, group) => sum + group.bookmarks.length, 0)
)
```

- [ ] **Step 2: 改模板为「组 → 组头 + 卡片网格」**

把现有 `v-if="bookmarks.length > 0"` 的单个 `.cards-container` 改成：

```vue
<template v-if="totalCount > 0">
  <template v-for="group in displayGroups" :key="group.key">
    <header
      v-if="group.categoryId !== undefined"
      class="card-group-header"
      :class="{ 'is-clickable': group.categoryId !== null }"
      @click="group.categoryId !== null && emit('group-click', group)"
    >
      <span class="card-group-path">
        <span v-if="group.parentText" class="card-group-parent">{{ group.parentText }} / </span>
        <span class="card-group-leaf">{{ group.leaf }}</span>
      </span>
      <span class="card-group-count">{{ group.bookmarks.length }}</span>
    </header>

    <div
      class="cards-container"
      :class="[animationClass, { 'grid-append': gridAppendActive }]"
      @dragover.prevent="handleGridDragOver"
      @drop="handleGridDrop"
    >
      <NavCard
        v-for="(bookmark, index) in group.bookmarks"
        :key="bookmark.id"
        :bookmark="bookmark"
        :isAuthenticated="isAuthenticated"
        :reorderable="reorderable"
        :style="getCardStyle(index)"
        @tag-click="handleTagClick"
        @show-detail="handleShowDetail"
        @dragstart="handleDragStart"
        @dragend="handleDragEnd"
        @drop="handleCardDrop"
      />
      <div v-if="gridAppendActive" class="nav-grid-append-cue">移动到末尾</div>
    </div>
  </template>
</template>

<div v-else class="empty-state">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
  <p>{{ emptyText }}</p>
</div>
```

`getCardStyle(index)` 保持现有实现（组内索引即可）。

- [ ] **Step 3: 新增组头样式（scoped）**

```css
.card-group-header {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  margin: 16px 0 9px;
  padding: 0;
  background: none;
  border: 0;
  font-family: inherit;
  text-align: left;
}
.card-group-header:first-child { margin-top: 12px; }
.card-group-header .card-group-path { font-size: 0.78rem; color: var(--nav-text); }
.card-group-header .card-group-parent { color: var(--nav-text-secondary); }
.card-group-header .card-group-leaf { font-weight: 600; }
.card-group-header .card-group-count {
  font-size: 0.55rem;
  font-weight: 600;
  color: var(--nav-text-secondary);
  background: var(--nav-border);
  border-radius: 999px;
  padding: 1px 6px;
}
.card-group-header.is-clickable { cursor: pointer; }
.card-group-header.is-clickable:hover .card-group-leaf { color: var(--nav-primary); }
```

- [ ] **Step 4: 构建验证 + 平铺模式回归检查**

Run: `npm run build`
Expected: 构建成功

手动（`npm run dev` 后打开 nav 页面）：
- 分类浏览的卡片布局、动画、拖拽把手、拖拽排序与改动前一致；
- 空分类仍显示原空状态文案。

- [ ] **Step 5: 提交**

```bash
git add src/components/NavCardGrid.vue
git commit -m "feat(nav): render bookmark cards grouped by category"
```

---

### Task 4: NavItemView 接入标签行、全部标签与结果视图

**Files:**
- Modify: `src/views/NavItemView.vue`

**Interfaces:**
- Consumes: `buildTagStats`、`countBookmarksWithTags`、`buildTagGroups`（Task 1）；`TagOverviewDialog`（Task 2）；`NavCardGrid` 的 `groups` / `emptyText` / `group-click`（Task 3）
- Produces: 完整用户流程（标签行 → 弹窗 → 结果视图 → 清除 / 跳分类）

- [ ] **Step 1: 引入依赖并替换状态**

```js
import TagOverviewDialog from '../components/TagOverviewDialog.vue'
import { buildTagStats, countBookmarksWithTags, buildTagGroups } from '../utils/tagBrowse.js'
```

- 删除 `const selectedFilterTag = ref(null)`
- 新增：

```js
const activeTag = ref(null)
const showTagOverview = ref(false)
```

- [ ] **Step 2: 替换标签统计与标签行数据源**

删除现有 `topTags` 与 `getTagCount` 实现，替换为：

```js
const tagStats = computed(() => buildTagStats(bookmarks.value))
const topTags = computed(() => tagStats.value.slice(0, 10))
const tagCountMap = computed(() => new Map(
  tagStats.value.map(tag => [tag.name.toLowerCase(), tag.count])
))
const getTagCount = (name) => tagCountMap.value.get(String(name).toLowerCase()) ?? 0
const bookmarkCountWithTags = computed(() => countBookmarksWithTags(bookmarks.value))
const isActiveTag = (name) =>
  !!activeTag.value && String(name).toLowerCase() === activeTag.value.toLowerCase()
```

- [ ] **Step 3: 分组结果与当前书签**

```js
const tagGroups = computed(() =>
  activeTag.value
    ? buildTagGroups(bookmarks.value, categories.value, activeTag.value)
    : null
)
```

`currentBookmarks` 改为（标签结果优先）：

```js
const currentBookmarks = computed(() => {
  if (tagGroups.value) {
    return tagGroups.value.flatMap(group => group.bookmarks)
  }
  if (searchResults.value) {
    return searchResults.value
  }
  if (!activeMenu.value) {
    return []
  }
  const categoryId = activeSubMenu.value?.id || activeMenu.value.id
  return bookmarks.value
    .filter(b => b.category_id === categoryId)
    .sort((a, b) => a.position - b.position)
})
```

删除其中 `selectedFilterTag` 过滤分支。`canReorder` 改为：

```js
const canReorder = computed(() =>
  isAuthenticated.value && !searchResults.value && !activeTag.value && !!activeMenu.value
)
```

- [ ] **Step 4: 关闭结果视图期间的菜单高亮（保留 state 用于恢复）**

```js
const activePath = computed(() => {
  if (activeTag.value) return []
  // …保留现有搜索逻辑
})
```

模板中 `NavBar` 改为：

```vue
:active-menu="activeTag ? null : activeMenu"
:active-sub-menu="activeTag ? null : activeSubMenu"
```

`activeMenu` / `activeSubMenu` 本身不清空，清除标签后高亮自动恢复。

- [ ] **Step 5: 标签行与上下文栏模板**

把现有 `.category-tabs` 块替换为：

```vue
<div v-if="tagStats.length" class="category-tabs">
  <button
    v-for="tag in topTags"
    :key="tag.name"
    class="cat-tab"
    :class="{ active: isActiveTag(tag.name) }"
    @click="handleTagClick(tag.name)"
  >
    {{ tag.name }}
    <span class="cat-count">{{ tag.count }}</span>
  </button>
  <button class="cat-tab tag-all" @click="showTagOverview = true">
    全部标签
    <span class="cat-count">{{ tagStats.length }}</span>
    ›
  </button>
</div>

<div v-if="activeTag" class="tag-filter-bar">
  <span class="tag-filter-chip">
    {{ activeTag }}
    <span class="tag-filter-count">{{ getTagCount(activeTag) }}</span>
    <button class="tag-filter-remove" aria-label="清除标签筛选" @click="clearTagFilter">×</button>
  </span>
  <span class="tag-filter-meta">
    {{ getTagCount(activeTag) }} 个书签 · 来自 {{ tagGroups?.filter(g => g.categoryId !== null).length || 0 }} 个分类
  </span>
  <button class="tag-filter-clear" @click="clearTagFilter">清除筛选</button>
</div>
```

- [ ] **Step 6: 传给 NavCardGrid 与挂载弹窗**

```vue
<NavCardGrid
  :key="animationKey"
  :bookmarks="currentBookmarks"
  :groups="tagGroups"
  :empty-text="activeTag ? `没有带“${activeTag}”标签的书签` : '该分类下暂无书签'"
  :isAuthenticated="isAuthenticated"
  :reorderable="canReorder"
  @tag-click="handleTagClick"
  @group-click="handleGroupClick"
  @show-detail="handleShowDetail"
  @reorder="handleReorder"
  @dragstart="onNavDragStart"
  @dragend="onNavDragEnd"
/>
```

在其它弹窗旁挂载：

```vue
<TagOverviewDialog
  :show="showTagOverview"
  :tags="tagStats"
  :active-tag="activeTag"
  :bookmark-count="bookmarkCountWithTags"
  @close="showTagOverview = false"
  @select="handleTagSelectFromDialog"
/>
```

- [ ] **Step 7: 事件处理与状态互斥**

- 用统一函数替换现有 `handleTagTabClick` 与 `handleTagClick`：

```js
const handleTagClick = (name) => {
  activeTag.value = name
  searchResults.value = null
  navSearchRef.value?.clearSearch()
  animationKey.value++
}

const clearTagFilter = () => {
  activeTag.value = null
  animationKey.value++
}

const handleTagSelectFromDialog = (name) => {
  showTagOverview.value = false
  handleTagClick(name)
}
```

- `handleSelectMenu`、`handleSelectSubMenu`、`handleSearchResults` 中补 `activeTag.value = null`
- 新增 `handleGroupClick`：

```js
const findCategoryInMenu = (id, nodes, root = null, trail = []) => {
  for (const node of nodes) {
    const currentRoot = root ?? node
    const nextTrail = [...trail, node]
    if (node.id === id) return { root: currentRoot, node, trail: nextTrail }
    if (node.children?.length) {
      const found = findCategoryInMenu(id, node.children, currentRoot, nextTrail)
      if (found) return found
    }
  }
  return null
}

const handleGroupClick = (group) => {
  if (group?.categoryId == null) return
  const found = findCategoryInMenu(group.categoryId, menuTree.value)
  if (!found) return
  activeTag.value = null
  activeMenu.value = found.root
  activeSubMenu.value = found.root === found.node ? null : found.node
  clearSearchResults()
  animationKey.value++
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
```

- 新增标签失效监听：

```js
watch(tagStats, (list) => {
  if (!activeTag.value) return
  const norm = activeTag.value.toLowerCase()
  if (!list.some(tag => tag.name.toLowerCase() === norm)) {
    activeTag.value = null
  }
})
```

- [ ] **Step 8: 新增样式（在 NavItemView 的 scoped 样式中）**

```css
.cat-tab.tag-all {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--nav-primary) 35%, transparent);
  color: var(--nav-primary);
}

.tag-filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 10% 10px;
  padding: 6px 10px;
  border: 1px solid var(--nav-border);
  border-radius: 8px;
  background: var(--nav-card-bg);
  font-size: 0.72rem;
  color: var(--nav-text-secondary);
}
.tag-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border: 1px solid color-mix(in srgb, var(--nav-primary) 30%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
  color: var(--nav-primary);
  font-weight: 600;
}
.tag-filter-count {
  font-size: 0.6rem;
  padding: 0 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--nav-primary) 18%, transparent);
}
.tag-filter-remove {
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1;
  padding: 0;
}
.tag-filter-meta { flex: 1; min-width: 0; }
.tag-filter-clear {
  border: 0;
  background: none;
  color: var(--nav-text-secondary);
  font-size: 0.7rem;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
@media (max-width: 778px) {
  .tag-filter-bar { margin-left: 16px; margin-right: 16px; }
}
```

- [ ] **Step 9: 构建 + 手动走查**

Run: `npm run build`
Expected: 构建成功

手动（`npm run dev`）：
- 点标签 → 胶囊实心、搜索框清空、出现上下文栏与分组卡片；
- 顶部菜单不再高亮旧分类；点「清除筛选」后原分类高亮恢复；
- 点组头 → 跳到该分类；
- 站内搜索 → 标签筛选被清空；
- 点卡片上的标签 → 切换标签结果；
- 未登录状态下以上全部可用；
- 标签视图无拖拽把手，回分类后拖拽排序正常。

- [ ] **Step 10: 提交**

```bash
git add src/views/NavItemView.vue
git commit -m "feat(nav): browse bookmarks by tag with category grouping"
```

---

### Task 5: 清理 NavSearch 的标签逻辑

**Files:**
- Modify: `src/components/NavSearch.vue`

**Interfaces:**
- Consumes: 无
- Produces: `clearSearch()` 保留（Task 4 调用）；不再暴露 `openSearchWithTags`

- [ ] **Step 1: 删除标签入口**

- 删除 `defineExpose({ openSearchWithTags: … })` 整块；
- `searchInSite(tags = null)` 改为 `searchInSite()`，删除 `if (tags && tags.length > 0)` 分支，只保留：

```js
const searchInSite = () => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) return
  const results = searchBookmarks(props.bookmarks, searchQuery.value, { field: searchField.value })
  searchResults.value = results
  emit('search-results', results)
}
```

- `handleSearch` 中调用保持不变（`searchInSite()`）。

- [ ] **Step 2: 确认没有残留调用**

Run: `grep -rn "openSearchWithTags" src/`
Expected: 无输出

- [ ] **Step 3: 构建 + 回归**

Run: `npm run build`
Expected: 构建成功

手动：站内搜索、字段筛选、清除 X 均与改动前一致。

- [ ] **Step 4: 提交**

```bash
git add src/components/NavSearch.vue
git commit -m "refactor(nav): remove tag search shortcut from search box"
```

---

### Task 6: 全量验证与审查

**Files:**
- 无新增；只验证

**Interfaces:**
- Consumes: Task 1–5 的成果
- Produces: 可交付的验证记录

- [ ] **Step 1: 跑单测与构建**

Run: `npm run test:tags`
Expected: 全部 PASS

Run: `npm run build`
Expected: 构建成功，无新增编译警告

- [ ] **Step 2: 按验收清单手动走查（设计文档 §10）**

覆盖：
- 标签行前 10 与计数、全部标签总数、选中态；
- 全部标签弹窗：搜索、数量/名称排序、摘要、点选、✕/遮罩关闭；
- 结果视图：上下文栏数量与分类数、菜单顺序分组、组内 `position`、未分类最后、组头跳转；
- 状态互斥：标签 → 搜索 → 分类 → 清除，任意顺序不串台；
- 未登录全流程；
- 标签视图无拖拽；分类浏览拖拽回归；
- 移动端宽度 375px：标签行换行、上下文栏、弹窗 2 列、组头不溢出；
- 深层分类（≥3 层）路径显示为 `A / B / C`。

- [ ] **Step 3: 代码审查**

使用 `superpowers:code-review-and-quality` 对整个分支做一次审查；修复阻塞项后重跑 Step 1。

- [ ] **Step 4: 最终提交（如有审查修复）**

```bash
git add -A
git commit -m "fix(nav): address tag browsing review findings"
```

---

## 计划自检

- **Spec 覆盖**：标签行（Task 4）、全部标签弹窗（Task 2/4）、结果分组（Task 1/3/4）、排序规则（Task 1）、状态互斥（Task 4 Step 7）、菜单高亮（Task 4 Step 4）、拖拽关闭（Task 3/4）、搜索框清理（Task 5）、边界（Task 1 测试 + Task 6 手动）、验收（Task 6）。
- **类型/命名一致**：`TagGroup.key/categoryId/path/leaf/parentText/bookmarks` 在 Task 1 定义，Task 3 消费；`groups` / `emptyText` / `group-click` 在 Task 3 定义，Task 4 消费；`clearSearch()` 在 Task 4 调用，Task 5 保留。
- **Review Focus 对应**：1（Task 4 Step 9 / Task 6）、2（Task 1 测试「未分类」）、3（Task 4 Step 7/9）、4（Task 1 测试）、5（Task 6 手动深层路径）。
