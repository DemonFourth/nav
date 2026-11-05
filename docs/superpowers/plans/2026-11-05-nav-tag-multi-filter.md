# nav 粘性筛选栏 + 多标签 AND 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 nav 模式的标签筛选在滚动时保持可操作，并把单选标签改为“同时满足”的多标签 AND 筛选。

**Architecture:** 先扩展 `src/utils/tagBrowse.js` 的纯函数（归一化、切换、AND 匹配、失效清理），用 Node 单测锁定语义；再把 `NavItemView.vue` 的 `activeTag: string` 升级为 `activeTags: string[]` 并新增吸顶容器；随后只加 CSS 完成吸顶；最后把全部标签弹窗改成可连续多选。组件层无测试设施，靠 `npm run test:tags` + `npm run build` + 手动验收清单兜底。

**Tech Stack:** Vue 3 `<script setup>`、Vite 6、Node 内置 test runner（`node --test`）、CSS 变量主题（`--nav-*`）。

**Spec:** `docs/superpowers/specs/2026-11-05-nav-tag-multi-filter-design.md`

## Global Constraints

- 不新增任何依赖。
- 不改 `functions/**`、数据库 schema、浏览器扩展。
- 不改 `NavCard.vue` 与 `NavCardGrid.vue`（现有 `groups` / `emptyText` 接口已够用）。
- 所有颜色使用现有 `--nav-*` CSS 变量，禁止硬编码颜色。
- UI 文案用中文，标点沿用现有风格（`「」` 用于多标签，`“”` 沿用 v1 单标签）。
- 每个任务结束必须 `npm run test:tags` 与 `npm run build` 通过后再提交。
- 不主动 `git push`。
- 吸顶条 `z-index` 固定为 60（必须低于 NavBar 100 与下拉 200/300）。
- 多标签语义固定为 AND：书签标签集合必须包含全部选中标签，大小写忽略。
- 标签上的数字徽标保持**全站数量**，不随筛选联动。

## Review Focus

- **重复点击同一标签（含 `AI` / `ai` 大小写变体）**：应切换为移除，而不是再追加一个重复项。
- **`handleTagClick` 中 `clearSearch()` 的事件顺序**：`clearSearch()` 会同步触发 `clear-results`，若在计算新选中集之前调用，会把已累加的标签全部抹掉。
- **数据刷新后某个标签消失**：只移除消失的那个标签，其余选择必须保留，不能整组清空。
- **375px 下的吸顶条**：不能堆成多行压住卡片，且必须能横向滚到「全部标签」。
- **暗色模式 / 自定义壁纸下的吸顶条**：下方卡片文字不能透过背景与吸顶条文字重叠。

---

## 文件结构

| 文件 | 责任 | 任务 |
|------|------|------|
| `src/utils/tagBrowse.js` | 标签纯函数：解析、统计、AND 过滤、选择切换、失效清理 | 1 |
| `tests/tag-browse.test.js` | 上述纯函数的 Node 单测 | 1 |
| `src/views/NavItemView.vue` | 标签筛选状态、吸顶容器结构、上下文栏、空态、菜单高亮/拖拽条件 | 2、3 |
| `src/components/TagOverviewDialog.vue` | 全部标签弹窗的多选交互与底部摘要 | 4 |
| `AGENTS.md` | 开发文档同步 | 5 |

---

### Task 1: 标签纯函数与 AND 过滤

**Files:**
- Modify: `src/utils/tagBrowse.js`
- Test: `tests/tag-browse.test.js`

**Interfaces:**
- Consumes: 现有 `parseTags(raw) -> string[]`、`buildTagStats(bookmarks) -> {name,count}[]`
- Produces:
  - `normalizeTagList(input: string | string[] | null | undefined) -> string[]`
  - `toggleTagSelection(selected: string[], name: string) -> string[]`
  - `matchesAllTags(bookmark: {tags?: string}, tags: string[] | string | null) -> boolean`
  - `pruneMissingTags(selected: string[], stats: {name: string}[]) -> string[]`
  - `buildTagGroups(bookmarks, categories, activeTags: string[] | string | null) -> groups[]`（AND 语义，返回结构不变）

- [ ] **Step 1: 写失败测试**

在 `tests/tag-browse.test.js` 的 import 中加入四个新函数：

```js
import {
  parseTags,
  buildTagStats,
  countBookmarksWithTags,
  buildTagGroups,
  filterAndSortTags,
  normalizeTagList,
  toggleTagSelection,
  matchesAllTags,
  pruneMissingTags
} from '../src/utils/tagBrowse.js'
```

在文件末尾追加：

```js
test('normalizeTagList trims, dedupes case-insensitively and keeps first spelling', () => {
  assert.deepEqual(normalizeTagList(' AI , ai , 搜索 '), ['AI', '搜索'])
  assert.deepEqual(normalizeTagList(['AI', 'ai', '搜索']), ['AI', '搜索'])
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
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:tags`
Expected: FAIL，报 `normalizeTagList is not a function`（或同类 `not a function`）。

- [ ] **Step 3: 实现四个纯函数并改造 `buildTagGroups`**

在 `src/utils/tagBrowse.js` 的 `parseTags` 之后加入：

```js
/**
 * 归一化标签集合：string / string[] / null → string[]
 * 去空白、去空项、按小写去重、保留首次出现的写法，并保留传入顺序
 */
export function normalizeTagList(input) {
  const list = Array.isArray(input) ? input : input == null ? [] : [input]
  const seen = new Set()
  const result = []
  for (const item of list) {
    const tag = String(item ?? '').trim()
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(tag)
  }
  return result
}

/**
 * 切换一个标签：已存在（忽略大小写）则移除，否则追加到末尾
 * 不修改入参数组
 */
export function toggleTagSelection(selected, name) {
  const tag = String(name ?? '').trim()
  const current = normalizeTagList(selected)
  if (!tag) return current
  const key = tag.toLowerCase()
  const index = current.findIndex(item => item.toLowerCase() === key)
  if (index === -1) return [...current, tag]
  return current.filter((_, i) => i !== index)
}

/**
 * 书签是否同时包含全部标签（AND）；标签列表为空时返回 true
 */
export function matchesAllTags(bookmark, tags) {
  const wanted = normalizeTagList(tags)
  if (!wanted.length) return true
  const own = new Set(parseTags(bookmark?.tags).map(tag => tag.toLowerCase()))
  return wanted.every(tag => own.has(tag.toLowerCase()))
}

/**
 * 从当前选择中移除已经不存在于标签统计里的项，保留其余顺序
 */
export function pruneMissingTags(selected, stats = []) {
  const valid = new Set(stats.map(tag => String(tag.name).toLowerCase()))
  return normalizeTagList(selected).filter(tag => valid.has(tag.toLowerCase()))
}
```

把 `buildTagGroups` 开头改为：

```js
export function buildTagGroups(bookmarks = [], categories = [], activeTags = null) {
  const wanted = normalizeTagList(activeTags)
  if (!wanted.length) return []
  const matched = bookmarks.filter(bookmark => matchesAllTags(bookmark, wanted))
  // ↓ 以下分组/排序逻辑保持 v1 不变
```

并同步更新该函数的 JSDoc：第三个参数改为 `string|string[]|null activeTags`，描述改为“按标签 AND 筛选书签并按分类分组”。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:tags`
Expected: PASS，14 个 test（原 8 + 新增 6）全绿。

- [ ] **Step 5: 提交**

```bash
git add src/utils/tagBrowse.js tests/tag-browse.test.js
git commit -m "feat(tags): 支持多标签 AND 过滤与选择切换"
```

---

### Task 2: NavItemView 多标签状态与交互

**Files:**
- Modify: `src/views/NavItemView.vue`

**Interfaces:**
- Consumes: Task 1 的 `toggleTagSelection`、`pruneMissingTags`、`buildTagGroups`（数组入参）
- Produces: `activeTags: Ref<string[]>`、`tagFilterActive: ComputedRef<boolean>`、`isTagActive(name)`、`activeTagLabels`、`tagMatchCount`、`tagCategoryCount`、`removeTag(name)`；供 Task 4 的弹窗 props 使用

- [ ] **Step 1: 模板改为多标签结构**

把 `src/views/NavItemView.vue` 中 `NavBar` 的两个高亮绑定改为：

```vue
:active-menu="tagFilterActive ? null : activeMenu"
:active-sub-menu="tagFilterActive ? null : activeSubMenu"
```

把原来的 `.category-tabs` 与 `.tag-filter-bar` 两块整体替换为：

```vue
<div v-if="tagStats.length" class="tag-filter-sticky" :class="{ 'is-pinned': tagFilterActive }">
  <div class="category-tabs">
    <button
      v-for="tag in topTags"
      :key="tag.name"
      class="cat-tab"
      :class="{ active: isTagActive(tag.name) }"
      :aria-pressed="isTagActive(tag.name)"
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

  <div v-if="tagFilterActive" class="tag-filter-bar">
    <span v-for="name in activeTagLabels" :key="name" class="tag-filter-chip">
      {{ name }}
      <span class="tag-filter-count">{{ getTagCount(name) }}</span>
      <button
        class="tag-filter-remove"
        :aria-label="`移除标签 ${name}`"
        @click="removeTag(name)"
      >×</button>
    </span>
    <span class="tag-filter-meta">
      {{ tagMatchCount }} 个书签 · 来自 {{ tagCategoryCount }} 个分类
    </span>
    <button class="tag-filter-clear" @click="clearTagFilter">清除筛选</button>
  </div>
</div>
```

`TagOverviewDialog` 的 props 改为（Task 4 会实现组件侧）：

```vue
<TagOverviewDialog
  :show="showTagOverview"
  :tags="tagStats"
  :active-tags="activeTags"
  :bookmark-count="bookmarkCountWithTags"
  :match-count="tagMatchCount"
  @close="showTagOverview = false"
  @toggle="handleTagClick"
/>
```

- [ ] **Step 2: 状态与派生值改为数组**

把现有导入行（`src/views/NavItemView.vue:136`）：

```js
import { buildTagStats, countBookmarksWithTags, buildTagGroups } from '../utils/tagBrowse.js'
```

改为：

```js
import { buildTagStats, countBookmarksWithTags, buildTagGroups, toggleTagSelection, pruneMissingTags } from '../utils/tagBrowse.js'
```

把 `const activeTag = ref(null)` 改为：

```js
const activeTags = ref([])
```

把 `isActiveTag` / `activeTagLabel` / `tagGroups` 一段替换为：

```js
const tagFilterActive = computed(() => activeTags.value.length > 0)

const isTagActive = (name) =>
  activeTags.value.some(tag => tag.toLowerCase() === String(name).toLowerCase())

// 卡片标签可能是任意大小写写法，展示时统一用首次出现的规范写法
const activeTagLabels = computed(() => {
  const canonical = new Map(tagStats.value.map(tag => [tag.name.toLowerCase(), tag.name]))
  return activeTags.value.map(name => canonical.get(name.toLowerCase()) ?? name)
})

const tagGroups = computed(() =>
  tagFilterActive.value
    ? buildTagGroups(bookmarks.value, categories.value, activeTags.value)
    : null
)

const tagMatchCount = computed(() =>
  tagGroups.value
    ? tagGroups.value.reduce((sum, group) => sum + group.bookmarks.length, 0)
    : 0
)

const tagCategoryCount = computed(() =>
  tagGroups.value
    ? tagGroups.value.filter(group => group.categoryId !== null).length
    : 0
)
```

`gridEmptyText` 改为：

```js
const gridEmptyText = computed(() => {
  if (!tagFilterActive.value) return '该分类下暂无书签'
  const names = activeTagLabels.value
  return names.length === 1
    ? `没有带“${names[0]}”标签的书签`
    : `没有同时带「${names.join('、')}」标签的书签`
})
```

`activePath` 首行改为 `if (tagFilterActive.value) return []`；`canReorder` 改为：

```js
const canReorder = computed(() => {
  return isAuthenticated.value && !searchResults.value && !tagFilterActive.value && !!activeMenu.value
})
```

- [ ] **Step 3: 处理函数改为切换语义**

把 `clearSearchResults` / `handleTagClick` / `clearTagFilter` / `handleTagSelectFromDialog` 一段替换为：

```js
const clearSearchResults = () => {
  searchResults.value = null
  activeTags.value = []
}

const handleTagClick = (name) => {
  // 顺序不可调换：clearSearch() 会同步 emit('clear-results') → clearSearchResults() 清空 activeTags。
  // 必须先基于当前选择算出 next，再清搜索框，否则累加会被抹掉。
  const next = toggleTagSelection(activeTags.value, name)
  navSearchRef.value?.clearSearch()
  activeTags.value = next
  searchResults.value = null
  animationKey.value++
}

const removeTag = (name) => {
  activeTags.value = toggleTagSelection(activeTags.value, name)
  animationKey.value++
}

const clearTagFilter = () => {
  activeTags.value = []
  animationKey.value++
}
```

删除 `handleTagSelectFromDialog`（弹窗现在直接 emit `toggle`）。

`handleSearchResults`、`handleSelectMenu`、`handleSelectSubMenu`、`handleGroupClick`、`handleLogout` 里的 `activeTag.value = null` 全部改为 `activeTags.value = []`。

把标签失效的 `watch` 替换为：

```js
watch(tagStats, (list) => {
  if (!activeTags.value.length) return
  const next = pruneMissingTags(activeTags.value, list)
  if (next.length !== activeTags.value.length) {
    activeTags.value = next
    animationKey.value++
  }
})
```

- [ ] **Step 4: 上下文栏允许多胶囊换行**

在 `.tag-filter-bar` 规则中补两行：

```css
flex-wrap: wrap;
row-gap: 6px;
```

- [ ] **Step 5: 检查无残留并构建**

Run: `git grep -n "activeTag" -- src tests`
Expected: 只剩 `activeTags` / `activeTagLabels` 等新名字，不再有裸 `activeTag.value`。

Run: `npm run test:tags`
Expected: PASS。

Run: `npm run build`
Expected: 构建成功，无新增 Vue 警告。

- [ ] **Step 6: 手动冒烟（可选，需本地数据）**

终端 1：`npx wrangler pages dev dist --port 8787`
终端 2：`npm run dev`，打开 http://localhost:3000

Expected:
- 点标签 A → 只显示含 A 的书签，A 高亮。
- 再点标签 B → 只显示同时含 A、B 的书签，A、B 都高亮，上下文栏出现两个胶囊。
- 再点 A → A 取消，只剩 B。
- 点某个胶囊的 `×` → 只移除该标签。
- 点「清除筛选」→ 两个都清空，回到分类浏览。

- [ ] **Step 7: 提交**

```bash
git add src/views/NavItemView.vue
git commit -m "feat(nav): 标签筛选支持多标签同时满足"
```

---

### Task 3: 筛选栏吸顶

**Files:**
- Modify: `src/views/NavItemView.vue`（仅 `<style scoped>`）

**Interfaces:**
- Consumes: Task 2 已渲染的 `.tag-filter-sticky` / `.is-pinned` / `--nav-bar-height`
- Produces: 无（纯样式）

- [ ] **Step 1: 加入吸顶样式**

在 `.category-tabs` 规则之前插入：

```css
.tag-filter-sticky {
  position: relative;
  z-index: 2;
}

/* 仅在有标签筛选时吸顶，普通浏览不占常驻空间 */
.tag-filter-sticky.is-pinned {
  position: sticky;
  top: var(--nav-bar-height, 56px);
  z-index: 60;
  background: var(--nav-glass);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border-bottom: 1px solid var(--nav-border);
  box-shadow: 0 8px 18px -16px rgba(0, 0, 0, 0.35);
  padding-bottom: 6px;
}

.tag-filter-sticky.is-pinned .tag-filter-bar {
  margin-bottom: 0;
}
```

在现有 `@media (max-width: 778px)` 块之后追加窄屏规则：

```css
@media (max-width: 640px) {
  .tag-filter-sticky.is-pinned .category-tabs {
    flex-wrap: nowrap;
    justify-content: flex-start;
    overflow-x: auto;
    padding-right: 16px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .tag-filter-sticky.is-pinned .category-tabs::-webkit-scrollbar {
    display: none;
  }
}
```

- [ ] **Step 2: 构建**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 3: 手动验收吸顶**

Run（两个终端）：`npx wrangler pages dev dist --port 8787`、`npm run dev`

Expected（1280px 窗口）：
- 未选标签时向下滚，标签行随内容滚走。
- 选中标签后向下滚，标签行 + 上下文栏停在导航栏下方，卡片从下方经过但不与吸顶条文字重叠。
- 吸顶条高度 = 标签行 + 上下文栏，无额外空白。

Expected（375px，DevTools 设备模拟）：
- 吸顶时标签行只占一行，可左右滚动到「全部标签」。
- 上下文栏胶囊可换行，不横向溢出。

Expected（暗色模式 + 自定义壁纸）：吸顶条文字可读，卡片文字不透出。

- [ ] **Step 4: 提交**

```bash
git add src/views/NavItemView.vue
git commit -m "style(nav): 标签筛选时标签行与上下文栏吸顶"
```

---

### Task 4: 全部标签弹窗支持连续多选

**Files:**
- Modify: `src/components/TagOverviewDialog.vue`

**Interfaces:**
- Consumes: Task 2 传入的 `activeTags`、`matchCount`
- Produces: `toggle` 事件（参数 `name: string`），不再有 `select`

- [ ] **Step 1: 改 props / emits 与选中判断**

```js
const props = defineProps({
  show: { type: Boolean, default: false },
  tags: { type: Array, default: () => [] },
  activeTags: { type: Array, default: () => [] },
  bookmarkCount: { type: Number, default: 0 },
  matchCount: { type: Number, default: 0 }
})
const emit = defineEmits(['close', 'toggle'])
```

把 `isActive` 改为：

```js
const isActive = (name) =>
  props.activeTags.some(tag => tag.toLowerCase() === name.toLowerCase())
```

`watch(() => props.show)` 的重置逻辑保持不变。

- [ ] **Step 2: 标签按钮改为切换且不关闭**

```vue
<button
  v-for="tag in list"
  :key="tag.name"
  class="tag-overview-item"
  :class="{ active: isActive(tag.name) }"
  :aria-pressed="isActive(tag.name)"
  @click="emit('toggle', tag.name)"
>
```

- [ ] **Step 3: 底部改为已选/命中摘要 + 完成按钮**

```vue
<template #footer>
  <div class="tag-overview-footer">
    <span>
      <template v-if="activeTags.length">
        已选 {{ activeTags.length }} 个 · 当前命中 {{ matchCount }} 个书签
      </template>
      <template v-else>
        共 {{ tags.length }} 个标签 · 覆盖 {{ bookmarkCount }} 个书签
      </template>
    </span>
    <span class="tag-overview-actions">
      <span class="tag-overview-hint">点标签累加筛选 · 再点取消</span>
      <button class="tag-overview-done" @click="emit('close')">完成</button>
    </span>
  </div>
</template>
```

- [ ] **Step 4: 补样式**

在 `.tag-overview-footer` 之后加入：

```css
.tag-overview-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.tag-overview-done {
  padding: 4px 12px;
  border: 1px solid color-mix(in srgb, var(--nav-primary) 35%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
  color: var(--nav-primary);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}
.tag-overview-done:hover {
  background: color-mix(in srgb, var(--nav-primary) 20%, transparent);
}
```

移动端：在现有 `@media (max-width: 640px)` 中给 `.tag-overview-actions` 加 `width: 100%; justify-content: space-between;`。

- [ ] **Step 5: 构建**

Run: `npm run build`
Expected: 构建成功，无 `select` 事件相关警告。

- [ ] **Step 6: 手动验收弹窗**

Expected:
- 打开弹窗点 A → A 高亮，弹窗不关闭；再点 B → A、B 都高亮。
- 底部显示「已选 2 个 · 当前命中 N 个书签」。
- 再点 A → A 取消，只剩 B。
- 点「完成」/ ✕ / 遮罩 / `Esc` 均能关闭，关闭后卡片区就是最新结果。
- 搜索、排序、打开时重置仍正常。

- [ ] **Step 7: 提交**

```bash
git add src/components/TagOverviewDialog.vue
git commit -m "feat(tags): 全部标签弹窗支持连续多选"
```

---

### Task 5: 文档同步与终验

**Files:**
- Modify: `AGENTS.md:313-314, 378, 385, 387-416`

**Interfaces:**
- Consumes: Task 1–4 的最终行为
- Produces: 无

- [ ] **Step 1: 更新 AGENTS.md 的导航站标签章节**

按以下事实改写（保持现有表格/列表风格）：

- `activeTag` → `activeTags`（数组），`NavItemView` 管理 `searchResults` / `activeTags`。
- 标签点击语义：**累加，再点同一标签取消**；`handleTagClick` 必须“先算 next 再 `clearSearch()`”，因为 `clearSearch()` 会同步 emit `clear-results` 清空标签。
- 标签匹配：**AND**，书签必须包含全部选中标签；大小写忽略；书签内重复标签只算一次。
- 标签行：可多个同时实心；数字仍为全站数量。
- 上下文栏：每个标签一个可 × 胶囊 + 命中数/分类数 +「清除筛选」。
- 吸顶：仅 `activeTags` 非空时 `.tag-filter-sticky.is-pinned` 吸顶，`top: var(--nav-bar-height)`，`z-index: 60`，`--nav-glass` + blur；`≤640px` 标签行单行横向滚动。
- 全部标签弹窗：点击切换选中、保持打开，底部「已选 N 个 · 当前命中 M 个书签」+「完成」。
- 标签失效：`pruneMissingTags` 只移除消失的标签。
- 相关文件表补充 `pruneMissingTags` / `toggleTagSelection` 的用途。

- [ ] **Step 2: 跑完整测试与构建**

Run: `npm run test:tags`
Expected: 14/14 PASS。

Run: `npm run test:ext`
Expected: 通过（本次未改扩展，防回归）。

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 3: 逐项走设计文档 §10 验收清单**

打开 `docs/superpowers/specs/2026-11-05-nav-tag-multi-filter-design.md` §10，按“吸顶 / 多标签 AND / 弹窗 / 不回归”四组逐条核对；在聊天中报告每条结果，不勾选未实际验证的项。

- [ ] **Step 4: 提交**

```bash
git add AGENTS.md
git commit -m "docs: 同步标签多选与吸顶行为"
```

---

## 完成后

- 不主动 push；等用户确认后再推。
- 若手动验收发现视觉问题，优先在 Task 3 的 CSS 范围内修（不引入新组件）。
