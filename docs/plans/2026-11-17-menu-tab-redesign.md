# 设置 · 菜单 Tab 重设计（单栏 + 即时保存 + 共享「移动到…」）

> 状态：待批准（批准后才动代码）
> 日期：2026-11-17
> 相关文件：`src/components/NavSettingsModal.vue`、`src/components/MenuTreeNode.vue`、`src/composables/useCategoryEditor.js`、`src/components/NavBar.vue`、`src/components/NavMenuItem.vue`、`src/composables/useMenuReorder.js`、`functions/api/categories/[id].js`

---

## 1. 背景与实测问题

在 1280×609 的真实窗口里操作了一遍现有菜单 Tab（拖拽、弹窗、放弃，全部只走本地待保存状态，未写入 D1），确认的问题：

| 类别 | 现象 | 数据 |
|------|------|------|
| 空间 | 设置内容区只有 547px 高，菜单格 `min-height:500` + 双栏 600px → 内容区自身滚动 + 左栏内部滚动，**两层滚动套叠** | content `scrollH 672 / clientH 564`；左栏 `scrollH 2469 / clientH 599` |
| 空间 | 左栏卡片底边（圆角、滚动条末端）在可视区外 70~100px，被直接切掉 | left `bottom 771` vs content `bottom 699` |
| 空间 | 52 个分类 / 12 个根 / 3 层，左栏一屏只露 10 行 | — |
| 空间 | 右栏固定 380px，未选中时长期空白；窄屏（820px）占比 46% | — |
| 跨级 | 拖拽期间浏览器不派发 `wheel`（项目已记录），目标父分类折叠时其子项不在 DOM → 跨级拖动实际不可完成 | — |
| 一致性 | 同级排序有三套入口：↑↓ 按钮、拖拽、详情里改父级；导航栏只有拖拽 | — |
| 一致性 | 落点反馈两套：设置页细线 + 文字；导航栏 2px 插入条 + 「插入左侧/右侧」胶囊 | — |
| 数据 | 数量徽标语义不同：设置=子分类数（部署 `2`、搜索引擎 `0`），导航栏=书签数（部署 `39`、搜索引擎 `5`） | — |
| 效率 | 拖一下即变「1 项更改」，必须再走「查看详情 → 确认保存」；表单改动也挤进同一条 | — |
| 可达性 | 行是 `div + @click`，无 `role`/`tabindex` → 键盘不可达；拖拽把手 `opacity:0` 只在 hover 出现 | `rowRole null`、`handleOpacity 0` |
| 表单 | 详情里的父分类是原生 `<select>`，54 个扁平长路径选项（**注**：新增分类弹窗的父分类是可搜索的，只有详情面板是原生 select） | — |

---

## 2. 目标 / 非目标

**目标**
- 菜单 Tab 与导航栏使用**同一套拖拽语义与视觉语言**（同级排序、插入条 + 落点胶囊、跨级拒绝）。
- 跨层级移动只有一个动作：共享「移动到…」弹窗，可从导航栏被拒绝处直达。
- 单栏布局，吃满可视高度，去掉嵌套滚动与常驻空白的详情区。
- 全部操作即时保存，取消「待保存 / 放弃 / 查看详情 / 确认保存」批量流。
- 分类改名、描述、删除、新建子分类等现有能力一项不丢。
- 键盘与触屏可达。

**非目标**
- 不做导航栏内跨级拖拽（理由见 §4）。
- 不做撤销/历史（见 §8 风险）。
- 不做批量选择分类 / 批量移动。
- 不在菜单 Tab 内管理书签（书签 Tab 已有完整能力）。
- 不改变 `categories` 表结构与 `position` 排序接口。

**反目标（即使技术可行也不做）**
- 用"拖到行中段变成子分类"来承担跨级 —— 它正是当前让人疑惑的来源。
- 为了保留 ↑↓ 按钮而把三套手法都留下。

---

## 3. 约束

1. `/api/reorder` **只写 `position`，不写 `parent_id`**（`functions/api/reorder.js`）。
2. `PUT /api/categories/:id` 的 `name` 是必填字段（内部用它做重名检查与 `UPDATE name = ?`）；只改父级时也必须把当前 `name` 一起带上。
3. 改了 `parent_id` 且未传 `position` 时，服务端自动落到**新父级末尾**（`MAX(position)+1`）。
4. 服务端校验：循环引用、深度上限 5、同父级重名 409。
5. 原生 HTML5 拖拽无 `wheel` 滚动、触屏不可用（既有平台限制）。
6. 分类写操作没有"三段式 toast"（`onPhase`）——只有 `bookmark` 系列有。

---

## 4. 方案对比

| | A. 保留双栏，只对齐视觉与手势 | B. 单栏重做（**选用**） | C. 导航栏内做跨级拖拽 |
|---|---|---|---|
| 改动量 | 小 | 中（新组件 + 抽公共件） | 大（自绘拖拽、滚动、浮层展开） |
| 两层滚动 | 仍在 | 消除 | — |
| 右栏空白 | 仍在 | 消除 | — |
| 跨级可操作 | 仍要拖过屏幕 | 弹窗 + 搜索，无视高度 | 需 hover 逐层展开浮层 |
| 风险 | 低 | 中（删批量确认） | 高（无撤销、误落后分类消失） |
| 与导航栏一致 | 部分 | 完全（同一状态机） | 需要另造一套规则 |

选 B。C 被否：导航栏一次只露一个分支，落点无参照物；跨级后分类从根菜单"消失"进下拉且无撤销；触屏/键盘彻底无路。

---

## 5. 详细设计

### 5.1 布局

```
菜单                                       [搜索分类…]   [＋ 新分类]
──────────────────────────────────────────────────────────────
≡ 部署                                   39 · 2子        ⋯
   ├ 影视聚合                            12              ⋯
   └ 节点订阅                             0              ⋯
≡ 搜索引擎                                 5              ⋯
≡ AI                                     67 · 8子        ⋯
```

- 单个滚动容器：列表区 `height: 100%`，随内容区伸缩，**不再有内层固定 600px 面板**。
- 工具条吸顶（`position: sticky; top: 0`）：搜索框 + 「＋ 新分类」+ 「展开全部/收起全部」。
- 行高 36px（有描述时 52px，第二行灰字描述，`text-overflow: ellipsis`）。
- 层级用缩进 + 连接线表达；不引入卡片、不引入左右分栏。
- 全部使用 nav 主题变量（`--nav-glass`/`--nav-border`/`--nav-text` 等），避免 `--card-bg` + 2px 边框那套旧语言。

### 5.2 行内容

| 位置 | 内容 |
|------|------|
| 左 | 拖拽把手（hover/聚焦出现，触屏隐藏）、展开三角（仅有子分类时） |
| 中 | 名称；有描述时下方灰字第二行（≤50 字，截断） |
| 右 | `书签数 · N子`（N 仅在有子分类时显示）、`⋯` 按钮 |

`⋯` 菜单项：重命名 / 编辑描述 / 新建子分类 / 移动到… / 删除（危险色）。

### 5.3 交互

| 操作 | 行为 |
|------|------|
| 单击有子分类的行 | 展开/折叠 |
| 单击叶子行 | 无操作（仅 hover 高亮） |
| 双击任意行 / `⋯ → 重命名` | 行内变输入框：`Enter` 保存、`Esc` 取消、失焦保存 |
| `⋯ → 编辑描述` | 行下方展开小编辑框，保留 `n/50` 计数 |
| 拖拽 | **仅同级排序**。插入条 2px + 「插入上方/下方」胶囊；跨父级 → 目标行红色虚线 + 底部提示条「只能在同一层级内排序 · [移动到其他分类…]」 |
| `⋯ → 移动到…` | 打开共享 `MoveCategoryDialog`，预选当前分类 |
| `⋯ → 新建子分类` | 复用导航栏 `CategoryCreateDialog`，父分类预填当前行 |
| `⋯ → 删除` | 沿用现有删除流程：有书签时二次询问（保留/删除书签） |

键盘：行 `tabindex="0"`，`Enter/Space` 展开收起父级；`⋯` 是可聚焦按钮；行内输入框 `Esc` 退出。

### 5.4 拖拽实现

- 直接复用 `useMenuReorder`（`menus: () => categoryTree`、`canReorder: () => isAuthenticated`、`orientation: 'vertical'`、`onInvalidDrop` 弹提示条），**不再使用 `useCategoryEditor` 里的拖拽实现**。
- 落点判定：目标行的父级 == 被拖项的父级才有效；否则无效。
- 拖动期间不展开/折叠、不自动滚动承诺（原生限制，文档化）。
- 松手：乐观改本地 `position` → `POST /api/reorder` → 失败回滚 + 红色 toast。

### 5.5 共享「移动到…」弹窗

`src/components/MoveCategoryDialog.vue`（新建，基于 `BaseDialog`）：

| 元素 | 说明 |
|------|------|
| 标题 | `移动「分类名」到…` |
| 搜索 | 按名称与路径过滤 |
| 列表 | 完整分类树（折叠层可选、可展开），首项「作为根分类」 |
| 禁止项 | 自身与所有后代置灰并注明「不能移动到自己的子分类」 |
| 现状标记 | 当前父分类右侧标 `当前位置`，选中它时底部按钮禁用 |
| 底部 | `当前：资源中心 / VPS(虚拟机)` + 取消 / 移动 |

提交：`PUT /api/categories/:id` `{ name, parent_id }` → 服务端落到新父级末尾 → 本地重排该组 `position` → 刷新数据。成功后 toast `已移动到「X」下`。

### 5.6 导航栏入口（把路接起来）

- `useMenuReorder.hintText` 的跨级文案改为可操作：悬浮提示仍是文字；**松手被拒绝时**不再只弹 `warning toast`，而是底部浮条 `只能在同一层级内排序` + 按钮 **`移动到其他分类…`**（8 秒后自动消失，可手动关闭）。
- 点击浮条按钮 → `NavBar` emit → `NavItemView` 打开同一个 `MoveCategoryDialog`，`category` 预选为刚被拖动的项。
- `onInvalidDrop` 需要携带被拖项（`draggingId` / `draggingName`），`useMenuReorder` 补这两个字段。
- 兜底：这个浮条只在登录态出现（未登录本来就不能拖）。
- 各层级共用 `NavBar` 里的同一个 `useMenuReorder` 实例（`NavMenuItem` 只透传 `reorder`），所以只在 `NavBar` 接 `onInvalidDrop` 即可覆盖根菜单与所有下拉层。

### 5.7 即时保存与失败处理

| 操作 | 请求 | 失败处理 |
|------|------|----------|
| 重命名 | `PUT /api/categories/:id` `{ name }` | 恢复旧名 + 红色 toast（409 显示服务端文案） |
| 描述 | `PUT /api/categories/:id` `{ name, description }` | 恢复旧值 + toast |
| 同级排序 | `POST /api/reorder` | 恢复 `position` 快照 + toast |
| 移动到… | `PUT /api/categories/:id` `{ name, parent_id }` | 关闭弹窗并保留选择？→ 不关闭，弹窗内报错，可重试 |
| 新建 / 删除 | 现有 `addCategory` / 删除流程 | 现有行为 |

- 写成功后 `fetchData({ forceRefresh: true })` **不 await**（与现有乐观更新约定一致）。
- 不再有 pending bar、保存确认弹窗、`discardAll`。

### 5.8 数量口径

- 书签数 = **本书签及其所有后代分类的书签总数**（与 `NavItemView.categoryCountMap` 同口径）。
- 把该计算从 `NavItemView` 抽到 `src/utils/categoryCounts.js`，两处共用，禁止各写一份。
- 子分类数标注为 `N子`，避免与书签数混淆。

### 5.9 搜索

- 输入即过滤（`debounce` 150ms），命中高亮；命中项自动展开其祖先路径。
- 清空恢复原展开状态。
- 空结果：`没有匹配「关键词」的分类`。

---

## 6. 组件与文件改动

| 文件 | 改动 |
|------|------|
| `src/components/settings/MenuSettings.vue` | **新建**。菜单 Tab 全部逻辑：工具条、搜索、树渲染、拖拽、即时保存、删除流程 |
| `src/components/settings/MenuCategoryRow.vue` | **新建**。单行展示 + 行内改名/描述 + `⋯` 菜单（递归自引用渲染子级） |
| `src/components/MoveCategoryDialog.vue` | **新建**。共享移动弹窗 |
| `src/utils/categoryCounts.js` | **新建**。递归书签计数（含单测） |
| `src/components/NavSettingsModal.vue` | 菜单 Tab 替换为 `<MenuSettings />`；移除 `useCategoryEditor` 引入、`MenuTreeNode`、pending bar、保存确认弹窗、相关 CSS |
| `src/components/NavBar.vue` | 跨级拒绝改为浮条 + 按钮；emit `move-category`（各层共用同一状态机，`NavMenuItem` 只需透传，禁止态样式已存在） |
| `src/views/NavItemView.vue` | 承载 `MoveCategoryDialog`，处理移动请求；计数改用 `utils/categoryCounts` |
| `src/composables/useMenuReorder.js` | `state.draggingName`、`onInvalidDrop({ id, name })` |
| `src/components/MenuTreeNode.vue` | 不再被引用；确认后删除 |
| `src/composables/useCategoryEditor.js` | 确认无引用后删除（避免第二套拖拽逻辑复燃） |
| `AGENTS.md` | 更新「NavSettingsModal 设置弹窗 UI 设计 → 菜单 Tab」与「导航站菜单拖拽排序」两节 |
| `tests/menu-counts.test.js` | 新增 `npm run test:counts`（或并入现有 node test 脚本） |

---

## 7. 数据流

```
MenuCategoryRow 交互
  ├ 改名/描述 → PUT /api/categories/:id → fetchData({forceRefresh}) [后台]
  ├ 拖拽     → useMenuReorder → onReorder → 乐观改 position → POST /api/reorder
  ├ 移动到…  → MoveCategoryDialog → PUT /api/categories/:id {name, parent_id}
  └ 删除     → DELETE /api/categories/:id（有书签时先询问 cascade）

导航栏
  NavMenuItem drop(跨父级) → useMenuReorder.onInvalidDrop → 浮条
    → 点击「移动到其他分类…」→ emit → NavItemView → 同一个 MoveCategoryDialog
```

---

## 8. 风险与处理

| 风险 | 影响 | 处理 |
|------|------|------|
| 取消批量确认后无「撤销」 | 误拖/误改名即时落库 | 每步一条 toast；拖拽/改名失败自动回滚；删除仍二次确认；把「移动到其他分类」放在浮条最显眼处 |
| 重命名失焦即存 | 误触离焦保存 | `Esc` 取消优先；空名或未变化不提交；输入框旁显示「保存中/已保存」 |
| 移动落在新父级末尾 | 用户期望精确位置 | 弹窗底部说明「将追加到目标分类末尾」；落库后可在列表里立即拖拽微调 |
| 并发（多标签页） | 覆盖彼此 | 与现状一致，下次 `fetchData` 覆盖；不额外做冲突检测 |
| 深度上限 5 | 移动被拒 | 弹窗内目标超过可容纳深度时置灰并提示 |
| 重名 409 | 移动/改名失败 | 原样展示服务端文案，保留输入 |
| 删除分类连带书签 | 数据丢失 | 沿用现有「有书签先询问」流程，文案不变 |

---

## 9. 验收标准

- [ ] 1280×609 下菜单 Tab **只有一个滚动容器**，没有卡片被裁切。
- [ ] 52 个分类的列表能完整滚动到底部；工具条吸顶。
- [ ] 行内改名：`Enter` 保存、`Esc` 取消、失焦保存；重名时报错并保留原值。
- [ ] 拖拽：同级出现 2px 插入条 + 落点胶囊；跨父级出现红线与浮条，松手不写库。
- [ ] 导航栏跨级松手 → 浮条含「移动到其他分类…」→ 打开弹窗且预选正确分类 → 移动成功后两处视图都更新。
- [ ] 设置行与导航栏对同一分类显示**相同书签数**。
- [ ] 菜单 Tab 不再出现「待保存/放弃/查看详情」；删除仍有确认。
- [ ] 键盘：`Tab` 能进到行与 `⋯`，`Enter/Space` 可展开收起。
- [ ] `npm run build` 通过；分类计数单测通过。
- [ ] 手动验证：改名、描述、拖拽、跨级移动、新建子分类、删除（含带书签）各一轮。

---

## 10. 待实施时确认的细节（builder 自行决定）

1. 行内改名用 `<input>` 覆盖还是独立输入框 —— 优先覆盖，保持行高不跳。
2. 描述编辑用小弹层还是行内展开 —— 优先行内展开，避免第三层浮层。
3. 展开状态是否需要持久化到 `localStorage` —— 默认不持久化（每次打开默认展开到第 2 层）。
4. `useCategoryEditor.js` 是否删除 —— 只有在确认全仓库无引用后删除。
