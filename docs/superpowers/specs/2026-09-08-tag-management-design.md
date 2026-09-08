# 标签管理功能设计文档

**日期**: 2026-09-08
**状态**: 已批准
**方案**: 混合实现（前端展示 + 后端API处理）

---

## 1. 概述

### 1.1 目标
实现统一的标签管理功能，支持：
- 查看所有标签及对应书签数量
- 重命名标签（支持合并）
- 删除标签（从书签中移除）
- 搜索和排序标签
- 展开查看标签下的书签列表

### 1.2 位置
在设置弹窗（NavSettingsModal.vue）中新增"标签管理"Tab，与现有的"书签"、"菜单"Tab并列。

---

## 2. 架构设计

### 2.1 文件结构

```
src/
├── components/
│   ├── TagManagement.vue          # 标签管理Tab组件（新增）
│   └── TagRenameDialog.vue        # 重命名标签弹窗（新增）
├── composables/
│   └── useTags.js                 # 标签管理composable（新增）
└── ...

functions/api/
└── tags/
    ├── index.js                   # GET: 获取标签列表（新增）
    ├── [name].js                  # PUT: 重命名 / DELETE: 删除（新增）
    └── batch.js                   # POST: 批量操作（新增）
```

### 2.2 数据流

```
用户操作 (TagManagement.vue)
    ↓
useTags.js (composable) → 通过 apiRequest() 发请求
    ↓
Cloudflare Functions (functions/api/tags/*.js)
    ↓
D1 数据库 (bookmarks.tags 字段)
    ↓
useBookmarks.fetchData() → 刷新前端数据
```

---

## 3. 前端设计

### 3.1 TagManagement.vue 组件

#### 布局

```
┌─────────────────────────────────────────────────────────┐
│  标签管理                                      [搜索] [排序▼] │
├─────────────────────────────────────────────────────────┤
│  标签名          书签数量    操作                        │
├─────────────────────────────────────────────────────────┤
│  ▶ Cloudflare    12         [编辑] [删除]               │
│  ▼ AI            8          [编辑] [删除]               │
│    ├ bookmark1   https://...                           │
│    ├ bookmark2   https://...                           │
│    └ ... (共8个)                                        │
│  ▶ 开发工具      5          [编辑] [删除]               │
├─────────────────────────────────────────────────────────┤
│  共 25 个标签，48 个书签使用标签                          │
└─────────────────────────────────────────────────────────┘
```

#### 交互

| 操作 | 交互方式 |
|------|----------|
| 展开/折叠 | 点击标签行 |
| 编辑 | 点击[编辑] → 弹出TagRenameDialog |
| 删除 | 点击[删除] → ConfirmDialog确认 |
| 搜索 | 输入框实时筛选 |
| 排序 | 按名称/数量排序，升序/降序切换 |

### 3.2 TagRenameDialog.vue 组件

#### 布局

```
┌─────────────────────────────────────┐
│  重命名标签                     [X]  │
├─────────────────────────────────────┤
│  当前标签名：AI                      │
│                                     │
│  新标签名：[____________]            │
│                                     │
│  ⚠️ 标签"AI工具"已存在，继续将合并  │
│                                     │
│         [取消]  [确认重命名]         │
└─────────────────────────────────────┘
```

#### 交互流程

1. 输入新名称 → 实时检查是否已存在
2. 若已存在 → 显示合并提示
3. 确认 → 调用 `PUT /api/tags/:name`
4. 成功 → 刷新列表，显示toast

### 3.3 useTags.js Composable

```javascript
// 状态
const tags = ref([])                    // [{name, count, bookmarks: []}]
const loading = ref(false)
const searchQuery = ref('')
const sortBy = ref('name')              // 'name' | 'count'
const sortOrder = ref('asc')            // 'asc' | 'desc'
const expandedTags = ref(new Set())

// 计算属性
const filteredTags = computed(() => { ... })  // 筛选+排序后的标签列表

// 方法
fetchTags()                            // GET /api/tags
renameTag(oldName, newName)            // PUT /api/tags/:name
deleteTag(name)                        // DELETE /api/tags/:name
toggleExpand(tagName)                  // 展开/折叠
```

---

## 4. 后端API设计

### 4.1 GET /api/tags

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "name": "AI",
      "count": 8,
      "bookmarks": [
        { "id": 1181, "name": "DeepSeek", "url": "https://..." }
      ]
    }
  ],
  "summary": {
    "totalTags": 25,
    "totalBookmarksWithTags": 48
  }
}
```

**SQL查询**:
```sql
-- 方法1：使用递归CTE拆分逗号分隔的标签
WITH RECURSIVE SplitTags AS (
  SELECT 
    id,
    TRIM(SUBSTR(tags, 1, INSTR(tags, ',') - 1)) as tag,
    CASE 
      WHEN INSTR(tags, ',') > 0 THEN SUBSTR(tags, INSTR(tags, ',') + 1)
      ELSE NULL
    END as remaining
  FROM bookmarks
  WHERE tags != '' AND tags IS NOT NULL
  
  UNION ALL
  
  SELECT 
    id,
    TRIM(SUBSTR(remaining, 1, INSTR(remaining, ',') - 1)),
    CASE 
      WHEN INSTR(remaining, ',') > 0 THEN SUBSTR(remaining, INSTR(remaining, ',') + 1)
      ELSE NULL
    END
  FROM SplitTags
  WHERE remaining IS NOT NULL AND remaining != ''
)
SELECT 
  tag as name,
  COUNT(*) as count,
  GROUP_CONCAT(id) as bookmark_ids
FROM SplitTags
WHERE tag IS NOT NULL AND tag != ''
GROUP BY tag
ORDER BY tag
```

### 4.2 PUT /api/tags/:name

**请求**:
```json
{
  "newName": "AI工具"
}
```

**响应**:
```json
{
  "success": true,
  "merged": false,
  "affectedCount": 8
}
```

**逻辑**:
1. 验证标签名（非空、不含逗号）
2. 检查 `newName` 是否已存在
3. 若存在 → `merged = true`，合并标签
4. 更新所有包含该标签的书签

### 4.3 DELETE /api/tags/:name

**响应**:
```json
{
  "success": true,
  "affectedCount": 8
}
```

**SQL操作**:
```sql
UPDATE bookmarks 
SET tags = TRIM(REPLACE(
  REPLACE(REPLACE(tags, '标签名,', ''), ',标签名', ''),
  '标签名', ''
)),
updated_at = CURRENT_TIMESTAMP
WHERE tags LIKE '%标签名%'
```

---

## 5. 验证规则

### 5.1 前端验证

| 规则 | 实现 |
|------|------|
| 空标签名 | 输入框required + 提交前检查 |
| 包含逗号 | 正则 `/,/` 检查 |
| 长度限制 | `maxlength="50"` |
| 重命名为自身 | 比较新旧名称 |

### 5.2 后端验证

| 规则 | 实现 |
|------|------|
| 空标签名 | `if (!newName \|\| !newName.trim())` |
| 包含逗号 | `if (newName.includes(','))` |

---

## 6. 错误处理

### 6.1 错误码

| 错误码 | 场景 | 响应 |
|--------|------|------|
| 400 | 标签名为空 | `{ error: '标签名不能为空' }` |
| 400 | 标签名含逗号 | `{ error: '标签名不能包含逗号' }` |
| 404 | 标签不存在 | `{ error: '标签不存在' }` |
| 401 | 未授权 | `{ error: '未授权' }` |

### 6.2 Toast提示

| 操作 | 成功提示 | 错误提示 |
|------|----------|----------|
| 重命名 | `标签已重命名为"xxx"` | `重命名失败：xxx` |
| 合并 | `已将N个书签合并到"xxx"` | `合并失败：xxx` |
| 删除 | `已从N个书签中移除标签` | `删除失败：xxx` |

---

## 7. 边界情况

| 情况 | 处理方式 |
|------|----------|
| 标签名包含逗号 | 后端拒绝，提示"标签名不能包含逗号" |
| 标签名为空格 | 后端自动trim，若为空则拒绝 |
| 标签名大小写 | 区分大小写（"AI" ≠ "ai"） |
| 重命名为自身 | 前端阻止，显示"新名称与原名称相同" |
| 并发操作 | 最后写入胜出，前端刷新获取最新状态 |
| 大量书签（>1000） | 后端使用事务批量更新，前端显示loading |

---

## 8. 性能优化

- **批量更新**：使用事务处理多个书签更新
- **缓存**：操作后前端刷新标签列表，利用现有缓存机制
- **懒加载**：展开标签时才获取书签列表（初始响应中已包含）

---

## 9. 待确认事项

- [ ] 标签管理是否需要支持批量操作（批量删除/重命名）？→ 暂不实现，后续根据需求添加
