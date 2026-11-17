# 书签可访问性检测（Link Health）设计

日期：2026-11-17
状态：待用户批准

## 意图

书签里积累了一批已经删掉的站（自己下线过的 CF 部署、别人的站），点开才发现 404。希望在书签卡片上直接看到"这个链接还活着吗"，用于**清理死书签**。

硬约束：**不消耗 Cloudflare Workers/Pages 的请求配额**。

## 目标

- 卡片上标出已失效的书签，区分「确认失效」与「待确认」
- 检测走用户自己的浏览器网络，零 CF 请求
- 检测结果本地缓存，日常浏览不重复请求
- 明确区分三种状态，避免误删

## 非目标

- 不做自动删除，只做标记 + 待清理清单
- 不做纯网页（no-cors）降级检测
- 不做跨设备同步（结果存 localStorage）
- 不检测页面内容质量（登录墙、JS 空壳页一律算"活着"）

## 为什么必须依赖浏览器扩展

实测（真实 Chromium，跨域 `fetch(url, {mode:'no-cors'})`）：

```
https://example.com/                      → resolved, type:opaque, status:0   (200)
https://example.com/no-such-page-xyz-123  → resolved, type:opaque, status:0   (404)
https://nonexistent-...pages.dev/         → rejected, TypeError              (DNS 无记录)
http://example.com/  (从 https 页面)      → rejected, TypeError, 0ms         (混合内容)
no-cors + redirect:'manual'               → rejected, TypeError, 9ms         (规范禁止)
```

网页 JS 永远拿不到跨域状态码 —— 200 与 404 返回值完全相同。只有扩展后台脚本（有 `host_permissions`）能读到真实状态码。仓库现有 `browser-extension` 的 `host_permissions` 已经是 `*://*/*`，无需新增权限。

## 状态模型

对外只暴露三态，`reason` 放 tooltip：

| 状态 | 判定 | 卡片圆点 | 文案 |
|------|------|----------|------|
| `ok` | 2xx / 3xx | 绿色实心 | 可访问 |
| `dead` | **404 / 410**（以及显式 DNS 不存在，若可得） | 红色实心 | 已失效 |
| `unsure` | 其余全部：5xx（含 522/523/530）、401/403/429、400/405/451、超时、连接失败 | 灰色实心 | 待确认 |
| `pending` | 从未检测 / 检测中 | 不显示（保留占位） | — |

判定函数（放 `shared.js`，纯函数可单测）：

```
输入 { status, error, timedOut, durationMs }
  status 200-399                → ok
  status 404 / 410              → dead
  status 401 / 403 / 429        → unsure (reason: 需要登录或有防护)
  status 5xx                    → unsure (reason: 源站不可达 HTTP xxx)
  其他 status                    → unsure (reason: HTTP xxx)
  timedOut                      → unsure (reason: 超时)
  error && durationMs < 3000    → unsure (reason: 域名或连接失败)
  error                         → unsure (reason: 请求失败)
```

**永远只有 404/410 进 `dead`。** 522 这类"源站不可达"可能是项目删了也可能是临时挂了，归 `unsure`；403 是被防护不是死链，归 `unsure`。误删代价高于漏删。

## 架构

```
NavItemView / NavSettingsModal
  └── useLinkHealth  (composable, 单例)
        ├── 探测扩展：<html data-bm-ext="1.8.0">
        ├── window.postMessage({ source:'bm-link-health', reqId, urls })
        ├── 10s 超时等回包
        └── localStorage['linkHealthCache']  (url → { state, reason, status, at })

content.js（新增桥接）
  └── 校验 → chrome.runtime.sendMessage({ type:'link-health-check', urls })

background.js / background.firefox.js（新增 onMessage 分支）
  └── 并发 5，fetch(url, { method:'GET', credentials:'omit',
                          referrerPolicy:'no-referrer', redirect:'follow' })
      → 读 response.status 后立即 response.body.cancel()
      → AbortController 8s 超时
      → 用 shared.js 的分类函数给出 { url, state, status, reason }
```

细节：

- `body.cancel()` 是为了只读状态码、不下载整页
- `credentials:'omit'` 避免把登录 cookie 带给目标站
- 单次批量 ≤ 40 个 URL，超出由 composable 分片
- 同一次请求内按 URL 去重

## 现有扩展的现状

当前 `background.js` 只处理三类消息，没有任何链接检测能力：

| 消息 | 作用 |
|------|------|
| `request-context-info` | 右键菜单保存书签时传页面信息 |
| `get-prefetch-data` | 返回分类/标签预取缓存 |
| `data-changed` | 书签变化后重新预取 |

`content.js` 也只响应 `get-page-metadata`（抓标题/描述）。

所以本次是**新增**一条 `link-health-check` 消息链路。关键点：`host_permissions` 已经是 `*://*/*`（当初为了在任意页面注入采集内容脚本），检测能力不需要新增任何权限，**更新后浏览器不会弹重新授权**。

## 触发与缓存

触发单位是**当前列表**（`currentBookmarks`），不是"分类"这一层概念。以下任一发生都算列表变化：

- 切换根分类
- 点击子菜单
- 标签筛选变化
- 站内搜索结果

列表变化后，找出其中「从未检测过」或「缓存超过 24h」的书签，交给扩展批量检测：

- 单次最多 40 个，超出分片，串行
- 检测在后台进行，卡片先用 `pending` 渲染，结果回来再就地更新
- 同一 URL 在 5 分钟内不重复检测（防止来回点菜单反复打请求）
- 滚动、切换标签页、重新渲染都不触发

**手动**：设置 → 书签 tab 的「重新检测」按钮，忽略 24h 缓存。

**缓存**：`localStorage['linkHealthCache']`，key 为原始 URL，`at` 为检测时间；超过 30 天的条目在写入时清理，最多保留 2000 条。

设置 → 外观 增加开关「书签死链检测」，默认开启，关闭后不自动触发、不显示圆点。

## UI

卡片（`NavCard.vue`）：圆点放在 **URL 行最前面，`https://` 的左边**。

```
┌────────────────────────────────┐
│ [icon] 我的旧项目                 │
│        描述文字…                  │
│ 标签 标签                         │
│ ● https://old.example.com        │
└────────────────────────────────┘
   ↑ 6px 圆点，green / red / grey
┌────────────────────────────────┐
│ ○ https://a.b.com                │  ← 灰：待确认
└────────────────────────────────┘
┌────────────────────────────────┐
│   https://c.d.com                │  ← 未检测：不显示，保留 6px 占位
└────────────────────────────────┘
```

- 圆点 `6px`，`border-radius: 50%`，`margin-right: 6px`，`flex-shrink: 0`
- 颜色用主题变量：`var(--success)` / 红 / `var(--text-tertiary)`
- URL 行改成 `display:flex; align-items:center`，URL 文本 `min-width:0` 保持原来的省略号
- 未检测时不渲染圆点，但保留 6px + 6px 的占位，避免文字左右跳动

**tooltip 的处理（重要）**：`v-tooltip` 是全局单例，卡片根元素已经挂了 `v-tooltip`，鼠标从卡片移到徽标会启动第二个 500ms 计时器，两个计时器写同一个元素，文案会互相覆盖闪烁。所以**徽标不挂 `v-tooltip`**，改为把状态并入卡片现有的 tooltip 末尾：

```
名称：我的旧项目
地址：https://old.example.com
描述：…
状态：HTTP 404 · 检测于 3 小时前
```

同时把卡片 tooltip 的显示条件从 `shouldShowTitle ? hoverTitle : ''` 放宽为「标题/描述被截断 **或** 该书签有非 `ok` 状态」，这样出问题的书签一定能看到原因。

设置 → 书签 tab：

- 顶部一行统计：`12 个已失效 · 5 个待确认 · 2 小时前检测`
- 筛选胶囊：「全部 / 已失效 / 待确认」
- 按钮「重新检测」（检测当前筛选结果）

未装扩展（`<html data-bm-ext>` 不存在）：

- 卡片不显示任何圆点
- 设置里的入口显示「死链检测 · 需安装扩展」，点击用 `BaseDialog` 说明原因 + 安装步骤
- 已缓存的结果仍然显示（tooltip 带检测时间），只是不能刷新


## 代码改动清单

| 文件 | 改动 |
|------|------|
| `browser-extension/shared.js` | 新增 `classifyLinkResult()`、状态常量与文案 |
| `browser-extension/background.js` | 新增 `link-health-check` 消息分支 + 批量并发执行 |
| `browser-extension/background.firefox.js` | 同上（两处必须同步） |
| `browser-extension/content.js` | 新增 postMessage 桥 + `data-bm-ext` 标记 |
| `browser-extension/manifest.json` / `.firefox.json` | 版本号 1.7.2 → 1.8.0（权限不变） |
| `browser-extension/package.ps1` / `package.sh` | 确认文件白名单无需新增（本次不改文件名） |
| `browser-extension/options.html` / `options.js` | 新增「死链检测」授权区块（Firefox 需要手动授予访问所有网站权限） |
| `src/composables/useLinkHealth.js` | 新增：扩展探测、桥接、分片、超时、缓存 |
| `src/components/NavCard.vue` | URL 行右侧状态徽标 |
| `src/views/NavItemView.vue` | 进入分类时按缓存条件触发检测 |
| `src/components/NavSettingsModal.vue` | 统计行、筛选、重新检测、未装扩展提示 |
| `tests/extension-shared.test.js` | 分类函数用例 |

## 安全

- content script 只接受来自本窗口的 postMessage，校验 `source` 字段、数组长度 ≤ 40、URL 协议仅 http/https
- 只回传状态码/错误类型，不回传响应体
- 检测请求不带 credential、不带 referrer

## 风险与未知

| 风险 | 处理 |
|------|------|
| 扩展后台能否请求 `http://`（扩展页面的混合内容策略） | 实现时验证；若被拦，该类书签一律标 `unsure`，不标死链 |
| Firefox 的 `optional_permissions` 默认未授予，后台跨站 fetch 会被拦 | options 页新增「死链检测 · 授予访问所有网站权限」，`permissions.request` 只能在扩展页面用户手势里调用；未授权时不误判，只显示「待确认」 |
| MV3 service worker 被回收导致无回包 | composable 10s 超时 → 提示「扩展无响应」，不清空已有缓存 |
| 站点有 bot 防护返回 403/挑战页 | 归 `unsure`，不会误标死链 |
| 检测向目标站暴露用户 IP | 24h 缓存 + 每次分类触发一次 |
| 多设备结果不共享 | 已知取舍，后续可改存 D1 |

## 测试

- `npm run test:ext`：`classifyLinkResult` 覆盖 200/204/301/401/403/404/410/429/500/522/超时/连接失败
- `npm run build`：前端构建通过
- 手测：加载扩展 → 打开分类 → 卡片出现徽标；卸下扩展 → 徽标消失但设置里显示需安装；断网 → 结果全为 `unsure`

## 实施顺序

1. `shared.js` 分类函数 + 单测
2. 两个 `background*.js` 的检测分支
3. `content.js` 桥接与存在标记
4. `useLinkHealth` composable
5. `NavCard` 徽标
6. `NavItemView` 触发
7. `NavSettingsModal` 入口与筛选
8. 版本号、打包、构建、手测
