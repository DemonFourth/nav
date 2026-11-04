# 浏览器插件 Popup 性能与提示层级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让插件弹窗打开即渲染、请求有超时与延迟可视、状态提示不再被滚出视口，同时保持 URL 查重语义不变。

**Architecture:** 把可测试的纯逻辑（token 过期、缓存年龄、延迟分档）抽到 `browser-extension/shared.js`（classic script，挂到 `globalThis.BMExt`），供 popup / options / 两份 background 共用并用 `node --test` 覆盖；popup 改为"先渲染、后台刷新"的 stale-while-revalidate 状态机；新增极简 `/api/ping` 做主动测速；UI 拆成常驻连接条、操作 toast、URL 内联查重三层。

**Tech Stack:** 原生 JS / CSS、Chrome MV3 + Firefox MV2、Cloudflare Pages Functions、Node 24 内置 `node --test`（不新增依赖）。

**Spec:** `docs/superpowers/specs/2026-11-04-extension-popup-performance-design.md`

## Global Constraints

- 不引入任何新依赖；测试用 `node --test`。
- 缓存 key 固定 `prefetchCache`，字段固定 `{ categories, tags, timestamp, serverUrl }`（`timestamp` 不得改名）。
- 超时：普通请求 8000ms，保存请求 10000ms，ping 5000ms。
- 缓存年龄阈值：`< 60s` fresh，`60s ~ 7d` stale，`>= 7d` old，无时间戳 `none`。
- 延迟分档：`<=500ms` fast，`<=1500ms` medium，`>1500ms` slow，无值/超时 error。
- 保存成功先显示 toast，**约 1 秒**后关窗（保留用户反应时间，不缩短）。toast 自动消失 `3000ms`。
- 版本号：`manifest.json` 与 `manifest.firefox.json` 同步升到 `1.7.0`。
- 查重仍以 `GET /api/bookmarks?url=` 的 `exactUrl === true` 为准，不得改用缓存。
- `/api/bootstrap` 响应 `Cache-Control: no-store`；`tags` 只回传字符串数组，不得夹带书签对象。
- 所有新 UI 文案为简体中文，沿用现有风格。
- 不修改 `bookmarks` 创建逻辑、不改弹窗宽度、不修暗色模式。

## Review Focus

| 最可能出问题的输入/条件 | 用户合理预期 | 由哪个任务的验证钉住 |
|---|---|---|
| 打开弹窗后立刻在标题/URL 输入 | 已输入内容不被后台续期或预取回填覆盖 | Task 5 手动项 8 |
| 更换服务器地址后首次打开 | 不出现上一台服务器的分类，保存不会带旧 `category_id` | Task 5 手动项 7 |
| 后端尚未部署 `/api/ping` | 状态条不误报红色超时，只显示真实请求耗时 | Task 3 + Task 7 手动项 12 |
| token 在请求途中刚好过期（服务端 401） | 清 token、回到登录区、提示一次，不无限重试 | Task 5 手动项 5 |
| URL 已存在后又生成 AI 描述 | 内联查重警告不消失、不被 toast 覆盖 | Task 6 手动项 9/11 |
| 书签数量较多（>500 条）时打开弹窗 | 传输体积保持几十 KB 级，不卡在加载 | Task 9 Step 3 体积对比 + 手动项 14 |

---

### Task 1: 共享纯逻辑 `shared.js` + 单元测试

**Files:**
- Create: `browser-extension/shared.js`
- Create: `tests/extension-shared.test.js`
- Modify: `package.json`（新增 `"test:ext": "node --test tests/extension-shared.test.js"`）

**Interfaces:**
- Consumes: 无
- Produces（挂在 `globalThis.BMExt`）：
  - `SHORT_TTL: number`（1800000）、`LONG_TTL: number`（2592000000）、`RENEW_THRESHOLD: number`（300000）
  - `getTokenType(token: string): 'short' | 'long'`
  - `parseTokenExpiry(token: string): number | null`
  - `shouldRenewToken(tokenExpiry: number, now?: number): boolean`
  - `cacheState(timestamp: number, now?: number): 'none' | 'fresh' | 'stale' | 'old'`
  - `latencyLevel(ms: number | null | undefined): 'fast' | 'medium' | 'slow' | 'error'`
  - `formatLatency(ms: number | null | undefined): string`
  - `buildDuplicateHint(bookmark: { category_name?: string }): string`

- [ ] **Step 1: 写失败测试**

创建 `tests/extension-shared.test.js`：

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import '../browser-extension/shared.js'

const B = globalThis.BMExt
const MIN = 60 * 1000
const DAY = 24 * 60 * MIN

test('parseTokenExpiry honours short/long type', () => {
  assert.equal(B.parseTokenExpiry('1700000000000.short.abc'), 1700000000000 + 30 * MIN)
  assert.equal(B.parseTokenExpiry('1700000000000.long.abc'), 1700000000000 + 30 * DAY)
  assert.equal(B.parseTokenExpiry('1700000000000.abcdef'), 1700000000000 + 30 * MIN)
  assert.equal(B.parseTokenExpiry('not-a-token'), null)
})

test('shouldRenewToken only inside the threshold window', () => {
  const now = 1000000
  assert.equal(B.shouldRenewToken(now + 2 * MIN, now), true)
  assert.equal(B.shouldRenewToken(now + 10 * MIN, now), false)
  assert.equal(B.shouldRenewToken(now - MIN, now), false)
})

test('cacheState separates fresh / stale / old / none', () => {
  const now = Date.now()
  assert.equal(B.cacheState(now - 30 * 1000, now), 'fresh')
  assert.equal(B.cacheState(now - 5 * MIN, now), 'stale')
  assert.equal(B.cacheState(now - 8 * DAY, now), 'old')
  assert.equal(B.cacheState(0, now), 'none')
  assert.equal(B.cacheState(undefined, now), 'none')
})

test('latency level and formatting', () => {
  assert.equal(B.latencyLevel(120), 'fast')
  assert.equal(B.latencyLevel(900), 'medium')
  assert.equal(B.latencyLevel(2000), 'slow')
  assert.equal(B.latencyLevel(null), 'error')
  assert.equal(B.formatLatency(320), '320ms')
  assert.equal(B.formatLatency(2100), '2.1s')
  assert.equal(B.formatLatency(undefined), '超时')
})

test('duplicate hint falls back to 未分类', () => {
  assert.match(B.buildDuplicateHint({ category_name: '开发/前端' }), /已在「开发\/前端」保存过/)
  assert.match(B.buildDuplicateHint({}), /未分类/)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:ext`
Expected: FAIL，报 `Cannot find module .../browser-extension/shared.js` 或 `BMExt` 为 undefined。

- [ ] **Step 3: 实现 `browser-extension/shared.js`**

classic script，必须同时兼容浏览器页面、service worker 和 Node：

```js
(function (global) {
  const SHORT_TTL = 30 * 60 * 1000
  const LONG_TTL = 30 * 24 * 60 * 60 * 1000
  const RENEW_THRESHOLD = 5 * 60 * 1000
  const CACHE_FRESH_MS = 60 * 1000
  const CACHE_OLD_MS = 7 * 24 * 60 * 60 * 1000

  function getTokenType(token) {
    const parts = String(token || '').split('.')
    return parts.length === 3 && parts[1] === 'long' ? 'long' : 'short'
  }

  function parseTokenExpiry(token) {
    const issuedAt = Number(String(token || '').split('.')[0])
    if (!Number.isFinite(issuedAt) || issuedAt <= 0) return null
    return issuedAt + (getTokenType(token) === 'long' ? LONG_TTL : SHORT_TTL)
  }

  function shouldRenewToken(tokenExpiry, now = Date.now()) {
    if (!tokenExpiry) return false
    const remaining = tokenExpiry - now
    return remaining > 0 && remaining < RENEW_THRESHOLD
  }

  function cacheState(timestamp, now = Date.now()) {
    if (!timestamp || !Number.isFinite(Number(timestamp))) return 'none'
    const age = now - Number(timestamp)
    if (age < CACHE_FRESH_MS) return 'fresh'
    if (age < CACHE_OLD_MS) return 'stale'
    return 'old'
  }

  function latencyLevel(ms) {
    if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return 'error'
    if (ms <= 500) return 'fast'
    if (ms <= 1500) return 'medium'
    return 'slow'
  }

  function formatLatency(ms) {
    if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return '超时'
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
  }

  function buildDuplicateHint(bookmark) {
    const category = (bookmark && bookmark.category_name) || '未分类'
    return `⚠️ 已在「${category}」保存过`
  }

  global.BMExt = {
    SHORT_TTL, LONG_TTL, RENEW_THRESHOLD,
    getTokenType, parseTokenExpiry, shouldRenewToken,
    cacheState, latencyLevel, formatLatency, buildDuplicateHint
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:ext`
Expected: 5 个测试全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add browser-extension/shared.js tests/extension-shared.test.js package.json
git commit -m "feat(extension): add shared token/cache/latency helpers with tests"
```

---

### Task 2: 把 `shared.js` 接入各端与打包脚本

**Files:**
- Modify: `browser-extension/popup.html`（`popup.js` 之前）
- Modify: `browser-extension/options.html`（`options.js` 之前）
- Modify: `browser-extension/background.js:1`
- Modify: `browser-extension/manifest.firefox.json:32-33`
- Modify: `browser-extension/package.ps1`、`browser-extension/package.sh`、`package.json`（`ext:build:chromium` / `ext:build:firefox` 的 `cp` 列表）

**Interfaces:**
- Consumes: Task 1 的 `globalThis.BMExt`
- Produces: 四个运行环境都能访问 `BMExt`；两个 zip 都包含 `shared.js`

- [ ] **Step 1: 页面引入**

`popup.html` / `options.html` 中在原有脚本前加一行：

```html
<script src="shared.js"></script>
<script src="popup.js"></script>
```

- [ ] **Step 2: background 引入**

`background.js` 第一行：

```js
importScripts('shared.js')
```

`manifest.firefox.json` 的 `background` 改为：

```json
"background": {
  "scripts": ["shared.js", "background.js"]
}
```

- [ ] **Step 3: 打包脚本加入 `shared.js`**

三处文件列表都在 `popup.js` 同级追加 `shared.js`：

- `package.ps1`：Chromium 与 Firefox 两个 `Copy-Item` 行
- `package.sh`：两个 `cp ... popup.js ...` 行
- `package.json`：`ext:build:chromium` 与 `ext:build:firefox` 的 `cp popup.html popup.js ...` 行

- [ ] **Step 4: 验证打包包含该文件**

Run: `npm run ext:build:win`
Expected: 输出两个 zip；`Get-ChildItem browser-extension/dist/chromium` 与 `.../firefox` 中都出现 `shared.js`。

- [ ] **Step 5: 提交**

```bash
git add browser-extension/popup.html browser-extension/options.html browser-extension/background.js browser-extension/manifest.firefox.json browser-extension/package.ps1 browser-extension/package.sh package.json
git commit -m "chore(extension): load shared.js in popup, options, background and packages"
```

---

### Task 3: 新增 `/api/ping` 端点

**Files:**
- Create: `functions/api/ping.js`
- Modify: `functions/_middleware.js:50-57`（`PUBLIC_READ_PATHS`）

**Interfaces:**
- Consumes: 无
- Produces: `GET /api/ping` → `200 {"ok":true,"ts":number}`，`Cache-Control: no-store`，无需 token

- [ ] **Step 1: 实现端点**

```js
// functions/api/ping.js
export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  })
}
```

- [ ] **Step 2: 中间件放行**

`PUBLIC_READ_PATHS` 增加 `'/api/ping'`，使未带 `Authorization` 的 GET 不被 401。

- [ ] **Step 3: 本地验证无 token 可访问**

Run（两个终端）：

```bash
npm run build
npx wrangler pages dev dist --port 8787
curl -i http://localhost:8787/api/ping
```

Expected: `HTTP/1.1 200`，body 含 `"ok":true`，响应头含 `Cache-Control: no-store`；不发送任何 token。

- [ ] **Step 4: 提交**

```bash
git add functions/api/ping.js functions/_middleware.js
git commit -m "feat(api): add lightweight /api/ping for extension latency checks"
```

---

### Task 4: Popup 结构与样式（连接条 / toast / 内联查重）

**Files:**
- Modify: `browser-extension/popup.html`
- Modify: `browser-extension/styles.css`

**Interfaces:**
- Consumes: 无（纯静态）
- Produces（popup.js 依赖的 DOM id）：
  - `#connection-bar`、`#connection-main`、`#connection-dot`、`#connection-text`、`#connection-detail-btn`
  - `#connection-panel`（默认 `.hidden`）
  - `#toast`（默认 `.hidden`）
  - `#duplicate-hint`（位于 URL 输入框所在 `.form-group` 内、输入框之后，默认 `.hidden`）
  - 删除 `#status-message`

- [ ] **Step 1: 改 `popup.html`**

header 之后插入连接条与面板、toast；URL `.form-group` 末尾插入查重提示；删除表单末尾的 `<div id="status-message" ...>`。结构：

```html
<div id="connection-bar" class="connection-bar hidden">
  <button type="button" id="connection-main" class="connection-main">
    <span id="connection-dot" class="connection-dot"></span>
    <span id="connection-text">未连接</span>
  </button>
  <button type="button" id="connection-detail-btn" class="connection-detail-btn">详情</button>
</div>
<div id="connection-panel" class="connection-panel hidden"></div>
<div id="toast" class="toast hidden" role="status" aria-live="polite"></div>

<!-- URL form-group 内 -->
<input type="url" id="url" required placeholder="https://example.com">
<div id="duplicate-hint" class="duplicate-hint hidden"></div>
```

- [ ] **Step 2: 改 `styles.css`**

新增样式，要求：

- `.header { position: sticky; top: 0; z-index: 20; background: inherit; }`
- `.connection-bar { position: sticky; top: 44px; z-index: 19; display:flex; align-items:center; justify-content:space-between; height:24px; font-size:12px; }`
- `.connection-dot` 12px 圆点，`.is-fast / .is-medium / .is-slow / .is-error` 分别为 `#16a34a / #d97706 / #dc2626 / #94a3b8`
- `.connection-panel { position: absolute; top: 72px; left: 16px; right: 16px; z-index: 30; }` 白底/暗底、圆角、阴影，行高 24px
- `.toast { position: fixed; top: 52px; left: 16px; right: 16px; z-index: 40; padding: 10px 12px; border-radius: 8px; font-size: 13px; }` 配 `.toast-success/.toast-error/.toast-info`（复用现有 status 配色）
- `.duplicate-hint { font-size: 12px; line-height: 1.4; color: #b45309; }`，`body.dark` 下 `#fbbf24`；`a` 元素与文字同行
- 删除仅服务于 `#status-message` 的规则（`.status-message`、`.status-success/.status-error/.status-info` 若不再被 toast 复用则一并删除；若复用则改为 `.toast-*`）

- [ ] **Step 3: 静态检查**

Run: `Select-String -Path browser-extension/popup.html -Pattern 'connection-bar|connection-panel|toast|duplicate-hint|status-message'`
Expected: 前四个 id 各出现一次，`status-message` 无结果。

- [ ] **Step 4: 提交**

```bash
git add browser-extension/popup.html browser-extension/styles.css
git commit -m "feat(extension): add connection bar, toast and inline duplicate hint markup"
```

---

### Task 5: Popup 首屏状态机 + 请求层 + token 单飞

**Files:**
- Modify: `browser-extension/popup.js`（`loadSettings`、`init`、`loadCategories`、`loadTags`、`getTabInfo`、`parseTokenExpiry`、`ensureTokenValid`、storage 监听）

**Interfaces:**
- Consumes: `BMExt.parseTokenExpiry`、`BMExt.shouldRenewToken`、`BMExt.cacheState`
- Produces（后续任务依赖）：
  - `let appSettings = { serverUrl, authToken, tokenExpiry, autoRenew }`
  - `async function apiFetch(path: string, options?: { method?, body?, timeout?, label?, auth? }): Promise<Response>`
  - `function readCache(): { categories: any[], tags: string[], timestamp: number, serverUrl?: string } | null`
  - `async function writeCache(): Promise<void>`
  - `function markFormDirty(): void`
  - `let categoriesLoaded: boolean`、`let formDirty: boolean`
  - `let prefetchCacheRecord: { categories: any[], tags: string[], timestamp: number, serverUrl?: string } | null`、`let cacheTimestamp: number`

- [ ] **Step 1: 替换 token 相关函数**

删除 popup 内的 `TOKEN_TTL` / `parseTokenExpiry` / `shouldRenewToken`，改用 `BMExt.*`。`ensureTokenValid()` 改为单飞：

```js
let renewingPromise = null
async function ensureTokenValid() {
  if (!appSettings.authToken || !appSettings.tokenExpiry) return false
  const now = Date.now()
  const expired = now > appSettings.tokenExpiry
  if (!expired && !BMExt.shouldRenewToken(appSettings.tokenExpiry, now)) return true
  if (!appSettings.autoRenew) return false
  if (!renewingPromise) {
    renewingPromise = autoRenewToken().finally(() => { renewingPromise = null })
  }
  return renewingPromise
}
```

`loadSettings()` 只读取 `serverUrl/authToken/tokenExpiry/autoRenew` 到 `appSettings`，**不再调用** `autoRenewToken()`，也不删除过期 token。

- [ ] **Step 2: 增加 `apiFetch`**

```js
const requestTimings = []

function recordTiming(label, ms, ok) {
  requestTimings.push({ label, ms: Math.round(ms), ok, at: Date.now() })
  if (requestTimings.length > 20) requestTimings.shift()
}

async function apiFetch(path, options = {}) {
  const { method = 'GET', body = null, timeout = 8000, label = 'request', auth = true } = options
  if (auth) await ensureTokenValid()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const start = performance.now()
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (auth && appSettings.authToken) headers.Authorization = `Bearer ${appSettings.authToken}`
    const response = await fetch(`${appSettings.serverUrl}${path}`, {
      method, headers, signal: controller.signal,
      body: body === null ? undefined : JSON.stringify(body)
    })
    recordTiming(label, performance.now() - start, response.ok)
    if (response.status === 401 && auth) { await handleUnauthorized(); const err = new Error('Unauthorized'); err.kind = 'unauthorized'; throw err }
    return response
  } catch (error) {
    if (error.kind === 'unauthorized') throw error
    recordTiming(label, performance.now() - start, false)
    const err = new Error(error.name === 'AbortError' ? 'Request timeout' : 'Network error')
    err.kind = error.name === 'AbortError' ? 'timeout' : 'network'
    throw err
  } finally {
    clearTimeout(timer)
  }
}
```

`handleUnauthorized()`：清 `authToken`/`tokenExpiry`（storage + `appSettings`）、`showSection('auth-section')`、`showToast('登录已过期，请重新登录', 'error')`。

- [ ] **Step 3: 缓存读写**

```js
function readCache() {
  return prefetchCacheRecord // 由 loadPrefetchCache 填充并校验
}

async function writeCache() {
  const record = { categories, tags: allTags, timestamp: Date.now(), serverUrl: appSettings.serverUrl }
  if (chrome.storage.session) await chrome.storage.session.set({ prefetchCache: record })
  await storageSet('local', { prefetchCache: record })
  cacheTimestamp = record.timestamp
}
```

`loadPrefetchCache()` 改为：session 优先、local 兜底；`record.serverUrl` 存在且不等于 `appSettings.serverUrl` → 返回 `null` 并清除两端缓存；`record.serverUrl` 缺失 → 接受，`writeCache()` 成功后补写。

- [ ] **Step 4: 重写 `init()`**

顺序必须是：

1. `await loadSettings()`
2. 无 `serverUrl`/`authToken`，或 token 过期且 `autoRenew === false` → `showSection('auth-section')` 并 `return`
3. 读缓存 → 有则回填 `categories/allTags` 并 `showSection('form-section')`
4. 无缓存 → 仍 `showSection('form-section')`，但 `categoriesLoaded = false`，分类输入禁用、保存按钮禁用
5. 按缓存年龄决定是否后台刷新：`BMExt.cacheState(cacheTimestamp)` 为 `fresh` 时跳过分类/标签请求；否则不 await 地并行触发 `refreshCategories()`、`refreshTags()`、`getTabInfo()`、`schedulePingIfIdle()`（无缓存时四项全跑）。

`refreshCategories()` / `refreshTags()` 用 `apiFetch`，带模块级 `inFlight` 去重；成功后 `writeCache()` 并解除禁用；失败则 `renderConnection({ mode: 'error', label: '分类加载失败', retry: refreshCategories })`。

`getTabInfo()` 只在字段为空时填充，且 `formDirty === true` 时整体跳过。

- [ ] **Step 5: 改 storage 监听**

```js
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes.serverUrl) { init() ; return }
  if (changes.authToken && changes.authToken.newValue) {
    appSettings.authToken = changes.authToken.newValue
    appSettings.tokenExpiry = parseTokenExpiry(changes.authToken.newValue) || appSettings.tokenExpiry
  }
})
```

- [ ] **Step 6: 用户输入标记**

给 `title`、`url`、`description`、`category-input`、`tags-input`、`is-private` 绑定首次 `input`/`change` → `formDirty = true`。

- [ ] **Step 7: 语法检查 + 手动验证**

Run: `node --check browser-extension/popup.js`
Expected: 无输出（语法通过）。

手动（登录态，用户接管）：
1. 无缓存首次打开 → 表单立即出现，分类输入禁用并显示"正在加载分类…"，加载完成后恢复可编辑。
2. 有缓存打开 → 无整页加载态。
3. 打开后立即在标题框输入 → 内容不被覆盖。
4. 换服务器地址再打开 → 不显示旧服务器分类。
5. 手动把 `tokenExpiry` 改到过去、`autoRenew=true` → 表单仍显示，后台续期一次，不跳登录页。

- [ ] **Step 8: 提交**

```bash
git add browser-extension/popup.js
git commit -m "feat(extension): render popup immediately with stale-while-revalidate and single-flight renewal"
```

---

### Task 6: 内联查重 + toast + 保存 1 秒关窗

**Files:**
- Modify: `browser-extension/popup.js`（`showStatus`/`clearPersistentStatus`/`checkDuplicateUrl`/`saveBookmark`/`generateDescription`/`suggestCategory`）

**Interfaces:**
- Consumes: `apiFetch`、`BMExt.buildDuplicateHint`
- Produces：
  - `function showToast(message: string, type?: 'success' | 'error' | 'info'): void`（3000ms 自动隐藏）
  - `function setDuplicateHint(bookmark: { name?, url, category_name? } | null): void`

- [ ] **Step 1: 实现 toast**

`showToast` 写入 `#toast`，设置 `toast-${type}` 类，清除上一个定时器后 3000ms 加 `.hidden`。所有原 `showStatus(...)` 的临时消息改为 `showToast(...)`，并删除 `persistentStatusActive` / `statusHideTimer` / `clearPersistentStatus`。

- [ ] **Step 2: 实现内联查重**

```js
function setDuplicateHint(bookmark) {
  const hint = document.getElementById('duplicate-hint')
  if (!hint) return
  if (!bookmark) { hint.classList.add('hidden'); hint.textContent = ''; return }
  hint.textContent = ''
  const text = document.createElement('span')
  text.textContent = BMExt.buildDuplicateHint(bookmark) + ' · '
  const link = document.createElement('a')
  link.href = bookmark.url
  link.textContent = '打开'
  link.addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({ url: bookmark.url }); window.close() })
  hint.append(text, link)
  hint.classList.remove('hidden')
}
```

`checkDuplicateUrl()` 改用 `apiFetch(`/api/bookmarks?url=${encodeURIComponent(url)}`, { label: '查重' })`；仅在 `result.exactUrl === true` 时处理；命中 → `setDuplicateHint(existing)`，未命中/失败 → `setDuplicateHint(null)`。保留 `duplicateCheckSeq` 竞态保护；URL `input` 时 `seq++` 且 `setDuplicateHint(null)`。

- [ ] **Step 3: 改保存流程**

- 成功：`showToast('已保存', 'success')` → `chrome.runtime.sendMessage({ type: 'data-changed' })` → `setTimeout(() => window.close(), 1000)`。**保留原 1000ms 延时**：本次改的是"提示从底部挪到顶部、用户看得见"，不是缩短等待。
- 409：`setDuplicateHint(result.existingBookmark)` + 恢复按钮，不关窗。
- `err.kind === 'timeout'` → `showToast('连接超时，请重试', 'error')`；`network` → `showToast('网络错误，请检查服务器地址', 'error')`。
- 保存请求用 `apiFetch('/api/bookmarks', { method: 'POST', body: {...}, timeout: 10000, label: '保存' })`。

- [ ] **Step 4: AI 按钮改用 apiFetch**

`generateDescription()` / `suggestCategory()` 的 fetch 换成 `apiFetch(..., { method: 'POST', body, label: 'AI' })`；失败按 `err.kind` 显示 toast。`suggestCategory()` 中取 `#category` 的无效语句删除。

- [ ] **Step 5: 语法检查 + 手动验证**

Run: `node --check browser-extension/popup.js`
Expected: 无输出。

手动：
1. 打开一个已存在的 URL → URL 下方出现内联提示与「打开」。
2. 改 URL → 提示消失；blur 到另一个已存在 URL → 提示换成新的分类。
3. 提示存在时点「AI生成描述」→ 提示仍在，toast 不覆盖它。
4. 保存成功 → 顶部 toast 清晰可见，约 1 秒后关窗。
5. 保存返回 409 → 内联提示出现、按钮恢复、不关窗。
6. 断网保存 → toast「网络错误」，已填内容保留。

- [ ] **Step 6: 提交**

```bash
git add browser-extension/popup.js
git commit -m "feat(extension): inline duplicate hint, toast messages and 1s close"
```

---

### Task 7: 延迟采集、连接条渲染与 ping

**Files:**
- Modify: `browser-extension/popup.js`

**Interfaces:**
- Consumes: `requestTimings`、`recordTiming`（Task 5）、`BMExt.latencyLevel` / `formatLatency`
- Produces：
  - `async function pingServer(): Promise<number | null>`
  - `function renderConnection(state: { mode: 'offline'|'loading'|'ok'|'error'|'unsupported', ms?: number, stale?: boolean, label?: string, retry?: Function }): void`
  - `function schedulePingIfIdle(): void`
  - `function toggleConnectionPanel(): void`

- [ ] **Step 1: 实现 `pingServer`**

```js
let pingSupported = true

async function pingServer() {
  if (!pingSupported || !appSettings.serverUrl) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  const start = performance.now()
  try {
    const response = await fetch(`${appSettings.serverUrl}/api/ping`, { signal: controller.signal, cache: 'no-store' })
    if (response.status === 404 || response.status === 405) { pingSupported = false; return null }
    if (!response.ok) return null
    return performance.now() - start
  } catch { return null } finally { clearTimeout(timer) }
}
```

- [ ] **Step 2: 实现 `renderConnection`**

- 无 `serverUrl` → `mode: 'offline'`，文本「未连接」，灰点；
- `loading` → 「加载分类…」；
- `ok` → `formatLatency(ms)`，点颜色用 `latencyLevel(ms)` 映射 `is-fast/is-medium/is-slow`；
- `error` → 「超时」或 `label`，`is-error`，且若提供 `retry` 则 `#connection-main` 点击执行重试；
- `stale: true` → 文本追加 ` · 数据较旧`；
- `pingSupported === false` → 不显示 ping 数字，显示最近一次真实请求的 `label + formatLatency`。

`#connection-detail-btn` 切换 `#connection-panel`。面板内容由 `requestTimings` 最后 5 条生成，每行 `label + 耗时`，附「重新测速」按钮（`pingSupported === false` 时隐藏）。点击面板外关闭（复用现有 document click 模式）。

- [ ] **Step 3: 实现 `schedulePingIfIdle`**

```js
function schedulePingIfIdle() {
  setTimeout(async () => {
    const recent = requestTimings.some(t => Date.now() - t.at < 300)
    if (recent) { renderConnectionFromTimings(); return }
    const ms = await pingServer()
    if (ms === null) renderConnectionFromTimings()
    else renderConnection({ mode: 'ok', ms })
  }, 300)
}
```

`renderConnectionFromTimings()`：取最后一条 timing，`mode: 'ok'` 或 `error`，`stale` 由 `BMExt.cacheState(cacheTimestamp) === 'old'` 决定。

- [ ] **Step 4: 接入刷新与保存**

`refreshCategories()` / `refreshTags()` 成功后调用 `renderConnectionFromTimings()`；`init()` 显示表单后调用 `schedulePingIfIdle()`。

- [ ] **Step 5: 语法检查 + 手动验证**

Run: `node --check browser-extension/popup.js`
Expected: 无输出。

手动：
1. 正常打开 → 300ms 内状态条出现「● xxxms」，颜色随耗时变化。
2. 点「详情」→ 面板列出「分类/查重/ping」耗时；点外部关闭。
3. 断网 → 状态条「● 超时」红色；恢复网络后点状态条 → 数字恢复。
4. 临时把 `serverUrl` 指向没有 ping 的实例（或本地删掉路由）→ 不出现红色超时，显示真实请求耗时。
5. 缓存 `timestamp` 改到 8 天前 → 状态条追加「· 数据较旧」。

- [ ] **Step 6: 提交**

```bash
git add browser-extension/popup.js
git commit -m "feat(extension): connection latency bar with ping and request timings"
```

---

### Task 8: background 缓存字段、options token 语义、版本号

**Files:**
- Modify: `browser-extension/background.js`（预取写入 `serverUrl`；token 用 `BMExt`）
- Modify: `browser-extension/background.firefox.js`（同上）
- Modify: `browser-extension/options.js`（token 用 `BMExt`）
- Modify: `browser-extension/manifest.json`、`browser-extension/manifest.firefox.json`（`1.7.0`）

**Interfaces:**
- Consumes: `BMExt.parseTokenExpiry`、`BMExt.shouldRenewToken`（Task 2 已加载）
- Produces: `prefetchCache` 记录带 `serverUrl`；全项目 token TTL 与服务端一致

- [ ] **Step 1: 两份 background 的预取缓存**

在 `prefetchBookmarkData()` 的 `cacheData` 中增加 `serverUrl`（该函数开头已解构出 `serverUrl`）：

```js
const cacheData = {
  categories: processedCategories,
  tags: Array.from(tagSet).sort(),
  timestamp: Date.now(),
  serverUrl
}
```

- [ ] **Step 2: 删除重复 token 实现**

两份 background、`options.js` 中删除本地 `TOKEN_TTL` / `parseTokenExpiry` / `shouldRenewToken`，改用 `BMExt.parseTokenExpiry` / `BMExt.shouldRenewToken`。

- [ ] **Step 3: 版本号**

两个 manifest 的 `"version"` 改为 `"1.7.0"`。

- [ ] **Step 4: 验证**

Run:
```
npm run test:ext
node --check browser-extension/background.js
node --check browser-extension/background.firefox.js
node --check browser-extension/options.js
Select-String -Path browser-extension/manifest*.json -Pattern '"version": "1.7.0"'
```
Expected: 测试通过；`node --check` 无输出；版本号两条命中。

- [ ] **Step 5: 提交**

```bash
git add browser-extension/background.js browser-extension/background.firefox.js browser-extension/options.js browser-extension/manifest.json browser-extension/manifest.firefox.json
git commit -m "chore(extension): share serverUrl cache field, align token TTL and bump 1.7.0"
```

---

### Task 9: 启动聚合接口 `/api/bootstrap`（消除全量书签传输）

**Files:**
- Create: `functions/api/bootstrap.js`
- Modify: `functions/_middleware.js`（`PUBLIC_READ_PATHS`）
- Modify: `browser-extension/popup.js`（新增 `refreshBootstrap` / `applyBootstrap`，保留旧路径作为回退）
- Modify: `browser-extension/background.js`、`browser-extension/background.firefox.js`（预取优先用 bootstrap，404 回退旧逻辑）

**Interfaces:**
- Produces: `GET /api/bootstrap` → `200 { categories: Array<{ id, name, parent_id, depth, position, is_private, path }>, tags: string[], generatedAt: number }`
- Produces（popup）：`async function refreshBootstrap(): Promise<boolean>`、`function applyBootstrap(payload): void`、`function refreshLegacyData(): Promise<boolean>`
- Consumes: `apiFetch`、`writeCache`、`categoriesLoaded`、`renderConnectionFromTimings`（Task 5/7）

- [ ] **Step 1: 实现端点**

```js
// functions/api/bootstrap.js
export async function onRequestGet(context) {
  const { env } = context
  const json = (data) => new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  })

  try {
    const isAuthenticated = context.data?.auth?.verified === true
    const publicModeSetting = await env.DB.prepare('SELECT value FROM settings WHERE key = ?')
      .bind('publicMode').first()
    const publicMode = publicModeSetting?.value !== 'false'

    if (!publicMode && !isAuthenticated) {
      return json({ categories: [], tags: [], generatedAt: Date.now() })
    }

    const categorySql = 'SELECT * FROM categories'
      + (isAuthenticated ? '' : ' WHERE is_private = 0')
      + ' ORDER BY depth, position'
    const tagSql = "SELECT tags FROM bookmarks WHERE tags IS NOT NULL AND tags != ''"
      + (isAuthenticated ? '' : ' AND is_private = 0')

    const [categoryRows, tagRows] = await Promise.all([
      env.DB.prepare(categorySql).all(),
      env.DB.prepare(tagSql).all()
    ])

    const rawCategories = categoryRows.results || []
    const map = new Map(rawCategories.map(cat => [cat.id, cat]))

    const categories = rawCategories.map(cat => {
      const segments = []
      const visited = new Set()
      let current = map.get(cat.id)
      while (current) {
        if (visited.has(current.id)) break
        visited.add(current.id)
        segments.unshift(current.name || '未命名')
        if (!current.parent_id) break
        current = map.get(current.parent_id)
      }
      return { ...cat, path: segments.join(' / ') }
    })

    const tagSet = new Set()
    for (const row of tagRows.results || []) {
      String(row.tags || '').split(',').forEach(tag => {
        const trimmed = tag.trim()
        if (trimmed) tagSet.add(trimmed)
      })
    }
    const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'zh-CN'))

    return json({ categories, tags, generatedAt: Date.now() })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to load bootstrap data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

- [ ] **Step 2: 中间件放行**

`PUBLIC_READ_PATHS` 增加 `'/api/bootstrap'`（与 `'/api/categories'` 并列）。

- [ ] **Step 3: 本地验证**

```bash
node --check functions/api/bootstrap.js
npm run build
npx wrangler pages dev dist --port 8787
curl -s http://localhost:8787/api/bootstrap
curl -s http://localhost:8787/api/bookmarks | wc -c
```

Expected：bootstrap 返回含 `categories`、`tags`、`generatedAt`；其字节数明显小于 `/api/bookmarks` 全量响应；不带 token 返回 200。

- [ ] **Step 4: popup 接入**

```js
async function refreshLegacyData() {
  const [categoriesOk] = await Promise.all([refreshCategories(), refreshTags()])
  return categoriesOk
}

async function refreshBootstrap() {
  if (inFlight.bootstrap) return inFlight.bootstrap
  inFlight.bootstrap = (async () => {
    try {
      const response = await apiFetch('/api/bootstrap', { label: '分类标签' })
      if (response.status === 404 || response.status === 405) return refreshLegacyData()
      const payload = await response.json()
      applyBootstrap(payload)
      return true
    } catch (error) {
      renderConnection({ mode: 'error', label: '加载失败', retry: refreshBootstrap })
      return false
    } finally {
      inFlight.bootstrap = null
    }
  })()
  return inFlight.bootstrap
}

function applyBootstrap(payload) {
  categories = sortCategories(payload.categories || [])
  allTags = payload.tags || []
  categoriesLoaded = true
  setCategoryLoading(false)
  writeCache()
  renderConnectionFromTimings()
}
```

Task 5 的 `init()` 第 5 步中，把"并行触发 `refreshCategories()`、`refreshTags()`"改为触发 `refreshBootstrap()`（其余仍并行）。

- [ ] **Step 5: background 预取接入**

两份 background 的 `prefetchBookmarkData()` 改为：先 `fetch(`${serverUrl}/api/bootstrap`, { headers })`；`response.ok` 时直接用 `{ categories, tags, timestamp: Date.now(), serverUrl }` 写入缓存；否则（404/405/异常）执行原有"categories + bookmarks"两请求逻辑，赋值给同一 `cacheData`。

- [ ] **Step 6: 验证回退**

临时把 `functions/api/bootstrap.js` 改名，重启 `wrangler pages dev`，打开弹窗。
Expected：分类与标签仍能加载（走回退两请求），状态条出现「分类/标签」两条耗时记录；恢复文件名后重启，恢复为单请求。

- [ ] **Step 7: 提交**

```bash
git add functions/api/bootstrap.js functions/_middleware.js browser-extension/popup.js browser-extension/background.js browser-extension/background.firefox.js
git commit -m "feat(extension): add /api/bootstrap to replace full bookmark download"
```

---

### Task 10: 构建、打包与整体验收

**Files:**
- 无源码改动（只验证；若发现缺陷回到对应任务修）

**Interfaces:**
- Consumes: 全部前置任务
- Produces: 可安装的 `dist/bookmark-manager-chromium.zip` 与 `dist/bookmark-manager-firefox.zip`

- [ ] **Step 1: 主站构建不受影响**

Run: `npm run build`
Expected: 构建成功，无新增 warning/error。

- [ ] **Step 2: 打包**

Run: `npm run ext:build:win`
Expected: 两个 zip 生成；`dist/chromium` 与 `dist/firefox` 都包含 `shared.js`、最新 `popup.html/js`、`styles.css`、版本 1.7.0 的 manifest。

- [ ] **Step 3: 执行设计文档 §10 手动清单**

按 `docs/superpowers/specs/2026-11-04-extension-popup-performance-design.md` §10 的第 1–15 项逐条验证，重点：打开即渲染、内联查重不消失、ping 缺失不报红、换服务器不串台、保存后提示可见且约 1 秒关窗、bootstrap 缺失可回退。

- [ ] **Step 4: 全分支审查**

Run: `git diff --stat HEAD~10..HEAD`
Expected: 改动仅限 spec 列出的 12 个文件；无调试日志、无临时文件、无 `console.log` 残留（`console.error` 允许）。

- [ ] **Step 5: 提交（若有验证期间的修补）**

```bash
git add -A browser-extension functions package.json tests docs
git commit -m "test(extension): verify popup performance and status UI changes"
```

---

## 自检记录

- 覆盖：spec §7.1→Task 5，§7.2→Task 5，§7.3→Task 5，§7.4/7.4.1→Task 1/5/8，§7.5→Task 3/7，§7.6→Task 4/6，§7.7→Task 6，§7.8→Task 6，**§7.9 bootstrap→Task 9**，§7.10→已提交 spec + Task 8，§8 文件清单全部落在 Task 1–9，§13 KV 明确不做。
- 接口一致性：`apiFetch`、`showToast`、`setDuplicateHint`、`renderConnection`、`pingServer`、`refreshBootstrap`、`applyBootstrap` 在创建任务与使用任务中签名一致。
- 无测试基础设施风险：只新增 `node --test`（Node 24 内置），未引入依赖。
- 免费额度：仅新增 1 个只读端点，D1 行读与 `/api/bookmarks` 全量方案相同或更低，传输体积大幅下降；不新增 KV 写入。
