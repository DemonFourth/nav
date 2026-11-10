# nav 模式功能对齐与默认模式退役方案（讨论稿）

- 日期：2026-11-09（最后更新：2026-11-10）
- 状态：**阶段 0–3 已实施并提交**（`347bdc9` → `1a9d1af`，共 7 个提交，未 push）；阶段 4（nav 试用）未开始；阶段 5 / F1（隐藏默认入口）方案已定、**暂缓执行**。
- 位置：`docs/plans/`（已移入）。

## 1. 背景与目标

- 目标：让 nav 模式成为项目的唯一界面，最终删除默认模式。
- 约束：**在 nav 功能对齐完成之前，默认模式必须保持可用**，作为回退路径。
- 已确认决策（2026-11-09）：**先按“完全等价”补齐 nav，再在试用期后逐项砍掉低频入口**，最后删除默认模式。
- 已确认例外（2026-11-09）：nav **不做**「回到顶部」「全部聚合视图」「批量操作（编辑/AI/删分类/反选）」；这些功能暂不补齐。
- 退役方式（2026-11-09 调整）：**暂不删除默认模式代码**。nav 完善后只隐藏默认模式入口（风格切换），保留代码作为回退；“删除”留到以后单独决定。
- 完成判据：
  1. 默认模式的功能在 nav 中都有可用入口，或明确记录为“等价物/主动放弃”。
  2. 连续试用期无 P0/P1 缺陷。
  3. `npm run build` 与现有 Node 测试通过。
  4. 默认入口隐藏后，nav 可独立完成日常使用。

## 2. 当前架构

### 2.1 双模式入口

```
src/App.vue
├─ displayMode === 'nav-item' → NavItemView.vue        （nav 模式）
└─ 其它                      → 默认模式模板（App.vue 内联）
```

- nav 分支：`App.vue:4-8`
- 默认分支：`App.vue:11-315`
- 默认模式 SettingsPage 被渲染了两次：`App.vue:270-314` 与 `App.vue:318-362`
- 全局常驻：`UpdateNotification`、`ToastNotification`（`App.vue:364-368`）

### 2.2 全局初始化（App.vue，两种模式共用）

`onMounted` 中依次执行：`fetchData` → `loadSettingsFromDB` → `loadThemeFromDB` → `loadSearchEnginesSettings` → `checkAIAvailability` → `applyWallpaper` → toast 实例 → authGuard 登录实例 → `onAuthChange` → `document.title` 监听。

> 删除默认模式时，这段初始化必须完整保留，只移除默认模式专属状态。

### 2.3 组件归属

| 类别 | 组件 |
|---|---|
| 仅默认模式 | `CategorySidebar` `CategorySection` `CategoryTreeItem` `BookmarkCard` `SearchBar` `AvatarMenu` `EditModeToolbar` `FloatingButtons` `BookmarkDialog` `CategoryDialog` `FooterEditDialog` `BatchOperationDialog` `BatchAIGenerateDialog` `BatchAIClassifyDialog` `SettingsPage` `settings/AppearanceSettings` `settings/DataSettings` `settings/AISettings` `settings/AboutSettings` `HighlightText` `LetterIcon` |
| 仅 nav | `NavItemView` `NavBar` `NavMenuItem` `NavSearch` `NavCard` `NavCardGrid` `NavSettingsModal` `NavBookmarkEditModal` `CategoryCreateDialog` `TagOverviewDialog` |
| 两种模式共用 | `ImportExportDialog` `BackupDialog` `ConfirmDialog` `PromptDialog` `LoginModal` `BaseDialog` `LazyIcon` `TagManagement` `TagRenameDialog` `MenuTreeNode` `ToastNotification` `UpdateNotification` |
| 当前已无引用 | `views/MenuEditorPreview.vue` `CategoryButtons.vue` |

### 2.4 composable 归属

| composable | 使用方 | 删除默认模式后 |
|---|---|---|
| `useBookmarks` `useAuth` `useAuthGuard` `useToast` `useAI` `useSettings` `useTheme` `useIcon` `useMenuReorder` `useCategoryEditor` `useIncrementalRender` `useTags` `useVersion` `useBackup` | nav 或共用 | 保留 |
| `useBatchOperations` | 仅 `App.vue` | 若 nav 不移植该模式则删除 |
| `useSearchEngines` | `App.vue` + `SearchBar`；2026-11-10 起 `NavSearch` + `NavSettingsModal` 也使用 | **保留**（搜索配置已迁到 nav，`eaae11b`） |
| `utils/helpers.js`（debounce） | 仅 `SearchBar` | 删除默认模式后删除 |
| `utils/search.js` `utils/tagBrowse.js` `utils/categoryTree.js` `utils/privacyCheck.js` | nav | 保留 |

## 3. 功能对照总表

> 「判定」列为 2026-11-09 审计时的结论，「现状」列为 2026-11-10 收尾时核对的实际状态。

| 模块 | 默认模式 | nav 模式 | 判定（2026-11-09 审计） | 现状（2026-11-10） |
|---|---|---|---|---|
| 分类浏览 | 侧边栏树 + 计数 + 面包屑 + “全部”聚合页 | 顶部多级菜单 + 祖先高亮 + 拖拽排序 + 内联新建 | nav 缺“全部”聚合、分类计数 | 分类计数已补齐（`347bdc9`，`7f3d714` 修正累加）；“全部”聚合主动放弃（B7） |
| 搜索 | 可配置引擎（面板开关 + 启用列表/排序）、按分类/多标签过滤、结果下拉并定位 | 固定 5 引擎（Google/百度/Bing/GitHub/站内）、站内字段筛选、结果直接进卡片区 | nav 缺引擎配置、分类过滤 | 引擎配置已迁移（`eaae11b`）；分类过滤改为按分类分组展示（C7），不做分类范围开关 |
| 书签增删改 | `BookmarkDialog`：URL 元数据抓取、AI、重复提示 | `NavBookmarkEditModal`：AI、标签建议、图标清除/重取、重复提示 | nav 缺元数据抓取，其余为超集 | 元数据抓取已补齐（`bfe9ac6`） |
| 批量操作 | 全选/取消/反选、移动、编辑（私密）、AI 生成、AI 分类、删除、删分类 | 设置→书签：全选/取消、删除、移动 | nav 缺编辑、AI 两类、删分类、反选 | 主动暂不做（C1–C5），保持设置→书签的最小批量栏 |
| 分类管理 | 侧边栏内联 + 设置页 | 导航栏拖拽 + 内联新建 + 设置→菜单（改名/描述/父级/顺序/删除） | nav 更完整 | 已一致 |
| 设置 | 外观 / 数据 / AI / 关于 | 外观 / 数据 / 菜单 / 书签 / 标签 / 趋势 / AI / 关于 | nav 超集，缺搜索引擎配置 | 搜索引擎区块已补齐（`eaae11b`） |
| 数据管理 | 导入导出、云备份、清理空分类、统计 | 同上 + 隐私分类检查 + 空分类统计 | nav 更完整 | 已一致 |
| 其他 | 页脚渲染、回到顶部、头像图片、非公开登录引导、卡片私密徽标 | 页脚可编辑但不渲染、无回到顶部、头像仅首字母、无非公开登录引导、无私密徽标 | nav 缺小功能 | 页脚 / 头像 / 未登录引导 / 私密徽标已补齐（`7283874`）；回到顶部主动放弃（B5） |

nav 独有：标签浏览（多标签 AND + 吸顶）、全部标签弹窗、标签重命名、趋势统计、隐私分类检查、菜单拖拽与内联新建、卡片毛玻璃/透明度/壁纸、图标源测试、分类浏览卡片序号（`1a9d1af`）。

## 4. 缺口清单（含证据）

> 本节为 2026-11-09 审计时的原始状态，保留作为证据；处置结果见第 3 节「现状」列与第 11 节实施记录。

### 4.1 P0：必须优先修

| 编号 | 缺口 | 证据 | 影响 |
|---|---|---|---|
| P0-1 | 登录守卫无法弹出登录框 | `App.vue:257` 的 `LoginModal` 只在默认分支；`App.vue:737-740` 仅在 ref 非空时注册；`useAuthGuard.js:20` 依赖该实例 | nav 下 `requireAuth()` 只提示“请先登录”，影响编辑/删除/批量操作 |
| P0-2 | “隐藏空分类”开关失效 | `NavSettingsModal.vue:128-137` 有开关；`NavItemView.vue:200-203` 的 `menuTree` 未过滤；全项目仅此两处引用 | 用户以为设置生效 |
| P0-3 | nav 首页无“新增书签”入口 | 默认：`EditModeToolbar.vue:20`、`CategorySidebar`；nav：仅 `NavSettingsModal.vue:655` | 日常添加书签需进设置，路径过长。**已定方案**：分类网格末尾渲染「新增书签」卡片（登录态、仅分类浏览），点击带入当前分类打开 `NavBookmarkEditModal` 新增模式 |

### 4.2 P1：体验补齐

| 编号 | 缺口 | 证据 | 候选做法 |
|---|---|---|---|
| P1-1 | 非公开模式未登录无引导 | 默认 `App.vue:102-113`；nav 只显示 `NavCardGrid.vue:54-59` 通用空态 | 空态区分 `!publicMode && !isAuthenticated`，给登录按钮 |
| P1-2 | 页脚可编辑但不显示 | `NavSettingsModal.vue:273-279` 编辑；`App.vue:249-251` 才渲染 | `NavItemView` 底部渲染 `footerContent` |
| P1-3 | 卡片无私密徽标 | `BookmarkCard.vue:77`；`NavCard.vue` 无 `is_private` | `NavCard` 增加徽标 |
| P1-4 | 菜单无分类书签计数 | 默认 `bookmarkCountByCategory` 含子孙；nav 菜单无计数 | `buildCategoryTree` + 递归计数，`NavBar/NavMenuItem` 展示 |
| P1-5 | 无“回到顶部” | `FloatingButtons` 仅默认模式使用 | `NavItemView` 引入，或复制轻量实现 |
| P1-6 | 头像只显示首字母 | `NavBar.vue:141-143`；`avatarUrl` 已在设置中可编辑 | 有图用图，无图回退首字母 |
| P1-7 | 无“全部”聚合视图 | 默认 `App.vue:524-532`；nav `NavItemView.vue:268-286` 只显示当前分类 | 菜单前插“全部”伪节点，复用 `NavCardGrid` 的 `groups` |

### 4.3 P2：重功能移植

| 编号 | 缺口 | 证据 | 候选做法 |
|---|---|---|---|
| P2-1 | 批量编辑（私密） | 默认 `EditModeToolbar.vue:109-120` + `BatchOperationDialog` | nav 复用 `BatchOperationDialog('edit')` |
| P2-2 | 批量 AI 生成描述 | 默认 `EditModeToolbar.vue:122-134` + `BatchAIGenerateDialog` | nav 复用现有弹窗 |
| P2-3 | 批量 AI 分类 | 默认 `EditModeToolbar.vue:136-147` + `BatchAIClassifyDialog` | nav 复用现有弹窗 |
| P2-4 | 批量删除分类 | 默认 `EditModeToolbar.vue:164-176` + `batchOperation('delete-categories')` | 设置→菜单多选，或新增 nav 批量入口 |
| P2-5 | 无“反选” | 默认 `EditModeToolbar.vue:83-93` | 设置→书签批量栏补按钮 |
| P2-6 | 无 URL 元数据抓取 | `BookmarkDialog.vue:362` 调 `/api/fetch-metadata`；`NavBookmarkEditModal.vue:363-377` 无 | 抽公共函数，nav 弹窗加按钮 |
| P2-7 | 站内搜索无分类过滤 | 默认 `SearchBar.vue:29-61` 有分类/标签过滤；`NavSearch.vue` 无 | 加分类下拉，或默认限定当前分类 |

### 4.4 判定为“已有等价物”，不重复实现

| 默认模式能力 | nav 等价物 | 理由 |
|---|---|---|
| 编辑模式 + 侧边栏内联操作 | 设置→菜单 + 卡片详情 + 导航栏内联新建 | 交互路径不同，能力齐全 |
| 搜索框内多标签过滤 | 标签行 + 全部标签弹窗（多标签 AND） | nav 的标签浏览更强 |
| 搜索结果下拉并滚动定位 | 搜索结果直接在卡片区展示 | nav 无需跳转 |
| 面包屑导航 | 导航栏祖先高亮 | 信息等价 |
| 分类上移/下移按钮 | 导航栏拖拽 + 设置→菜单的上移/下移 | 触屏依赖后者，需验证 |

## 5. 分阶段路线

### 阶段 0：修补 nav 现有缺陷（约 1 天）— ✅ 已完成（`347bdc9`）

任务（对应决策）：
- A1 登录守卫：`NavBar` 挂载时注册自身 `LoginModal`。
- A2 隐藏空分类：`NavItemView` 用 `bookmarkCountByCategory` 过滤菜单，当前分类例外。
- A3 新增书签：`NavCardGrid` 末尾新增卡片 + `NavBookmarkEditModal.open(bookmark, options)` 默认分类 + `handleSaveBookmark` 新增分支。

验收：
- 未登录点击编辑/删除能弹出登录框。
- 开启“隐藏空分类”后，整棵子树为 0 的分类消失，当前分类仍可见。
- 分类网格末尾有新增卡，点击带入当前分类，保存后立即可见。

### 阶段 1：日常体验补齐（约 1 天）— ✅ 已完成（`7283874`）

任务：B1 未登录引导、B2 页脚、B3 私密徽标、B4 菜单计数、B6 头像图片。
> B5 回到顶部、B7 全部聚合视图已确认不做。

验收：锁屏引导可登录；页脚显示且可编辑生效；私密徽标出现；菜单计数含子孙；头像有图用图、无图用默认头像图。

### 阶段 2：搜索与表单补齐（约 1~2 天）— ✅ 已完成（`bfe9ac6`）

任务：
- C6 元数据抓取：`NavBookmarkEditModal` URL 行加「自动获取」。
- C7 搜索改版：引擎选择前置为搜索框内下拉；站内结果按分类分组；加摘要栏；抽 `buildCategoryGroups`。
> C1–C5 批量操作已确认暂不做。

验收：新增/编辑书签可抓标题描述；站内结果按分类分组、组头可跳转、摘要栏计数正确；外部引擎回车新标签打开。

### 阶段 3：搜索引擎配置迁移（约 1 天）— ✅ 已完成（`eaae11b`）

任务：
- `NavSearch` 接入 `useSearchEngines`，站内固定第一项，默认选中站内。
- `NavSettingsModal` 外观加入「显示外部搜索引擎」开关 + 8 个引擎复选（`AppearanceSettings.vue:105-151` 的对应能力）。
- 确认 `App.vue` 继续调用 `loadSearchEnginesSettings()`。

验收：nav 中可开关外部引擎、启用/禁用引擎；配置与默认模式共用；站内搜索与字段筛选行为不变。

### 阶段 4：nav 完善与内部试用（时间待定）— ⏸ 未开始

不写新功能，用 nav 作主界面，默认模式作回退。按第 9 节清单回归，记录阻碍点。试用时长与是否进入下一阶段由用户届时决定。

### 阶段 5：隐藏默认入口（暂缓，待用户决定）— ⏸ 方案已定、未实施

> 2026-11-09 调整：**只隐藏、不删除**。默认模式代码保留作为回退。

1. 隐藏风格切换入口：`NavBar.vue:122` 的切换按钮；`NavItemView` 不再 emit `toggleStyle`。
2. 强制 `displayMode = 'nav-item'`（或保留 localStorage 读取但无 UI 入口）。
3. `App.vue` 默认分支保留，不做删除。
4. 第 8 节“删除清单”**不执行**；默认专属组件、`useBatchOperations`、`useSearchEngines` 等全部保留。
5. `AGENTS.md` 只补充“nav 为默认界面、风格切换入口已隐藏”，不删除默认模式章节。
6. 不删除 `BatchOperationDialog` / `BatchAIGenerateDialog` / `BatchAIClassifyDialog` / `FloatingButtons`。

## 6. 待逐项讨论清单

按依赖顺序逐项确认“怎么做”，确认一项勾一项：

- [x] A1 / P0-1 登录守卫弹窗 —— 采用方案 A（NavBar 注册自身 LoginModal）
- [x] A2 / P0-2 隐藏空分类 —— 采用方案 A（菜单真正过滤，当前分类例外）
- [x] A3 / P0-3 新增书签入口 —— 采用方案 D（分类网格末尾新增卡片，仅分类浏览）
- [x] B1 / P1-1 非公开未登录引导 —— 采用方案 A（整块引导面板）
- [x] B2 / P1-2 页脚渲染 —— 采用方案 A（NavItemView 末尾渲染）
- [x] B3 / P1-3 私密徽标 —— 采用方案 A（卡片底部橙色胶囊）
- [x] B4 / P1-4 菜单分类计数 —— 采用方案 A（全层级显示，含子孙）
- [x] B5 / P1-5 回到顶部 —— **主动放弃**（用户决定 nav 不实现；默认模式删除时一并删除 `FloatingButtons`）
- [x] B6 / P1-6 头像图片 —— 采用方案 B（有 avatarUrl 用图，无图用内置默认头像图）
- [x] B7 / P1-7 “全部”聚合视图 —— **主动放弃**（用户决定 nav 不做聚合视图，保留分类优先浏览）
- [x] C1 / P2-1 批量编辑 —— **暂不做**（用户决定 nav 暂不投入批量功能）
- [x] C2 / P2-2 批量 AI 描述 —— **暂不做**（同上）
- [x] C3 / P2-3 批量 AI 分类 —— **暂不做**（同上）
- [x] C4 / P2-4 批量删除分类 —— **暂不做**（同上）
- [x] C5 / P2-5 反选 —— **暂不做**（同上；现有设置→书签的最小批量栏保持不变）
- [x] C6 / P2-6 元数据抓取 —— 采用方案 A（nav 弹窗内实现「自动获取」）
- [x] C7 / P2-7 站内搜索分类过滤 —— **改为搜索改版**（前置引擎选择 + 结果按分类分组 + 摘要栏；不做分类范围开关）
- [x] D1 / P3-1 NavSearch 接入 useSearchEngines —— 采用方案 A（完整迁移）
- [x] D2 / P3-2 搜索设置迁移 —— 采用方案 A（外观设置加开关 + 8 引擎复选；默认引擎「站内」）
- [x] E1 试用观察与逐项砍 —— **暂缓**（先完善 nav，删除最后再说）
- [x] F1 切换、删除与文档更新 —— **只隐藏不删**（隐藏风格切换入口，默认模式代码保留）；方案已定，**尚未实施**

## 7. 技术边界与风险

1. **共享组件改动会影响默认模式**：`useSettings`、`useTheme`、`useIcon`、`NavBookmarkEditModal`（被 NavItemView 与 NavSettingsModal 共用）等改动需双模式回归。
2. **风格切换链**在阶段 5 前必须保留，作为回退开关；任何阶段都不要提前禁用。
3. **触屏拖拽不可用**：原生 HTML5 拖拽在触屏无效；分类排序依赖设置→菜单的上移/下移，阶段 4 必须验证。
4. **无前端自动化测试**：项目仅有 `tests/tag-browse.test.js`、`tests/extension-shared.test.js`、`tests/url-variants.test.js`；UI 靠 `npm run build` + 手动回归。
5. **登录态依赖人工验证**：拖拽排序、AI 等需登录后手动验证。
6. **displayMode 仅存 localStorage**：隐藏入口不涉及 D1 迁移。
7. **文档过期**：`AGENTS.md` 需补充“nav 为默认界面、风格切换入口已隐藏”；本阶段不删除默认模式章节。

## 8. 删除/保留清单（**暂不执行**）

> 2026-11-09 决策：只隐藏默认入口，**不删除任何文件**。下述清单仅作为将来真正删除时的参考。

### 参考：将来删除时

- `src/components/`：`CategorySidebar.vue` `CategorySection.vue` `CategoryTreeItem.vue` `BookmarkCard.vue` `SearchBar.vue` `AvatarMenu.vue` `EditModeToolbar.vue` `FloatingButtons.vue` `BookmarkDialog.vue` `CategoryDialog.vue` `FooterEditDialog.vue` `BatchOperationDialog.vue` `BatchAIGenerateDialog.vue` `BatchAIClassifyDialog.vue` `HighlightText.vue` `LetterIcon.vue` `SettingsPage.vue`
- `src/components/settings/`：`AppearanceSettings.vue` `DataSettings.vue` `AISettings.vue` `AboutSettings.vue`
- 已死代码：`src/views/MenuEditorPreview.vue` `src/components/CategoryButtons.vue`
- 视讨论结果：`src/composables/useBatchOperations.js`、`src/composables/useSearchEngines.js`、`src/utils/helpers.js`

### 保留

- nav：`NavItemView` `NavBar` `NavMenuItem` `NavSearch` `NavCard` `NavCardGrid` `NavSettingsModal` `NavBookmarkEditModal` `CategoryCreateDialog` `TagOverviewDialog`
- 共用：`ImportExportDialog` `BackupDialog` `ConfirmDialog` `PromptDialog` `LoginModal` `BaseDialog` `LazyIcon` `TagManagement` `TagRenameDialog` `MenuTreeNode` `ToastNotification` `UpdateNotification`
- composables：`useBookmarks` `useAuth` `useAuthGuard` `useToast` `useAI` `useSettings` `useTheme` `useIcon` `useMenuReorder` `useCategoryEditor` `useIncrementalRender` `useTags` `useVersion` `useBackup`
- utils：`categoryTree` `search` `tagBrowse` `privacyCheck`

## 9. 手动回归清单

| 场景 | 检查点 |
|---|---|
| 浏览 | 根/子菜单切换、祖先高亮、隐藏空分类（当前分类例外）、菜单计数 |
| 分类管理 | 导航栏拖拽排序、跨父级拒绝、内联新建、设置→菜单改名/父级/删除 |
| 书签 | 新增卡（带入当前分类）、编辑、删除、私密徽标、图标与缓存、元数据抓取 |
| 搜索 | 引擎前置下拉、默认站内、字段筛选、结果按分类分组、摘要栏、清除、标签联动 |
| 标签 | 多标签 AND、吸顶、全部标签弹窗、重命名、失效清理 |
| 批量 | 仅回归现有「设置→书签」全选/取消、删除、移动（不新增功能） |
| AI | 单条生成/推荐、Prompt 配置、连接诊断 |
| 设置 | 主题、卡片样式、壁纸、图标源、头像、标题、页脚、公共模式、搜索引擎 |
| 数据 | 导入、导出、云备份、清理空分类、隐私检查、统计 |
| 认证 | 未登录浏览、非公开模式引导、登录过期、退出、requireAuth 弹窗 |
| 排序 | 卡片拖拽（含置底）、菜单拖拽、失败回滚、刷新保持 |
| 响应式 | 桌面/平板/手机布局、触屏排序替代路径、新增卡与摘要栏不溢出 |

## 10. 附：讨论记录

| 日期 | 议题 | 结论 |
|---|---|---|
| 2026-11-09 | 目标完整度 | 先按完全等价做，再逐项砍 |
| 2026-11-09 | 默认模式去留 | 暂保留，作为回退，nav 对齐并通过试用后再删 |
| 2026-11-09 | A1 登录守卫 | 采用方案 A：`NavBar` 挂载时把自身 `LoginModal` 注册给 `useAuthGuard`；默认模式不动。理由：nav 模式下 NavBar 始终挂载；删除默认模式后 App 根级登录框随之删除，该注册仍然成立，无需返工。卸载时不置空（默认模式不调用 `requireAuth`）。 |
| 2026-11-09 | A2 隐藏空分类 | 采用方案 A：nav 菜单按“整棵子树书签数为 0”过滤分类；**当前选中分类即使为空也不隐藏**；设置→菜单始终显示全部分类。默认模式该开关仅影响搜索态，此方案是语义升级（与开关文案一致）。计数逻辑与 B4 菜单计数共用 `bookmarkCountByCategory`。 |
| 2026-11-09 | A3 新增书签入口 | 采用方案 D（用户提议）：分类网格**末尾**渲染「新增书签」卡片，仅登录态 + 仅分类浏览（搜索/标签结果不显示）；点击带入当前分类（`activeSubMenu?.id \|\| activeMenu?.id`）打开 `NavBookmarkEditModal` 新增模式，分类可改。空分类只显示该卡（副标题“该分类下暂无书签”）替代原空态。改选其他分类保存后 toast「已添加到「X」」且不跳转。新增卡不参与排序。 |
| 2026-11-09 | B1 未登录引导 | 采用方案 A：`NavItemView` 在 `!publicMode && !isAuthenticated` 时隐藏搜索区/标签行/卡片区，替换为居中锁屏引导（锁图标 + 默认模式文案 + 「立即登录」→ `requireAuth()`）。NavBar 保留；`onMounted` 的 `fetchData` 保留，登录后由 `onAuthChange` 自动重取。公开模式行为不变。 |
| 2026-11-09 | B2 页脚渲染 | 采用方案 A：`NavItemView` 的 `content-section` 之后渲染 `<footer>`，`v-if="footerContent"`，`v-html="footerContent"`；`margin-top:auto` 贴底，毛玻璃用 `var(--nav-glass)`，边框 `var(--nav-border)`，文字 `var(--nav-text-secondary)`，链接 `var(--nav-primary)`。空内容时不渲染。默认模式不动。 |
| 2026-11-09 | B3 私密徽标 | 采用方案 A：`NavCard` 底部信息区（URL 之后）渲染橙色胶囊「私密」（`is_private` 为真时），复用默认模式配色（`#ff9800` + 10%/20% 透明底，12px 锁图标）。仅私密卡片多一行，普通卡片不变。 |
| 2026-11-09 | B4 菜单分类计数 | 采用方案 A：根菜单与所有下拉层级均在名称后显示含子孙的总数；`NavItemView` 复用 A2 的 `bookmarkCountByCategory` → `NavBar` → `NavMenuItem` 逐级透传。样式 `0.68rem`、`var(--nav-text-secondary)`、`tabular-nums`，无胶囊底；计数为 0 也显示。 |
| 2026-11-09 | B5 回到顶部 | **主动放弃**：nav 不实现回到顶部（用户决定）。`FloatingButtons.vue` 保持默认模式专属，阶段 5 随默认模式删除；删除清单无需调整。 |
| 2026-11-09 | B6 头像图片 | 采用方案 B（与默认模式一致）：`avatarUrl` 有值显示图片，为空显示内置默认头像图；加载失败回退默认头像图。nav 版默认头像用白色描边 SVG（适配主色渐变底），`object-fit: cover` 填满 34px 圆钮。首字母方案废弃。 |
| 2026-11-09 | B7 “全部”聚合视图 | **主动放弃**：nav 不做聚合视图，保持“分类优先”浏览（用户决定）。因此与默认模式存在一项明确的功能差异；“先完全等价再逐项砍”的试用期需接受该差异，或后续再议。默认模式删除后「全部」视图随 `App.vue` 一并消失。 |
| 2026-11-09 | C1–C5 批量操作 | **暂不做**（用户决定）：nav 暂不投入批量功能，不补编辑/AI 生成/AI 分类/删分类/反选。现有「设置→书签」批量栏（全选/取消、删除选中、移动）保持不变；入口仍为勾选书签后底部浮出。`BatchOperationDialog`、`BatchAIGenerateDialog`、`BatchAIClassifyDialog` 继续仅为默认模式使用，阶段 5 随默认模式删除。批量入口发现性问题暂不处理。 |
| 2026-11-09 | C6 元数据抓取 | 采用方案 A：在 `NavBookmarkEditModal` 的 URL 行加「自动获取」按钮，调 `GET /api/fetch-metadata?url=`，依次取 `og:title`/`<title>`、`og:description`/`meta description`，仅填空字段；成功 toast，失败提示手动输入。逻辑本地实现，不改默认模式 `BookmarkDialog`。不抓图标。 |
| 2026-11-09 | C7 搜索改版 | 采用用户方案：① 删除搜索框上方引擎按钮行，引擎选择改为搜索框内左侧下拉（当前引擎名 + 箭头，Teleport 下拉）；② 站内结果改为**按分类分组**展示，复用标签视图的 `groups` 渲染与组头跳转；③ 抽 `buildCategoryGroups(bookmarks, categories)` 供搜索/标签共用；④ 搜索期间不高亮菜单、禁用拖拽、隐藏新增卡；⑤ 结果空态按关键词提示。**不做**分类范围开关（用户决定）。⑥ 搜索框下方加摘要栏「找到 N 个书签 · 来自 M 个分类」+「清除」（复用标签上下文栏样式）。 |
| 2026-11-09 | D1/D2 搜索引擎 | 采用方案 A：`NavSearch` 接入 `useSearchEngines`，「站内」固定第一项且不受配置开关影响，其余为已启用外部引擎；`enabledSearchEnginesPanel` 关闭时只剩「站内」。nav 设置→外观新增「搜索引擎」区块：显示外部引擎开关 + 8 个引擎复选（图标 + 名称），调 `toggleSearchEnginesPanel` / `toggleEngine`，与默认模式共用 D1/localStorage 配置。引擎顺序沿用 `SEARCH_ENGINES`，不做拖拽排序。默认引擎「站内」（用户决定），外部引擎回车新标签打开。 |
| 2026-11-09 | E1 试用 | **暂缓**：先完善 nav 功能，试用与“逐项砍”等删除前再讨论。 |
| 2026-11-09 | F1 退役方式 | **只隐藏不删**：nav 完善后隐藏风格切换入口并默认进入 nav，**保留默认模式全部代码**作为回退；第 8 节删除清单不执行，`AGENTS.md` 不删默认模式章节。真正的代码删除留到以后单独决定。 |
| 2026-11-10 | B4 计数异常 | 根菜单显示总数而非含子孙总数，根因是 `walk()` 递归只累加首个子树；改为 `return sum + total`。 |
| 2026-11-10 | 登录提示冗余 | 「立即登录」同时弹登录框和「请先登录」toast；`requireAuth()` 改为有登录框实例时只弹框、无实例才 toast。 |
| 2026-11-10 | 首屏重复请求 | 不删组件生命周期调用，改在数据层去重：`settingsFetch` 3 秒 TTL 合并 3 次 `/api/settings`；`checkAIAvailability` 3 秒 TTL；`checkEmptyCategories` 数据指纹 + 防抖；`useSearchEngines` 模块级单 watch（多实例共享、不重复写库）。 |
| 2026-11-10 | 卡片序号 | 序号角标骑在卡片边框左上角（`absolute top/left -10px`），与卡片内容解耦、`pointer-events: none`；取当前列表下标，拖拽重排后自动更新；仅分类浏览显示，搜索/标签视图与新增卡不编号。 |
| 2026-11-10 | 后续节奏 | **暂不执行 F1**，先把计划文档状态与仓库实际对齐；F1 与阶段 4 试用另行决定。 |

## 11. 实施记录

| 阶段 | 提交 | 内容 | 验证 |
|---|---|---|---|
| 0 | `347bdc9` | A1 登录守卫、A2 隐藏空分类、A3 新增书签卡、B4 菜单计数 | `npm run build`、`test:tags`、`test:ext` 通过 |
| 1 | `7283874` | B1 未登录锁屏引导、B2 nav 页脚、B3 私密徽标、B6 头像图片 | `npm run build` 通过 |
| 2 | `bfe9ac6` | C6「自动获取」标题描述、C7 搜索改版（前置引擎下拉、分类分组、摘要栏、抽出 `buildCategoryGroups`） | `npm run build`、`test:tags`（新增 1 个单测）通过 |
| 3 | `eaae11b` | D2 外观设置「搜索引擎」区块（开关 + 8 引擎复选）；D1 已由 `NavSearch` 接入 `useSearchEngines` 完成 | `npm run build` 通过 |
| 修复 | `7f3d714` | B4 计数 `walk()` 漏加同级累加（改为 `return sum + total`）；`useAuthGuard.requireAuth` 弹窗优先、无实例才 toast；`NavItemView` 移除重复 `fetchData`；新增 `utils/settingsFetch` 3 秒 TTL 合并 `/api/settings`；`useAI.checkAIAvailability` 3 秒 TTL；`NavSettingsModal.checkEmptyCategories` 数据指纹 + 300ms 防抖；`useSearchEngines` 改模块级单 watch（避免多实例重复 POST） | `npm run build`；浏览器实测首屏 `ai/status`、`categories`、`settings`、`bookmarks`、`cleanup-empty-categories` 各 1 次、`POST settings` 0 次；菜单计数 部署 40 / AI 67 / Github 98 / 工具 69 / 资源中心 22，根合计 334 |
| 增强 | `1a9d1af` | 分类浏览时在卡片左上角显示序号角标（搜索/标签分组视图与「新增书签」卡不编号；序号随数组重排自动更新） | `npm run build`；用户浏览器验证通过 |
| 修复 | `5f7d4a4` | 引擎选择 / 搜索范围按钮的 tooltip 在对应下拉展开时置空；`v-tooltip` 指令在文案清空时立即收起已显示的 tooltip | `npm run build` 通过；浏览器实测（2026-11-10）：两处下拉展开时 tooltip 立即消失、关闭后重新悬停恢复显示，下拉第一项无遮挡 |
| 优化 | `c2de28b` | 序号角标改玻璃胶囊 + 主色数字（方案 C）；悬停轻弹 2px + 主色环、按下回弹收缩；暗色单独玻璃底；入场动画改 `backwards` 让状态 transform 生效 | `npm run build`；浏览器实测浅/深色与悬停（角标 transform 1.06/-2px、主色环出现，数字仍为列表位次） |
| 优化 | `5145915` | 角标描边改用 `var(--nav-border)` 与卡片同 token；阴影减为 2px/6px，悬停环收窄至 2px | `npm run build`；浏览器实测角标与卡片描边同色（浅色 `rgba(0,0,0,.1)`），暗色悬停环同步 |
| 交互 | `5c80702` | 搜索结果展示时隐藏标签行（`tag-filter-sticky` 增加 `!searchResults`），清空搜索后恢复；结果卡片上的标签点击仍按原规则退出搜索（保留，用户决定保持现状） | `npm run build`；浏览器实测搜索 107 条时标签行消失、摘要栏保留，清除搜索后标签行恢复 |
| 优化 | `302e9f2` | 编辑书签 URL 行：「自动获取」改 38×38 图标按钮，与「打开链接」同尺寸并排；两按钮改用 `v-tooltip` 替换原生 title | `npm run build`；浏览器实测两按钮 38×38、间距 8px，URL 输入 253px（较改前多约 60px），tooltip 文案正常 |
| 优化 | `6e69245` | 编辑书签：私密书签勾选移到固定底栏（删除右侧）；描述改 `rows=2` 文本域，与备注同高 | `npm run build`；浏览器实测描述/备注高度均 61px、勾选只在底栏渲染 |
| 优化 | `a09e8ab` | 编辑书签：AI 生成按钮移到「描述」标签行右侧并紧凑化（78×25），文本域独占整行 | `npm run build`；浏览器实测按钮 78×25、与文本域右缘对齐、描述仍两行 61px |
| 修复 | `f863742` | 编辑书签：分类下拉与标签建议改 Teleport 到 body + fixed（按空间翻转/限高，滚动时重新定位）；分类下拉补点击外部关闭；标签区改 `full-width` | `npm run build`；浏览器实测两下拉 parent=BODY、完全在视口内；分类下拉滚动后 top 271→191；外部点击可关闭；标签行宽=表单宽 703px |
| 优化 | `22f240f` | 编辑书签表单重排：名称｜图标URL、URL 整行、分类｜标签、描述/备注整行（标签行回到半列，后续以本条为准） | `npm run build`；浏览器实测行序正确，各行宽 345/345/703/345/345，URL 输入 611px |
| 优化 | `1aa1b00` | 编辑书签：分类 AI 推荐按钮移到「分类」标签行右侧（78×25）；输入框/分类触发器/标签容器统一 38px；弹窗打开锁 body 滚动 + `overscroll-behavior: contain` | `npm run build`；浏览器实测三类控件均 38px、按钮 78×25 与描述一致、打开时 `body.overflow=hidden`、关闭恢复 |

**浏览器实测记录（2026-11-09 ~ 11-10，Chrome DevTools MCP；登录态 `admin`、非公开模式）**：

- A1 登录链路：未登录点「立即登录」弹出的正是 `NavBar` 注册的 `LoginModal`，且不再同时弹「请先登录」toast（`7f3d714` 后复验）。
- A3 新增卡：点击带入当前分类，分类可改。
- B1 锁屏引导、B2 页脚、B3 私密徽标、B6 默认头像。
- B4 菜单计数：修复后根菜单与各级子菜单均为含子孙总数。
- C6 自动获取：MDN 页面抓到标题 + 描述。
- C7 引擎前置下拉、站内结果按分类分组、摘要栏、组头跳转。
- D2 外观设置引擎开关与复选联动搜索框下拉；勾选写库 1 次，刷新后保持。
- 卡片序号：用户确认通过（序号顺序、拖拽后重排、搜索/标签不编号、新增卡不编号）。

**用户手动验证补充（2026-11-10）**：

- A3 新增卡保存后立即出现在网格。
- B4 新增/删除/移动书签后计数实时变化。

**尚未单独验证**：

- A1 的「登录态失效但界面仍挂载」兜底场景。未登录时卡片不渲染编辑/删除入口（`NavCard.vue` 的 `v-if="isAuthenticated"`），原验收项「未登录点编辑/删除」不适用；已验证 `requireAuth()` 弹窗链路。
- B6 设置 `avatarUrl` 后的图片分支（测试时未设置头像，只验证了无图默认头像）。
- C6 已有标题/描述时不被覆盖（测试时字段为空，只验证了填空）。
- C7 外部引擎选中后回车新标签打开（只验证了引擎下拉与站内搜索）。
- 触屏（`@media (hover: none)`）拖拽把手隐藏与设置→菜单上移/下移替代路径。
- 平板/手机断点的响应式布局。

**已知遗留 + 观察项**：

- 搜索/标签视图切换分类时输入框文本不清空（沿用默认模式行为）。
- `enabledSearchEnginesPanel` 关闭时若此前选中的是外部引擎，会自动回落到「站内」。
- 站内搜索为大小写忽略的子串匹配（默认 5 字段），短词命中面大（如搜 `AI` 命中 106 条）——待确认是否可接受。
