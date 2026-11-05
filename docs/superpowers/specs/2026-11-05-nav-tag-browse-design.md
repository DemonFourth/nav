# nav 模式标签浏览设计文档

**日期**: 2026-11-05
**状态**: 待批准
**范围**: nav 模式（`displayMode === 'nav-item'`）的标签展示与标签结果页
**前置文档**: `docs/superpowers/specs/2026-09-08-tag-management-design.md`（设置内的标签管理，本文不改动它）

---

## 1. 背景与问题

nav 模式当前只有一个标签入口：搜索框下方一排胶囊（`NavItemView.vue` 的 `.category-tabs`），取全站标签按数量排序的前 10 个。

现状实现（已核对代码）：

| 位置 | 现状 |
|------|------|
| `NavItemView.vue:185-197` | `topTags` 每次渲染遍历全部书签统计数量，只取前 10 |
| `NavItemView.vue:199-201` | `getTagCount(tag)` 对每个标签再全量扫一遍书签（O(标签数 × 书签数)） |
| `NavItemView.vue:203-211` | 点标签调用 `NavSearch.openSearchWithTags([tag])` |
| `NavSearch.vue:129-136` | 把标签名**写进搜索框**，再 emit `search-results` |
| `NavSearch.vue:196-214` | 标签分支对全站书签做「包含该标签」过滤，结果与分类上下文无关 |
| `NavItemView.vue:130,232-246` | `selectedFilterTag` 只被置空、从未赋值；`currentBookmarks` 里的标签过滤与 `canReorder` 判断均为死代码 |

由此产生的具体问题：

1. **看不到全部标签**。第 11 个之后的标签在主界面没有入口，只能进设置 → 标签。
2. **点标签会污染搜索框**。输入框出现 `AI`，搜索引擎仍是 Google；用户再按回车会去 Google 搜 “AI”。
3. **不知道书签来自哪个分类**。结果是全站扁平卡片流，原本高亮的分类菜单还停留在旧分类上。
4. **胶囊永远不亮**。`selectedFilterTag` 从未被赋值，选中态是死代码。
5. **大小写不一致**。搜索匹配不区分大小写，标签过滤区分，同一个标签可能表现不同。

目标是把「按标签查书签」做成 nav 模式内的一等浏览路径：看得到全部标签、点一下就能查、结果按分类路径分组、不改变现有导航与卡片布局。

---

## 2. 目标 / 非目标

### 2.1 目标

- 主界面标签行末尾提供「全部标签」入口，展示**全部标签**及其书签数量。
- 「全部标签」支持**搜索**与**排序**（数量 / 名称）。
- 点击任意标签（标签行 / 全部标签弹窗 / 卡片上的标签）进入**标签结果视图**。
- 结果视图按**分类路径分组**，组头显示 `父路径 / 当前分类` 与数量，组内显示书签卡片。
- 保持 nav 模式现有排布：导航栏、搜索框、标签行、卡片网格位置不变；`NavCard` 内部结构零改动。
- 标签结果视图**不启用拖拽排序**。

### 2.2 非目标（本次不做）

- 不做 URL / hash 持久化（刷新后不保留标签筛选）。
- 不做多标签 AND / OR 组合筛选。
- 不在标签视图里重命名 / 删除标签（仍走设置 → 标签）。
- 不新增后端接口、不改数据库结构、不改 `functions/`。
- 不改浏览器扩展。
- 不做「紧凑胶囊卡」密度或密度切换（见 §4 方案 B，已放弃）。
- 不改造设置页 `TagManagement.vue` 的交互。

### 2.3 反目标（做了就算失败）

- 卡片内部多出一行路径导致卡片变高、描述被挤掉。
- 标签行 / 结果页改动导致分类浏览、搜索、拖拽排序任一功能回归。
- 为了展示标签而引入新的全局状态库或路由。
- 让访客（未登录）看不到标签行或全部标签弹窗。

---

## 3. 已确认决策

| # | 决策 | 结论 |
|---|------|------|
| 1 | 标签行范围 | **全站最热 10 个**（保持现状语义），末尾追加「全部标签」 |
| 2 | 全部标签形态 | **居中弹窗**（复用 `BaseDialog`），不是独立页面、不是抽屉 |
| 3 | 结果页布局 | **按分类分组，组头放路径**；卡片沿用现有 `NavCard` |
| 4 | 分组之间顺序 | **菜单顺序**（`buildCategoryTree().flatList` 的深度优先 + `position`） |
| 5 | 组内顺序 | 书签 `position` 升序，同名/空值用名称兜底 |
| 6 | 结果页拖拽 | **关闭**，理由见 §7.3 |
| 7 | 路径展示位置 | 只在组头，不在卡片内部 |
| 8 | 数据来源 | 前端内存中的 `bookmarks` 单次遍历，不调 `/api/tags`（该接口需登录） |

---

## 4. 方案对比

### 方案 A：分组头 + 现有卡片（**采用**）

结果区按分类分组，组头 `学习资源 / 前端开发  6`，下面沿用 `NavCard` 网格。

- 优点：`NavCard` 零改动；描述、标签、URL 全部保留；与分类浏览视觉一致；改动集中在 `NavCardGrid` 的渲染分支。
- 代价：一屏可见条目数少于紧凑卡；路径重复出现在每个组头（但组头数量远少于卡片数量）。

### 方案 B：卡片内加路径徽章（放弃）

每张卡片底部加一行蓝色路径。用户明确反馈这会改变卡片内部布局，且路径重复、卡片变高。仅作为对比保留。

### 方案 C：左侧标签导航 / 独立标签页（放弃）

左侧常驻标签栏或整页标签总览。会改变 nav 的三段式布局或新增页面状态，用户明确不想动 nav 结构。全部标签的“发现性”改用弹窗解决。

### 「全部标签」形态：弹窗（采用）/ 独立页 / 抽屉

- 弹窗：与现有 `BaseDialog`、`NavSettingsModal` 风格一致；标签多时靠搜索 + 滚动，足够；关闭后立即看到筛选结果。**采用**。
- 独立页：需要新增一层“当前在标签总览”的页面状态，且与搜索/分类状态的互斥关系更复杂。
- 抽屉：实现成本高于弹窗，收益不明显。

---

## 5. 交互设计

### 5.1 标签行

```
[ Skills 23 ] [ AI 21 ] [ Cloudflare 20 ] ... [ 全部标签 63 › ]
```

- 前 10 个：全站按 `count` 降序，`count` 相同按名称升序（`localeCompare('zh')`）。
- 选中标签：实心主色胶囊（复用 `.cat-tab.active`）。
- 「全部标签」：虚线边框的独立样式（`.tag-all`），显示去重后的标签总数，点击打开弹窗。
- 标签行始终渲染（即使没有标签则不渲染整行；有标签但不足 10 个时只显示实际数量 + 全部入口）。
- 未登录可见（数据来自公开的 `bookmarks`）。

### 5.2 全部标签弹窗（`TagOverviewDialog.vue`）

```
┌────────────────────────────── 全部标签 63 ── ✕ ┐
│ [ 搜索标签… ]            [数量 ↓] [名称]        │
│  Skills 23   AI 21      Cloudflare 20          │
│  Free 16     构建节点 10  VPN 7                 │
│  …（可滚动）                                     │
├─────────────────────────────────────────────────┤
│ 共 63 个标签 · 覆盖 128 个书签      点标签直接筛选 → │
└─────────────────────────────────────────────────┘
```

- 基础组件：`BaseDialog`（`maxWidth="640px"`，header 由 BaseDialog 提供）。
- 搜索：不区分大小写，匹配标签名子串；输入即过滤。
- 排序：
  - 数量：`count` 降序，相同按名称升序（默认）；
  - 名称：`localeCompare('zh')` 升序。
- 列表：桌面 3 列、移动端 2 列的紧凑行；每行 `名称 … 数量`。
- 当前选中标签高亮。
- 点击标签：emit `select(name)` → 父组件设置 `activeTag` 并关闭弹窗。
- 底部摘要：`共 N 个标签 · 覆盖 M 个书签`（M 为**带至少一个标签的书签数**，不是计数之和）。
- 空结果：`没有匹配的标签`。
- 关闭：右上角 ✕、点击遮罩（BaseDialog 已实现）。

### 5.3 标签结果视图

```
[ 标签行（选中项实心） … 全部标签 ]
┌ AI 21 × ─ 21 个书签 · 来自 6 个分类 ────────── 清除筛选 ┐
搜索引擎 1
  [ 秘塔AI搜索卡片 ]
AI / AI 对话 2
  [ ChatGPT ] [ Claude ]
学习资源 / 前端开发 6
  [ MDN ] [ React ] [ Vue ]
…
```

- 上下文栏 `.tag-filter-bar`：标签胶囊（含数量、× 按钮）、`N 个书签 · 来自 M 个分类`、右侧「清除筛选」。
  - M 只统计真实分类组，不含「未分类」。
- 组头 `.card-group-header`：
  - 父路径灰色（`#9aa1ad` 级别，用现有 `--nav-text-secondary` / `--nav-text-tertiary` 变量），当前分类名加粗（`--nav-text`）；
  - 数量使用现有计数胶囊样式；
  - 整行可点击（除「未分类」组），点击跳到该分类：清空标签、设置 `activeMenu` / `activeSubMenu`、滚动到顶部。
  - 分隔符统一用 ` / `（与 `flatList.displayName` 一致）。
- 组内：现有 `NavCard` 网格，列数与分类浏览一致（`repeat(auto-fill, minmax(160px, 300px))`）。
- 顶部菜单在标签结果期间**不高亮**任何分类（原分类状态保留，仅关闭高亮，见 §5.4）。
- 卡片交互不变：点卡片打开 URL、点卡片标签进入该标签结果、登录后可点详情。
- 「未分类」组固定在最后；组头不可点击。
- 空结果（标签在数据刷新后消失）：自动清空 `activeTag`，回到分类浏览，不弹 toast。

### 5.4 状态互斥

| 用户动作 | `searchResults` | `activeTag` | 说明 |
|----------|-----------------|-------------|------|
| 点标签（行 / 弹窗 / 卡片） | 清空 | 设为该标签 | 同时清空搜索框文本（不写入标签名） |
| 站内搜索提交 | 设为结果 | 清空 | 标签筛选让位于搜索 |
| 点顶部菜单 / 子菜单 | 清空 | 清空 | 回到分类浏览 |
| 点搜索框 X | 清空 | 清空 | 回到分类浏览 |
| 点「清除筛选」/ 上下文 × | 不变 | 清空 | 回到分类浏览 |

**结果视图期间的导航高亮**：保留 `activeMenu` / `activeSubMenu` 作为「清除筛选后回到哪」的记忆，但传给 `NavBar` 时置空（`active-menu = null`、`active-sub-menu = null`、`active-path = []`），避免“看着全站标签结果、菜单却高亮旧分类”的错位。清除筛选后三个值自动恢复，分类高亮回来。`NavBar.vue` / `NavMenuItem.vue` **无需改动**（`activeMenu` 只参与 `active` class 与子菜单 `active-id`，传 `null` 即可关闭高亮）。

### 5.5 搜索框改动

- 删除 `NavSearch.vue` 的 `openSearchWithTags` 暴露方法与 `searchInSite(tags)` 的标签分支（实现后无调用方）。
- 搜索框只负责搜索引擎与站内文本搜索，不再承载标签语义。
- 点标签时如需清空搜索框，调用 `navSearchRef.clearSearch()`（会 emit `clear-results`），不直接改 `searchQuery`。

---

## 6. 数据与计算

全部在前端完成，`bookmarks` 与 `categories` 已由 `useBookmarks.fetchData()` 加载；不改 API。

### 6.1 标签解析

```js
// 去重，避免同一本书签写两次相同标签导致重复计数
function parseTags(raw) {
  if (!raw) return []
  return [...new Set(raw.split(',').map(t => t.trim()).filter(Boolean))]
}
```

### 6.2 标签统计（单次遍历）

```js
// key = 小写标签名；value = { name: 首次出现的大小写, count }
const tagStats = computed(() => {
  const map = new Map()
  for (const b of bookmarks.value) {
    for (const tag of parseTags(b.tags)) {
      const key = tag.toLowerCase()
      const hit = map.get(key)
      if (hit) hit.count++
      else map.set(key, { name: tag, count: 1 })
    }
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh')
  )
})
```

- **大小写**：聚合与匹配均忽略大小写，展示首次出现的写法；解决现有「搜索不区分、过滤区分」的不一致。
  - 已知差异：设置页 `TagManagement` 仍按原大小写分组。若数据里同时存在 `AI` 与 `ai`，本页会合并显示，设置页仍是两行。本次不统一，记录在 §12。
- **计数口径**：同一书签内重复标签只算一次。

### 6.3 前 10 与数量查询

```js
const topTags = computed(() => tagStats.value.slice(0, 10))
const tagCountMap = computed(() => new Map(tagStats.value.map(t => [t.name.toLowerCase(), t.count])))
const getTagCount = (name) => tagCountMap.value.get(name.toLowerCase()) ?? 0
```

删除现有按标签全量扫描的 `getTagCount`。`allTags`（`useBookmarks` 的字母序集合）继续给编辑弹窗做建议，不参与本页统计。

### 6.4 分组

```js
const tagGroups = computed(() => {
  if (!activeTag.value) return null
  const norm = activeTag.value.toLowerCase()
  const matched = bookmarks.value.filter(b =>
    parseTags(b.tags).some(t => t.toLowerCase() === norm)
  )
  const { map, flatList } = buildCategoryTree(categories.value)
  const order = new Map(flatList.map((c, i) => [c.id, i]))
  const buckets = new Map()

  for (const b of matched) {
    const key = b.category_id != null && map[b.category_id] ? b.category_id : 'none'
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(b)
  }

  return [...buckets.entries()]
    .map(([key, items]) => {
      const isNone = key === 'none'
      const category = isNone ? null : map[key]
      const path = category ? getCategoryPath(category.id, map).map(c => c.name) : []
      return {
        key,
        categoryId: isNone ? null : category.id,
        path,
        leaf: isNone ? '未分类' : category.name,
        parentText: path.slice(0, -1).join(' / '),
        bookmarks: items.sort(
          (a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER)
            || String(a.name).localeCompare(String(b.name), 'zh')
        )
      }
    })
    .sort((a, b) => {
      if (a.categoryId === null) return 1
      if (b.categoryId === null) return -1
      return order.get(a.categoryId) - order.get(b.categoryId)
    })
})
```

- 分组键用**书签自己的 `category_id`**（叶子分类），路径由 `getCategoryPath` 追溯父级。
- 分类已删除（`category_id` 找不到）→ 归入「未分类」。
- 组顺序严格跟菜单顺序；`flatList` 里找不到的脏数据放最后。

### 6.5 当前书签

- 标签激活时：`currentBookmarks = tagGroups.flatMap(g => g.bookmarks)`（组顺序）。
- 其他情况保持现有逻辑（搜索结果 / 分类 + 标签筛选死代码删除）。
- `canReorder` 增加条件 `!activeTag`。

---

## 7. 组件与文件改动

### 7.1 文件清单

| 文件 | 类型 | 改动 |
|------|------|------|
| `src/components/TagOverviewDialog.vue` | 新增 | 全部标签弹窗（搜索、排序、计数、选择） |
| `src/views/NavItemView.vue` | 修改 | 标签统计/分组 computed、标签行、上下文栏、事件处理、挂载弹窗；删除 `selectedFilterTag` |
| `src/components/NavCardGrid.vue` | 修改 | 新增 `groups` / `emptyText` props，按组渲染组头 + 卡片；平铺模式行为不变 |
| `src/components/NavSearch.vue` | 修改 | 删除 `openSearchWithTags` 与 `searchInSite` 的标签分支 |
| `src/assets/main.css` | 可能微调 | 仅当新样式需要跨组件复用；优先写在各组件 scoped 中 |

**不改**：`NavCard.vue`、`useBookmarks.js`、`useTags.js`、`functions/**`、数据库。

### 7.2 `NavItemView.vue` 结构

模板顺序保持不变：

```vue
<NavBar 
  :menus="menuTree"
  :active-menu="activeTag ? null : activeMenu"
  :active-sub-menu="activeTag ? null : activeSubMenu"
  :custom-title="customTitle"
  :reorderable="isAuthenticated"
  :active-path="activePath"
  ...
/>
<div class="search-section"><NavSearch ref="navSearchRef" ... /></div>

<div class="category-tabs" v-if="tagStats.length">
  <button v-for="tag in topTags" class="cat-tab" :class="{ active: isActiveTag(tag.name) }"
          @click="handleTagClick(tag.name)">
    {{ tag.name }} <span class="cat-count">{{ tag.count }}</span>
  </button>
  <button class="cat-tab tag-all" @click="showTagOverview = true">
    全部标签 <span class="cat-count">{{ tagStats.length }}</span> ›
  </button>
</div>

<div class="tag-filter-bar" v-if="activeTag">…</div>

<div class="content-section">
  <NavCardGrid
    :key="animationKey"
    :bookmarks="currentBookmarks"
    :groups="tagGroups"
    :empty-text="tagGroups ? `没有带“${activeTag}”标签的书签` : '该分类下暂无书签'"
    :isAuthenticated="isAuthenticated"
    :reorderable="canReorder"
    @tag-click="handleTagClick"
    @group-click="handleGroupClick"
    ...
  />
</div>

<TagOverviewDialog
  :show="showTagOverview"
  :tags="tagStats"
  :active-tag="activeTag"
  @close="showTagOverview = false"
  @select="handleTagSelectFromDialog"
/>
```

新增状态：

```js
const activeTag = ref(null)        // 保留展示用大小写
const showTagOverview = ref(false)
```

`activePath` 增加首行短路（用于关闭菜单高亮，不改变 `activeMenu` 记忆）：

```js
const activePath = computed(() => {
  if (activeTag.value) return []
  // ...原有逻辑
})
```

新增/修改处理函数：

```js
const handleTagClick = (name) => {
  activeTag.value = name
  searchResults.value = null
  navSearchRef.value?.clearSearch()   // 清空搜索框文本，不写入标签名
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

`handleSelectMenu` / `handleSelectSubMenu` / `handleSearchResults` 中补 `activeTag.value = null`。

自动失效：

```js
watch(tagStats, (list) => {
  if (!activeTag.value) return
  if (!list.some(t => t.name.toLowerCase() === activeTag.value.toLowerCase())) {
    activeTag.value = null
  }
})
```

### 7.3 `NavCardGrid.vue` 渲染

- 新 props：

```js
groups: { type: Array, default: null },     // null = 平铺模式
emptyText: { type: String, default: '该分类下暂无书签' }
```

- 内部归一化，避免复制卡片模板：

```js
const displayGroups = computed(() =>
  props.groups ?? [{ key: '__flat__', header: null, bookmarks: props.bookmarks }]
)
const totalCount = computed(() =>
  displayGroups.value.reduce((n, g) => n + g.bookmarks.length, 0)
)
```

- 渲染：

```vue
<template v-for="group in displayGroups" :key="group.key">
  <header v-if="group.header !== null" class="card-group-header" @click="$emit('group-click', group)">
    <span class="group-path">
      <span v-if="group.parentText" class="group-parent">{{ group.parentText }} / </span>
      <span class="group-leaf">{{ group.leaf }}</span>
    </span>
    <span class="group-count">{{ group.bookmarks.length }}</span>
  </header>
  <div class="cards-container">…NavCard…</div>
</template>
```

- 平铺模式：`groups = null` → 一个无 header 的组，DOM 与现在一致（保持 `.cards-container` 与动画）。
- 空状态：`totalCount === 0` → 显示 `emptyText`。
- 拖拽：组模式下 `reorderable` 必为 false；`handleGridDragOver/Drop` 已有 `if (!props.reorderable) return`，无需改动。
- 动画：`animationKey` 仍由父级控制重建；组内延迟用组内索引计算。
- 新样式（scoped）：`.card-group-header`、`.group-path`、`.group-parent`（次级色）、`.group-leaf`（主文字加粗）、`.group-count`（复用现有计数胶囊视觉，不跨组件引用类名则本地实现）。

**为什么标签视图必须关拖拽**：`POST /api/reorder` 直接把传入 id 的 `position` 写成 `0..n-1`，不带分类条件（`functions/api/reorder.js:10-17`）。标签视图是某分类的子集，重排会与未显示的其余书签撞位，回到分类视图顺序错乱。若未来要支持排序，需要按分类整组重算，不在本次范围。

### 7.4 `TagOverviewDialog.vue`

```js
props: { show: Boolean, tags: Array /* [{name,count}] */, activeTag: String|null }
emits: ['close', 'select']

const query = ref('')
const sortBy = ref('count')   // 'count' | 'name'

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = q ? props.tags.filter(t => t.name.toLowerCase().includes(q)) : [...props.tags]
  return list.sort((a, b) =>
    sortBy.value === 'name'
      ? a.name.localeCompare(b.name, 'zh')
      : b.count - a.count || a.name.localeCompare(b.name, 'zh')
  )
})

const summary = computed(() => ({
  tagCount: props.tags.length,
  bookmarkCount: /* 由父组件传入或在此按去重书签数计算 */
}))
```

- 覆盖书签数 M：优先由父组件传 `bookmarkCount`（`bookmarks.filter(b => parseTags(b.tags).length > 0).length`），避免弹窗重复解析。
- 弹窗打开时重置 `query`、保持上次排序（或每次重置为数量排序——实现时取重置，行为更可预期）。
- 样式：使用 `BaseDialog` 的非 scoped 全局变量（`--nav-bg`、`--nav-border`、`--nav-text`、`--nav-primary`），内部布局可 scoped。
- 数量徽章与标签行一致（浅底 + 次级文字）。

### 7.5 `NavSearch.vue`

- 删除 `defineExpose({ openSearchWithTags })`。
- `searchInSite(tags = null)` 改为 `searchInSite()`：仅保留文本搜索分支。
- 保留 `clearSearch()`（清空输入 + emit `clear-results`），供标签点击时调用。

---

## 8. 样式规格

沿用 nav 主题变量，不硬编码颜色。

| 元素 | 规格 |
|------|------|
| `.cat-tab` | 维持现状（`0.68rem`、圆角胶囊） |
| `.tag-all` | 虚线边框 `1px dashed color-mix(in srgb, var(--nav-primary) 35%, transparent)`，主色文字，与普通胶囊同高 |
| `.tag-filter-bar` | 与卡片同宽居中，白/玻璃底，`border: 1px solid var(--nav-border)`，圆角 8px，内边距 `6px 10px`，`margin-bottom: 10px` |
| 上下文标签胶囊 | 主色浅底 + 主色文字，`×` 按钮 16×16，`aria-label="清除标签筛选"` |
| `.card-group-header` | `display:flex; align-items:center; gap:7px; margin:16px 0 9px;` 字号 `0.78rem`；可点击时 `cursor:pointer`，hover 时主色 |
| 父路径 | `var(--nav-text-secondary)`；当前分类 `var(--nav-text)`，`font-weight:600` |
| 数量胶囊 | `var(--nav-border)` 底 + 次级文字，`0.55rem`，与现有 `.cat-count` 对齐 |
| 组间距 | 组头 `margin-top: 16px`，首组 `12px` |
| 移动端（≤778px） | 标签行 / 上下文栏左右内边距 16px；弹窗列表 2 列；组头字号不缩小 |

---

## 9. 边界情况

| 情况 | 处理 |
|------|------|
| 没有任何标签 | 不渲染标签行；分类浏览照旧 |
| 标签少于 10 个 | 只渲染实际数量 + 「全部标签 N」 |
| 标签名大小写不一致 | 聚合展示，匹配忽略大小写 |
| 同一书签重复写同一标签 | `parseTags` 去重，只计一次 |
| 书签无分类 / 分类已删除 | 归入最后「未分类」组，组头不可点 |
| 标签在当前数据中消失（他端删除） | `watch(tagStats)` 自动清空筛选 |
| 标签命中 0 本书签 | 上下文栏显示 0；结果区空状态 + 清除入口 |
| `position` 为 null / 重复 | 名称升序兜底；不改数据库 |
| 未登录访问 | 标签行、全部标签、标签结果全部可用（数据来自公开书签） |
| 登录态 token 过期 | 本功能不发请求，不受影响 |
| 标签很多（>500） | 弹窗内滚动；搜索缩小范围；暂不做虚拟滚动 |
| 一级分类与子分类同名 | 组头显示完整父路径区分，`key` 用分类 id |

---

## 10. 验收标准

**标签行**
- [ ] 显示全站数量前 10 的标签，每个带正确计数；计数与「全部标签」内一致。
- [ ] 点击胶囊后胶囊实心，搜索框文本被清空且不出现标签名。
- [ ] 「全部标签 N」中 N = 去重标签总数。
- [ ] 未登录时同样可见、可用。

**全部标签弹窗**
- [ ] 展示全部标签与计数，默认数量降序，可切换名称排序。
- [ ] 搜索实时过滤、不区分大小写；无匹配时显示空状态。
- [ ] 底部摘要为「共 N 个标签 · 覆盖 M 个书签」。
- [ ] 点击标签关闭弹窗并进入结果视图；点击 ✕ / 遮罩关闭。

**标签结果视图**
- [ ] 上下文栏显示标签名、命中数、涉及分类数、清除入口。
- [ ] 按菜单顺序分组，组头显示 `父路径 / 分类名` 与数量；未分类在最后。
- [ ] 组内顺序与对应分类浏览一致（按 `position`）。
- [ ] 点组头跳到该分类，标签筛选被清空。
- [ ] 卡片内部结构与分类浏览完全一致（无新增行、无高度变化）。
- [ ] 标签视图不出现拖拽把手；分类浏览的拖拽排序仍正常。
- [ ] 标签结果期间顶部菜单不再高亮旧分类；清除筛选后恢复原分类高亮。
- [ ] 点卡片上的标签可切换标签结果；点搜索框做站内搜索会清空标签筛选。
- [ ] 清除筛选后回到进入前的分类？——**约定**：回到当前 `activeMenu/activeSubMenu`，不记忆进入前分类。

**构建**
- [ ] `npm run build` 通过，无新增 Vue 编译警告。

---

## 11. 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| `NavCardGrid` 改为组渲染后影响分类浏览 | 高 | `groups` 默认 `null`，平铺路径保持原 DOM；验收逐项对比 |
| 分组依赖 `category_id` 与分类树 | 中 | 脏数据归「未分类」；组顺序缺失时排最后 |
| 大小写合并与设置页口径不同 | 低 | 文档记录；后续可统一 `TagManagement` |
| 标签统计每次数据刷新重算 | 低 | 单次遍历 + computed 缓存；数据量级（千级书签）可忽略 |
| 弹窗标签很多时浏览效率 | 低 | 搜索 + 数量排序；后续可加字母索引 |
| 状态互斥遗漏（搜索 / 标签 / 分类） | 中 | §5.4 矩阵作为验收用例 |

---

## 12. 后续可选项（不在本次）

- `TagManagement.vue` 改为不区分大小写聚合，与本页统一。
- 标签筛选写入 URL hash，支持刷新保持与分享。
- 「最近使用的标签」或按当前分类的标签 Tab。
- 标签结果支持按名称 / 最近添加排序。
- 紧凑胶囊卡密度（若日后仍想要）。

---

## 13. 待批准

- [ ] 用户确认本文档
- [ ] 批准后进入 `writing-plans`，产出任务拆解与实施计划
