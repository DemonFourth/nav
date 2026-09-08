# NavCard 横向布局重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将导航模式书签卡片从垂直居中布局改为横向布局，提升信息展示密度

**Architecture:** 拆分为 NavCard.vue（独立卡片组件）和 NavCardGrid.vue（网格容器），保持现有功能完整

**Tech Stack:** Vue 3 Composition API, CSS Grid, CSS Variables

## Global Constraints

- 复用现有 CSS 变量（--nav-card-bg, --nav-border 等）
- 保留所有现有交互功能
- 不修改非 nav 模式的组件
- 响应式设计：lg+ 3列，md 2列，sm 1列

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/components/NavCard.vue` | 新增 | 独立卡片组件，横向布局 |
| `src/components/NavCardGrid.vue` | 修改 | 重构为网格容器，导入 NavCard |
| `src/views/NavItemView.vue` | 修改 | 传递 columns prop（如需） |

---

## Task 1: 创建 NavCard.vue 组件基础结构

**Files:**
- Create: `src/components/NavCard.vue`

**Interfaces:**
- Produces: NavCard.vue 组件，接受 bookmark 和 isAuthenticated props

- [ ] **Step 1: 创建组件文件并添加基础模板**

```vue
<template>
  <div 
    class="nav-card-horizontal"
    @click="handleCardClick"
    :title="hoverTitle"
  >
    <!-- 图标 -->
    <div class="nav-card-icon">
      <img 
        v-if="!iconError"
        :src="iconUrl"
        :alt="bookmark.name"
        loading="lazy"
        @error="handleIconError"
      />
      <div v-if="iconError" class="letter-icon">
        {{ bookmark.name.charAt(0) }}
      </div>
    </div>
    
    <!-- 内容区域 -->
    <div class="nav-card-content">
      <h3 class="nav-card-title">{{ bookmark.name }}</h3>
      <p v-if="bookmark.description" class="nav-card-description">
        {{ bookmark.description }}
      </p>
      <div v-if="bookmark.tags && bookmark.tags.trim()" class="nav-card-tags">
        <span 
          v-for="(tag, index) in visibleTags" 
          :key="index"
          class="tag-badge"
          @click.stop="handleTagClick(tag)"
        >
          {{ tag }}
        </span>
        <span 
          v-if="remainingCount > 0" 
          class="tag-badge more-tags"
          @click.stop="toggleExpand"
        >
          {{ expanded ? '收起' : `+${remainingCount}` }}
        </span>
      </div>
      <div class="nav-card-url">{{ bookmark.url }}</div>
    </div>
    
    <!-- 详情按钮 -->
    <button 
      v-if="isAuthenticated" 
      class="nav-card-detail-btn" 
      @click.stop="handleShowDetail"
      title="查看详情"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSettings } from '../composables/useSettings'

const props = defineProps({
  bookmark: {
    type: Object,
    required: true
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['tag-click', 'show-detail'])

const { iconSources, parseIconSourceUrl } = useSettings()

const iconError = ref(false)
const iconSourceIndex = ref(0)
const expanded = ref(false)
const MAX_VISIBLE_TAGS = 6

// 图标相关
const getIconSources = () => {
  if (props.bookmark.icon && props.bookmark.icon.trim()) {
    return []
  }
  try {
    const enabledSources = iconSources.value.filter(s => s.enabled)
    return enabledSources.map(source => parseIconSourceUrl(source.url, props.bookmark.url))
  } catch {
    return []
  }
}

const iconUrl = computed(() => {
  if (props.bookmark.icon && props.bookmark.icon.trim()) {
    return props.bookmark.icon
  }
  const sources = getIconSources()
  if (sources.length > 0 && iconSourceIndex.value < sources.length) {
    return sources[iconSourceIndex.value]
  }
  return ''
})

const handleIconError = () => {
  const sources = getIconSources()
  if (iconSourceIndex.value < sources.length - 1) {
    iconSourceIndex.value++
  } else {
    iconError.value = true
  }
}

// 标签相关
const parsedTags = computed(() => {
  if (!props.bookmark.tags) return []
  return props.bookmark.tags.split(',').map(t => t.trim()).filter(Boolean)
})

const visibleTags = computed(() => {
  if (expanded.value) {
    return parsedTags.value
  }
  return parsedTags.value.slice(0, MAX_VISIBLE_TAGS)
})

const remainingCount = computed(() => {
  return Math.max(0, parsedTags.value.length - MAX_VISIBLE_TAGS)
})

const toggleExpand = () => {
  expanded.value = !expanded.value
}

// Tooltip
const hoverTitle = computed(() => {
  const parts = []
  if (props.bookmark.name) parts.push(`名称：${props.bookmark.name}`)
  if (props.bookmark.url) parts.push(`地址：${props.bookmark.url}`)
  if (props.bookmark.description) parts.push(`描述：${props.bookmark.description}`)
  if (props.bookmark.tags && props.bookmark.tags.trim()) parts.push(`标签：${props.bookmark.tags}`)
  if (props.bookmark.notes && props.bookmark.notes.trim()) parts.push(`备注：${props.bookmark.notes}`)
  return parts.join('\n')
})

// 事件处理
const handleCardClick = () => {
  window.open(props.bookmark.url, '_blank')
}

const handleTagClick = (tag) => {
  emit('tag-click', tag)
}

const handleShowDetail = () => {
  emit('show-detail', { tag: null, bookmark: props.bookmark })
}
</script>
```

- [ ] **Step 2: 添加基础样式**

```vue
<style scoped>
.nav-card-horizontal {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--nav-border);
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  min-height: 100px;
}

.nav-card-horizontal::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--nav-primary) 5%, transparent) 0%, color-mix(in srgb, var(--primary) 3%, transparent) 50%, transparent 100%);
  opacity: 0;
  transition: opacity 0.4s;
  pointer-events: none;
}

.nav-card-horizontal::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 13px;
  background: conic-gradient(from 0deg at 50% 50%,
    transparent 0deg, color-mix(in srgb, var(--nav-primary) 18%, transparent) 45deg,
    transparent 90deg, transparent 270deg,
    color-mix(in srgb, var(--primary) 12%, transparent) 315deg, transparent 360deg
  );
  opacity: 0;
  transition: opacity 0.5s;
  pointer-events: none;
  mask: linear-gradient(#000, #000) content-box, linear-gradient(#000, #000);
  mask-composite: exclude;
  -webkit-mask: linear-gradient(#000, #000) content-box, linear-gradient(#000, #000);
  -webkit-mask-composite: xor;
  padding: 1px;
}

.nav-card-horizontal:hover {
  background: var(--nav-card-hover);
  transform: translateY(-3px);
  box-shadow: 0 12px 40px -8px var(--shadow-lg), 0 0 0 1px color-mix(in srgb, var(--nav-primary) 12%, transparent);
  border-color: color-mix(in srgb, var(--nav-primary) 20%, transparent);
}

.nav-card-horizontal:hover::before { opacity: 1; }
.nav-card-horizontal:hover::after { opacity: 1; }

.nav-card-horizontal:active {
  transform: translateY(-1px) scale(0.98);
}

.nav-card-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--nav-card-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 12px var(--shadow);
}

.nav-card-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.letter-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: white;
  font-weight: 700;
  font-size: 0.875rem;
}

.nav-card-horizontal:hover .nav-card-icon {
  transform: scale(1.08);
}

.nav-card-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nav-card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--nav-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-card-description {
  font-size: 14px;
  color: var(--nav-text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.nav-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-badge {
  padding: 2px 8px;
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
  color: var(--nav-primary);
  border: 1px solid color-mix(in srgb, var(--nav-primary) 25%, transparent);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tag-badge:hover {
  background: color-mix(in srgb, var(--nav-primary) 25%, transparent);
  border-color: color-mix(in srgb, var(--nav-primary) 50%, transparent);
}

.tag-badge.more-tags {
  cursor: pointer;
  background: var(--nav-card-bg);
  border-color: var(--nav-border);
  color: var(--nav-text-secondary);
}

.tag-badge.more-tags:hover {
  background: var(--nav-card-hover);
  color: var(--nav-text);
}

.nav-card-url {
  font-size: 12px;
  color: var(--nav-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-card-detail-btn {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--nav-card-bg);
  border: none;
  color: var(--nav-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s ease;
  z-index: 10;
}

.nav-card-detail-btn svg {
  width: 14px;
  height: 14px;
}

.nav-card-horizontal:hover .nav-card-detail-btn {
  opacity: 1;
}

.nav-card-detail-btn:hover {
  background: color-mix(in srgb, var(--nav-primary) 45%, transparent);
  color: var(--nav-text);
  transform: scale(1.1);
}
</style>
```

- [ ] **Step 3: 验证组件可独立渲染**

运行: `npm run build`
预期: 构建成功，无错误

- [ ] **Step 4: 提交**

```bash
git add src/components/NavCard.vue
git commit -m "feat: add NavCard.vue component with horizontal layout"
```

---

## Task 2: 重构 NavCardGrid.vue 为网格容器

**Files:**
- Modify: `src/components/NavCardGrid.vue`

**Interfaces:**
- Consumes: NavCard.vue 组件
- Produces: 重构后的 NavCardGrid.vue，接受 columns prop

- [ ] **Step 1: 重写模板，使用 NavCard 组件**

```vue
<template>
  <div class="nav-card-grid">
    <div v-if="bookmarks.length > 0" class="cards-container" :class="animationClass">
      <NavCard
        v-for="(bookmark, index) in bookmarks"
        :key="bookmark.id"
        :bookmark="bookmark"
        :isAuthenticated="isAuthenticated"
        :style="getCardStyle(index)"
        @tag-click="handleTagClick"
        @show-detail="handleShowDetail"
      />
    </div>

    <div v-else class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <p>该分类下暂无书签</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import NavCard from './NavCard.vue'
import { useSettings } from '../composables/useSettings'
import { useTheme } from '../composables/useTheme'

const props = defineProps({
  bookmarks: {
    type: Array,
    default: () => []
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  },
  columns: {
    type: Number,
    default: 3
  }
})

const emit = defineEmits(['tag-click', 'show-detail'])

const { navCardAnimation, navCardBlur, navCardOpacity } = useSettings()
const { isDark } = useTheme()

const animationClass = ref('')

onMounted(() => {
  triggerAnimation()
})

function triggerAnimation() {
  if (!navCardAnimation.value || props.bookmarks.length === 0) {
    animationClass.value = ''
    return
  }
  animationClass.value = 'animate-slideUp'
}

function getCardStyle(index) {
  const baseAlpha = isDark.value ? 0.15 : 0.85
  const opacityFactor = navCardOpacity.value / 100
  const effectiveAlpha = baseAlpha * opacityFactor
  const style = {
    backdropFilter: `blur(${navCardBlur.value}px)`,
    WebkitBackdropFilter: `blur(${navCardBlur.value}px)`,
    background: `rgba(255, 255, 255, ${effectiveAlpha})`
  }
  if (animationClass.value) {
    style.animationDelay = `${Math.min(0.03 + index * 0.035, 0.8)}s`
  }
  return style
}

const handleTagClick = (tag) => {
  emit('tag-click', tag)
}

const handleShowDetail = (payload) => {
  emit('show-detail', payload)
}
</script>

<style scoped>
.nav-card-grid {
  width: 100%;
  display: flex;
  justify-content: center;
}

.cards-container {
  display: grid;
  grid-template-columns: repeat(var(--columns, 3), 1fr);
  gap: 16px;
  max-width: 80%;
  margin: 0 auto;
  width: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: 80%;
  margin: 0 auto;
  padding: 4rem 1rem;
  color: var(--nav-text-secondary);
  box-sizing: border-box;
  width: 100%;
  gap: 12px;
}

.empty-state svg {
  width: 48px;
  height: 48px;
  opacity: 0.3;
}

.empty-state p {
  font-size: 0.875rem;
  font-weight: 500;
}

.animate-slideUp :deep(.nav-card-horizontal) {
  animation: slideUpIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
  transform: translateY(20px);
}

@keyframes slideUpIn {
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 1024px) {
  .cards-container {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .cards-container {
    grid-template-columns: 1fr;
    max-width: 90%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .animate-slideUp :deep(.nav-card-horizontal) {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
```

- [ ] **Step 2: 验证网格容器工作正常**

运行: `npm run dev`
预期: 卡片以横向布局显示，3列网格

- [ ] **Step 3: 测试响应式布局**

调整浏览器窗口大小，验证：
- lg+ (1024px+): 3列
- md (640-1024px): 2列
- sm (<640px): 1列

- [ ] **Step 4: 提交**

```bash
git add src/components/NavCardGrid.vue
git commit -m "refactor:重构 NavCardGrid 为网格容器，使用 NavCard 组件"
```

---

## Task 3: 集成到 NavItemView 并测试

**Files:**
- Modify: `src/views/NavItemView.vue`（如需传递 columns prop）

**Interfaces:**
- Consumes: NavCardGrid.vue 组件

- [ ] **Step 1: 检查 NavItemView 是否需要修改**

查看 NavItemView.vue 中 NavCardGrid 的使用方式，确认是否需要传递 columns prop。

当前调用：
```vue
<NavCardGrid 
  :key="animationKey" 
  :bookmarks="currentBookmarks"
  :isAuthenticated="isAuthenticated"
  @tag-click="handleTagClick"
  @show-detail="handleShowDetail"
/>
```

如果需要支持动态列数，添加 columns prop。

- [ ] **Step 2: 运行开发服务器测试完整功能**

```bash
npm run dev
```

测试项目：
- [ ] 卡片显示为横向布局
- [ ] 图标在左侧垂直居中
- [ ] 名称、描述、标签、URL 正确显示
- [ ] 标签展开/收起功能正常
- [ ] 图标加载失败显示首字母
- [ ] hover 效果正常（上浮、阴影、边框变色、图标放大）
- [ ] 详情按钮在登录状态下显示
- [ ] 点击详情按钮打开编辑弹窗
- [ ] 卡片点击打开 URL
- [ ] 标签点击触发搜索
- [ ] 入场动画正常

- [ ] **Step 3: 运行构建验证**

```bash
npm run build
```

预期: 构建成功，无错误

- [ ] **Step 4: 提交**

```bash
git add src/views/NavItemView.vue
git commit -m "feat: integrate NavCard horizontal layout into NavItemView"
```

---

## Task 4: 清理和最终验证

**Files:**
- 无新增修改

**Interfaces:**
- 无

- [ ] **Step 1: 检查是否有遗留代码**

确认旧的垂直布局代码已完全移除，无冗余。

- [ ] **Step 2: 完整功能测试**

运行开发服务器，测试所有功能：
- [ ] 切换到导航站风格
- [ ] 浏览不同分类的书签
- [ ] 测试搜索功能
- [ ] 测试标签筛选
- [ ] 测试登录/登出状态
- [ ] 测试响应式布局（不同屏幕尺寸）

- [ ] **Step 3: 最终构建**

```bash
npm run build
```

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: complete NavCard horizontal layout redesign"
```
