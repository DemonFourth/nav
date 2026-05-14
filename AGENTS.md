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

## 浏览器扩展

```bash
# 构建 Chromium 版本
npm run ext:build:chromium

# 构建 Firefox 版本
npm run ext:build:firefox
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
