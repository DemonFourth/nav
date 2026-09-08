# NavCard 布局修复计划

## 目标
将卡片从单行横向布局改为两行结构，与参考网站一致

## 修改文件
- `src/components/NavCard.vue`

## 具体修改

### 1. 模板结构
```
卡片 (flex-direction: column)
├── 第一行 (nav-card-top)
│   ├── 图标 (40x40)
│   └── 内容区域 (名称 + 描述)
└── 第二行 (nav-card-bottom)
    ├── 标签
    └── URL
```

### 2. CSS 修改
- `.nav-card-horizontal`：改为 `flex-direction: column`
- `.nav-card-top`：新增，`display: flex`，图标+内容横向排列
- `.nav-card-content`：移除（用 nav-card-top 替代）
- `.nav-card-bottom`：新增，标签+URL 左对齐

### 3. 保留功能
- 所有交互功能不变
- 详情按钮位置不变（右下角）
- hover 效果不变

## 验证
- npm run build 成功
- 刷新浏览器查看效果
