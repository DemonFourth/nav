# AGENTS.md - 书签管理器开发指南

## 构建和开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器（http://localhost:3000）
npm run dev

# 构建生产版本
npm run build

# 本地预览生产构建
npm run preview

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
| 点击卡片上的标签 | `NavCardGrid.vue` → `@tag-click` → `handleTagClick` | 通过 `openSearchWithTags([tag])` 触发标签搜索 |
| 点击标签筛选栏的标签 | `NavItemView.vue` → `handleTagTabClick` | 同上，触发标签搜索 |
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

const searchInSite = (tags = null) => {
  // ... 执行搜索 ...
  searchResults.value = results
  emit('search-results', results)  // 发送给父组件
}

const clearSearch = () => {
  searchQuery.value = ''
  emit('clear-results')  // 通知父组件清除搜索结果
}

// 暴露方法供外部调用（卡片标签点击、标签栏点击）
defineExpose({
  openSearchWithTags: (tags) => {
    if (tags && tags.length > 0) {
      searchQuery.value = tags.join(',')
      searchInSite(tags)
    }
  }
})
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
| `src/components/NavSearch.vue` | 搜索组件，emit `search-results` 和 `clear-results`，暴露 `openSearchWithTags` |
| `src/views/NavItemView.vue` | 管理 `searchResults` 状态，`currentBookmarks` 根据搜索/分类返回不同数据 |
| `src/components/NavCardGrid.vue` | 书签卡片网格，接收 `currentBookmarks` 并展示 |

### 后续开发提示

- 如果需要区分"搜索结果显示"和"分类浏览"的视觉样式，可以在 `NavCardGrid` 中通过 `searchResults.value !== null` 判断
- 搜索结果的排序默认跟随书签的 `position` 字段，如需自定义排序可修改 `currentBookmarks` 中的逻辑
- `openSearchWithTags` 方法可被任何需要触发标签搜索的外部组件调用，只需通过 `ref` 访问 `navSearchRef.value.openSearchWithTags([tag])`

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

```bash
# 构建 Chromium 版本
npm run ext:build:chromium

# 构建 Firefox 版本
npm run ext:build:firefox
```

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
| `timestamp.type.hash`（3段） | `short` | 15 分钟 |
| `timestamp.hash`（2段，旧格式） | 默认为 `short` | 15 分钟 |
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
