# 书签管理系统

基于 Vue 3 + Vite + Cloudflare Pages Functions + D1 构建的书签管理系统，支持默认管理模式与导航站模式两种界面。

## 功能特性

- 多级分类管理，支持嵌套分类与排序
- 书签增删改查，支持描述、图标、备注、标签等信息
- 默认管理模式：适合整理、编辑和批量维护书签
- 导航站模式：适合日常访问，支持顶部菜单、站内/站外搜索、固定壁纸、卡片动画
- 搜索功能：支持书签筛选与导航站搜索引擎切换
- 主题与外观设置：亮色/暗色、随机壁纸、自定义标题、页脚内容
- 图标源配置：支持多图标源回退、启用/禁用、顺序调整
- 批量操作：批量移动、编辑、删除
- 导入导出：支持 JSON / HTML
- AI 辅助：支持描述生成、分类推荐（需配置兼容 OpenAI 的 API）
- 浏览器扩展构建：支持 Chromium / Firefox

## 导航站模式说明

项目内置 `displayMode` 双模式切换：

- `default`：默认书签管理界面
- `nav-item`：导航站模式

导航站模式最近做了以下增强：

- 参考 [eooce/Nav-Item](https://github.com/eooce/Nav-Item) 的视觉风格进行了重新调整
- 支持固定壁纸地址配置
- 支持卡片切换动画开关
- 卡片、菜单栏、搜索框样式按导航站场景独立优化
- 上述导航站专属设置仅保存在本地，不同步到 D1

## 技术栈

- Vue 3
- Vite
- Cloudflare Pages Functions
- Cloudflare D1
- Cloudflare R2（可选，用于备份）
- Wrangler

## 项目结构

```text
src/
├── components/          # 通用组件与设置面板
│   └── settings/        # 设置页子模块
├── composables/         # 组合式逻辑（认证、书签、设置、主题等）
├── views/               # 页面级视图（含 NavItemView）
├── utils/               # 工具函数
├── assets/              # 全局样式
├── App.vue              # 应用入口视图
└── main.js              # 应用入口
```

## 本地开发

```bash
npm install
npm run dev
```

默认开发地址：`http://localhost:3000`

## 构建与预览

```bash
npm run build
npm run preview
```

## 部署

```bash
npm run deploy
```

部署前需要在 Cloudflare Pages 中配置：

### D1 绑定

- 绑定变量名：`DB`

### 必需环境变量

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `JWT_SECRET`

### 可选环境变量

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

### 可选 R2 绑定

- 绑定变量名：`BACKUP_BUCKET`

## 数据库与脚本

```bash
npm run db:create
npm run db:init:local
npm run db:init:remote
npm run db:migrate:indexes
```

## 浏览器扩展

```bash
npm run ext:build:chromium
npm run ext:build:firefox
```

## 当前外观设置的存储策略

### 同步到 D1 的设置

- `showSearch`
- `hideEmptyCategories`
- `customTitle`
- `footerContent`
- `activeSettingsTab`
- `publicMode`
- `randomWallpaper`
- `wallpaperApi`
- `avatarUrl`

### 仅本地存储的设置

- `displayMode`
- `navCardAnimation`
- `navWallpaper`
- `iconSources`
- `proxyUrl`

## 参考项目

导航站模式视觉风格参考：

- GitHub: [https://github.com/eooce/Nav-Item](https://github.com/eooce/Nav-Item)
- 示例站点: [https://eooce.ct8.pl/](https://eooce.ct8.pl/)

本项目并非该项目的直接移植，而是在现有书签管理系统基础上，参考其导航站布局与交互风格进行适配。

## 许可证

Apache License 2.0
