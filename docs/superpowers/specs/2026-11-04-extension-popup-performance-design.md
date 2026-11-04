# 浏览器插件 Popup：加载性能、连接状态与提示层级 设计

日期：2026-11-04
范围：`browser-extension/` + `functions/api/ping.js` + `functions/_middleware.js`

## 1. 背景

用户实测两个问题：

1. 打开插件时长时间停在"加载中"，保存后还要再等一段才关窗。
2. 底部状态条在固定高度弹窗里会被滚出视口，看不到保存失败/重复提示。

代码层面的原因（已核实）：

| 原因 | 位置 |
|---|---|
| 缓存未命中时，加载态阻塞等待 `/api/categories` + `/api/bookmarks?limit=1000` 两个请求 | `popup.js` `init()` |
| 缓存 5 分钟硬过期，没有 stale-while-revalidate | `popup.js` `loadPrefetchCache()` / `CACHE_TTL` |
| `loadSettings()` 内联执行 `/api/login` 自动续期，阻塞首屏 | `popup.js` |
| 保存成功后固定 `setTimeout(1000)` 才关窗 | `popup.js` `saveBookmark()` |
| 创建书签服务端串行 3 次 D1 查询 | `functions/api/bookmarks/index.js` |
| 状态条位于表单末尾，仍在 `form-section` 内 | `popup.html` |

## 2. 目标

- G1：有本地缓存的常规打开，首屏渲染不再等待任何网络请求（目标 <100ms 出表单）。
- G2：无缓存/缓存过期时也不整页遮罩，表单先呈现，分类区显示可交互的加载态。
- G3：所有 API 请求有超时与失败提示，不再无限转圈。
- G4：顶部常驻一条连接状态条，直观显示与 Cloudflare 的往返延迟与连接状态。
- G5：状态提示分层：连接状态常驻、操作结果 toast、URL 已存在内联在 URL 输入框下方。
- G6：保存成功 300ms 内关窗，消除固定 1 秒等待。
- G7：期间不改变查重的判定语义（仍以服务端 `/api/bookmarks?url=` 为准）。

## 3. 非目标

- 不做"编辑/删除已有书签"、"最近书签列表"、"弹窗内搜索"。
- 不引入前端框架，不拆分构建流程，仍为原生 JS + 单 CSS。
- 不改弹窗宽度（320px）与右键兜底窗口（420px）的不一致——留到下一轮布局优化。
- 不修复 popup 暗色模式未生效、死样式、innerHTML 注入等既有问题（可单独排期）。
- 不改 `bookmarks` 创建流程的 D1 查询次数（只记录耗时，不动后端逻辑）。
- 不做跨上下文（popup ↔ service worker）的续期互斥锁——代价过高，收益是"少一次幂等登录"。

## 4. 反目标

- 不允许用本地缓存书签列表做查重（会因缓存过期误判）。
- 不允许"延迟胶囊"额外增加每次打开的请求数（除空闲时的一次 ping）。
- 不允许为提速牺牲 token 过期后的正确登出/重新登录。
- 不允许 toast 覆盖或提前清除"URL 已存在"警告。

## 5. 约束

- 同时支持 Chromium MV3（`popup.js` + `background.js`）与 Firefox MV2（`background.firefox.js`）；两份 background 与 `options.js` 需各改一处 token 语义与缓存字段，已计入范围。
- 后端新增端点需加入 `functions/_middleware.js` 的 `PUBLIC_READ_PATHS`，否则未带 token 会被 401。
- CORS 已在中间件统一放行；`host_permissions: *://*/*`（Firefox 为 optional）已有，无需新增权限。
- 打包脚本按文件名白名单复制，本轮不新增扩展侧文件，因此 `package.ps1` / `package.sh` 不需要改。

## 6. 方案（已选）

- 延迟判定：**主动 ping + 被动真实请求计时**组合（B+A）。不采用仅被动，也不做网络/数据库两段式拆分（C）。
- 提示层级：**轻量 C**——顶部常驻连接条 + toast + URL 内联查重警告。
- 加载：**stale-while-revalidate**，缓存软过期；表单先渲染，数据后台刷新。

## 7. 详细设计

### 7.1 首屏状态机（popup.js）

`init()` 改为同步渲染优先：

1. 读 `chrome.storage.local`：`serverUrl`、`authToken`、`tokenExpiry`、`autoRenew`、`prefetchCache`。
2. 判定初始视图：
   - 无 `serverUrl` 或无 `authToken` → `auth-section`（立即显示）。
   - token 已过期且 `autoRenew=false` → `auth-section`。
   - token 已过期且 `autoRenew=true` → **仍显示表单**，后台静默续期；续期失败再切 `auth-section` 并 toast 提示"登录已过期，请重新登录"。
   - 其余 → 显示 `form-section`。
   - **token 过期判定必须先修正**（见 7.4.1），否则会把服务端仍有效的 token 判死。
3. 有缓存 → 立即回填分类/标签，`savedAt` 仅用于展示"数据时间"与决定是否刷新。
4. 无缓存 → 立即显示表单，但：
   - 分类输入框 `disabled`，placeholder 为"正在加载分类…"；
   - 保存按钮 `disabled`；
   - 顶部状态条显示 `○ 加载分类…`；
   - 分类加载成功 → 解除禁用；失败 → 状态条显示可点击的"分类加载失败 · 重试"。
5. 无论缓存是否命中，均在渲染后异步执行：`refreshCategories()`、`refreshTags()`、`checkDuplicateUrl()`、`maybePing()`，互不阻塞、互不 await。

`loading-section` 保留但仅用于"未登录 → 登录中"这类明确阻塞？**决定：删除该分支的使用**，元素保留在 HTML 中但不再展示，避免大改 DOM。实施时可移除。

**`init()` 可重入保护**（新增）：

- `chrome.storage.onChanged`：
  - `serverUrl` 变化 → 清空缓存 + 重新 `init()`；
  - 仅 `authToken` 变化（含后台续期写入）→ **只更新内存中的 `settings`**，不重新 `init()`；
  - `prefetchCache` 变化 → 忽略（popup 自己会刷新）。
- `getTabInfo()` 只填充**空字段**：`title` 已有值不覆盖，`url` 已有值不覆盖。
- 新增 `formDirty` 标记：用户编辑过任意字段后，任何异步回填（元数据描述、context 信息）都跳过。

### 7.2 缓存策略

缓存结构（`chrome.storage.local` 与 `chrome.storage.session` 双写，读时 session 优先）：

```js
{ categories: [...], tags: [...], timestamp: number, serverUrl: string }
```

- **字段名沿用 `timestamp`**，不改成 `savedAt`：`background.js` / `background.firefox.js` 已用该字段写入同一 key，改名会破坏兼容。
- `background` 的两份预取函数各加一行 `serverUrl`（它本来就从 storage 读到了 `serverUrl`），使 popup 能识别缓存属于哪台服务器。
- 读取时校验：`record.serverUrl` 存在且不等于当前 `serverUrl` → 视为无缓存并清除。
- `record.serverUrl` 缺失（升级前的旧缓存）→ 仅本次接受，并在刷新成功后补写 `serverUrl`。
- `age = Date.now() - timestamp`
- `age < 60s`：直接用，不刷新。
- `60s <= age < 7d`：**立即用旧值** + 后台刷新（stale-while-revalidate）。
- `age >= 7d`：仍用旧值，但状态条标注"数据较旧"。
- 无缓存：见 7.1 第 4 步。

刷新成功才更新 `timestamp`；失败保留旧值只提示，不阻塞。

`refreshCategories` / `refreshTags` 加 `inFlight` 去重，避免 popup 内多次触发。

### 7.3 请求封装

```js
apiFetch(path, { method = 'GET', body, timeout = 8000, label })
```

职责：
- 先 `await ensureTokenValid()`；
- `AbortController` 超时（默认 8s，保存 10s）；
- 记录 `{ label, ms, status, ok, at }` 到内存环形缓冲（每 label 保留最近 3 条，总数上限 20）；
- 401 → 清 token、切 `auth-section`、toast "登录已过期"；
- 网络错误/超时 → 抛出带 `kind: 'timeout' | 'network'` 的错误，由调用方决定文案。

所有现有 `fetch` 调用（categories / tags / 查重 / 保存 / AI）统一走该封装。

### 7.4 token 单飞（single-flight）

```js
let renewingPromise = null
function ensureTokenValid() {
  // 未过期 → true；已过期且未开自动续期 → false
  if (!needsRenew()) return true
  if (!renewingPromise) {
    renewingPromise = autoRenewToken().finally(() => { renewingPromise = null })
  }
  return renewingPromise
}
```

`loadSettings()` 不再内联续期；只读取与判定。续期统一由 `ensureTokenValid()` 触发。

**单飞范围说明**：`renewingPromise` 只在 popup 内生效。`background.js` 的 5 分钟定时续期仍可能独立发一次 `/api/login`；两次登录都是幂等的、结果都写回 `authToken`，接受这一点。验收只要求"popup 自身不并发重复登录"，不要求全局仅一次。

### 7.4.1 token 过期判定修正（范围内）

现状：`popup.js` / `options.js` / 两份 background 都用 `TOKEN_TTL = 15min` 且只读 token 第一段，忽略类型；而服务端（`_middleware.js`）是 `short = 30min`、`long = 30 天`，主站 `useAuth.js` 也与服务端一致。后果：

- 服务端仍有效的 30 分钟 token，插件在 15 分钟就判死 → 未开自动续期时被迫提前重登；
- 开了自动续期时，续期触发点从"剩 5 分钟"变成"剩 15 分钟"，`/api/login` 频率约翻倍——正好是打开插件变慢的一个来源。

修正：`parseTokenExpiry()` 改为按 token 类型取 TTL（`timestamp.type.hash` 三段：`long` 30 天、`short` 30 分钟；两段旧格式按 30 分钟）。四处同步修改。

注：插件设置页登录时不发送 `rememberMe`，服务端因此总发 `short`，所以插件实际拿到的是 30 分钟 token——本次修正后，续期频率减半，长 token 分支同时被覆盖。

### 7.5 连接延迟指示

**新端点** `functions/api/ping.js`：

```
GET /api/ping → 200 {"ok":true,"ts":<ms>}
Cache-Control: no-store
```

不查 D1、不读 settings、不校验 token。`_middleware.js` 将 `/api/ping` 加入 `PUBLIC_READ_PATHS`，页面调用时不带 `Authorization` 头。

**端点缺失的兼容**（插件可能连到尚未部署新后端的实例）：

- 首次 ping 返回 404/405 → 标记 `pingSupported = false`（模块内存，不落盘），状态条**不显示红色错误**，只退化为纯被动计时；
- 隐藏"重新测速"按钮，避免用户反复点出 404；
- 每次新开 popup 允许再试一次（后端可能已更新）。

**采集规则**（保证不额外增加请求）：

- 打开后 300ms 内若已有真实请求（分类/标签/查重）发出 → 不 ping，直接使用这些请求的耗时。
- 300ms 内无请求（全缓存命中场景）→ 发一次 ping。
- 状态条点击"测速"可手动再 ping 一次。

**状态条表现**（header 正下方，常驻，24px 高）：

| 状态 | 显示 | 颜色 |
|---|---|---|
| 未配置/未登录 | `○ 未连接` | 灰 |
| 加载分类中 | `○ 加载分类…` | 灰 |
| 正常且 ≤500ms | `● 320ms` | 绿 |
| 500–1500ms | `● 820ms` | 黄 |
| >1500ms | `● 2.1s` | 红 |
| 超时/失败 | `● 超时` | 红（可点击重试） |
| ping 端点不存在 | 不显示延迟数字，仅显示最近真实请求耗时 | 灰/按阈值 |
| 数据较旧（>7d） | 追加 `· 数据较旧` | 黄 |

点击状态条展开一个轻量面板，列出最近请求：`分类 480ms`、`查重 210ms`、`保存 1.4s`、`ping 120ms`，以及"重新测速"按钮。面板用绝对定位、点击外部关闭，不引入依赖。

### 7.6 提示分层

| 层级 | 元素 | 内容 | 生命周期 |
|---|---|---|---|
| 顶部状态条 | `#connection-bar`，header 下方，`position: sticky; top: 0` | 连接状态、延迟、重试入口 | 常驻 |
| 内联查重 | `#duplicate-hint`，URL form-group 内部、输入框下方 | `⚠ 已在「父/子」分类保存过` + 「打开」链接 | URL 改变/保存成功时清除 |
| Toast | `#toast`，固定于 header 下方浮层，不占布局 | 保存成功、AI 成功/失败、网络错误、登录过期 | 3s 自动淡出，可叠加最多 1 条（新覆盖旧） |

- 移除原 `#status-message`（表单末尾）及其 `showStatus` 调用，替换为 `showToast()` 与 `setDuplicateHint()`。
- `showStatus` 的 `persistent` 语义取消：持久信息只剩"连接状态"和"内联查重"。
- 重复提示点击「打开」→ `chrome.tabs.create({ url: existing.url })`，然后 `window.close()`。

### 7.7 保存流程

1. 校验必填（含分类必须已选中）。
2. 保存中：按钮禁用、文案"保存中…"。
3. 成功：
   - `showToast('已保存', 'success')`；
   - `chrome.runtime.sendMessage({ type: 'data-changed' })`；
   - `setTimeout(() => window.close(), 300)`。
4. 409 重复：内联警告（复用 7.6 的 `#duplicate-hint`）+ 恢复按钮，**不关窗**。
5. 超时/网络错误：toast "连接超时，请重试" + 恢复按钮，保留已填内容。

### 7.8 查重语义（保持不变）

- 触发：表单渲染且 URL 非空时一次；URL `blur` 时再次。
- 请求：`GET /api/bookmarks?url=<encoded>`，带 token；仅当响应 `exactUrl === true` 才判定。
- 竞态：沿用 `duplicateCheckSeq`；URL `input` 事件时 `seq++` 并清除内联警告，作废在途结果。
- 不做本地缓存查重。
- 命中后只显示提示，不自动修改表单。

### 7.9 版本与文档

- `manifest.json` / `manifest.firefox.json`：`1.6.6` → `1.7.0`。
- 若获同意，本文档迁入 `docs/superpowers/specs/2026-11-04-extension-popup-performance-design.md` 并提交。

## 8. 文件改动清单

| 文件 | 改动 |
|---|---|
| `browser-extension/popup.html` | 新增 `#connection-bar`、`#toast`、`#duplicate-hint`；移除底部 `#status-message` |
| `browser-extension/popup.js` | 首屏状态机、缓存软过期、`apiFetch`、token 单飞、计时采集、ping、toast、内联查重、保存 300ms 关窗、storage 变更保护 |
| `browser-extension/styles.css` | 状态条、toast、内联警告、加载骨架、sticky header 样式；清理与本次相关的旧状态条样式 |
| `browser-extension/background.js` | 预取缓存增加 `serverUrl` 字段；token TTL 修正 |
| `browser-extension/background.firefox.js` | 同上 |
| `browser-extension/options.js` | token TTL 修正（状态文案中的过期时间由类型决定） |
| `functions/api/ping.js` | 新增极简端点 |
| `functions/_middleware.js` | `PUBLIC_READ_PATHS` 增加 `/api/ping` |
| `manifest.json` / `manifest.firefox.json` | 版本号 |

## 9. 错误与边界

| 场景 | 行为 |
|---|---|
| 首次安装，无缓存且网络失败 | 表单可见；分类禁用；状态条"分类加载失败 · 重试"；保存禁用 |
| token 过期 + 自动续期开 | 表单先显示；后台续期；失败 → `auth-section` + toast |
| token 过期 + 自动续期关 | 直接 `auth-section` |
| 请求超时 | 8s（保存 10s）中断；toast；按钮恢复 |
| 用户快速改 URL | 在途查重结果按 seq 丢弃 |
| 后台续期写入 `authToken` | 只更新内存 settings，不重建表单、不覆盖用户输入 |
| 连到没有 `/api/ping` 的后端 | 静默降级为被动计时，不显示红色错误 |
| 弹出的表单已展示后再次触发 `init()` | 仅在 `serverUrl` 变化时重建；其余忽略 |
| 关闭弹窗前请求未完成 | 不处理，弹窗销毁即取消 |
| 状态条点击 | 展开/收起请求耗时面板；"重新测速"仅触发 ping |

## 10. 验证清单

自动化：
- `npm run build` 通过（确认主站未受影响）。
- `npx wrangler pages dev dist --port 8787` 后 `curl http://localhost:8787/api/ping` 返回 `{"ok":true,...}` 且无 token 也可访问。
- 打包脚本执行成功，两个 zip 均含最新 popup/styles。

手动（需登录态浏览器，用户接管）：
1. 首次安装无缓存：表单立即出现，分类禁用→自动恢复。
2. 有缓存打开：无明显加载态，状态条 1s 内出现延迟数值。
3. 断网打开：表单可见，状态条超时红，重试可恢复。
4. 缓存超过 7 天（改本地时间或伪造 `timestamp`）：仍显示旧数据并标注"数据较旧"。
5. token 过期 + 自动续期：打开不阻塞；popup 自身只发一次 `/api/login`（SW 的独立续期不计入）。
6. token 未过期（登录后 20 分钟）：仍判为有效，不触发续期。
7. 换服务器地址：旧缓存被识别并丢弃，分类不会串台。
8. 打开后立刻在标题框输入：后台续期/预取回填不会覆盖已输入内容。
9. URL 已存在：内联提示出现在 URL 下方，切换 URL 后消失，保存 409 时同样出现。
10. 保存成功：toast 出现且 300ms 内关窗。
11. AI 生成中/失败：toast 正常，不覆盖内联查重。
12. 后端无 `/api/ping`（临时删掉路由或指向旧实例）：状态条不报红，仅显示真实请求耗时。
13. Firefox 临时加载：上述 1–4 正常。

## 11. 风险

| 风险 | 缓解 |
|---|---|
| 提前 ping 与后台刷新叠加，请求数上升 | 300ms 空闲判定；有真实请求则不 ping |
| 表单先渲染但分类未就绪，用户误点保存 | 分类未加载时保存按钮禁用 |
| 内联警告与 409 提示文案不一致 | 共用 `setDuplicateHint()` |
| 续期单飞写错导致永久挂起 | `finally` 清空 promise |
| 状态条 sticky 导致小窗内容被压缩 | 状态条 24px；请求面板用绝对定位浮层 |
| 后台 SW 与 popup 同时续期（幂等，可接受） | 不引入跨上下文锁；验收只约束 popup 内部 |
| 旧缓存无 `serverUrl` 导致串台 | 仅接受一次，刷新成功后立即补写 `serverUrl` |
| token 判定改成 30 分钟后，过期边缘请求 401 | 沿用现有 401 处理：清 token、切 `auth-section`、toast |

## 12. 留给实施者

- 状态条展开面板的具体排版与动画。
- 计时环形缓冲的具体实现（数组/Map）。
- 加载骨架用文案还是骨架块（当前倾向文案）。
- 是否顺手抽取 `browser-extension/common.js` 承载 storage/请求封装（当前倾向不抽，保持单文件便于打包）。
