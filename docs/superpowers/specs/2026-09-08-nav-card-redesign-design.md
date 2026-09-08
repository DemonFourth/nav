# NavCard 重新设计 - 横向布局

## 概述

将导航模式（nav-item）的书签卡片从垂直居中布局改为类似 i8k.tv 的横向布局，提升信息展示密度和可读性。

## 需求总结

### 显示字段
- 图标（40x40px，垂直居中）
- 名称（16px粗体，1行截断）
- 描述（14px，最多2行截断，灰色）
- 标签（药丸样式，最多5-6个）
- URL（12px灰色，单行截断）
- 备注：不显示

### 布局
- 横向布局：左图右文
- 默认3列，通过 props 控制，不硬编码
- 响应式：lg+ 3列，md 2列，sm 1列

### 交互功能
- 卡片点击 → 打开URL
- 标签点击 → 搜索该标签
- 标签展开/收起（超过5-6个时）
- 图标加载失败 → 显示首字母
- hover效果：上浮+阴影+边框变色+图标放大
- tooltip：只在名称/描述截断时显示
- 详情按钮：登录时右下角，点击打开编辑弹窗
- 入场动画：slideUp + 逐个延迟
- 动态背景：模糊度/透明度可配置

## 组件设计

### 组件结构

```
NavCardGrid.vue（网格容器）
├── Props: bookmarks, isAuthenticated, columns
├── 动态列数：style="grid-template-columns: repeat(columns, 1fr)"
└── 渲染：<NavCard /> × N

NavCard.vue（单个卡片）
├── Props: bookmark, isAuthenticated
├── Emits: tag-click, show-detail
├── 横向布局：flex row
│   ├── 左侧：图标（40x40，垂直居中）
│   ├── 中间：名称 + 描述 + 标签 + URL
│   └── 右下角：详情按钮（登录时显示）
└── 保留所有现有功能
```

### Props 定义

#### NavCardGrid.vue
```javascript
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
```

#### NavCard.vue
```javascript
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
```

### 模板结构

#### NavCardGrid.vue
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
    <!-- empty state -->
  </div>
</template>
```

#### NavCard.vue
```vue
<template>
  <div 
    class="nav-card-horizontal"
    @click="handleCardClick"
    :title="getHoverTitle"
  >
    <!-- 图标 -->
    <div class="nav-card-icon">
      <img 
        v-if="!iconError"
        :src="getIconUrl"
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
      <!-- 名称 -->
      <h3 class="nav-card-title">{{ bookmark.name }}</h3>
      
      <!-- 描述 -->
      <p v-if="bookmark.description" class="nav-card-description">
        {{ bookmark.description }}
      </p>
      
      <!-- 标签 -->
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
      
      <!-- URL -->
      <div class="nav-card-url">{{ bookmark.url }}</div>
    </div>
    
    <!-- 详情按钮（登录时显示） -->
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
```

### 样式设计

#### CSS 变量（复用现有）
```css
--nav-card-bg：卡片背景
--nav-card-hover：hover 背景
--nav-border：边框颜色
--nav-text：文字颜色
--nav-text-secondary：次要文字颜色
--nav-primary：主题色（标签、hover边框）
```

#### 核心样式
```css
/* 网格容器 */
.cards-container {
  display: grid;
  grid-template-columns: repeat(var(--columns, 3), 1fr);
  gap: 16px;
  max-width: 80%;
  margin: 0 auto;
  width: 100%;
}

/* 横向卡片 */
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

/* 图标 */
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
}

/* 内容区域 */
.nav-card-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 名称 */
.nav-card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--nav-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 描述 */
.nav-card-description {
  font-size: 14px;
  color: var(--nav-text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 标签 */
.nav-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* URL */
.nav-card-url {
  font-size: 12px;
  color: var(--nav-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 详情按钮 */
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
}

.nav-card-horizontal:hover .nav-card-detail-btn {
  opacity: 1;
}
```

### 响应式设计

```css
/* 平板端 */
@media (max-width: 1024px) {
  .cards-container {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 手机端 */
@media (max-width: 640px) {
  .cards-container {
    grid-template-columns: 1fr;
    max-width: 90%;
  }
  
  .nav-card-horizontal {
    min-height: 80px;
  }
  
  .nav-card-icon {
    width: 32px;
    height: 32px;
  }
}
```

### 动画保留

```css
/* 入场动画 */
.animate-slideUp .nav-card-horizontal {
  animation: slideUpIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
  transform: translateY(20px);
}

@keyframes slideUpIn {
  to { opacity: 1; transform: translateY(0); }
}
```

## 文件变更

### 新增文件
- `src/components/NavCard.vue`：独立卡片组件

### 修改文件
- `src/components/NavCardGrid.vue`：重构为网格容器，导入 NavCard
- `src/views/NavItemView.vue`：如需传递 columns prop

### 删除文件
- 无

## 验证方式

1. 运行 `npm run dev` 启动开发服务器
2. 切换到导航站风格（displayMode: 'nav-item'）
3. 验证卡片显示为横向布局
4. 测试所有交互功能：
   - 卡片点击打开URL
   - 标签点击搜索
   - 标签展开/收起
   - 图标加载失败显示首字母
   - hover效果
   - tooltip显示
   - 详情按钮（登录状态）
5. 测试响应式布局（不同屏幕尺寸）
6. 运行 `npm run build` 确认构建成功
