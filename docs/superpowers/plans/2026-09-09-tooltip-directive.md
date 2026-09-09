# data-tooltip 自定义指令实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建 Vue 自定义指令 `v-tooltip`，替换项目中原生 `title` 属性的延迟、不可样式化、移动端无效缺陷，支持静态文本、动态多行、条件显隐三种用法

**Architecture:** 实现一个全局单例 tooltip 元素（append 到 body），通过自定义指令 `v-tooltip` 挂载 mouseenter/mouseleave 监听，显示时定位到鼠标附近并做边缘翻转，scroll 时自动隐藏。指令值支持空字符串 no-op、`\n` 换行、条件绑定。先替换高交互按钮区（工具栏、分类树操作、搜索框），保留卡片 hoverTitle 场景用指令重写。

**Tech Stack:** Vue 3 Custom Directive, CSS Variables, Teleport 式 body 定位

## Global Constraints

- 指令必须支持三种用法：静态字符串、响应式变量、空值 no-op
- tooltip 样式使用现有 CSS 变量（`--bg-secondary`, `--border`, `--text`, `--text-tertiary`），跟随亮/暗主题
- 单例元素挂载到 `document.body`，避免 stacking context / overflow 裁剪问题
- scroll 时隐藏 tooltip（防止悬停元素滚走时残留）
- 不替换所有 66 处 title，只替换：EditModeToolbar、CategoryTreeItem、SearchBar、NavSearch、NavBar 的高交互按钮（约 20+ 处）
- 验证方式：`npm run build` 成功 + 手动浏览器测试（项目无测试框架）
- 修改文件前必须获得用户批准

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/directives/tooltip.js` | 新增 | `v-tooltip` 指令实现：单例元素创建、显示/隐藏、定位、边缘翻转 |
| `src/assets/main.css` | 修改 | 追加 `.app-tooltip` 单例元素样式（非 scoped，全局生效） |
| `src/main.js` | 修改 | `app.directive('tooltip', tooltipDirective)` 全局注册 |
| `src/components/EditModeToolbar.vue` | 修改 | `title="..."` → `v-tooltip` |
| `src/components/CategoryTreeItem.vue` | 修改 | `title="..."` → `v-tooltip` |
| `src/components/SearchBar.vue` | 修改 | `title="..."` → `v-tooltip` |
| `src/components/NavSearch.vue` | 修改 | `title="..."` → `v-tooltip` |
| `src/components/NavBar.vue` | 修改 | `title="..."` → `v-tooltip` |
| `src/components/NavCard.vue` | 修改 | `:title="hoverTitle"` → `v-tooltip`（保持条件显隐） |

---

## Task 1: 创建 tooltip 指令

**Files:**
- Create: `src/directives/tooltip.js`

**Interfaces:**
- Produces: 默认导出 `tooltipDirective`，实现 `mounted` / `unmounted` 钩子
  - `v-tooltip="'静态文本'"` — 字符串
  - `v-tooltip="hoverTitle"` — 响应式变量（`\n` 换行）
  - `v-tooltip="shouldShowTitle ? hoverTitle : ''"` — 空值 no-op

- [ ] **Step 1: 创建指令文件**

```js
// src/directives/tooltip.js
// v-tooltip 指令：显示跟随鼠标的自定义 tooltip
// 用法：v-tooltip="'文本'" | v-tooltip="变量" | v-tooltip="条件 ? '文本' : ''"
// 空字符串/undefined 时不显示

let tooltipEl = null
let activeEl = null
let hideTimeout = null

function ensureTooltip() {
  if (tooltipEl) return tooltipEl
  tooltipEl = document.createElement('div')
  tooltipEl.className = 'app-tooltip'
  tooltipEl.setAttribute('role', 'tooltip')
  document.body.appendChild(tooltipEl)
  return tooltipEl
}

function removeTooltip() {
  if (tooltipEl && tooltipEl.parentNode) {
    tooltipEl.parentNode.removeChild(tooltipEl)
  }
  tooltipEl = null
}

function showTooltip(el, text, event) {
  const tip = ensureTooltip()
  tip.textContent = text
  tip.classList.add('visible')

  const offset = 12
  let left = event.clientX + offset
  let top = event.clientY + offset

  const rect = tip.getBoundingClientRect()
  if (left + rect.width > window.innerWidth) {
    left = event.clientX - rect.width - offset
  }
  if (top + rect.height > window.innerHeight) {
    top = event.clientY - rect.height - offset
  }
  if (left < 0) left = 0
  if (top < 0) top = 0

  tip.style.left = left + 'px'
  tip.style.top = top + 'px'
  tip.style.position = 'fixed'
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.classList.remove('visible')
}

const onMouseEnter = (event) => {
  const el = event.currentTarget
  const text = el.__vTooltipText
  if (!text) return
  activeEl = el
  clearTimeout(hideTimeout)
  showTooltip(el, text, event)
}

const onMouseLeave = () => {
  if (!activeEl) return
  hideTimeout = setTimeout(hideTooltip, 100)
  activeEl = null
}

const onScroll = () => {
  hideTooltip()
}

export const tooltipDirective = {
  mounted(el, binding) {
    el.__vTooltipText = binding.value
    el.addEventListener('mouseenter', onMouseEnter)
    el.addEventListener('mouseleave', onMouseLeave)
    if (!window.__vTooltipScrollBound) {
      window.__vTooltipScrollBound = true
      window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    }
  },
  updated(el, binding) {
    el.__vTooltipText = binding.value
  },
  unmounted(el) {
    el.removeEventListener('mouseenter', onMouseEnter)
    el.removeEventListener('mouseleave', onMouseLeave)
    delete el.__vTooltipText
    if (activeEl === el) {
      hideTooltip()
      activeEl = null
    }
    if (!document.querySelector('[data-v-tooltip-bound]')) {
      // 无指令绑定元素时保持滚动监听（单例，泄漏可忽略）
    }
  },
}

export default tooltipDirective
```

> 说明：`updated` 钩子使条件显隐（`shouldShowTitle ? hoverTitle : ''`）在响应式变化时即时更新 tooltip 文本；空字符串时 `mouseenter` 不显示。

- [ ] **Step 2: 验证文件语法**

运行: `npm run build`
Expected: 构建成功（`src/directives/` 目录首次创建）

- [ ] **Step 3: 提交**

```bash
git add src/directives/tooltip.js
git commit -m "feat: add v-tooltip custom directive"
```

---

## Task 2: 添加 tooltip 样式到 main.css

**Files:**
- Modify: `src/assets/main.css`（文件末尾追加）

**Interfaces:**
- Consumes: `src/directives/tooltip.js` 创建的 `.app-tooltip` 元素
- Produces: `.app-tooltip` 全局样式（fixed 定位、z-index 高于所有弹窗、主题变量跟随）

- [ ] **Step 1: 在 main.css 末尾追加样式**

在 `src/assets/main.css` 文件末尾追加：

```css
/* ===== 自定义 Tooltip (v-tooltip 指令) ===== */
.app-tooltip {
  position: fixed;
  z-index: 100000;
  max-width: 300px;
  padding: 6px 10px;
  border-radius: var(--radius, 8px);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-line;
  pointer-events: none;
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 0.12s ease, transform 0.12s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.app-tooltip.visible {
  opacity: 1;
  transform: translateY(0);
}
```

> `white-space: pre-line` 支持 `\n` 换行；`z-index: 100000` 高于 ConfirmDialog（99999）；`pointer-events: none` 避免 tooltip 自身触发 mouseleave。

- [ ] **Step 2: 验证构建**

运行: `npm run build`
Expected: 构建成功

- [ ] **Step 3: 提交**

```bash
git add src/assets/main.css
git commit -m "feat: add app-tooltip global styles"
```

---

## Task 3: 全局注册指令

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `src/directives/tooltip.js` 默认导出 `tooltipDirective`
- Produces: 全应用可用 `v-tooltip`

- [ ] **Step 1: 注册指令**

将 `src/main.js` 改为：

```js
import { createApp } from 'vue'
import App from './App.vue'
import './assets/main.css'
import tooltipDirective from './directives/tooltip'

const app = createApp(App)
app.directive('tooltip', tooltipDirective)
app.mount('#app')
```

- [ ] **Step 2: 验证构建**

运行: `npm run build`
Expected: 构建成功

- [ ] **Step 3: 提交**

```bash
git add src/main.js
git commit -m "feat: register v-tooltip directive globally"
```

---

## Task 4: 迁移 EditModeToolbar 的 title → v-tooltip

**Files:**
- Modify: `src/components/EditModeToolbar.vue`

**Interfaces:**
- Consumes: 全局注册的 `v-tooltip`
- Produces: 工具栏按钮 tooltip 无延迟显示、可主题化

- [ ] **Step 1: 替换工具栏按钮 title 属性**

将 `src/components/EditModeToolbar.vue` 中所有静态 `title="..."` 替换为 `v-tooltip="'...'"`。涉及行（以文件实际为准）：

| 原属性 | 替换为 |
|--------|--------|
| `title="添加书签"` | `v-tooltip="'添加书签'"` |
| `title="添加分类"` | `v-tooltip="'添加分类'"` |
| `title="批量操作"` | `v-tooltip="'批量操作'"` |
| `title="完成编辑"` | `v-tooltip="'完成编辑'"` |
| `title="全选"` | `v-tooltip="'全选'"` |
| `title="取消全选"` | `v-tooltip="'取消全选'"` |
| `title="反选"` | `v-tooltip="'反选'"` |
| `title="移动分类"` | `v-tooltip="'移动分类'"` |
| `title="编辑属性"` | `v-tooltip="'编辑属性'"` |
| `title="AI 批量生成描述"` | `v-tooltip="'AI 批量生成描述'"` |
| `title="AI 批量分类"` | `v-tooltip="'AI 批量分类'"` |
| `title="批量删除"` | `v-tooltip="'批量删除'"` |
| `title="批量删除分类"` | `v-tooltip="'批量删除分类'"` |
| `title="退出批量操作"` | `v-tooltip="'退出批量操作'"` |

- [ ] **Step 2: 验证构建**

运行: `npm run build`
Expected: 构建成功

- [ ] **Step 3: 手动验证**

1. 运行 `npm run dev`，打开 http://localhost:3000，进入默认模式编辑模式
2. 悬停工具栏各按钮，确认 tooltip 立即出现（无原生 title 延迟）
3. 移动鼠标到窗口边缘，确认 tooltip 翻转不溢出
4. 滚动页面，确认 tooltip 隐藏

- [ ] **Step 4: 提交**

```bash
git add src/components/EditModeToolbar.vue
git commit -m "feat: migrate EditModeToolbar titles to v-tooltip"
```

---

## Task 5: 迁移 CategoryTreeItem 的 title → v-tooltip

**Files:**
- Modify: `src/components/CategoryTreeItem.vue`

**Interfaces:**
- Consumes: 全局注册的 `v-tooltip`
- Produces: 分类树操作按钮 tooltip 无延迟显示

- [ ] **Step 1: 替换分类树按钮 title 属性**

将 `src/components/CategoryTreeItem.vue` 中 `title="上移"` / `title="下移"` / `title="添加子分类"` / `title="添加书签"` / `title="编辑分类"` / `title="删除分类"` 分别替换为 `v-tooltip="'上移'"` 等。

- [ ] **Step 2: 验证构建**

运行: `npm run build`
Expected: 构建成功

- [ ] **Step 3: 手动验证**

1. 默认模式分类侧边栏中悬停各操作按钮，确认 tooltip 立即显示

- [ ] **Step 4: 提交**

```bash
git add src/components/CategoryTreeItem.vue
git commit -m "feat: migrate CategoryTreeItem titles to v-tooltip"
```

---

## Task 6: 迁移 SearchBar / NavSearch 的 title → v-tooltip

**Files:**
- Modify: `src/components/SearchBar.vue`
- Modify: `src/components/NavSearch.vue`

**Interfaces:**
- Consumes: 全局注册的 `v-tooltip`
- Produces: 搜索相关按钮 tooltip 无延迟显示

- [ ] **Step 1: 替换 SearchBar 的 title**

`src/components/SearchBar.vue`：
- `title="清除搜索"` → `v-tooltip="'清除搜索'"`
- `title="过滤选项"` → `v-tooltip="'过滤选项'"`
- `title="关闭结果"` → `v-tooltip="'关闭结果'"`

> 注意：`SearchBar.vue:123` 的 `:title="engine.name"` 是搜索引挚名展示，**保留**原生 title（多行引擎信息场景，后续如需再迁移）。

- [ ] **Step 2: 替换 NavSearch 的 title**

`src/components/NavSearch.vue`：
- `title="搜索"` → `v-tooltip="'搜索'"`
- `:title="'搜索范围: ' + (...)"` 的动态字符串 → `v-tooltip="'搜索范围: ' + (...)"`

> 注意：`NavSearch.vue:29` 的字段按钮 tooltip 是动态拼接字符串，指令 `updated` 钩子会随值变化更新，直接替换即可。

- [ ] **Step 3: 验证构建**

运行: `npm run build`
Expected: 构建成功

- [ ] **Step 4: 提交**

```bash
git add src/components/SearchBar.vue src/components/NavSearch.vue
git commit -m "feat: migrate SearchBar and NavSearch titles to v-tooltip"
```

---

## Task 7: 迁移 NavBar / NavCard 的 title → v-tooltip

**Files:**
- Modify: `src/components/NavBar.vue`
- Modify: `src/components/NavCard.vue`

**Interfaces:**
- Consumes: 全局注册的 `v-tooltip`
- Produces: 导航站模式按钮与卡片 hover 信息无延迟显示

- [ ] **Step 1: 替换 NavBar 的 title**

`src/components/NavBar.vue`：
- `title="切换风格"` → `v-tooltip="'切换风格'"`

> 注意：`NavBar.vue:20` 的 `:title="menu.description || ''"` 是菜单描述，**保留**（当前仅展示，非交互按钮）。

- [ ] **Step 2: 替换 NavCard 的 title 为条件 tooltip**

`src/components/NavCard.vue:5`：

```vue
  <div 
    class="nav-card-horizontal"
    @click="handleCardClick"
    :title="shouldShowTitle ? hoverTitle : undefined"
  >
```

改为：

```vue
  <div 
    class="nav-card-horizontal"
    @click="handleCardClick"
    v-tooltip="shouldShowTitle ? hoverTitle : ''"
  >
```

> 这是条件显隐的关键场景：`hoverTitle` 是多行文本（名称/地址/描述/标签/备注，`NavCard.vue:165`），`shouldShowTitle` 为 false 时传入空串，指令 no-op。

- [ ] **Step 3: 验证构建**

运行: `npm run build`
Expected: 构建成功

- [ ] **Step 4: 手动验证**

1. 导航站模式，悬停有截断文本的卡片，确认 tooltip 显示完整多行信息
2. 悬停无截断的卡片，确认不显示 tooltip
3. 悬停风格切换按钮，确认 tooltip 立即显示

- [ ] **Step 5: 提交**

```bash
git add src/components/NavBar.vue src/components/NavCard.vue
git commit -m "feat: migrate NavBar and NavCard to v-tooltip"
```

---

## Task 8: 最终验证

- [ ] **Step 1: 完整构建**

运行: `npm run build`
Expected: 构建成功，无报错

- [ ] **Step 2: 功能回归测试**

1. 默认模式：编辑模式工具栏、分类树按钮、搜索栏 tooltip 全部正常
2. 导航站模式：卡片 hover 信息、风格切换按钮 tooltip 正常
3. 暗色模式：tooltip 背景/边框/文字颜色跟随主题
4. 窗口边缘：tooltip 不超出视口
5. 滚动页面：tooltip 及时隐藏

- [ ] **Step 3: 提交（如验证中有修复）**

```bash
git add -A
git commit -m "fix: resolve issues found in v-tooltip verification"
```
