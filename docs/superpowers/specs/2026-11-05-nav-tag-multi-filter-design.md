# nav 模式粘性筛选栏 + 多标签 AND 筛选设计文档

**日期**: 2026-11-05
**状态**: 已批准（2026-11-05，实现见 `docs/superpowers/plans/2026-11-05-nav-tag-multi-filter.md`）
**范围**: nav 模式（`displayMode === 'nav-item'`）的标签行、标签筛选上下文栏、全部标签弹窗、标签结果视图
**前置文档**: `docs/superpowers/specs/2026-11-05-nav-tag-browse-design.md`（v1 标签浏览，本文在其基础上增量修订）

---

## 1. 背景与问题

v1 已把「按标签查书签」做成一等浏览路径：标签行（最热 10 + 全部标签）、分组结果、上下文栏。实际使用后暴露两个问题：

1. **筛选栏会滚走。** `NavBar` 是 `position: fixed`（`NavBar.vue:428`），而搜索框、标签行（`.category-tabs`）、上下文栏（`.tag-filter-bar`）都在普通文档流里，只设了 `position: relative; z-index: 2`。页面滚动的是 `window`，所以一往下翻，标签行和上下文栏整块出屏；想换标签 / 移除标签 / 清除筛选必须回到顶部。
2. **只能单标签筛选。** `activeTag` 是单个字符串，`buildTagGroups` 用 `some(...)` 做「包含任一」匹配。用户需要的是**同时满足**（AND）：一个书签必须带上所有选中的标签。

本文解决这两点，同时保持 v1 的布局约定不变。

---

## 2. 目标 / 非目标

### 2.1 目标

- 标签筛选激活时，**标签行 + 上下文栏整体吸顶**，滚动中随时增减标签、清除筛选。
- 标签筛选从单选改为**多标签 AND**：书签的标签集合必须包含全部选中标签。
- 选中态支持多个；标签行、全部标签弹窗、卡片标签三处入口共用同一套累加/取消语义。
- 上下文栏为每个选中标签提供一个可单独移除的胶囊。
- 全部标签弹窗支持连续多选，不再点一次就关闭。
- 不改变 nav 结构：导航栏、搜索框、标签行、卡片网格的位置与尺寸关系不变（仅在筛选时吸顶）。
- 不新增依赖、不改后端 / 数据库 / `NavCard.vue` / 浏览器扩展。

### 2.2 非目标（本次不做）

- 不做 OR 组合筛选（用户明确要 AND）。
- 不做 URL / hash 持久化，刷新后不保留筛选。
- 不做「标签数字随筛选联动」。徽标继续显示**全站数量**（已确认）。
- 不做「只留这一个」的修饰键交互（Alt/Ctrl 点击）。
- 不做筛选条件保存 / 命名 / 分享。
- 不改设置页 `TagManagement.vue`。
- 不改 `NavCard.vue` 内部结构（卡片不新增任何行）。

### 2.3 反目标（做了就算失败）

- 吸顶容器遮挡卡片、或滚动时卡片从底部缝隙透出导致文字重叠。
- 普通分类浏览（没有标签筛选）也被常驻的吸顶条占掉高度。
- `clearSearch()` 的 `clear-results` 事件把已累加的标签清空（见 §7.4 的顺序约束）。
- 移动端吸顶后标签行堆成 3~4 行，把可视区压到只剩一两排卡片。
- 引入新的全局状态库或路由。

---

## 3. 已确认决策

| # | 决策 | 结论 |
|---|------|------|
| 1 | 粘性范围 | **有筛选时**把「标签行 + 上下文栏」整体吸顶；普通浏览不吸顶 |
| 2 | 吸顶偏移 | `top: var(--nav-bar-height)`（NavBar 已用 `ResizeObserver` 维护该变量） |
| 3 | 窄屏处理 | `≤640px` 吸顶时标签行改为**单行横向滚动**，左对齐 |
| 4 | 多标签语义 | **AND**：书签标签集合 ⊇ 全部选中标签；大小写忽略、书签内重复标签只算一次 |
| 5 | 点击行为 | **累加；再点同一标签取消**（大小写归一比较） |
| 6 | 标签徽标 | 保持全站数量，不随筛选变化 |
| 7 | 上下文栏 | 每个标签一个可 × 胶囊 + 命中数/分类数 + 「清除筛选」 |
| 8 | 全部标签弹窗 | 点击=切换选中，**保持打开**；底部显示已选数量与当前命中数，另有「完成」按钮 |
| 9 | 数据来源 | 前端内存 `bookmarks` 过滤，不发请求 |

---

## 4. 方案对比

### 4.1 粘性范围

| 方案 | 表现 | 结论 |
|------|------|------|
| A. 只粘上下文栏 | 能移除 / 清除，但**加**标签仍要回顶部 | 与多标签需求冲突，放弃 |
| **B. 标签行 + 上下文栏，仅筛选时粘** | 滚动中可增减标签；普通浏览零占用 | **采用** |
| C. 标签行始终粘 | 快捷，但长期占用顶部空间，改变现有浏览观感 | 放弃 |
| D. 滚动出浮动「筛选」按钮 | 不占常驻空间，但引入新组件与新交互 | 放弃（成本高、偏离现有风格） |

### 4.2 多标签交互

| 方案 | 行为 | 结论 |
|------|------|------|
| **A. 累加 + 再点取消** | 点 A 得 A；点 B 得 A AND B；再点 A 回到只剩 B | **采用**（零学习成本、触屏可用） |
| B. 累加 + Alt/Ctrl 替换 | 多一种意图直达 | 放弃（需提示，触屏无效） |
| C. 弹窗勾选 + 「应用」 | 批量组合一次生效 | 弹窗改为「保持打开」即可覆盖，无需额外「应用」步骤 |

> 弹窗采用「点击切换、保持打开、实时生效」，底部「完成」关闭。相当于 A 在弹窗内的自然延伸，不引入第二种心智模型。

---

## 5. 交互设计

### 5.1 标签行（吸顶容器）

```vue
<div v-if="tagStats.length" class="tag-filter-sticky" :class="{ 'is-pinned': tagFilterActive }">
  <div class="category-tabs">…标签胶囊 + 全部标签…</div>
  <div v-if="tagFilterActive" class="tag-filter-bar">…</div>
</div>
```

- `tagFilterActive = activeTags.length > 0`。
- 未筛选时：容器是普通块，视觉与 v1 完全一致。
- 筛选时：容器 `position: sticky; top: var(--nav-bar-height, 56px); z-index: 60`，玻璃底 + `blur` + 下边框（见 §8）。
- 标签行每个胶囊：选中即实心；支持多个同时实心；`aria-pressed` 反映选中态。
- 未登录同样可用。
- 标签在数据刷新后消失时，自动从 `activeTags` 移除（§7.5）。

### 5.2 上下文栏

```
[ AI 21 × ] [ Cloudflare 20 × ]  ─  9 个书签 · 来自 3 个分类  ─  清除筛选
```

- 每个选中标签：主色浅底胶囊 + 数量 + `×`（`aria-label="移除标签 AI"`），点击 `×` 只移除该标签。
- 胶囊顺序 = 用户点击顺序（后选的排后面），移除后其余保持原顺序。
- 命中数 = AND 过滤后的书签总数；分类数只统计真实分类组，不含「未分类」。
- 右侧「清除筛选」清空全部标签，回到当前分类浏览。
- 胶囊过多时允许换行（`flex-wrap: wrap`），不与右侧按钮挤成一行。

### 5.3 全部标签弹窗（`TagOverviewDialog.vue`）

- 点击标签：`emit('toggle', name)`，弹窗**不关闭**；再次点击同一标签取消。
- 选中态可多个，视觉与标签行一致（主色浅底 + 加粗）。
- 底部左侧：`已选 N 个 · 当前命中 M 个书签`（未选标签时只显示 `共 T 个标签 · 覆盖 B 个书签`，T/B 为全站统计）。
- 底部右侧：提示文案 `点标签累加筛选 · 再点取消` + 「完成」按钮（`emit('close')`）。
- 搜索 / 排序 / 关闭方式（✕、遮罩、`Esc`）保持现状；打开时仍重置搜索与排序。
- 实时生效：筛选在弹窗打开时即更新背后的卡片区，关闭即看到结果。

### 5.4 卡片上的标签

- 点击卡片标签与点标签行完全一致：**累加**；点已选中的标签则移除它。
- 仍在点击时清空搜索框文本（不写入标签名）。

### 5.5 状态互斥

| 用户动作 | `searchResults` | `activeTags` | 说明 |
|----------|-----------------|--------------|------|
| 点标签（行 / 弹窗 / 卡片） | 清空 | 切换该标签（累加或移除） | 同时清空搜索框文本 |
| 站内搜索提交 | 设为结果 | 清空 | 标签让位于搜索 |
| 点搜索框 X | 清空 | 清空 | 回到分类浏览 |
| 点顶部菜单 / 子菜单 | 清空 | 清空 | 回到分类浏览 |
| 点上下文栏 `×` | 不变 | 移除该标签，可能为空 | 空则回到分类浏览 |
| 点「清除筛选」 | 不变 | 清空 | 回到分类浏览 |
| 点分组组头 | 清空 | 清空 | 跳到该分类 |

- 筛选期间顶部菜单不高亮任何分类，但保留 `activeMenu` / `activeSubMenu` 作为「清除后回到哪」的记忆（沿用 v1：传 `null` 给 `NavBar`，`activePath` 返回 `[]`）。
- `canReorder` = 已登录 + 浏览分类 + 非搜索结果 + **`activeTags` 为空**。

### 5.6 空结果

- 空态文案：`没有同时带「A、B」标签的书签`（单个标签时退化为 v1 的 `没有带“A”标签的书签`）。
- 上下文栏与「清除筛选」仍然可见，用户可直接移除最后一个标签退出筛选。
- 不允许出现「空结果但无法操作」的死路。

---

## 6. 数据与计算

全部在前端完成，不改 API。

### 6.1 新增纯函数（`src/utils/tagBrowse.js`）

```js
/**
 * 归一化标签集合：string / string[] / null → string[]
 * - trim、去空、按小写去重、保留首次出现的写法
 * - 不排序（保留用户点击顺序）
 */
export function normalizeTagList(input) { … }

/**
 * 切换一个标签：已存在（忽略大小写）则移除，否则追加
 * @returns {string[]} 新数组，不修改入参
 */
export function toggleTagSelection(selected, name) { … }

/**
 * 书签是否同时包含全部标签（AND）
 * @param {{tags?: string}} bookmark
 * @param {string[]} tags
 * @returns {boolean} tags 为空时返回 true
 */
export function matchesAllTags(bookmark, tags) { … }
```

- `parseTags` 保持不变（已去重、保留大小写）。
- `matchesAllTags` 内部把书签标签转成小写 `Set`，再对每个目标标签做 `has`，复杂度 O(书签标签数 + 目标标签数)。

### 6.2 `buildTagGroups` 扩展

```js
export function buildTagGroups(bookmarks = [], categories = [], activeTags = null) {
  const wanted = normalizeTagList(activeTags)
  if (!wanted.length) return []
  const matched = bookmarks.filter(bookmark => matchesAllTags(bookmark, wanted))
  // 后续分组逻辑与 v1 完全一致（菜单顺序、未分类最后、组内 position）
}
```

- **向后兼容**：入参为字符串时 `normalizeTagList` 自动包成单元素数组，v1 的调用与单测无需改签名。
- 分组、排序、组内排序逻辑零改动。

### 6.3 `NavItemView.vue` 状态

```js
const activeTags = ref([])                    // 规范写法，点击顺序
const tagFilterActive = computed(() => activeTags.value.length > 0)
const activeTagLabels = computed(() => …)     // 用 tagStats 的首次出现写法兜底
```

- 保存的是 `tagStats` 里的规范写法（点击时查一次），避免上下文栏出现 `ai` / `AI` 混排。
- 若点击的标签在 `tagStats` 中找不到（数据刚刷新），直接使用传入写法。

### 6.4 派生值

```js
const tagGroups = computed(() =>
  tagFilterActive.value
    ? buildTagGroups(bookmarks.value, categories.value, activeTags.value)
    : null
)

const tagMatchCount = computed(() =>
  tagGroups.value ? tagGroups.value.reduce((n, g) => n + g.bookmarks.length, 0) : 0
)

const tagCategoryCount = computed(() =>
  tagGroups.value ? tagGroups.value.filter(g => g.categoryId !== null).length : 0
)

const currentBookmarks = computed(() => {
  if (tagGroups.value) return tagGroups.value.flatMap(g => g.bookmarks)
  // 其余分支不变
})
```

- `getTagCount` 继续用全站 `tagCountMap`，**不联动**。

---

## 7. 组件与文件改动

### 7.1 文件清单

| 文件 | 类型 | 改动 |
|------|------|------|
| `src/utils/tagBrowse.js` | 修改 | 新增 `normalizeTagList` / `toggleTagSelection` / `matchesAllTags`；`buildTagGroups` 改为 AND 且兼容字符串 |
| `src/views/NavItemView.vue` | 修改 | `activeTag` → `activeTags`；吸顶容器；多胶囊上下文栏；点击切换；空态文案；`canReorder` / 菜单高亮 / 清理逻辑同步 |
| `src/components/TagOverviewDialog.vue` | 修改 | `activeTag` → `activeTags`；点击切换且不关闭；底部已选/命中摘要 + 「完成」 |
| `tests/tag-browse.test.js` | 修改 | 补 AND、大小写、重复标签、空数组、字符串兼容、切换函数用例 |
| `AGENTS.md` | 修改（实施后） | 更新「导航站标签浏览」章节：多标签语义、吸顶规则、`activeTags` |

**不改**：`NavCard.vue`、`NavCardGrid.vue`（`groups` / `emptyText` 接口已够用）、`NavSearch.vue`、`useBookmarks.js`、`useTags.js`、`functions/**`、数据库、浏览器扩展。

### 7.2 `NavItemView.vue` 模板

```vue
<NavBar
  :active-menu="tagFilterActive ? null : activeMenu"
  :active-sub-menu="tagFilterActive ? null : activeSubMenu"
  :active-path="activePath"
  …
/>

<div class="search-section"><NavSearch ref="navSearchRef" … /></div>

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
      {{ tag.name }} <span class="cat-count">{{ tag.count }}</span>
    </button>
    <button class="cat-tab tag-all" @click="showTagOverview = true">
      全部标签 <span class="cat-count">{{ tagStats.length }}</span> ›
    </button>
  </div>

  <div v-if="tagFilterActive" class="tag-filter-bar">
    <span v-for="name in activeTagLabels" :key="name" class="tag-filter-chip">
      {{ name }}
      <span class="tag-filter-count">{{ getTagCount(name) }}</span>
      <button class="tag-filter-remove" :aria-label="`移除标签 ${name}`" @click="removeTag(name)">×</button>
    </span>
    <span class="tag-filter-meta">
      {{ tagMatchCount }} 个书签 · 来自 {{ tagCategoryCount }} 个分类
    </span>
    <button class="tag-filter-clear" @click="clearTagFilter">清除筛选</button>
  </div>
</div>

<div class="content-section">
  <NavCardGrid
    :key="animationKey"
    :bookmarks="currentBookmarks"
    :groups="tagGroups"
    :empty-text="gridEmptyText"
    :isAuthenticated="isAuthenticated"
    :reorderable="canReorder"
    @tag-click="handleTagClick"
    @group-click="handleGroupClick"
    …
  />
</div>

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

### 7.3 `NavItemView.vue` 逻辑

```js
const isTagActive = (name) =>
  activeTags.value.some(tag => tag.toLowerCase() === String(name).toLowerCase())

const activeTagLabels = computed(() => {
  const canonical = new Map(tagStats.value.map(t => [t.name.toLowerCase(), t.name]))
  return activeTags.value.map(name => canonical.get(name.toLowerCase()) ?? name)
})

// 关键：先算 next，再调用 clearSearch()。
// NavSearch.clearSearch() 会同步 emit('clear-results') → clearSearchResults() 清空 activeTags，
// 如果先清搜索再算 next，累加会被抹掉。
const handleTagClick = (name) => {
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

const clearSearchResults = () => {
  searchResults.value = null
  activeTags.value = []
}
```

- `handleSelectMenu` / `handleSelectSubMenu` / `handleSearchResults` / `handleGroupClick` 中的 `activeTag = null` 全部改为 `activeTags = []`。
- `activePath` 首行改为 `if (tagFilterActive.value) return []`。
- `canReorder` 增加 `!tagFilterActive.value`。
- `gridEmptyText`：

```js
const gridEmptyText = computed(() => {
  if (!tagFilterActive.value) return '该分类下暂无书签'
  const names = activeTagLabels.value
  return names.length === 1
    ? `没有带“${names[0]}”标签的书签`
    : `没有同时带「${names.join('、')}」标签的书签`
})
```

### 7.4 自动失效（数据刷新）

```js
watch(tagStats, (list) => {
  if (!activeTags.value.length) return
  const valid = new Set(list.map(tag => tag.name.toLowerCase()))
  const next = activeTags.value.filter(name => valid.has(name.toLowerCase()))
  if (next.length !== activeTags.value.length) {
    activeTags.value = next
    animationKey.value++
  }
})
```

- 逐个移除消失的标签，而不是「有一个消失就全清」，避免一个误删标签清掉整个组合。
- 全部消失时自然回到分类浏览。

### 7.5 `TagOverviewDialog.vue`

```js
props: {
  show: Boolean,
  tags: Array,                 // [{ name, count }]
  activeTags: Array,           // 规范写法
  bookmarkCount: Number,
  matchCount: Number
}
emits: ['close', 'toggle']

const isActive = (name) =>
  props.activeTags.some(tag => tag.toLowerCase() === name.toLowerCase())
```

- 标签按钮：`@click="emit('toggle', tag.name)"`，**不再 emit `select`、不再关闭**。
- 底部：

```
已选 2 个 · 当前命中 9 个书签        点标签累加筛选 · 再点取消        [完成]
```

  - `activeTags.length === 0` 时左侧显示 `共 N 个标签 · 覆盖 M 个书签`。
- `Esc` / 遮罩 / ✕ 关闭沿用 `BaseDialog`。

---

## 8. 样式规格

| 元素 | 规格 |
|------|------|
| `.tag-filter-sticky` | 普通状态不加定位，保持 v1 视觉 |
| `.tag-filter-sticky.is-pinned` | `position: sticky; top: var(--nav-bar-height, 56px); z-index: 60;` 背景 `var(--nav-glass)`，`backdrop-filter: blur(20px) saturate(1.4)`（与 `NavBar` 一致），`border-bottom: 1px solid var(--nav-border)`，`padding-bottom: 6px`，`box-shadow: 0 8px 18px -16px rgba(0, 0, 0, 0.35)` |
| `.tag-filter-bar` | 增加 `flex-wrap: wrap; row-gap: 6px;`；其余保持 `border` / 圆角 / 内边距 |
| `.tag-filter-chip` | 保持主色浅底 + `×`；允许 `max-width: 100%` 防止长标签撑破 |
| 移动端 `≤640px`（仅 `.is-pinned`） | `.category-tabs { flex-wrap: nowrap; justify-content: flex-start; overflow-x: auto; padding-right: 16px; scrollbar-width: none; }`；`::-webkit-scrollbar { display: none; }`；横向惯性滚动 `-webkit-overflow-scrolling: touch` |
| 吸顶层级 | 必须低于 `NavBar`（100）与下拉（200/300），高于卡片区（2）；取 60 |
| 拖拽隐藏导航栏 | `.drag-reordering` 只作用于 `.nav-bar`；标签视图本身禁用拖拽，两者无交叠，但吸顶 `top` 仍由 `--nav-bar-height` 决定，无需特判 |

- 颜色全部走现有 `--nav-*` 变量，不硬编码。
- `backdrop-filter` 与 `NavBar` 使用同一套参数，保证吸顶条和导航栏视觉连续。
- 暗色模式继承 `--nav-glass`（`rgba(0,0,0,0.4)`）；若实际测试文字压卡片仍可读性不足，只调整该变量的使用浓度（加一层 `background: linear-gradient(...)` 或提高 blur），不改卡片样式。

---

## 9. 边界情况

| 情况 | 处理 |
|------|------|
| 未选择任何标签 | 不渲染上下文栏，容器不吸顶，行为与 v1 一致 |
| 只选 1 个标签 | 上下文栏与 v1 相同，仅数据结构变成数组 |
| 选中标签导致 0 结果 | 上下文栏保留，空态文案说明是 AND 结果，可逐个移除 |
| 同一标签重复点击 | 第二次移除；大小写不同视为同一标签 |
| 标签名大小写不一致 | 归一化比较，展示首次出现写法 |
| 书签内重复同一标签 | `parseTags` 去重，AND 判定不受影响 |
| 点击的标签不在 `tagStats` 中 | 直接使用传入写法参与筛选 |
| 数据刷新后某标签消失 | 只移除该标签（§7.4） |
| 标签全部消失 | `activeTags` 变空，自动回分类浏览 |
| 弹窗内连续点击多个标签 | 全部保持选中，弹窗不关闭，背后结果实时更新 |
| 移动端标签很多 | 吸顶时单行横向滚动，不堆叠 |
| 页面有自定义壁纸 | 吸顶条用玻璃底 + blur，与导航栏一致 |
| 未登录 | 全部可用（公开书签数据） |
| 拖拽排序 | 标签筛选期间 `canReorder=false`，不出现把手 |
| 切换浏览器窗口宽度 | `NavBar` 的 `ResizeObserver` 更新 `--nav-bar-height`，吸顶偏移自动跟随 |

---

## 10. 验收标准

**吸顶**
- [ ] 未选标签时，滚动页面标签行随内容滚走（与 v1 一致，不占常驻空间）。
- [ ] 选中标签后向下滚动，标签行 + 上下文栏固定在导航栏下方，不遮挡卡片。
- [ ] 吸顶条背景能遮住下方卡片（浅色/暗色/自定义壁纸三种情况均可读）。
- [ ] 滚动中可直接点标签累加、点 `×` 移除、点「清除筛选」。
- [ ] 1280px 宽下标签行换行时吸顶高度自适应；375px 下吸顶为单行横向滚动。
- [ ] 导航栏高度变化（窗口缩放）后，吸顶条不重叠、不留缝。

**多标签 AND**
- [ ] 点 A 显示含 A 的书签；再点 B 只显示同时含 A 和 B 的书签。
- [ ] 再点 A 移除 A，结果回到只含 B。
- [ ] 大小写不同的同名标签被视为同一个（如 `AI` / `ai`）。
- [ ] 同一书签重复写同一标签不影响结果与计数。
- [ ] 上下文栏为每个标签显示胶囊，`×` 只移除该标签。
- [ ] 空结果显示「没有同时带「A、B」标签的书签」，且可继续操作。
- [ ] 卡片上的标签点击同样遵循累加/取消语义。

**弹窗**
- [ ] 弹窗内点击标签不关闭，可连续选多个；再次点击取消。
- [ ] 底部显示已选数量与当前命中数；`N=0` 时显示总数摘要。
- [ ] 「完成」、✕、遮罩、`Esc` 均可关闭。

**不回归**
- [ ] 点顶部菜单 / 搜索提交 / 搜索框 X / 组头跳转都会清空全部标签。
- [ ] 标签筛选期间菜单不高亮；清除后恢复原分类高亮。
- [ ] 标签视图无拖拽把手；分类浏览拖拽排序正常。
- [ ] 普通分类浏览、站内搜索、卡片详情、登录/登出均不受影响。

**测试与构建**
- [ ] `npm run test:tags` 通过（含新增用例）。
- [ ] `npm run build` 通过，无新增 Vue 编译警告。

---

## 11. 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| `clearSearch()` 的 `clear-results` 抹掉已选标签 | 高（累加失效） | 先算 `next` 再清搜索（§7.3），代码注释说明顺序不可调换 |
| 吸顶条在暗色 / 壁纸下对比度不足 | 中 | 复用 NavBar 的 glass + blur 参数；验收覆盖三种背景 |
| 移动端吸顶占用过高 | 中 | `≤640px` 强制单行横向滚动；验收 375px |
| 多标签组合容易 0 结果 | 中 | 空态文案 + 上下文栏常驻可移除；徽标暂不联动（已确认） |
| `buildTagGroups` 签名变化影响旧调用 | 低 | 兼容字符串入参；保留全部 v1 单测 |
| 弹窗实时生效让用户误以为已提交 | 低 | 底部显示已选数量与命中数，并提供「完成」 |
| `z-index` 与导航栏下拉冲突 | 低 | 吸顶条 60 < NavBar 100 < 下拉 200/300 |

---

## 12. 后续可选项（不在本次）

- 标签徽标随筛选联动（显示「加上它还能命中多少」，0 置灰）。
- Alt/Ctrl 点击「只留这一个」。
- 筛选条件写入 URL hash。
- 「最近使用的标签」「当前分类下的标签」。
- 多标签组合的记忆 / 收藏。

---

## 13. 待批准

- [ ] 用户确认本文档
- [ ] 批准后进入 `writing-plans`，产出任务拆解与实施计划
