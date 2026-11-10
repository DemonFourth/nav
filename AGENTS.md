# AGENTS.md - 书签管理器开发指南

## 开发流程（superpowers）

> **最高优先级**：所有开发活动必须遵守 superpowers 开发流程。用户明确指令 > 本文件 > 默认行为。

### 核心门控：未经同意禁止修改

- **修改项目文件前必须先获得用户明确同意**
- **讨论阶段**（用户提出想法、咨询、讨论方案时）：
  - 只允许**只读**项目文件（Read/Glob/Grep/codegraph/git log）
  - 禁止 edit/write 项目内任何文件
  - 允许向系统临时目录（Windows 通过 `%TEMP%` / `%TMP%` 环境变量查询实际路径）写入草稿/计划等辅助文件
- 仅当用户明确说"开始做/动手改/按此执行"或批准了计划后，才进入**实施模式**

### 强制 skill 调用链

回应前必须先判断是否有适用 skill，符合时必须调用：

| 场景 | 必须先调用 | 之后 |
|------|-----------|------|
| 任何会话开始 | `using-superpowers` | 判断后续 skill |
| 创建功能/组件/改行为 | `brainstorming` | 探索意图 → `writing-plans` → 计划获批后才实施 |
| 修 bug/异常 | `systematic-debugging` | 定位根因 → 修复 |
| 多文件/大型改动 | `writing-plans` / `executing-plans` | 按计划实施 |
| 声称完成前 | `verification-before-completion` | 先跑 build/test 再下结论 |
| 合并/PR 前 | `code-review-and-quality` | 多维度审查 |

### 完整流程（功能开发）

```
1. 讨论（brainstorming）：明确意图/需求/边界 —— 只读项目 + 可写临时目录
2. 计划（writing-plans）：拆解任务 —— 输出到临时目录，或经同意后写入 docs/
3. 【门控】计划经用户批准
4. 实施（executing-plans）：按计划小步修改
5. 验证（verification-before-completion）：运行 npm run build / 测试
6. 审查（code-review-and-quality）：合并前检查
```

### 配套规则

- 未经同意，不主动重构、格式整理、无关优化
- 讨论中发现可行方案时先**提出方案**，不直接动手
- 用户说"先讨论/看看怎么做"时，只讨论不改码

## 构建和开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器（http://localhost:3000）
npm run dev

# 启动开发服务器并更换端口
npm run dev -- --port 3001

# 构建生产版本
npm run build

# 本地预览生产构建
npm run preview

# 启动本地 D1 后台服务端（需先执行 npm run build 生成 dist，http://localhost:8787）
npx wrangler pages dev dist --port 8787

# 部署到 Cloudflare Pages
npm run deploy
```

## 项目结构

```
src/
├── components/          # Vue 组件（对话框、卡片、侧边栏等）
│   └── settings/        # 设置面板子组件
├── composables/        # Vue 组合式函数（useAuth、useBookmarks 等）
├── views/              # 页面级组件（NavItemView）
├── utils/              # 辅助函数（categoryTree、helpers）
├── assets/             # CSS 样式（main.css，含 CSS 变量主题）
├── App.vue             # 根组件
└── main.js             # 入口文件
```

## 代码风格规范

### Vue 组件
- 使用 **Composition API** 和 `<script setup>` 语法
- 组件为 `.vue` 单文件组件
- 使用 `defineProps` 和 `defineEmits` 声明类型安全的 props 和 emits
- 推荐使用 scoped 样式（`<style scoped>`）

### 命名规范
- **组件**：PascalCase（`CategorySidebar.vue`、`BookmarkDialog.vue`）
- **Composables**：camelCase 并以 `use` 开头（`useAuth.js`、`useBookmarks.js`）
- **CSS 类名**：kebab-case（`.nav-bar-content`、`.bookmark-card`）
- **变量/函数**：camelCase（`fetchData`、`searchQuery`）
- **常量**：模块级使用 UPPER_SNAKE_CASE

### 导入顺序
- 使用 `@/` 别名导入 src 下的模块（如 `import { useBookmarks } from '@/composables/useBookmarks'`）
- Vue 内置模块：从 'vue' 导入
- 本地模块：使用路径别名
- 顺序：Vue 导入 → 外部库 → 内部别名 → 相对导入

### CSS 和主题
- 使用 `:root` 和 `html.dark` 中定义的 CSS 自定义属性（变量）
- 可用 token：`--primary`、`--bg`、`--text`、`--border`、`--radius`、`--transition` 等
- 主题感知组件通过 `html.dark` 选择器支持亮色和暗色模式
- 使用 `var(--variable)` 保持一致性
- 避免硬编码颜色值

### 错误处理
- API 函数返回 `{ success: boolean, error?: string, ... }` 对象
- 使用 try/catch 并提供适当的错误消息
- 通过调用 `logout()` 处理 401 未授权
- 使用 `useToast` 通过 toast 通知显示错误

### 类型安全
- 使用 JSDoc 标记复杂对象结构
- 尽量解构 props
- 使用 TypeScript 友好的 `ref()` 和 `computed()` 模式

### Composables 模式
- 为可复用逻辑创建 composables（auth、bookmarks、theme、toast 等）
- Composables 返回响应式状态和函数
- Composables 可以调用其他 composables（如 `useBookmarks` 调用 `useAuth` 和 `useToast`）

### API 模式
- 所有 API 调用通过 `/api/*` 端点（代理到 Cloudflare Workers）
- 通过 `useAuth` 的 `getAuthHeaders()` 添加认证头
- 使用 `apiRequest()` 包装器处理认证请求
- `fetchData()` 支持 `{ forceRefresh, background }` 选项控制缓存

### 性能优化
- 使用 `computed()` 处理派生状态
- 搜索输入使用 `utils/helpers.js` 中的 `debounce()`
- Vite 配置了代码分割：`vue-vendor`、`cf-vendor`、`composables`、`components` 分块
- 合理使用 `v-if` / `v-show`（从 DOM 移除 vs 隐藏）
- 状态变更后需要 DOM 更新时使用 `nextTick()`

## 测试

当前项目**没有配置测试文件**。添加测试时：
- 使用 Vitest（与 Vite 兼容）
- 放置在源文件旁：`*.spec.js` 或 `*.test.js`
- 运行单个测试：`npx vitest run src/components/SomeComponent.spec.js`

## 常用模式

### 对话框/模态框模式
- 使用 `<Teleport to="body">` 避免 z-index 问题
- 用 `<Transition name="modal">` 包裹实现动画
- 向父组件 emit confirm/cancel 事件

### 状态管理
- 使用带 `ref()` 的 composables 管理本地状态
- 使用 `computed()` 处理派生状态
- 父组件通过 props 接收状态，通过 emit 发送事件

### 乐观更新 + 回滚机制

项目采用**乐观更新**模式，在 API 请求返回前先更新本地状态，提升响应速度。

#### 核心流程（以 `saveBookmark` 为例）

```
1. 保存原始状态快照（originalBookmark）
2. 立即更新本地 bookmarks.value（乐观更新）
3. 发送 PUT 请求 await updateBookmark()
4. 请求失败 → 回滚 + toast 提示错误
   请求成功 → closeDetailModal()
5. fetchData 在后台静默同步（不阻塞 UI）
```

#### Rollback 机制

mutation 操作（如 `saveBookmark`）在 `try/catch` 中捕获失败：

```javascript
// 失败时回滚到原始状态
bookmarks.value = bookmarks.value.map(b => {
  if (b.id === originalBookmark.id) return originalBookmark
  return b
})
errorToast(result.error || '保存失败，请重试')
```

#### 后台静默同步

`updateBookmark` 成功后调用 `fetchData({ forceRefresh: true })` **不 await**，让它在后台运行：

```javascript
if (result.success) {
  fetchData({ forceRefresh: true })  // 非阻塞，后台同步
  return { success: true }
}
```

这样用户感知到的响应是：弹窗秒关，数据最终一致性由后台 fetch 保证。

#### 已知风险

| 风险 | 处理方式 |
|------|----------|
| 服务器更新失败但本地已乐观更新 | catch 中回滚 + toast |
| 并发冲突（多 Tab 同时修改） | 无特殊处理，下次 fetchData 覆盖 |
| 网络异常 | 回滚 + toast 提示"保存失败，请重试" |

### 写操作的三段式 Toast（新增 / 编辑 / 删除）

nav 模式下新增、编辑、删除书签复用**同一条 toast 就地更新**，不再各弹一条结果提示：

| 阶段 | 文案 | 触发 |
|------|------|------|
| `saving` | 正在保存到云端… | 写请求发出前 |
| `syncing` | 已保存 · 正在同步列表… | 写请求成功、`fetchData` 前 |
| `done` | 已同步 | 两次 GET 完成，1.5s 后自动收起 |
| `sync-failed` | 已保存，但列表同步失败 | `fetchData` 失败，4s 警告 |

- `useBookmarks.addBookmark / deleteBookmark / updateBookmark` 接受 `{ onPhase }`；`fetchData` 返回成功与否，并支持 `silent` 抑制自身错误 toast。
- `ToastNotification` 提供 `loading()`（常驻、不自动消失）与 `update(id, patch)`；`useToast` 同步透出。
- 写请求失败时由调用方把同一条 toast 改为红色错误态，不新开第二条。
- 编辑保存**不做差异判断**：每次点击保存都 PUT D1 并走三段提示，避免「点了没反应」；分类变化时完成文案为「已同步 · 已移动到「X」」。
- 编辑的列表同步仍在后台进行，不阻塞弹窗关闭；同步结束后再推进 toast。
- 目前仅 nav 模式接入；设置页与默认模式仍用原有结果 toast。

### 响应式设计
- 使用 CSS 媒体查询设置断点（768px、1024px）
- 采用桌面端优先，移动端覆盖的方式
- 书签卡片网格：`repeat(auto-fill, minmax(200px, 1fr))`

## 代码检查

项目未配置 ESLint。提交前：
- 运行 `npm run build` 验证构建成功
- 检查开发环境控制台是否有错误

## Git 工作流程

**重要**：修改代码后要及时提交 git，但**不要主动 push 到远程仓库**。

- 完成功能或修复后尽早提交
- 提交信息应简洁描述变更内容
- 仅在用户明确要求时才推送到远程仓库

## 风格切换（displayMode）

### 两种风格模式

| 模式 | displayMode 值 | 说明 |
|------|---------------|------|
| 默认风格 | `'default'` | 标准书签管理界面，支持分类侧边栏、编辑模式等完整功能 |
| 导航站风格 | `'nav-item'` | 简洁的导航站界面，顶部导航菜单 + 搜索框 + 卡片网格 |

### 存储策略

**重要**：`displayMode` 仅保存在本地 `localStorage` 中，**不同步到 D1 数据库**，以确保各设备风格偏好独立。

```javascript
// useSettings.js
const displayMode = ref(localStorage.getItem('displayMode') || 'default')

const toggleDisplayMode = () => {
  displayMode.value = displayMode.value === 'default' ? 'nav-item' : 'default'
  localStorage.setItem('displayMode', displayMode.value)
}
```

### 相关文件

| 文件 | 作用 |
|------|------|
| `src/composables/useSettings.js` | displayMode 状态定义、切换逻辑 |
| `src/App.vue` | 根组件，根据 displayMode 条件渲染不同视图 |
| `src/views/NavItemView.vue` | 导航站风格页面组件 |
| `src/components/NavBar.vue` | 导航站风格的顶部导航栏（含风格切换、登录/头像按钮） |
| `src/components/NavSearch.vue` | 导航站风格的搜索组件 |
| `src/components/NavCardGrid.vue` | 导航站风格的书签卡片网格 |
| `src/components/settings/AppearanceSettings.vue` | 设置页面中的风格切换开关 |

### 导航站布局

导航站模式采用三段式布局：
```
[ 左侧10%空白 ] [ 中间80%菜单/内容 ] [ 右侧10%按钮区 ]
```

- **左侧10%**：空白区域（`.nav-left-space`）
- **中间80%**：菜单栏（`.nav-bar-container`）和书签卡片网格（居中）
- **右侧10%**：功能按钮区（`.nav-right-area`），左对齐，包含：
  - 风格切换按钮（始终可见）
  - 登录按钮（未登录）或头像菜单（已登录）

### CSS 布局结构

```css
.nav-bar {
  display: flex;
}
.nav-left-space { flex: 0 0 10%; }
.nav-bar-container { flex: 0 0 80%; }
.nav-right-area { flex: 0 0 10%; }
```

### 切换入口

1. **默认风格**：
   - 右上角风格切换按钮（登录/头像按钮左侧）
   - 设置 → 外观 → 风格开关
2. **导航站风格**：
   - 顶部导航栏右侧按钮（始终可见）
   - 设置 → 外观 → 风格开关

### 注意事项

- `loadSettingsFromDB()` **不会**从 D1 加载 displayMode，避免登录后覆盖本地偏好
- 风格设置为纯本地行为，不会同步到其他设备
- 导航站风格下右侧按钮区独立于80%菜单区域，始终可见
- 导航站模式支持完整的登录/登出功能和设置页面访问

## 导航站搜索结果展示

站内搜索（Google/Baidu/Bing/GitHub 除外）的结果**不再以弹窗显示**，而是在 `content-section` 卡片区域直接展示。

### 触发搜索结果的方式

| 触发方式 | 组件/位置 | 行为 |
|----------|-----------|------|
| 搜索框输入 + 回车 | `NavSearch.vue` → `searchInSite()` | 在 content-section 显示匹配书签 |
| 点击卡片上的标签 | `NavCardGrid.vue` → `@tag-click` → `handleTagClick` | 进入**标签筛选视图**（见下方「导航站标签浏览」，不再写入搜索框） |
| 点击标签行 / 全部标签弹窗 | `NavItemView.vue` → `handleTagClick` | 同上 |
| 点击搜索框的 X 清除按钮 | `NavSearch.vue` → `clearSearch()` | 清除搜索结果显示，恢复分类浏览 |

### 释放搜索结果的时机

当以下任一事件发生时，搜索结果被清除，恢复分类浏览模式：

1. **点击顶部菜单分类** → `handleSelectMenu` → `clearSearchResults()`
2. **点击子菜单** → `handleSelectSubMenu` → `clearSearchResults()`
3. **点击搜索框 X 按钮** → `emit('clear-results')` → `clearSearchResults()`

### 核心实现

#### NavSearch.vue — 事件驱动

```javascript
// 搜索组件不再管理弹窗状态，改为 emit 事件
const emit = defineEmits(['search-results', 'clear-results'])

const searchInSite = () => {
  // ... 执行搜索 ...
  searchResults.value = results
  emit('search-results', results)  // 发送给父组件
}

const clearSearch = () => {
  searchQuery.value = ''
  emit('clear-results')  // 通知父组件清除搜索结果
}

// 父组件点标签时需要清空搜索框文本（clearSearch 不会触发标签筛选）
defineExpose({ clearSearch })
```

#### NavItemView.vue — 状态驱动

```javascript
// 搜索结果状态
const searchResults = ref(null)

// 搜索结果优先于分类书签
const currentBookmarks = computed(() => {
  if (searchResults.value) {
    return searchResults.value  // 有搜索结果时直接返回
  }
  // 否则按分类 + 标签筛选返回书签
  // ...
})

const clearSearchResults = () => {
  searchResults.value = null
  animationKey.value++
}

// 父组件监听 NavSearch 的事件
// @search-results="handleSearchResults"  →  设置 searchResults
// @clear-results="clearSearchResults"   →  清除搜索结果
```

### 相关文件

| 文件 | 作用 |
|------|------|
| `src/components/NavSearch.vue` | 搜索组件，emit `search-results` 和 `clear-results`，暴露 `clearSearch()` |
| `src/views/NavItemView.vue` | 管理 `searchResults` / `activeTags` 状态，`currentBookmarks` 根据搜索/标签/分类返回不同数据 |
| `src/components/NavCardGrid.vue` | 书签卡片网格，接收 `currentBookmarks` 并展示；`groups` prop 非 null 时按分类分组 |

### 后续开发提示

- 如果需要区分"搜索结果显示"和"分类浏览"的视觉样式，可以在 `NavCardGrid` 中通过 `searchResults.value !== null` 判断
- 搜索结果的排序默认跟随书签的 `position` 字段，如需自定义排序可修改 `currentBookmarks` 中的逻辑
- 标签筛选不再经过搜索框：`handleTagClick` 调用 `navSearchRef.value?.clearSearch()` 只清空输入，再用 `activeTags` 驱动结果视图
- **顺序约束**：`clearSearch()` 会同步 emit `clear-results` → `clearSearchResults()` 清空 `activeTags`，所以 `handleTagClick` 必须**先算出 next 再清搜索框**，否则多标签累加会被抹掉

## 导航站标签浏览

nav 模式支持按标签浏览书签，访客与登录用户均可用。标签行固定在搜索框下方（`category-tabs` 位置），不改变 nav 结构。标签筛选支持**多标签同时满足（AND）**。**搜索结果展示时整行隐藏**（`!searchResults`），清空搜索后恢复——搜索态下同屏出现标签行会让「点标签」静默丢弃搜索结果。

### 界面结构

| 位置 | 内容 |
|------|------|
| 标签行 | 全站最热 10 个标签（按数量降序）+ 末尾虚线胶囊「全部标签 N ›」；可多个同时实心 |
| 吸顶容器 | `.tag-filter-sticky` 包住标签行 + 上下文栏，**仅 `activeTags` 非空时**吸顶 |
| 全部标签弹窗 | 居中弹窗（复用 `BaseDialog`），搜索 + 数量/名称排序 + 每个标签计数；点标签**切换选中且不关闭**，可连续选多个 |
| 上下文栏 | 每个选中标签一个可 × 胶囊（带全站数量）+ 命中数 + 涉及分类数 + 「清除筛选」 |
| 标签结果卡片 | 按**菜单顺序**分组，组头为 `父路径 / 分类名 + 数量`；组内按 `position`，未分类最后 |

### 多标签 AND

- 语义：书签的标签集合必须**包含全部选中标签**（不是任一）。
- 交互：点标签**累加**，再点同一标签**取消**（大小写忽略）。
- 三个入口行为一致：标签行 / 全部标签弹窗 / 卡片上的标签。
- 标签上的数字徽标保持**全站数量**，不随筛选联动。
- 弹窗底部：`已选 N 个 · 当前命中 M 个书签`；未选标签时显示 `共 T 个标签 · 覆盖 B 个书签`（T/B 为全站统计，不是已选数量）。
- 空态：单标签为 `没有带“A”标签的书签`；多标签为 `没有同时带「A、B」标签的书签`。

### 吸顶规则

- `.tag-filter-sticky.is-pinned`：`position: sticky; top: var(--nav-bar-height, 56px); z-index: 60`。
- 背景 `var(--nav-glass)` + `backdrop-filter: blur(20px) saturate(1.4)`，与 `NavBar` 一致；底部加 `1px` 边框和轻微阴影。
- `z-index: 60` 必须低于 `NavBar`（100）与下拉（200/300）。
- `≤640px` 吸顶时标签行改为 `flex-wrap: nowrap` + 横向滚动、左对齐，避免堆成多行压住卡片。
- 普通浏览（无标签筛选）**不吸顶**，不占常驻空间。

### 关键规则

- 标签匹配、统计、排序全部**忽略大小写**；展示用首次出现的写法（上下文栏也用规范写法）。
- 同一书签内重复标签（含大小写差异）只计一次。
- 标签视图期间顶部菜单不高亮任何分类，但保留 `activeMenu` / `activeSubMenu`；清除筛选后恢复。
- 标签视图**禁用卡片拖拽**（`canReorder` 为 false，且 `NavCardGrid` 分组态有额外守卫）；`POST /api/reorder` 会把传入 id 的 `position` 全量重写。
- 状态互斥：标签 / 搜索 / 分类三者任意切换都会清掉另外两个；`handleTagClick` **先算 next 再 `clearSearch()`**（`clear-results` 会清空 `activeTags`）。
- 标签行在搜索态隐藏；但搜索结果**卡片上的标签仍可点击**，点击会退出搜索并进入标签筛选（与标签行规则相同，属保留行为）。
- 标签失效：`pruneMissingTags` 只移除数据刷新后消失的标签，其余选择保留。
- 组头是原生 `<button>`，可键盘回车跳转；未分类组头 `disabled`。

### 相关文件

| 文件 | 作用 |
|------|------|
| `src/utils/tagBrowse.js` | 纯函数：`parseTags` / `buildTagStats` / `countBookmarksWithTags` / `normalizeTagList` / `toggleTagSelection` / `matchesAllTags` / `pruneMissingTags` / `buildTagGroups`（AND）/ `filterAndSortTags` |
| `src/components/TagOverviewDialog.vue` | 多选弹窗：emit `toggle`，不自动关闭；底部已选/命中摘要 + 「完成」 |
| `src/components/NavCardGrid.vue` | `groups` / `emptyText` / `group-click`；分组态禁用拖拽 |
| `src/views/NavItemView.vue` | 标签行、吸顶容器、`activeTags` / `tagGroups` / `tagMatchCount`、组头跳分类、菜单高亮开关 |
| `tests/tag-browse.test.js` | 15 个 Node 单测，`npm run test:tags` |

## 导航站卡片拖拽排序

nav 模式下支持在**当前分类内**拖拽卡片调整顺序，复用后端 `POST /api/reorder`（`useBookmarks.reorderItems('bookmarks', items)`）。

### 触发条件（canReorder）

`NavItemView.vue` 的 `canReorder`：**已登录 + 浏览某分类 + 非搜索结果 + 非标签筛选** 时才允许排序。不满足则把手不渲染、不可拖。

### 交互

| 阶段 | 行为 |
|------|------|
| hover 卡片 | 右上角出现**拖拽把手**（`NavCard` 内 `draggable` 元素），点卡片本体仍打开 URL |
| 拖动到目标卡 | 以该卡**水平中线**分界：左半显示蓝条+「插入左侧」，右半「插入右侧」，随指针实时切换 |
| 拖动到网格空白区 | 显示**视口底部固定**的「移动到末尾」，松手该卡追加到末尾 |
| 拖动期间 | **固定顶部 NavBar 上滑隐藏**（`drag-reordering` 类 + `:deep(.nav-bar)`），`search-section` 顶部留白压缩到 `1rem`，松手恢复 |
| 松手 | 乐观重排 → `reorderItems` 持久化 → 后台 `fetchData` 同步；失败回滚 + toast |

### 数据流

```
NavCard（dragstart/drop）→ NavCardGrid（计算重排 items）→ NavItemView（handleReorder 乐观更新+持久化）→ /api/reorder
```

- `NavCard` emit：`dragstart`、`dragend`、`drop`（含 `draggedId/targetId/position/draggedBookmark`）
- `NavCardGrid` emit：`dragstart/dragend`（转发，供拖时隐藏菜单）、`reorder`（`[{id, position}]`）
- 空白区置底：`handleGridDrop` 把拖拽卡移到 `bookmarks` 末尾

### 相关文件

| 文件 | 作用 |
|------|------|
| `src/components/NavCard.vue` | 拖拽把手、dragstart/drop、插入左右条+文字提示（`drop-before`/`drop-after`）、`reorderable` prop |
| `src/components/NavCardGrid.vue` | 转发拖拽生命周期、`handleCardDrop` 重排、空白区置底（`gridAppendActive` + 固定「移动到末尾」提示） |
| `src/views/NavItemView.vue` | `canReorder`、`handleReorder`（乐观更新+回滚+持久化）、拖拽期间隐藏 NavBar |

### 已知限制

- **无滚轮控制**：原生 HTML5 `draggable` 拖拽期间浏览器**不派发 `wheel` 事件**，无法在拖拽时用滚轮滚动。长列表定位靠①视口边缘原生自动滚动、②空白区置底。曾尝试 `window.addEventListener('wheel')` 无效，已回滚（commit `db7b386`）。
- **不要用占位格 `<div>` 做插入指示**：`auto-fill` 网格插入占位格会触发整行重排 → 拖拽时卡片闪烁 + 松手时落点错位。必须用不影响布局的 `outline`/`inset box-shadow` + drop 时按 `dropInfo` 算终序（commit `1b74ca5`）。
- **拖拽交互无法自动化验证**：需登录态浏览器会话（登录需用户接管），手动验证把手/指示条/落位行为。

## 导航站菜单拖拽排序

nav 模式下支持在**同一父级内**拖拽菜单项调整顺序，覆盖根菜单、下拉第一层及更深的每一级。复用后端 `POST /api/reorder`（`useBookmarks.reorderItems('categories', items)`），**只写 `position`，不写 `parent_id`**。

### 触发条件

- `NavItemView` 将 `isAuthenticated` 传给 `NavBar` 的 `reorderable`，只有登录后才渲染拖拽把手。
- `/api/reorder` 的 POST 不在公开读名单内，未登录返回 401，服务端二次兜底。
- 触摸设备（`@media (hover: none)`）隐藏把手：原生 HTML5 拖拽在触屏不工作。

### 统一机制（useMenuReorder）

`src/composables/useMenuReorder.js` 是唯一拖拽状态机，根菜单与所有下拉层级共用：

| 状态/方法 | 说明 |
|-----------|------|
| `draggingId` / `draggingParentId` | 被拖项及其父级 |
| `targetId` / `targetParentId` / `dropPosition` | 当前落点与 `before`/`after` |
| `beginDrag` / `hoverItem` / `dropItem` / `endDrag` | 生命周期入口 |
| `rowState(id)` | 返回 `{ dragging, before, after, forbidden }`，组件映射成 class |
| `dropCue(id)` | 返回 `before`/`after`，用于目标项旁的「插入…」胶囊 |
| `wasJustDragging()` | 松手后 300ms 内抑制误触发的点击 |

核心规则：**只有 `draggingParentId === targetParentId` 才认可落点**；父级不同时显示禁止样式与提示，松手不产生任何写入。落点方向由 `resolveDropPosition(event, element, 'horizontal' | 'vertical')` 按目标元素中线计算。

### 交互

| 阶段 | 行为 |
|------|------|
| hover 菜单项 | 左侧出现抓手（`v-tooltip` 提示「按住并拖动，调整同级顺序」，悬停 500ms 显示），热区 10px，绝对定位在行内留白中 |
| 拖拽开始 | 被拖整项：主色 14% 浅底 + 主色文字 + 1px 虚线描边 + 85% 不透明度；抓手保持高亮；tooltip 主动收起 |
| 同级落点 | 目标项 2px 描边 + 4px 插入条；根级显示「插入左侧/右侧」，下拉层显示「插入上方/下方」胶囊 |
| 跨父级落点 | 目标项红色虚线描边，不显示插入条与胶囊；视口底部提示「只能在同一层级内排序 · 跨层级请到 设置 → 菜单 修改父分类」 |
| 无效松手 | 不写入，warning toast「只能在同一层级内排序」 |
| 有效松手 | 乐观更新组内 `position`（1..n）→ `reorderItems` → 失败回滚 + toast |
| 拖拽期间 | 冻结下拉展开/收起与隐藏定时器（根 200ms / 移动端 2000ms、嵌套浮层 100ms），避免拖到一半浮层被销毁 |

### 选中与祖先标记

- `NavItemView` 计算 `activePath`（根 → 当前选中项），传给 `NavBar` 与各级 `NavMenuItem`。
- 当前项：主色文字 + 左侧 3px 主色竖线；祖先按距离递减：`100% / 55% / 35% / 22% / 15%`（父级 55%，祖级 35%），竖线宽 2px、颜色与文字同步变淡。
- 根菜单按同一距离递减文字与背景强度（背景 `18% / 10% / 6% / 4% / 3%`），使三级选中时能顺着二级父项找到根分类。
- 竖线用 `::before` 绝对定位，不参与布局；**禁止用“实心底 + 内侧白条”组合**，两者叠在圆角里会看成两个重叠矩形。

### 数据流

```
NavBar / NavMenuItem（共用 useMenuReorder）
  → NavBar emit reorder-categories { parentId, ids }
  → NavItemView.handleMenuReorder（快照 → 乐观改 position 1..n）
  → reorderItems('categories', [{ id, position }])
  → POST /api/reorder（只更新 categories.position）
```

- 顺序未变、拖到自身、拖到无效区域都不发请求。
- 失败时按快照回滚该组 `position` 并提示。
- 与设置页菜单 Tab 的区别：nav 导航栏是**即时保存**；设置页是“待保存 → 确认”（`useCategoryEditor.confirmSave`）。
- **跨父级移动不在本机制内**：`/api/reorder` 不写 `parent_id`。改父级仍走设置 → 菜单 → 右侧「父分类」表单（已知：设置页把分类拖到另一分类上只改本地，保存不会落库父级）。

### 相关文件

| 文件 | 作用 |
|------|------|
| `src/composables/useMenuReorder.js` | 统一拖拽状态机、同父级判定、落点方向、提示文案 |
| `src/components/NavBar.vue` | 根菜单把手与横向拖拽、冻结 hover 定时器、底部提示条（Teleport）、emit `reorder-categories` |
| `src/components/NavMenuItem.vue` | 各层级纵向拖拽、递归透传 `reorder` / `activePath`、祖先递减标记 |
| `src/views/NavItemView.vue` | `activePath`、`handleMenuReorder`（乐观更新+回滚+持久化）、传入 `reorderable` |

### 布局与已知限制

- 抓手绝对定位在行内左留白中（根菜单 `left: 4px`，下拉行 `left: 3px`），**不占布局宽度**；下拉行 `padding-left: 1rem`，抓手需保持在该留白内，避免压住文字。
- 插入指示只用 `outline` / `inset box-shadow` / 绝对定位胶囊，不插占位元素，避免重排闪烁。
- 原生 HTML5 拖拽期间无法滚轮滚动；触摸端不可用。
- 拖拽交互需要登录态浏览器手动验证（把手、插入条、落点、刷新后顺序保持、断网回滚）。

## 导航站菜单内联新建分类

nav 模式下可在菜单栏直接新建分类，覆盖根分类与各层级子分类，仅登录态显示入口。

### 入口

| 位置 | 父级 | 说明 |
|------|------|------|
| 导航栏根菜单末尾「＋」 | `null`（根分类） | 仅登录态渲染 |
| 有子项的下拉/浮层底部「＋ 新建子分类」 | 当前菜单 id | 自动带入父级 |
| 叶子菜单 hover 右侧「＋」 | 该菜单 id | 叶子没有下拉/浮层，用行内＋补齐；触屏隐藏 |

- 深度达到 5 层时隐藏子级入口，服务端仍二次校验。
- 入口显示条件沿用 `reorderable`（= `isAuthenticated`），未登录服务端返回 401。

### 弹窗（CategoryCreateDialog）

`src/components/CategoryCreateDialog.vue`：分类名称 + 父分类选择。

- 打开时按点击位置预填父分类：根级＋为「作为根分类」，子级/叶子＋为该项完整路径。
- 父分类可搜索、可修改，最终以选择结果为准（不强制锁定点击位置）。
- 名称为空或提交中时「创建」禁用；失败（重名 409 / 父级不存在 / 超过 5 层）保留弹窗与已填内容并 toast；成功后关闭并刷新。
- 创建后保持当前浏览分类不变。

### 数据流

```
NavBar / NavMenuItem（emit create-category(parentId)）
  → NavItemView.handleCreateCategory（打开弹窗）
  → CategoryCreateDialog emit confirm({ name, parentId })
  → useBookmarks.addCategory(name, parentId)
  → POST /api/categories（父级校验、depth、同父级重名、position 末尾）
  → fetchData({ forceRefresh: true })
```

### 相关文件

| 文件 | 作用 |
|------|------|
| `src/components/CategoryCreateDialog.vue` | 名称 + 父分类选择弹窗（导航栏主题） |
| `src/components/NavBar.vue` | 根级＋、下拉底部入口 |
| `src/components/NavMenuItem.vue` | 各级浮层底部入口、叶子行内＋、depth 传递 |
| `src/views/NavItemView.vue` | 打开弹窗、调用 `addCategory`、成功/失败处理 |

### 样式约束

- 新建入口是次级操作：字号 12px（菜单项 14px），图标 12px。
- 该行 `white-space: nowrap`；下拉用 `width: max-content`（上限 320px），**不要用固定 `min-width`**，否则短菜单会被撑出大块留白。
- 嵌套浮层在移动端恢复 `width: auto`，避免横向溢出。

### 已知限制

- 父分类允许修改（产品选择），不是严格绑定入口位置。
- 第 5 层分类仍会出现在父级下拉，选中后服务端拒绝并 toast；如需可改为过滤/置灰。
- 设置页“新增分类”仍使用设置面板自带弹窗（局部主题变量耦合），导航栏使用 `CategoryCreateDialog`；如要统一为共享组件，需要把强调色/表单样式参数化。

## 统一书签搜索（src/utils/search.js）

### searchBookmarks(bookmarks, query, options)

nav 模式下 NavSearch.vue 和 NavSettingsModal.vue 共享的搜索函数。

```javascript
import { searchBookmarks, SEARCH_FIELD_OPTIONS } from '@/utils/search'

// 默认搜索 name/url/description/tags/notes 全字段
searchBookmarks(bookmarks, 'vue')

// 指定单字段搜索
searchBookmarks(bookmarks, 'vue', { field: 'name' })

// 指定多字段搜索
searchBookmarks(bookmarks, 'vue', { fields: ['name', 'url'] })
```

### SEARCH_FIELD_OPTIONS

```javascript
[
  { value: 'all', label: '全部字段' },
  { value: 'name', label: '名称' },
  { value: 'url', label: 'URL' },
  { value: 'description', label: '描述' },
  { value: 'tags', label: '标签' },
  { value: 'notes', label: '备注' },
]
```

### 字段筛选按钮 + 下拉菜单

两处搜索框都实现了字段筛选按钮：

| 位置 | 文件 | 可见条件 |
|------|------|----------|
| 主页搜索框 | `NavSearch.vue` | 仅选中"站内"搜索引擎时显示 |
| 设置-书签搜索框 | `NavSettingsModal.vue` | 始终显示 |

下拉菜单通过 `<Teleport to="body">` + `position: fixed` 渲染，避免 stacking context 层级问题。点击外部自动收起。按钮始终显示当前选中的字段名。

### CSS 样式规则

NavSearch.vue 使用 scoped 样式 + `--nav-*` 全局变量。
NavSettingsModal.vue 使用 non-scoped `<style>` 块 + 全局变量（`--text-tertiary`、`--bg-secondary`、`--border`、`--success`、`--text`），因为 Teleport 到 body 后 scoped CSS 变量不生效。

**修改搜索字段**：只需改 `searchBookmarks()` 的默认 `fields` 数组和 `SEARCH_FIELD_OPTIONS` 即可，两处搜索框自动生效。

## 浏览器扩展

### 构建与打包

```bash
# Windows（本机可用）
npm run ext:build:win

# Linux/macOS
npm run ext:build

# 共享逻辑单测（Node 内置 test runner，无需额外依赖）
npm run test:ext
```

- 产物固定输出到 `browser-extension/dist/`（已 gitignore）：`bookmark-manager-chromium.zip`、`bookmark-manager-firefox.zip`
- **不要再往 `browser-extension/` 根目录放 zip**（历史遗留包已删除，`.gitignore` 已加 `browser-extension/*.zip` 兜底）
- `package.ps1` 与 `package.sh` 各自维护文件白名单，**新增共享脚本（如 `shared.js`）必须同时加进两个脚本**，否则打包后会 `BMExt is not defined`

### 共享逻辑 shared.js（BMExt）

`browser-extension/shared.js` 用 IIFE 挂到 `globalThis.BMExt`，被 popup / options / background 三处共用；纯函数、不碰 DOM，可直接单测。

| 成员 | 作用 |
|------|------|
| `parseTokenExpiry(token)` | 解析 `timestamp.type.hash`，返回过期时间戳 |
| `shouldRenewToken(expiry, now)` | 是否进入续期提前量 |
| `cacheState(ts, now)` | `fresh`(<60s) / `stale`(60s~7d) / `old`(>7d) |
| `latencyLevel(ms)` | `fast`(≤500) / `medium`(≤1500) / `slow` |
| `formatLatency(ms)` | `68ms` / `1.2s` |
| `formatRelativeTime(ts, now)` | `刚刚` / `30 秒前` / `5 分钟前`（胶囊面板用，保持短文本） |
| `buildDuplicateHint(bookmark)` | 内联查重提示文案 |

token TTL 必须与 `functions/_middleware.js` 的 `validateToken` 保持一致：`long` 30 天、`short` 30 分钟。

### popup 首屏（stale-while-revalidate）

`popup.js` 的 `init()` 顺序：

1. 读 settings → 无 `serverUrl` / `authToken` 直接显示 `auth-section`
2. token 已过期且未开自动续期 → 清 token，显示「登录已过期」
3. 读 `prefetchCache` → **先渲染表单**（分类为空时才禁用输入框）
4. 缓存非 fresh 或无分类 → 后台 `refreshBootstrap()`，不阻塞界面
5. `getTabInfo()` 与 `schedulePingIfIdle()` 并行

- `/api/bootstrap` 一次返回 `categories` + `tags`；遇 404/405/401/403 或返回非 JSON（被 SPA 重写成 HTML）时回退 `refreshLegacyData()` 的两个旧请求
- `sessionEpoch` 在切换服务器 / 重新登录时递增，用于丢弃在途响应，避免分类串台

### 连接延迟胶囊

唯一的连接状态展示，位于标题行右侧（`#connection-main`），不再有独立状态栏：

| 状态 | 文案 |
|------|------|
| 正常 | `68ms`；缓存超 7 天为 `68ms · 旧` |
| 后端无 `/api/ping` | 最近一次真实请求耗时（请求名前缀只在详情里看） |
| 加载中 / 尚无数据 | `连接中…`（**绝不显示"已连接"这种无数据支撑的状态**） |
| 失败 | `分类加载失败`（灰点） |
| 未登录 / 过期 | `未连接` / `登录已过期` |

- 点击胶囊 = 展开/收起详情面板：最近 5 次请求耗时、查重结论、后端能力提示、失败时的「重试」、`ping` 可用时的「重新测速」、缓存较旧说明
- 计时来源优先级：**`/api/ping` 的纯连接耗时优先**，其次才是最近一次真实请求（`recordTiming`）。原因：bootstrap 这类批量接口要 1~2s，用它当"连接延迟"会让冷启动看起来像网络故障（曾出现「已连接(灰) → 1.9s(红)」的误导状态）
- 打开 300ms 后主动测速；10 秒内复用上次结果，不重复请求
- **测速前先等在途请求落地**：`apiFetch` 维护 `activeRequests`，`waitForRequestsIdle()` 最多等 1.2s。bootstrap 动辄 1~2s，与 ping 并发会把延迟一起拖高，看起来像服务端问题
- **只认 JSON + `{ok:true}`**：200 不代表是 ping。别的 CF 项目可能被 SPA 兜底或 Cloudflare Access 登录页接走（返回 200 HTML）或 302 跳转；这类响应判定为「后端无 `/api/ping`」并降级，**不能把首页下载时间当延迟**。降级后面板补一行「后端无 /api/ping，延迟取自最近一次请求」
- **失败要留痕**：ping 失败（超时/网络错误/非 2xx）写入一条 `测速（失败）` 记录，胶囊显示「测速失败」而不是继续挂着上一次的成功数字；若此前成功过，面板补一行「最近测速成功：X 分钟前（Nms）」
- 胶囊 `max-width: 104px`（`styles.css`）：**只放数值或 4 字以内的状态**，相对时间、来源说明一律放详情面板，避免标题行被挤占
- 「重新测速」点击后：按钮先变「测速中…」并禁用 → 结果写入 `requestTimings`（面板新增一行 `测速 124ms`）→ 胶囊数字同步更新；失败时按钮变「测速失败，再试一次」。**不要只改胶囊数字**，几毫秒的差异用户看不出来，会被当成"点了没反应"
- 切换服务器（`resetSessionState`）必须清空 `lastPingMs` / `lastPingAt` / `lastPingFailAt`，否则会把旧服务器的延迟显示给新服务器
- `renderConnection(state)` 只负责渲染；重试回调存 `pendingRetry`，由面板按钮触发，点击后自动收起面板

### URL 查重（内联提示）

- 触发：打开弹窗自动填 URL 后立即查、URL 输入停顿 600ms、`blur`、保存返回 409
- 后端 `GET /api/bookmarks?url=` 正常返回 `{ data, exactUrl: true }`；**旧后端忽略 `url` 参数返回全量列表（无 `exactUrl`）时，改为本地逐条归一化比对**，不能直接判定重复
- **等价规则（前后端必须一致）**：`functions/api/bookmarks/_shared.js` 的 `getUrlComparisonVariants` 生成变体集合，忽略三类差异 —— `http`/`https`、`www.`/非 `www.`、**任意路径**的尾部斜杠。变体对输入是对称的，所以只需用输入的变体去 `b.url IN (...)` 精确匹配即可（保留 `url` 索引）。客户端 `normalizeUrlForCompare` 用同一套规则（去掉协议与 `www`、去掉尾部斜杠）生成比对键
- **URL 必须以 `tab.url` 为准**：`getTabInfo()` 里只有在用户真正 `keydown`/`paste` 过 URL 字段（`urlEditedByUser`）时才保留输入值；**不要用 `formDirty` 或「字段已有值」判断**。浏览器自动填充/表单恢复也会写入并触发 `input`，但它不产生 `keydown`/`paste`——一旦用「已改过」来判断，旧 URL 会顶掉 `tab.url`，查重就会去查一个用户根本没在看的地址（曾出现：面板显示「未找到匹配」，实际查的是自动填充留下的 `...?from=old`；表单改成先渲染后这个竞态才暴露）。输入框与 `<form>` 也加了 `autocomplete="off"` 从源头减少自动填充
- 结果同时记进 `duplicateCheckInfo`，详情面板显示「已存在（分类）/ 未找到匹配 / 旧后端无 exactUrl / 请求失败」；**未命中时附带比对键**（如 `比对 expreview.com/ketang`），用于对照存储值找出真正的差异（query、fragment、不同路径）
- `/api/bootstrap` 回退旧接口时 `backendFallback` 置位，面板显示「后端缺少 /api/bootstrap，已回退旧接口」，用于识别扩展与后端版本不一致

### toast

- 位于 `.sticky-top` 内，`width: fit-content`：出现时把表单轻微下推，**不遮挡字段、不超视口**
- 保存成功：先 `showToast`，**1 秒后再 `window.close()`**；不要缩短，否则用户看不到提示

### 弹窗高度

- `body` 不要写 `min-height`：弹窗高度由内容决定，写死会在底部留白
- 未登录页需要撑一点高度，用 `#auth-section:not(.hidden) { min-height: 200px; display: flex; ... }`
- 必须带 `:not(.hidden)`，否则 ID 选择器优先级压过 `.hidden`，登录页会永远显示

### 本地安装与验证

- Chrome/Edge：`chrome://extensions` → 开发者模式 → 「加载已解压的扩展程序」指向 `browser-extension/`；**改代码后点 ↻ 重新加载即可，不需要重装**
- Firefox：`about:debugging#/runtime/this-firefox` → 临时载入 `browser-extension/manifest.firefox.json`，改后点「重新载入」（Firefox 重启后临时扩展失效）
- `/api/ping`、`/api/bootstrap` 是新端点，需随主站一起部署（`npm run deploy` 或 Git 自动部署），否则扩展走降级路径（功能正常，只是没有一次请求与 ping 数值）

## 故障排查：白屏问题

Nav 模式（`displayMode === 'nav-item'`）白屏通常由以下原因导致：

### 1. 缺少 composable 的 import

**症状**：控制台有 `useXXX is not defined` 或 `useXXX is not a function` 错误。

**原因**：组件调用了某个 composable（如 `useCategoryEditor`）但没有 import 它。

**预防**：
- 重构时删除函数调用后，确保同步删除 import 语句
- 新增 composable 调用后，确保添加对应的 import
- 使用 `npm run build` 验证构建成功（构建时会更严格检查）

**检查方法**：
```bash
# 构建时会暴露缺失的 import
npm run build
```

### 2. 运行时错误静默失败

**原因**：部分错误在开发模式被 Vite 忽略，但生产构建会拒绝。

**预防**：
- 开发时经常用 `npm run build` 检查
- 关注开发服务器控制台的 Warning 和 Error

### 3. 循环依赖

**症状**：构建警告 `Circular chunk`，可能导致运行时异常。

**原因**：组件 → composable → 组件形成了循环引用。

**检查**：查看 `vite.config.js` 中的 chunk 分割配置是否合理。

### 快速恢复

如果遇到白屏，先尝试：
```bash
# 清除浏览器缓存（尤其 localStorage）
# 或者按 F12 打开控制台检查错误

# 重启开发服务器
npm run dev
```

## 数据库（Cloudflare D1）

```bash
# 创建新的 D1 数据库
npm run db:create

# 初始化本地数据库
npm run db:init:local

# 初始化远程数据库
npm run db:init:remote

# 在远程运行迁移
npm run db:migrate:indexes
```

## useCategoryEditor composable

分类编辑器 composable，提供分类树的构建、选择、编辑、拖拽排序等完整功能。

### 引入

```javascript
import { useCategoryEditor } from '@/composables/useCategoryEditor'
```

### 主要状态

| 状态 | 类型 | 说明 |
|------|------|------|
| `categoryTree` | `ComputedRef<Category[]>` | 嵌套结构的分类树 |
| `categoryFlatList` | `ComputedRef<FlatCategory[]>` | 带 depth 信息的扁平列表 |
| `selectedCategoryId` | `Ref<string \| null>` | 当前选中的分类 ID |
| `selectedCategory` | `ComputedRef<Category \| null>` | 当前选中的分类对象 |
| `expandedCategoryIds` | `Ref<string[]>` | 展开的分类 ID 列表 |
| `editForm` | `Reactive<{ name, parentId, position, maxPosition }>` | 编辑表单状态 |
| `dragState` | `Reactive<{ draggingId, dropTargetId, dropPosition }>` | 拖拽状态 |
| `dragHintText` | `ComputedRef<string>` | 拖拽提示文本 |

### 主要函数

#### 选择与展开

```javascript
// 选择分类进行编辑
selectCategory(category)

// 切换分类展开/折叠
toggleExpand(categoryId)

// 重置编辑表单
resetEditForm()
```

#### CRUD 操作

```javascript
// 创建分类
createCategory(name, parentId = null, isPrivate = false)
// 返回 { success, error?, id? }

// 编辑分类
editCategory(id, name, parentId, isPrivate = undefined)
// 返回 { success, error? }

// 删除分类（会提示确认）
removeCategory(id)
// 返回 { success, error? }

// 应用编辑表单的更改
applyChanges()
// 返回 { success, error? }
```

#### 位置调整

```javascript
// 调整分类在同级中的位置
changePosition(delta) // delta 为 1 上移，-1 下移
```

#### 子项重排序（本地）

```javascript
// 在同级中移动子项
moveChildItem(parentId, childId, direction) // direction: 1 上移，-1 下移

// 获取子项索引
getChildIndex(parent, child)
```

#### 拖拽排序（stubbed for future API）

```javascript
onDragStart(event, category)
onDragEnd()
onDragOver(event, category)
onDrop(event, category)
```

### availableParentCategories

计算属性，返回可选的父分类列表。**排除自身及所有后代分类**，避免创建循环引用。

```javascript
availableParentCategories.value = [
  { id: 'xxx', displayName: '父分类/子分类', depth: 1, parent_id: 'xxx' },
  // ...
]
```

### findParent

查找分类的父分类。

```javascript
findParent(childId)
// 返回父分类对象或 null
```

### 使用示例

```javascript
const {
  categoryTree,
  selectedCategoryId,
  editForm,
  selectCategory,
  changePosition,
  createCategory,
  applyChanges,
  removeCategory
} = useCategoryEditor()

// 选择分类
selectCategory(category)

// 创建新分类
await createCategory('新分类', null)

// 调整位置
changePosition(1) // 上移
changePosition(-1) // 下移

// 保存更改
await applyChanges()

// 删除分类
await removeCategory(categoryId)
```

## NavSettingsModal 设置弹窗 UI 设计

`src/components/NavSettingsModal.vue` 是导航站模式的设置弹窗，包含以下 UI 设计决策：

### Sidebar 布局

| 属性 | 值 | 说明 |
|------|-----|------|
| 展开宽度 | `150px` | 固定宽度，`flex-shrink: 0` |
| 折叠宽度 | `52px` | 仅图标模式，隐藏文字和 footer |
| 折叠按钮 | sidebar-header 内"设置"标题旁 | `◀` / `▶` 图标切换 |
| 折叠持久化 | `localStorage` key `navSettingsSidebarCollapsed` | 跨会话保存 |

### 关闭按钮

- X 关闭按钮位于 modal **右上角**（`position: absolute; top: 16px; right: 16px; z-index: 10`）
- 样式沿用原 `.sidebar-close`（hover 变红色）

### 书签 Tab — 粘性分类分组

书签列表按 `category_id` 分组渲染，每组上方有分类 header：

- **分组逻辑**：`groupedBookmarks` computed 按 `categoryFlatList` 顺序排序，无分类的书签归入"未分类"
- **粘性 header**：`.bookmark-group-header { position: sticky; top: 0; z-index: 1 }`，滚动时当前分类 header 固定在顶部
- **header 内容**：左侧彩色竖条（`3px var(--accent)`）+ 分类名 + 数量 badge
- **书签项**：`padding: 10px 14px`，无缩进

### 相关状态

```javascript
// 书签 tab 状态
const bookmarkSearch = ref('')           // 搜索关键词
const bookmarkCategoryFilter = ref(null) // 分类筛选
const selectedBookmarks = ref(new Set()) // 批量选中
```

### 注意事项

- 曾尝试 collapsed-groups-bar + IntersectionObserver/scroll 自动折叠功能，因效果不理想已移除
- 如需重新实现自动折叠，建议使用 `IntersectionObserver` 监听每组末尾的 sentinel 元素
- 折叠状态不保存到 localStorage（临时浏览偏好）

### 菜单 Tab — 分类管理

分类管理使用 `useCategoryEditor` composable，与默认风格共享同一套分类编辑逻辑：

| 功能 | composable 方法 | 说明 |
|------|----------------|------|
| 创建分类 | `confirmAddCategory(name, parentId)` | 调用 `useBookmarks.addCategory` API，成功后刷新数据 |
| 编辑分类 | `applyFormChanges()` | 修改分类名称、父分类 |
| 删除分类 | `confirmDelete(id)` | 删除分类及所有子分类 |
| 拖拽排序 | `onDragStart/onDragOver/onDrop` | 拖拽移动分类位置 |

**数据刷新**：打开设置弹窗时调用 `fetchData({ forceRefresh: true })` 确保分类数据最新。

**父分类下拉**：
- 新增分类时使用 `categoryFlatList`（完整分类树）
- 编辑分类时使用 `availableParentCategories`（排除自身及后代，避免循环引用）

## Token 过期预检机制

`src/composables/useAuth.js` 实现了客户端 token 过期预检，在发起 API 请求前先判断 token 是否已过期，避免无效网络请求和意外的 401 登出。

### 实现方式

`apiRequest` 函数在 `fetch` 调用前插入预检：

```javascript
if (token.value && isTokenExpired(token.value)) {
  logout()
  throw new Error('Token expired')
}
```

### isTokenExpired 规则

| token 格式 | 类型 | 有效期 |
|-----------|------|--------|
| `timestamp.type.hash`（3段） | `long` | 30 天 |
| `timestamp.type.hash`（3段） | `short` | 30 分钟 |
| `timestamp.hash`（2段，旧格式） | 默认为 `short` | 30 分钟 |
| 其他格式 | - | 视为已过期 |

### 效果

- **token 有效**：正常发起请求，不受影响
- **token 已过期**：不发起网络请求，直接调用 `logout()` 清除本地 token，抛出 `Token expired` 错误
- **未登录（无 token）**：跳过预检，正常发起请求（服务端会返回 401，由后续逻辑处理）
- **token 格式异常**：视为已过期，直接登出

### 注意事项

- 预检逻辑与服务端 `functions/_middleware.js` 的 `validateToken` 保持一致
- 仅检查时间戳，不验证 hash（客户端没有 `JWT_SECRET`）
- 一处修改，全局生效：所有通过 `apiRequest` 发起的请求都会自动预检

## 删除操作确认

nav 模式所有删除操作（书签/分类）统一使用 `ConfirmDialog` 组件：

```javascript
const confirmed = await confirmDialog.value.open('确定要删除"xxx"吗？', '标题')
if (!confirmed) return
// 执行删除...
```

| 触发位置 | 操作 | 调用的 API |
|----------|------|-----------|
| 卡片详情弹窗 `NavBookmarkEditModal` → 底部删除按钮 | 删除书签 | `deleteBookmark(id)` |
| 设置 → 书签 tab → 行内删除按钮 | 删除书签 | `deleteBookmark(id)` |
| 设置 → 菜单 tab → 危险区域 | 删除分类 | `confirmDelete(id)` |

- `ConfirmDialog` 内嵌在调用的组件模板中（`<ConfirmDialog ref="confirmDialog" />`），通过 `ref` 调用 `open()`
- z-index 为 `99999`（定义在 `src/assets/main.css`），始终浮在所有弹窗之上
- 确认弹窗的 `message` 支持 `\n` 换行（`.dialog-message` 设置了 `white-space: pre-line`）

## BaseDialog 通用弹窗

`src/components/BaseDialog.vue` 是 nav 模式的通用弹窗骨架，封装 System B 模式（`.dialog-overlay` → `.dialog-menu` → header/body/footer 三段式布局），通过 CSS 变量自动跟随主题。

```vue
<BaseDialog :show="showDialog" title="标题" max-width="520px" @close="showDialog = false">
  <p>自定义 body 内容</p>
  <template #footer>
    <button class="btn-secondary-sm" @click="showDialog = false">取消</button>
    <button class="btn-primary-sm" @click="handleSave">确定</button>
  </template>
</BaseDialog>
```

| Prop | 类型 | 默认 | 说明 |
|------|------|------|------|
| `show` | boolean | `false` | 弹窗可见性 |
| `title` | string | — | 弹窗标题 |
| `maxWidth` | string | `'440px'` | 面板最大宽度 |

- **Slots**：default（body 内容区）、`footer`（底部按钮区）
- **CSS**：非 scoped，集中管理；依赖 `var(--nav-glass)`、`var(--nav-bg)`、`var(--nav-border)` 等主题变量
- **不要**用于纯文字确认弹窗（用 `ConfirmDialog`）

| 弹窗用途 | 使用组件 | 示例 |
|----------|---------|------|
| 纯文字确认（删除/放弃等） | `ConfirmDialog` | 确认删除书签、确认放弃更改 |
| 带表单/列表内容的弹窗 | `BaseDialog` | 新增分类、确认保存更改列表 |

## AI 功能

### 架构总览

```
用户操作 (Vue组件)
    ↓
useAI.js (composable) → 通过 apiRequest() 发请求（自动加认证头）
    ↓
Cloudflare Functions (functions/api/ai/*.js) → 8 个端点
    ↓
_shared.js (callOpenAI) → OpenAI 兼容 API (chat/completions)
```

前端不直接持有 API key，所有请求通过后端代理转发。

### 配置文件与环境变量

定义在 `wrangler.toml`（生产环境在 Cloudflare Pages 控制台设置）：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENAI_API_KEY` | API key（**必须**，或在 UI 中填写） | - |
| `OPENAI_BASE_URL` | API 基础地址 | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 模型名称 | `gpt-4o-mini` |
| `OPENAI_AUTH_HEADER` | 认证 Header 名称 | `Authorization` |
| `OPENAI_AUTH_PREFIX` | 认证前缀 | `Bearer ` |

也支持通过 D1 的 `settings` 表存储（详见下方配置优先级）。

### 配置方式（双层优先级）

| 层级 | 配置途径 | 优先级 | 代码位置 |
|------|---------|--------|---------|
| **环境变量** | `wrangler.toml` / Cloudflare Pages 控制台 | **高** | `_shared.js:25` |
| **D1 数据库** | 设置页面 UI → `settings` 表 | 低 | `_shared.js:25` |

合并逻辑（`functions/api/ai/_shared.js:25`）：
```javascript
const apiKey = env.OPENAI_API_KEY || settings.secret_openai_api_key || ''
```

环境变量在前，`||` 短路求值，**环境变量完全覆盖 D1 设置**。

`settings.js` 保存时检查：如果对应环境变量已设置，拒绝写入 DB（`settings.js:85`）。UI 中锁定字段显示为灰色不可编辑。

### API 端点一览

全部文件位于 `functions/api/ai/` 目录：

| 端点 | 文件 | 方法 | 功能 | 调用 AI？ |
|------|------|------|------|-----------|
| `/api/ai/status` | `status.js` | GET | 检查 AI 是否启用 | 否 |
| `/api/ai/settings` | `settings.js` | GET | 读取 AI 配置（API key 返回空字符串） | 否 |
| `/api/ai/settings` | `settings.js` | POST | 保存 AI 配置到 D1 | 否 |
| `/api/ai/generate-description` | `generate-description.js` | POST | **生成单个书签描述** | 是 |
| `/api/ai/suggest-category` | `suggest-category.js` | POST | **推荐单个书签分类** | 是 |
| `/api/ai/batch-generate-descriptions` | `batch-generate-descriptions.js` | POST | **批量生成描述** | 是 |
| `/api/ai/batch-classify` | `batch-classify.js` | POST | **批量分类** | 是 |
| `/api/ai/verify` | `verify.js` | POST | 验证 API key 有效性（调 GET /models） | 是（调 models） |
| `/api/ai/proxy` | `proxy.js` | POST | 通用 OpenAI 代理转发 | 是 |

### 核心实现（_shared.js）

**`callOpenAI(env, { path, method, body, headers })`** (`functions/api/ai/_shared.js:55`):
1. 调用 `getAIConfig(env)` 合并环境变量 + D1 配置
2. 拼接 URL：`joinBaseUrl(baseUrl, path)` → `${baseUrl}/${path}`
3. 自动注入认证头（可配置 authHeader / authPrefix）
4. 非 2xx 响应时解析 error message 并 throw

**`getAIConfig(env)`** (`functions/api/ai/_shared.js:16`):
从 D1 `settings` 表读取 `secret_openai_api_key`、`ai_base_url`、`ai_model`、`ai_auth_header`、`ai_auth_prefix`，与环境变量合并。

### useAI composable

**引入**：
```javascript
import { useAI } from '@/composables/useAI'
const { aiEnabled, aiSource, ... } = useAI()
```

**响应式状态**：

| 状态 | 类型 | 说明 |
|------|------|------|
| `aiEnabled` | `Ref<boolean>` | AI 是否已启用（全局状态，模块级单例） |
| `aiSource` | `Ref<string>` | API key 来源：`'env'` / `'db'` / `'none'` |
| `aiApiKey` | `Ref<string>` | API key（前端存储仅用于显示） |
| `aiBaseUrl` | `Ref<string>` | 当前 base URL |

**方法**：

```javascript
// 检查 AI 状态
checkAIAvailability()         // → { success, enabled, source }

// 单条操作
generateDescription(name, url)       // → { success, description }
suggestCategory(name, url, description, categories)
// → { success, categoryId, reason }

// 批量操作
batchGenerateDescriptions(bookmarks)  // → { success, results[], successCount, failedCount }
batchClassify(bookmarks, categories)  // → { success, results[], successCount, failedCount }

// 配置管理
getAISettings()                // → { success, apiKey, baseUrl, model, authHeader, authPrefix, hasApiKey, lockedFields, customPromptDescription, customPromptDescriptionEnabled }
saveAISettings(settings)       // → { success }
verifyApiKey(apiKey, baseUrl, model) // → { success, valid, message }
```

所有方法通过 `apiRequest()` 发送（自动处理 token 过期、401 登出）。

### 前端组件与 AI 功能对应

| 组件 | 文件 | AI 功能 | 调用方式 |
|------|------|---------|---------|
| **BookmarkDialog** | `src/components/BookmarkDialog.vue` | 单条描述生成 + 分类推荐 | 点击"AI 生成"→ `generateDescription()`，点击"AI 推荐"→ `suggestCategory()` |
| **EditModeToolbar** | `src/components/EditModeToolbar.vue` | 批量操作入口 | 选中书签后点击"AI 生成"/"AI 分类"，打开对应 Batch 弹窗 |
| **BatchAIGenerateDialog** | `src/components/BatchAIGenerateDialog.vue` | 批量生成描述 UI | 逐个调 `generateDescription()` + `updateBookmark()` 实时保存，显示进度条 |
| **BatchAIClassifyDialog** | `src/components/BatchAIClassifyDialog.vue` | 批量分类 UI | 逐个调 `suggestCategory()`，支持自动应用 / 审核后应用 |
| **AISettings** | `src/components/settings/AISettings.vue` | 默认模式 AI 配置 | 调 `getAISettings()` / `saveAISettings()` |
| **NavSettingsModal** | `src/components/NavSettingsModal.vue` | 导航模式 AI 配置 | 同上，嵌入侧边栏设置 |
| **App.vue** | `src/App.vue` | 根组件 | 全局 `aiEnabled` 状态控制 AI 按钮显示/禁用 |

**Browser Extension**：`browser-extension/popup.js` 直接 `fetch` 后端 API，调用 `generate-description` 和 `suggest-category`。

### Prompt 机制

**描述生成**（`generate-description.js:22`）：

默认 Prompt 模板：
```
You are an assistant that generates concise and helpful descriptions for bookmarks/websites.
Name: {name}
URL: {url}
→ 1-2 句描述，max 100 词，语言与书籍名称一致
```

- temperature: **0.5**, max_tokens: **150**
- 支持**自定义 Prompt**（D1 中 `ai_custom_prompt_description`），用开关 `ai_custom_prompt_description_enabled` 控制
- 自定义 Prompt 可用变量：`{name}`、`{url}`
- 开关关闭或自定义 Prompt 为空时回退到默认 Prompt

**分类推荐**（`suggest-category.js:35`）：

默认 Prompt 模板：
```
Choose the most suitable existing category ID based on the bookmark information.
Name: {name}, URL: {url}, Description: {description}
Categories: {id}: {path}
→ 返回 JSON: {"categoryId": "...", "reason": "..."}
```

- temperature: **0.3**（更低，追求确定性）, max_tokens: **180**
- 用 `extractJson()` 正则 `/\{[\s\S]*\}/` 提取 AI 返回中的 JSON 对象
- 返回的 `categoryId` 通过 `Number.parseInt` 转为整数验证

**批量操作**：
- 逐个调用单条 API
- 描述生成间隔 **500ms**（`batch-generate-descriptions.js:105`）
- 分类间隔 **100ms**（`batch-classify.js:133`）

### 常见故障排查

| 错误信息 | 原因 | 排查方向 |
|---------|------|---------|
| `Access denied: please complete identity verification` | OpenAI 账号未绑定支付方式或被风控 | 登录 platform.openai.com → Billing 绑定信用卡；检查 Usage 是否有余额 |
| `401 Invalid Authentication` | API key 无效 | 检查 key 是否正确、是否过期；用 `curl Get /models` 测试 |
| `404 The model does not exist` | 模型名拼写错误或无权访问 | 检查 `OPENAI_MODEL` 配置（默认 `gpt-4o-mini`） |
| `Insufficient quota` | API 额度已用完 | OpenAI → Usage 查看额度/账单 |
| AI 按钮灰色不可点击 | AI 未启用 | 调用 `checkAIAvailability()` 检查状态；配置 API key |
| settings 输入框灰色锁定 | 对应字段已通过环境变量配置 | 修改 wrangler.toml / Cloudflare Pages 控制台 |
| AI 返回速度慢 | 网络延迟或模型响应慢 | 检查 `baseUrl` 是否为国内可直连地址；考虑使用 `gpt-4o-mini` 而非 `gpt-4o` |

## 统一图标获取模块（useIcon）

`src/composables/useIcon.js` 是所有界面（nav 模式卡片、编辑弹窗、设置书签列表、标签页）**共享的图标获取唯一入口**。各界面不再各自对接图标源，只调用两个函数：

```javascript
import { getIconUrl, handleIconError } from '@/composables/useIcon'

// 模板中绑定
<img v-if="getIconUrl(bookmark)" :src="getIconUrl(bookmark)" @error="handleIconError(bookmark)" />
// getIconUrl 返回空字符串时显示字母图标兜底
```

### 获取优先级

```
① bookmark.icon（自定义，存在 D1）—— 除非已被标记"失效"（见下）
② 启用的图标源链，按优先级依次尝试
③ 全部失败 → 字母图标
```

### 共享失败记忆（localStorage `bookmarkIconSourceMemory`）

- 模块级 `reactive(Map)`，key = `String(bookmark.id)`，value = **源 id**（或 `null` = 已耗尽）
- 所有界面共用一份进度：A 界面失败切换源后，B 界面直接用记忆的源，不再各自从头遍历
- 已耗尽（`null`）**不持久化**，刷新后重新探测；成功记忆跨刷新保留
- 记忆的源失效/被禁用时自动回落到第 0 个启用的源重试

### 自定义 icon 失效自动回退（方案 A）

`src/composables/useIcon.js` 实现"自定义图标死链自动回退源链"：

- `customIconBroken`（`reactive(Map)`，key = bookmark.id，value = **失败的自定义 icon URL**），持久化到 localStorage `bookmarkCustomIconBroken`
- `getIconUrl`：仅当 `bookmark.icon` 存在**且未被标记失效**时使用它；该 URL 已被标记失效 → 自动回退源链
- `handleIconError`：带自定义 icon 的书签加载失败时，该 URL 尚未标记 → 标记失效并返回；已标记 → 走正常源链切换
- **标记绑定 URL 而非布尔值**：用户改新 icon URL → 立即恢复正常；清除 icon → 走源链，标记不再阻塞
- 不改数据库字段；想彻底清掉仍用「清除图标」或「批量清除」

### 已接入界面

| 文件 | 说明 |
|------|------|
| `src/components/NavCard.vue` | nav 卡片 |
| `src/components/NavBookmarkEditModal.vue` | 编辑弹窗 header 图标 + 图标URL字段（清除/重新获取） |
| `src/components/NavSettingsModal.vue` | 书签 tab 列表 + 趋势 tab 时间轴 |
| `src/components/TagManagement.vue` | 标签 tab 展开书签列表 |

`NavSearch.vue` 曾有过一套独立的搜索图标逻辑（`searchIconSourceIndexes`/`getSearchResultIconUrl` 等），搜索结果显示已移交 `NavCardGrid` 渲染后即为死代码，已删除。

### 注意

- 模块在文件加载时调用 `useSettings()`（模块级单例，无生命周期钩子，可在模块作用域安全调用）
- `proxyUrl`（代理）目前**只用于"测试图标源"**，实际图标加载不走代理
- `resetIconMemory()` 可清空源记忆与失效标记（当前未接 UI）

### favicon.im 占位图自动回退（方案 A）

favicon.im 对**无公开 favicon 的域名**默认返回其专属占位图（HTTP 200），浏览器 `onload` 成功 → 回退链永不触发，卡片会一直显示占位图。解决方案：

- favicon.im 默认 URL 模板改为 `https://favicon.im/{domain}?throw-error-on-404=true`
- 无真实图标时 favicon.im 返回 **HTTP 404** → 触发 `handleIconError` 现有回退链 → 自动切到下一源
- 该模板同时是 `defaultIconSources` 与 `mergeIconSources` 自动升级的基准：老用户 localStorage 里存的旧版 `https://favicon.im/{domain}` 会在模块加载时被升级
- **勿将 URL 模板改回不带参数版本**，除非有意恢复"占位图不回退"行为

### 测试图标源结果预览

两处测试界面（`NavSettingsModal.vue` 表格、`AppearanceSettings.vue` 卡片）除文字状态外，还展示**真实获取到的图标**：

- 表格：新增"图标"列（源列右侧）；卡片：源名称右侧图标区
- 用 `getPreferredIcon(result)` 选择展示源：**直连成功优先**，直连失败才用代理图标；都失败显示 `–`/无
- 图标下方/旁带来源角标（`直连`/`代理`）
- 图标按测试时实际尺寸渲染（`width/height` 单独存储，不占 `size` 字符串），`max-width/max-height: 48px` 防撑爆布局；加载失败时用内联 `@error` 隐藏
- 直连/代理测试仍为串行、各自记录耗时，展示层只是额外选一个快照

### 清除图标缓存（refreshBookmarkIcon）

- 点击编辑弹窗「清除图标缓存」调用 `refreshBookmarkIcon(id)`：清空该书签的源记忆/失效标记，并写入**刷新戳**（localStorage `bookmarkIconRefreshStamp`）
- `getIconUrl` 为带刷新戳的书签源 URL 追加 `?t=<戳>`，URL 变化绕过浏览器 HTTP 缓存 → 发起**真实重新请求**
- 机制是"清缓存"而非"主动抓取保存"：编辑弹窗头部图标因 URL 变化立即重新请求；卡片页下次显示时也用带戳 URL 获取最新
- 戳持久化：刷新后卡片的源 URL 保持带戳，首次新鲜加载后被浏览器缓存，不再反复请求；再次点击清除缓存才更新戳
- `resetBookmarkIconMemory(id)` 只清空记忆不加戳（可用于纯重置场景）

## 图标懒加载（LazyIcon + useIncrementalRender）

所有图标展示界面统一懒加载，**图标进入视口附近（rootMargin 200px）才发起请求**，加载成功后立即显示，无需刷新页面。

### LazyIcon 组件（`src/components/LazyIcon.vue`）

- 图片级懒加载：默认 slot 传入 `<img>`，组件在元素进入视口前不渲染 slot，避免一次性为所有书签并发请求图标
- `size` prop 指定占位盒尺寸（卡片 40 / 书签列表 24 / 趋势 20 / 标签 20），`display: inline-flex` 居中，不破坏各界面原有布局
- 触发一次即断开 observer，图标保持显示；失败换源仍由 `useIcon` 的响应式记忆驱动 `:src` 变化

```html
<LazyIcon v-if="bm.url && getIconUrl(bm)" :size="24">
  <img :src="getIconUrl(bm)" alt="" @error="handleIconError(bm)" />
</LazyIcon>
<div v-else class="letter-icon">{{ bm.name.charAt(0) }}</div>
```

### useIncrementalRender composable（`src/composables/useIncrementalRender.js`）

行级增量渲染，用于大列表（设置→书签 tab、趋势 tab）：

- 把分组列表**扁平化为行数组**（`{type:'header'}` / `{type:'bookmark'|'item'}`），每批渲染 60 行，哨兵元素进入滚动容器附近（rootMargin 300px）时继续加载下一批
- 参数：`rows`（computed）、`scrollRootRef`（滚动容器 ref，趋势用 `settingsContentRef`）、`activateWhen`（getter，tab 激活时初始化 observer）
- 返回 `{ sentinelRef, rendered, hasMore }`；`rendered` 用于 `v-for`，`sentinelRef` 绑定哨兵 `<div ref="..." class="bookmark-load-more">`
- 列表数据变化自动重置为首屏并重建观察器，组件卸载时断开

### 各界面懒加载情况

| 界面 | 图片级（LazyIcon） | 行级分批 |
|------|-------------------|---------|
| 主页卡片网格（NavCard） | ✅ | —（按分类只渲染当前） |
| 设置→书签 tab | ✅ | ✅（60/批，root=列表滚动容器） |
| 设置→趋势 tab 时间轴 | ✅ | ✅（60/批，root=内容滚动容器） |
| 设置→标签 tab 展开书签 | ✅ | — |
| 编辑书签弹窗 header | —（单个书签，本就即时） | — |

### 注意事项

- `LazyIcon` 依赖 `useIcon.getIconUrl`，图标 URL 计算与懒加载解耦：懒加载只决定**何时**渲染 `<img>`，URL/失败切换仍由 `useIcon` 统一管理
- 书签/趋势两个大列表同时启用"行级分批 + 图片级懒加载"：分批控制 DOM 数量，懒加载控制图标请求时机

## 自建图标代理（/api/icon-proxy）

`functions/api/icon-proxy.js` 提供自建 favicon 抓取端点，用 Cloudflare 原生 `HTMLRewriter` 解析目标站点真实图标，不依赖第三方图标服务。

### 端点行为

```
GET /api/icon-proxy?url=<目标网站完整URL，URL编码>
```

| 输入 | 行为 |
|------|------|
| 有效站点 | 抓取首页 HTML，解析 `apple-touch-icon` → `link[rel~=icon]` → 回退 `/favicon.ico`，返回图片（image/*） |
| 无图标 / 抓取失败 | 返回 404，前端自动回退到下一个图标源 |
| 缺 `url` 参数 | 返回 400 |
| 非 http/https scheme | 返回 400（防 SSRF） |

### 关键实现点

- **HTMLRewriter 流式解析**：用 `transformed.body.getReader()` 流式读取，找到 icon 链接或读到 64KB 上限即 `reader.cancel()` 终止，避免下载完整 HTML 页面
- **两跳请求**：第一跳抓首页 HTML 解析 link，第二跳抓图标图片，串行执行
- **缓存**：用 `caches.default` 缓存响应（`Cache-Control: public, max-age=86400, s-maxage=86400`），同一 URL 第二次起命中缓存不再出站
- **出站超时**：第一跳有 5 秒 `AbortController` 超时
- **SSRF 防护**：仅允许 http/https scheme

### 前端接入

- 作为第 6 个图标源（`useSettings.js` 的 `defaultIconSources`），默认 `enabled: false`，用户手动开启
- URL 模板：`/api/icon-proxy?url={url}`，`{url}` 占位符在 `parseIconSourceUrl` 中被替换为 `encodeURIComponent(url.href)`
- 老用户 localStorage 已有 `iconSources` 时，`mergeIconSources()` 会补充缺失的默认源
- **注意**：两处图标源测试函数（`NavSettingsModal.vue` 的 `handleTestAll`、`AppearanceSettings.vue` 的 `testIconSource`）都必须单独替换 `{url}` 占位符，不要只替换 `{domain}`/`{origin}`

### 已知限制

- 该端点出站请求走 Cloudflare 服务器网络：**境外站（github、google 等）CF 可直连，国内站（百度等）CF 访问不稳定**，与本地 dev 环境的网络情况相反
- 本地 dev 环境下 `functions/` 由 wrangler pages dev 运行，出站走本机网络（google 被墙则抓取失败）
- 图标命中率不如三方服务的场景，由现有回退链（favicon.im、icon.horse 等）兜底

## v-tooltip 自定义指令

`src/directives/tooltip.js` 提供全局 `v-tooltip` 指令，替换原生 `title` 属性的延迟、不可样式化、移动端无效缺陷。

### 用法

```vue
<!-- 静态文本 -->
<button v-tooltip="'添加书签'">+</button>

<!-- 响应式变量（\n 换行） -->
<button v-tooltip="hoverTitle">info</button>

<!-- 条件显隐（空值 no-op） -->
<div v-tooltip="shouldShowTitle ? hoverTitle : ''">卡片</div>
```

| 场景 | 行为 |
|------|------|
| 空字符串 / undefined | 不显示 tooltip |
| 多行文本 | `white-space: pre-line` 支持 `\n` 换行 |
| 窗口边缘 | 自动翻转避免溢出视口 |
| 页面滚动 | 自动隐藏 |

### 实现要点

- **单例元素**：首次显示时创建 `.app-tooltip` 并 append 到 `document.body`，避免 stacking context 裁剪
- **事件委托**：mounted 时挂 mouseenter/mouseleave，滚动时统一隐藏
- **样式**：`.app-tooltip` 在 `src/assets/main.css` 末尾，用 CSS 变量跟随主题，`z-index: 100000`（高于 ConfirmDialog 的 99999）
- **注册**：`src/main.js` 通过 `app.directive('tooltip', tooltipDirective)` 全局注册

### 已迁移组件

| 组件 | 替换数量 |
|------|---------|
| `EditModeToolbar.vue` | 14 处静态 title |
| `CategoryTreeItem.vue` | 6 处操作按钮 |
| `SearchBar.vue` | 3 处（清除/过滤/关闭结果） |
| `NavSearch.vue` | 2 处（搜索按钮 + 动态搜索范围） |
| `NavBar.vue` | 1 处（切换风格按钮） |
| `NavCard.vue` | 2 处（条件 hover 信息 + 查看详情） |

**注意**：`SearchBar.vue` 的 `:title="engine.name"`（搜索引擎名）和 `NavBar.vue` 的 `:title="menu.description"`（菜单描述）仍保留原生 title，未迁移。
