# 设置 · 菜单 Tab 重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把设置·菜单 Tab 改成单栏、即时保存、与导航栏共用一套拖拽语义的编辑器，跨层级移动统一走可搜索的「移动到…」弹窗。

**Architecture:** 新 Tab 抽成 `src/components/settings/MenuSettings.vue` + 递归行组件 `MenuCategoryRow.vue`，直接消费 `useBookmarks` 的分类数据与写接口；拖拽复用 `useMenuReorder`（不新写状态机）；跨级移动与导航栏共用 `MoveCategoryDialog.vue`。纯逻辑（书签计数、可移动目标计算）抽到 `src/utils/` 并用 Node 内置 test runner 覆盖。

**Tech Stack:** Vue 3 `<script setup>`、Vite、Cloudflare D1 / Pages Functions、Node `--test`（无新增依赖）。

**Spec:** `docs/plans/2026-11-17-menu-tab-redesign.md`

## Global Constraints

- 拖拽只允许**同一父级**内排序；跨父级一律无效落点，必须引导到 `MoveCategoryDialog`。
- `PUT /api/categories/:id` 的 `name` 必填 —— 只改父级/描述时也要带上当前 `name`。
- 换父级且不传 `position` 时服务端追加到新父级末尾（`MAX(position)+1`），UI 必须提前说明。
- 书签数 = 本分类 + 所有后代分类的书签数（与 `NavItemView.categoryCountMap` 同口径）。
- 设置页所有分类写操作**即时保存**，不引入 pending bar / 放弃 / 确认保存。
- 删除分类保留现有「有书签先询问（保留或一并删除）」流程。
- 样式只用 nav 主题变量（`--nav-glass`、`--nav-border`、`--nav-text`、`--nav-primary` 等），不用 `--card-bg` + 2px 边框那套旧语言。
- 不新增 npm 依赖；测试用 `node --test`，脚本命名沿用 `test:*`。
- 不改 `categories` 表结构，不改 `/api/reorder` 语义。

## Review Focus

1. **移动到自身或自己的后代** —— 客户端必须置灰并给出原因，不能只靠服务端 400。测试在 Task 2（`canMoveToParent` / `buildMoveTargets`）。
2. **子树太深导致深度超 5** —— 目标父级深度 + 子树高度 > 5 时置灰；服务端此时会返回 500。测试在 Task 2（`getSubtreeHeight` + `buildMoveTargets`）。
3. **改名撞重名（409）** —— 行内输入必须回滚到旧名并展示服务端文案，不能静默吞掉。手动验证步骤在 Task 3。
4. **空分类** —— 没有书签的分类计数为 `0`，`0` 必须显示而不是隐藏或显示 `-`。测试在 Task 1。
5. **跨父级拖拽松手** —— 不得写库，必须弹提示条并给出「移动到其他分类…」入口。手动验证步骤在 Task 5 / Task 6。

---

### Task 1: 书签计数工具 + 导航栏改用

**Files:**
- Create: `src/utils/categoryCounts.js`
- Create: `tests/category-counts.test.js`
- Modify: `src/views/NavItemView.vue:245-263`
- Modify: `package.json`（scripts 增加 `test:counts`）

**Interfaces:**
- Produces: `buildCategoryBookmarkCounts(categories: Array, bookmarks: Array) => Record<number, number>` —— 键为分类 id，值为该分类及其所有后代的书签总数。
- Consumes: `buildCategoryTree` / `getDescendantIds`（`src/utils/categoryTree.js`）。

- [ ] **Step 1: 写失败测试**

`tests/category-counts.test.js`：

```js
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

test('category_id 为空的书中签被忽略', () => {
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
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test tests/category-counts.test.js`
Expected: FAIL —— `Cannot find module '../src/utils/categoryCounts.js'`

- [ ] **Step 3: 实现 `buildCategoryBookmarkCounts`**

实现要点：先按 `category_id` 统计直接书签数（`Number(category_id)`，`null`/`undefined` 跳过），再用 `buildCategoryTree(categories)` 得到的树自底向上累加（树已把“父分类不存在”的节点当根）；返回的键必须包含**所有**分类 id（包括 0 书签的）。

- [ ] **Step 4: 运行确认通过**

Run: `node --test tests/category-counts.test.js`
Expected: 5 个测试全部 PASS

- [ ] **Step 5: 接入 `package.json`**

在 `scripts` 中加：`"test:counts": "node --test tests/category-counts.test.js"`。
Run: `npm run test:counts` → PASS。

- [ ] **Step 6: `NavItemView.vue` 改用它**

把 `categoryCountMap` 的计算体（第 246-263 行）替换为：

```js
const categoryCountMap = computed(() =>
  buildCategoryBookmarkCounts(categories.value, bookmarks.value)
)
```

删除因此不再使用的局部 `directCounts` 逻辑；`buildCategoryTree` 的 import 仍需保留（`categoryFlatList` 等处还在用，构建时会报未使用则一并检查）。

- [ ] **Step 7: 构建验证**

Run: `npm run build`
Expected: 构建成功。浏览器打开导航页，菜单上的数字（部署 39 / AI 67 / 搜索引擎 5）与改动前一致。

- [ ] **Step 8: 提交**

```bash
git add src/utils/categoryCounts.js tests/category-counts.test.js package.json src/views/NavItemView.vue
git commit -m "refactor(nav): extract recursive category bookmark counts"
```

---

### Task 2: 移动目标计算工具

**Files:**
- Create: `src/utils/categoryMove.js`
- Create: `tests/category-move.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `getSubtreeHeight(categories, categoryId) => number` —— 叶子返回 `0`，每深一层 +1，找不到该分类返回 `-1`。
  - `canMoveToParent(categories, movingId, targetParentId) => { ok: boolean, reason: string }`
  - `buildMoveTargets(categories, movingId) => Array<{ id, name, displayName, depth, disabled, reason, isCurrentParent }>`
- Consumes: `buildCategoryTree`、`getCategoryPath`、`getDescendantIds`（`src/utils/categoryTree.js`）。

判定规则（按顺序，命中即返回）：

| 条件 | 结果 |
|---|---|
| `targetParentId === movingId` | `{ ok: false, reason: '不能移动到自身' }` |
| 目标是自己的后代 | `{ ok: false, reason: '不能移动到自己的子分类' }` |
| `targetParentId !== null` 且目标不存在 | `{ ok: false, reason: '目标分类不存在' }` |
| `目标depth + 1 + 子树高度 > 5` | `{ ok: false, reason: '超过最大嵌套深度（5层）' }` |
| 其余 | `{ ok: true, reason: '' }` |

`isCurrentParent` = `targetParentId === 该分类的 parent_id`；`displayName` 用树的路径（`父 / 子`）；`depth` 为分类自身深度。

- [ ] **Step 1: 写失败测试**

`tests/category-move.test.js`（同一份 3 层 + 6 层数据）：

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMoveTargets, canMoveToParent, getSubtreeHeight } from '../src/utils/categoryMove.js'

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

test('子树过高时拒绝', () => {
  assert.deepEqual(canMoveToParent(deep, 6, 1), { ok: false, reason: '超过最大嵌套深度（5层）' })
  assert.equal(canMoveToParent(deep, 7, 1).ok, true)
})

test('buildMoveTargets 标出自身/后代/当前父级', () => {
  const targets = buildMoveTargets(deep, 2)
  const byId = Object.fromEntries(targets.map(t => [t.id, t]))
  assert.equal(byId[2].disabled, true)
  assert.equal(byId[2].reason, '不能移动到自身')
  assert.equal(byId[3].disabled, true)
  assert.equal(byId[1].isCurrentParent, true)
  assert.equal(byId[7].disabled, false)
  assert.equal(byId[3].displayName, 'L1 / L2 / L3')
})
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test tests/category-move.test.js`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 实现三个函数**

实现要点：`getSubtreeHeight` 用 `buildCategoryTree(categories).map` 递归；`buildMoveTargets` 用 `buildCategoryTree(categories).flatList`（已含 `displayName` 与路径顺序），逐项调用 `canMoveToParent`，`depth` 取分类自身的 `depth` 字段（缺失时按 `flatList` 深度推导）。

- [ ] **Step 4: 运行确认通过**

Run: `node --test tests/category-move.test.js`
Expected: 5 个测试 PASS。

- [ ] **Step 5: 加 script 并验证**

`package.json` 增加 `"test:move": "node --test tests/category-move.test.js"`；`npm run test:move` → PASS。

- [ ] **Step 6: 提交**

```bash
git add src/utils/categoryMove.js tests/category-move.test.js package.json
git commit -m "feat(nav): add category move target rules"
```

---

### Task 3: 新菜单 Tab —— 列表、搜索、行内改名与描述

**Files:**
- Create: `src/components/settings/MenuCategoryRow.vue`
- Create: `src/components/settings/MenuSettings.vue`
- Modify: `src/components/NavSettingsModal.vue`（菜单 Tab 模板 596-692 行替换为 `<MenuSettings />`；移除 `MenuTreeNode` import；删除菜单 Tab 的 pending/保存确认相关模板与逻辑，见 Task 7）

**Interfaces:**
- `MenuCategoryRow.vue`
  - Props：`node`（含 `children`）、`depth: Number`、`expandedIds: Array`、`counts: Object`、`editing: Object|null`（`{ id, field }`，`field ∈ 'name'|'description'`）、`reorder: Object|null`（Task 5 用，先传 `null`）。
  - Emits：`toggle(id)`、`start-edit({ id, field })`、`save-edit({ id, field, value })`、`cancel-edit()`、`action({ action, node })`（`action ∈ 'rename'|'description'|'create-child'|'move'|'delete'`）。
- `MenuSettings.vue`
  - Props：无。Emits：无。
  - Consumes：`useBookmarks()` 的 `categories / bookmarks / addCategory / updateCategory / deleteCategory / reorderItems / fetchData`；`useAuth().isAuthenticated`；`useToast()`。
  - Produces（供 Task 4/5 在同一文件内扩展的本地函数，签名固定）：
    - `handleSaveEdit({ id, field, value }) => Promise<void>`
    - `handleConfirmCreate({ name, parentId }) => Promise<void>`
    - `handleDeleteCategory(node) => Promise<void>`

- [ ] **Step 1: 建 `MenuCategoryRow.vue` 展示骨架**

要求：
- 根元素 `.menu-row`，`tabindex="0"`，`role="treeitem"`，`data-category-id`。
- 内容顺序：拖拽把手（`opacity:0`，`:hover`/`:focus-visible` 显示，`@media (hover:none)` 隐藏）→ 展开三角（仅有子分类）→ 名称 →（有描述时）第二行灰字 → `书签数`（`counts[node.id] ?? 0`）→（有子分类时）`{{ node.children.length }}子` → `⋯` 按钮。
- 展开三角点击 `emit('toggle', node.id)`；行点击有子分类时也 `emit('toggle', node.id)`，叶子行点击无操作。
- `⋯` 按钮点击打开行内小菜单（`Teleport` 到 body + `position: fixed`，复用现有 `.select-dropdown-fixed` 风格），菜单项：重命名 / 编辑描述 / 新建子分类 / 移动到… / 删除（此项 `color: var(--error)`）。点击项 emit `action`。
- `editingId === node.id && editingField === 'name'` 时，名称位置渲染 `<input class="row-name-input">`，`v-model` 本地副本，`@keyup.enter` emit `save-edit`、`@keyup.esc` emit `cancel-edit`、`@blur` emit `save-edit`（值未变或为空时不 emit）。`nextTick` 聚焦并全选。
- 描述字段同理，渲染在名称下方，`maxlength="50"`，带 `n/50` 计数。
- 递归渲染子级：`v-for` 子节点 → `<MenuCategoryRow v-bind="..." :depth="depth+1" @...>`（事件全部透传，含 Task 5 的拖拽事件）。
- 键盘：`@keydown.enter.space.prevent` → 有子分类时 `emit('toggle', node.id)`。
- 样式：行高 36px（有描述 52px），`padding-left: calc(12px + depth * 18px)`，hover `background: var(--nav-bg-hover)`，圆角 8px；插入条/禁止态样式留给 Task 5。

- [ ] **Step 2: 建 `MenuSettings.vue` 列表与搜索**

要求：
- `const { tree, flatList, map } = computed(() => buildCategoryTree(categories.value))`（拆成三个 computed）。
- `expandedIds = ref(new Set())`：默认展开深度 0 与 1 的分类（`flatList` 里 `depth <= 1`）；提供 `expandAll()` / `collapseAll()`。
- `searchQuery = ref('')`，用 `@/utils/helpers` 的 `debounce`（150ms）更新 `searchActive`；`filteredTree` = 命中名称或路径的节点 + 其祖先链；搜索态强制展开祖先；空结果显示 `没有匹配「关键词」的分类`。
- 工具条（`position: sticky; top: 0`）：搜索输入（带清除按钮）、`＋ 新分类`（打开 `CategoryCreateDialog`，`defaultParentId = null`）、`展开全部` / `收起全部`。
- 列表容器：`flex: 1; min-height: 0; overflow-y: auto;`，外层是单个滚动容器（不要给列表再套 `max-height`）。
- `counts = computed(() => buildCategoryBookmarkCounts(categories.value, bookmarks.value))`。
- 空态：`categories.length === 0` 时显示「还没有分类，点「＋ 新分类」开始」。
- 不再显示「第 x / 共 n 项」这类位置字段：顺序由列表本身和拖拽表达。
- `handleConfirmCreate({ name, parentId })`：`await addCategory(name, parentId)`，失败 `toastError(result.error)` 并保持弹窗打开，成功关闭弹窗 + `toastSuccess('已创建分类')`（`addCategory` 内部已刷新）。

- [ ] **Step 3: 行内改名 / 描述即时保存**

`handleSaveEdit`：
1. 找到分类；`value.trim()` 为空或与当前值相同 → 直接 `editing = null`，不发请求。
2. 保存旧值快照，乐观写本地 `categories` 中该项（`name` 或 `description`）。
3. `await updateCategory(id, nextName, undefined, undefined, nextDescription)` —— 注意：`updateCategory(id, name, parentId, isPrivate, description)`，改描述时必须把**当前 name** 传第一位。
4. 失败：把本地值回滚为旧值，`toastError(result.error || '保存失败')`；成功 `toastSuccess(field === 'name' ? '已重命名' : '已更新描述')`。
5. 无论成败 `editing = null`。

`⋯` 菜单里的 `重命名` / `编辑描述` 走同一套：`action === 'rename'` → `editing = { id, field: 'name' }`；`action === 'description'` → `editing = { id, field: 'description' }`。同一时刻只允许一行处于编辑态。

- [ ] **Step 4: 换进 `NavSettingsModal.vue`**

把 `<div v-show="activeTab === 'menu'" ...>` 整块（596-692 行）替换为：

```vue
<div v-show="activeTab === 'menu'" class="tab-panel menu-tab">
  <MenuSettings />
</div>
```

import `MenuSettings`；删除 `MenuTreeNode` import；`.menu-tab { padding: 0 !important }` 保留，其余 `.menu-editor-grid` 相关样式留到 Task 7 一起清。

- [ ] **Step 5: 构建 + 浏览器验证**

Run: `npm run build`
Expected: 成功。
浏览器（`npm run dev -- --port 3001` 已在跑）：设置 → 菜单
- 列表只占一个滚动容器，能一直滚到最后一个分类，底部不再被切掉；工具条吸顶。
- 展开/收起、搜索、展开全部正常。
- 双击名称 → 输入框；`Enter` 保存出现 toast；刷新后仍是新名字。
- 改成已存在的同级分类名 → 出现 409 文案，行内恢复旧名。
- 描述：编辑后刷新仍在；导航栏悬浮该分类时能看到描述。

- [ ] **Step 6: 提交**

```bash
git add src/components/settings/MenuCategoryRow.vue src/components/settings/MenuSettings.vue src/components/NavSettingsModal.vue
git commit -m "feat(settings): rebuild menu tab as single-column tree with inline editing"
```

---

### Task 4: 共享「移动到…」弹窗 + 新建子分类 + 删除

**Files:**
- Create: `src/components/MoveCategoryDialog.vue`
- Modify: `src/components/settings/MenuSettings.vue`
- Modify: `src/components/settings/MenuCategoryRow.vue`（`⋯` 菜单项接上 action）

**Interfaces:**
- `MoveCategoryDialog.vue`
  - Props：`show: Boolean`、`category: Object|null`、`categories: Array`、`saving: Boolean`。
  - Emits：`close`、`confirm({ parentId })`（`parentId` 为 `null` 表示根分类）。
  - Consumes：`buildMoveTargets(categories, category.id)`。
- `MenuSettings.vue` 新增：`openMoveDialog(node)`、`handleMoveConfirm({ parentId })`。

- [ ] **Step 1: 实现弹窗**

`BaseDialog`（`max-width="480px"`）内：
- 标题 `移动「{category.name}」到…`（`category` 为空时 `移动到…`）。
- 搜索框（按 `displayName` 过滤）。
- 选项列表：首项「作为根分类」（选中值 `parentId = null`；若当前就是根则标注 `当前位置`），随后 `buildMoveTargets` 结果；`disabled` 项置灰且 `title=reason`，不可点击；`isCurrentParent` 项右侧标注 `当前位置`。
- 底部左侧：`当前：{{ 当前完整路径 || '根分类' }}`；右侧：`取消` / `移动`（未变更或 `saving` 时禁用）。
- 打开时重置搜索并把当前父级作为初始选中。
- 说明文案：`换父级后分类会追加到目标分类末尾`。

- [ ] **Step 2: 接上 `⋯` 菜单三个动作**

`MenuSettings` 中：
- `action === 'create-child'` → 打开 `CategoryCreateDialog`，`defaultParentId = node.id`，`categories = flatList`。
- `action === 'move'` → `openMoveDialog(node)`。
- `action === 'delete'` → `handleDeleteCategory(node)`：

```js
// 沿用现有流程：先问用户，再调 deleteCategory
const confirmed = await confirmDialog.value.open(`确定要删除"${node.name}"吗？\n删除后其子分类也会一并删除。`, '确认删除')
if (!confirmed) return
const result = await deleteCategory(node.id)
if (result.needsDecision) {
  const cascade = await confirmDialog.value.open(`分类"${node.name}"下有 ${result.bookmarkCount} 个书签，如何处理？\n选择「确定」将一并删除书签。`, '分类内含书签')
  const cascadeResult = await deleteCategory(node.id, { cascade: cascade ? 'true' : 'false' })
  // 失败时 toastError；成功按是否删除书签给不同文案（与现有 NavSettingsModal 行为一致）
}
```

- `handleMoveConfirm`：`await updateCategory(id, node.name, parentId)`（`name` 必带）；成功 `toastSuccess('已移动到「X」下')` 并关闭弹窗，失败保留弹窗 + `toastError`。
- 弹窗挂载：`<MoveCategoryDialog :show="moveDialog.show" :category="moveDialog.category" :categories="categories" :saving="moveSaving" @close="..." @confirm="handleMoveConfirm" />`，同时放一个 `<ConfirmDialog ref="confirmDialog" />`。

- [ ] **Step 3: 构建 + 浏览器验证**

Run: `npm run build`
浏览器验证：
- `⋯ → 新建子分类` 打开弹窗且父分类已预填；创建后列表出现新分类。
- `⋯ → 移动到…`：自身与后代置灰并显示原因；选当前父级时「移动」禁用；移到另一个分类后列表位置更新，导航栏下拉里也出现。
- `⋯ → 删除`：无书签分类直接确认删除；有书签分类出现第二步询问。

- [ ] **Step 4: 提交**

```bash
git add src/components/MoveCategoryDialog.vue src/components/settings/MenuSettings.vue src/components/settings/MenuCategoryRow.vue
git commit -m "feat(settings): add shared move dialog, child create and delete to menu tab"
```

---

### Task 5: 菜单 Tab 拖拽（同级）+ 跨级提示条

**Files:**
- Modify: `src/composables/useMenuReorder.js`（`state.draggingName`；`onInvalidDrop({ id, name })`）
- Modify: `src/components/settings/MenuCategoryRow.vue`（拖拽事件 + 插入条/禁止态样式）
- Modify: `src/components/settings/MenuSettings.vue`（实例化 `useMenuReorder`、`handleReorder`、提示条）

**Interfaces:**
- `useMenuReorder` 产出新增：`state.draggingName: string|null`；`onInvalidDrop` 回调收到 `{ id, name }`。
- `MenuSettings` 新增 `handleMenuReorder({ parentId, ids }) => Promise<void>`。

- [ ] **Step 1: 扩展 `useMenuReorder`**

在 `beginDrag` 里记 `state.draggingName = item.name`、`endDrag` 里清空；`dropItem` 的无效分支改为 `onInvalidDrop?.({ id: state.draggingId, name: state.draggingName })`（在 `endDrag()` 之前取）。其余行为不变。

- [ ] **Step 2: 行组件接拖拽**

照 `src/components/NavMenuItem.vue:209-244` 的写法接：`beginDrag(event, node, parentId)`、`hoverItem(node, parentId, resolveDropPosition(event, currentTarget, 'vertical'), 'vertical')`、`clearTarget()`、`dropItem(...)`、`endDrag()`；`rowState` 映射 class：`is-dragging` / `drop-before` / `drop-after` / `drop-forbidden`。
- 插入条：`drop-before` 用 `box-shadow: inset 0 2px 0 var(--nav-primary)`，`drop-after` 用 `inset 0 -2px 0`，外加 `::after` 胶囊显示「插入上方/下方」（`dropCue` 非空时）。
- `drop-forbidden`：`outline: 1.5px dashed var(--error)`。
- 触屏（`@media (hover:none)`）隐藏把手，并让 `draggable="false"`。

- [ ] **Step 3: `MenuSettings` 实例化状态机**

```js
const reorder = useMenuReorder({
  menus: () => tree.value,
  canReorder: () => isAuthenticated.value,
  onReorder: ({ parentId, ids }) => handleMenuReorder({ parentId, ids }),
  onInvalidDrop: ({ id, name }) => showMoveHint({ id, name })
})
```

`handleMenuReorder`：对 `ids` 中的每个 id 在新组内写 `position = index + 1`（乐观），`await reorderItems('categories', ids.map((id, i) => ({ id, position: i + 1 })))`；失败按快照回滚并 `toastError('排序失败')`。

`showMoveHint`：底部浮条 `只能在同一层级内排序` + 按钮 `移动到其他分类…`，点击用 `map.value[id]` 打开 `MoveCategoryDialog`；8 秒后自动消失，可手动关闭（`Teleport to="body"`，`z-index` 低于 `BaseDialog`）。

- [ ] **Step 4: 构建 + 浏览器验证**

Run: `npm run build`
- 同级拖拽：出现 2px 插入条 + 胶囊；松手后顺序保持（刷新后仍在）。
- 跨父级拖拽：目标行红色虚线；松手不写库（刷新后顺序不变），底部出现提示条；点按钮打开移动弹窗且预选该分类。
- 触屏模拟（`emulate viewport` + `touch`）：无把手、无法拖。

- [ ] **Step 5: 提交**

```bash
git add src/composables/useMenuReorder.js src/components/settings/MenuCategoryRow.vue src/components/settings/MenuSettings.vue
git commit -m "feat(settings): same-level drag reorder with move-category escape hatch"
```

---

### Task 6: 导航栏跨级拒绝 → 可点入口

**Files:**
- Modify: `src/components/NavBar.vue:252`
- Modify: `src/views/NavItemView.vue`

**Interfaces:**
- `NavBar` 新增 emit：`move-category`（payload：分类对象 `{ id, name, ... }`）。
- `NavItemView` 新增：`moveDialog` 状态、`openMoveDialog(category)`、`handleMoveConfirm({ parentId })`。
- Consumes：`MoveCategoryDialog`（Task 4）。

- [ ] **Step 1: `NavBar` 换成浮条**

把 `onInvalidDrop: () => warningToast('只能在同一层级内排序')` 改为：记录 `{ id, name }` 到本地 ref `invalidDrop`，渲染底部浮条（`Teleport to="body"`）：
`只能在同一层级内排序` · 按钮 `移动到其他分类…`（点击 `emit('move-category', 对应菜单对象)` 并关闭浮条）· 关闭按钮。
浮条 8 秒自动消失；`useMenuReorder.hintText` 文案改成 `只能在同一层级内排序`（去掉“跨层级请到设置→菜单”这句，改由按钮承担）。

- [ ] **Step 2: `NavItemView` 承载弹窗**

- 从 `useBookmarks()` 解构中补 `updateCategory`。
- 模板中 `<NavBar ... @move-category="openMoveDialog" />`。
- 新增 `MoveCategoryDialog` 与 `ConfirmDialog` 实例（`ConfirmDialog` 已有则忽略）。
- `handleMoveConfirm({ parentId })`：`await updateCategory(category.id, category.name, parentId)`；成功 `toastSuccess('已移动到「X」下')` 并关闭，失败 `toastError` 保留弹窗。
- 移动成功后无需手动刷新：`updateCategory` 内部已 `fetchData({ forceRefresh: true })`。

- [ ] **Step 3: 构建 + 浏览器验证**

Run: `npm run build`
- 导航栏把「工具」拖到「AI」上 → 出现红色禁止态；松手出现底部浮条；点「移动到其他分类…」→ 弹窗预选「工具」。
- 选一个合法父级 → 移动 → 导航栏下拉里立即出现；设置 → 菜单里位置一致。
- 同一层级拖拽不受影响。

- [ ] **Step 4: 提交**

```bash
git add src/components/NavBar.vue src/views/NavItemView.vue
git commit -m "feat(nav): offer move-category dialog when cross-level drop is refused"
```

---

### Task 7: 清理旧实现、文档同步、整体验收

**Files:**
- Delete: `src/components/MenuTreeNode.vue`
- Delete: `src/composables/useCategoryEditor.js`
- Modify: `src/components/NavSettingsModal.vue`（移除 pending bar、保存确认弹窗、`useCategoryEditor` 解构、菜单 Tab 旧 CSS）
- Modify: `AGENTS.md`

- [ ] **Step 1: 确认无引用**

Run: `rg -n "MenuTreeNode|useCategoryEditor" src/`
Expected: 只剩 `NavSettingsModal.vue` 中的残留引用（将被删除）；若其他文件仍引用，停手并回报。

- [ ] **Step 2: 删除残留**

- 删 `MenuTreeNode.vue`、`useCategoryEditor.js`。
- `NavSettingsModal.vue`：删 `useCategoryEditor` import 与解构、`MenuTreeNode` import、pending-bar 模板（1284-1296）、保存确认弹窗（1360-1377）、以及只服务于它们的 refs/函数与 CSS（`.menu-editor-grid`、`.menu-left-panel`、`.menu-right-panel`、`.panel-section-header`、`.detail-form-menu`、`.pending-bar`、`.change-list` 等）。
- 静态检查：`rg -n "pendingChanges|showSaveDialog|dragHintText|MenuTreeNode" src/components/NavSettingsModal.vue` 应无输出。

- [ ] **Step 3: 构建**

Run: `npm run build`
Expected: 成功；`rg -n "useCategoryEditor" src/` 无输出。

- [ ] **Step 4: 更新 `AGENTS.md`**

- 「NavSettingsModal 设置弹窗 UI 设计 → 菜单 Tab」改为新结构（单栏、行内编辑、`⋯` 菜单、即时保存、共享移动弹窗）。
- 「导航站菜单拖拽排序」补充：跨级拒绝 = 浮条 + 「移动到其他分类…」入口；设置页与导航栏共用 `MoveCategoryDialog`。
- 「测试」一节补 `npm run test:counts`、`npm run test:move`。

- [ ] **Step 5: 全量手动验收（对照 spec §9）**

- [ ] 1280×609 下菜单 Tab 只有一层滚动，卡片不被裁切。
- [ ] 52 个分类能滚到底部，工具条吸顶。
- [ ] 改名 `Enter` / `Esc` / 失焦三种路径；重名报错并保留原值。
- [ ] 同级拖拽插入条 + 胶囊；跨级红色禁止 + 浮条；松手不写库。
- [ ] 导航栏浮条 → 弹窗 → 移动成功，两处视图一致。
- [ ] 设置行与导航栏对同一分类显示相同书签数。
- [ ] 无 pending bar / 放弃 / 查看详情；删除仍有确认。
- [ ] `Tab` 可进到行与 `⋯`，`Enter/Space` 展开收起。
- [ ] `npm run test:counts`、`npm run test:move`、`npm run build` 全绿。

- [ ] **Step 6: 提交**

```bash
git add src/components/NavSettingsModal.vue AGENTS.md package.json
git add -u src/components/MenuTreeNode.vue src/composables/useCategoryEditor.js
git commit -m "refactor(settings): remove legacy category editor, sync docs"
```
