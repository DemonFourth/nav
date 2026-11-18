# 设置 · 菜单 Tab 改回两列（左树 + 右详情 · 单编辑会话 + 显式保存）

> 状态：已实施并验证（2026-11-18，commit `807e05c`）
> 相关文件：`src/components/settings/MenuSettings.vue`、`src/components/settings/MenuCategoryRow.vue`、`src/components/settings/MenuDetailPanel.vue`（新建）、`src/components/NavSettingsModal.vue`

## 1. 背景

`b34d351` 把菜单 Tab 从「左树 + 右详情（1fr / 380px）」改成单栏树。当时的理由是实测：内容区只有 547px 高，双栏各带 600px 固定高面板 → 内容区滚动 + 面板内部滚动两层套叠；右栏未选中时长期空白；820px 窗口下 380px 右栏占 46%。

单栏解决了这些问题，但宽屏下（1920 屏内容区约 1578px）整行拉满，名字在左、计数在最右，中间近千像素空白；父级、位置、计数没有稳定的展示位置，只能靠缩进和弹窗推断。

结论：两列可以恢复，但必须**不引入固定高面板**、**不恢复批量待保存**、**一次只允许一个编辑会话**。

## 2. 目标 / 非目标

**目标**
- 视口 > 1100px 两列：左树（现状）+ 右 340px 详情。
- 同一时刻只允许一个编辑会话；在右栏改完点「保存」才写 D1。
- 宽屏右栏是唯一编辑入口：行内改名/描述退化为「聚焦右栏字段」。
- ≤1100px 完全退回今天单列（行内编辑 + `⋯`，`editing` 本来就是单例）。

**非目标**
- 不做多处草稿、批量保存、离线队列。
- 不恢复「待保存」批量条与「查看详情 / 确认保存」。
- 不改后端接口与表结构。

## 3. 编辑会话模型

```js
editSession = { id, name, description, savedName, savedDescription }
```

- `dirty = name !== savedName || description !== savedDescription`。
- 任何「开始编辑另一处」的动作在 dirty 时都要先处置当前会话（§5），处置完成前 `editSession.id` 不变 → 结构上不存在两个草稿。

## 4. 写库模型

| 动作 | 请求 |
|------|------|
| 右栏「保存」（名称和/或描述） | **1 次** `PUT /api/categories/:id`，body 同时带 `name` + `description`（后端单条 UPDATE） |
| 右栏「取消」/ Esc | 0 次，草稿回填 |
| 切换分类（dirty） | 先处置；选「保存并切换」才发 1 次 PUT |
| 窄屏行内改名（≤1100px） | 1 次 PUT（现状失焦提交，不变） |
| 移动 / 新建 / 删除 | 现有弹窗各自 1 次，不变 |

**同时保存多处：不支持，也不会发生。** PUT 是单分类粒度，N 处只能 N 次请求且无法原子；本模型一次只有一个会话。

## 5. 单会话与失败闭环（重点）

| 触发 | 行为 | 失败时 |
|------|------|--------|
| dirty 时点另一行 / 另一行 ⋯「重命名」 | 弹三选一：`取消` / `放弃更改` / `保存并切换` | 保存失败 → **不切换**、草稿保留、红色 toast、按钮恢复 |
| dirty 时关闭弹窗（× / 遮罩） | 三选一：`取消` / `放弃更改` / `保存并关闭` | 保存失败 → **不关闭**、草稿保留、toast |
| 保存时名称为空 | 不写库；字段下红字 + toast + 聚焦名称框 | — |
| 保存返回 409 重名 | 保留草稿，红色 toast 显示服务端文案，可改名重试 | — |
| 保存网络错误 / 401 | 回滚乐观更新，红色 toast；401 走登录框或「登录已过期」 | — |
| 选中分类被外部删除 | 自动选中第一条根分类，warning toast「分类已被删除，未保存的修改已丢弃」 | — |
| 自己删除当前分类 | 不重复提示（用户显式删除），清空会话 | 删除失败 → toast（现有流程），会话保留 |
| 切换中途弹窗被 Esc/遮罩关掉 | 视为「取消」，停在原分类，草稿不丢 | — |

所有处置串行：`resolving` 门闩，避免连点两行弹两个确认框。

## 6. 布局

```
.menu-settings (flex column, 100%)
├ .menu-toolbar（不变，整行）
└ .menu-body (flex:1, min-height:0, grid: minmax(0,1fr) 340px)
   ├ .menu-list（overflow-y:auto）
   └ .menu-detail（纵向 flex：head + body(overflow-y:auto) + footer 固定保存条）
```

- `.settings-content.content-flush` 已 `overflow:hidden`；两栏内部各自滚动，无外层滚动条。
- `@media (max-width: 1100px)`：`grid-template-columns: 1fr`，右栏 `display:none`。

## 7. 组件改动

| 文件 | 改动 |
|------|------|
| `MenuDetailPanel.vue`（新建） | 展示节点路径 + 名称/描述（v-model 草稿）、父级与「移动到…」、位置、书签/子分类计数、新建子分类/删除、底部固定「取消 / 保存」+「未保存」标记；`focusName / focusDescription` 暴露给父级。 |
| `MenuSettings.vue` | `.menu-body` 外壳；`selectedId` / `draft` / `dirty` / `saving` / `nameError`；`selectCategory`（dirty 三选一）、`saveDraft`（乐观更新→PUT→失败回滚+toast）、`discardDraft`、`handlePanelAction`；`matchMedia('(min-width:1101px)')` 控制 `editMode`；`defineExpose({ hasUnsaved, confirmLeave })`。 |
| `MenuCategoryRow.vue` | `selected` / `dirtyId` / `editMode` props 透传；选中态样式；dirty 小圆点；`select` emit（click + focus）；panel 模式双击与 ⋯ 重命名/编辑描述改为 `focus-name` / `focus-description` 动作。 |
| `NavSettingsModal.vue` | `<MenuSettings ref="menuSettingsRef" />`；`handleClose` 先 `hasUnsaved()` → `confirmLeave()`，返回 false 则不关。 |
| `AGENTS.md` | 菜单 Tab 小节改为两列 + 单会话 + 显式保存说明。 |

## 8. 验收

- [ ] 1440 / 1920 两列并排、无外层滚动条；1280 两列成立；≤1100 与今天单列一致。
- [ ] 只改名称、只改描述、两者都改 → 各只发 1 次 PUT。
- [ ] dirty 时点另一行弹三选一；「取消」原位不动；「放弃更改」0 请求切换；「保存并切换」1 请求后切换。
- [ ] 保存失败（断网/409）不切换、不关闭、草稿保留、有 toast。
- [ ] dirty 关闭弹窗弹确认；保存失败时不关闭。
- [ ] 宽屏双击行 = 聚焦右栏名称框；窄屏 = 行内改名。
- [ ] 拖拽排序、跨级提示、新建/移动/删除照旧。
- [ ] `npm run build`、`npm run test:counts` 通过；浏览器三档宽度手动验证。

## 9. 已知边界

- 多标签页同时改同一分类：后保存者覆盖（PUT 全量字段），与现状一致，不加乐观锁。
- 保存后的后台 `fetchData` 是静默的（`useBookmarks` 既有约定）；若它失败，写操作本身已成功，列表靠下次刷新收敛。

## 10. 实施记录

- `npm run build` 通过；`npm run test:counts` 5/5 通过。
- 1280×609 实测：`.menu-body` 1001px = 列表 661 + 右栏 340；列表内部滚动（2002/492），外层 `.settings-content` 为 `overflow:hidden`，无嵌套滚动。
- 交互实测：dirty 切行三选一（取消原位不动 / 放弃更改 0 次 PUT 切换 / 保存并切换 1 次 PUT）；关闭弹窗（含切到别的 Tab 后关闭）同样拦截；名称置空有红字 + toast 且不发请求。
- 断网保存：乐观更新回滚 + toast，草稿保留、按钮恢复；用拦截的假成功响应验证「已保存 → 后台刷新回真实值」。
- ≤1100px：右栏不渲染，双击回到行内改名；控制台无新增错误。
- 保存成功路径未对真实 D1 执行（避免影响线上数据），以假响应验证。

