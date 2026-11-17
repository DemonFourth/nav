# 书签可访问性检测（Link Health）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在书签卡片上显示该链接是否可访问，帮助清理死书签，全部检测由用户浏览器发起、零 Cloudflare 请求。

**Architecture:** 网页通过 `window.postMessage` 与扩展的 content script 通信，content script 转给 background，background 用宿主权限直接请求目标站点并读取真实状态码，结果回传网页后写入 localStorage，卡片只渲染缓存。

**Tech Stack:** Vue 3 `<script setup>`、原生 postMessage、Chrome MV3 service worker / Firefox MV2 background page、`node --test`

**Spec:** `C:\Users\28050050\AppData\Local\Temp\opencode\2026-11-17-link-health-design.md`

## Global Constraints

- 不新增任何扩展权限；`manifest.json` 已有 `host_permissions: ["*://*/*"]`
- 检测请求零 CF 请求：不得调用 `/api/*`
- 检测请求必须带 `credentials: 'omit'` 与 `referrerPolicy: 'no-referrer'`
- 单批 URL 上限 40，并发上限 5，单条超时 8000ms
- 只有 HTTP 404 / 410 判为 `dead`；其余一律 `unsure`
- 结果只存 `localStorage`，不写 D1
- 颜色只能用主题变量：`var(--success)` / `var(--error)` / `var(--text-tertiary)`，不得硬编码色值
- `background.js` 与 `background.firefox.js` 必须同步改（后者用 `browser.*` / Promise 风格）
- 新增共享脚本必须同时在 `package.ps1` 与 `package.sh` 白名单里；本次不改文件名，但改动后必须逐个核对
- 中文文案，逗号用「，」，状态文案固定为「可访问 / 已失效 / 待确认」

## Review Focus

| 会咬人的情况 | 期望行为 | 归属任务 |
|---|---|---|
| 没装扩展 | 卡片不显示圆点，设置入口显示「需安装扩展」，绝不发起检测 | Task 7 |
| 目标站 403 / 522 / 超时 | 显示「待确认」，不能出现在「已失效」筛选里 | Task 1、Task 7 |
| `http://` 老书签 | 请求失败时标「待确认」，不得标「已失效」 | Task 1、Task 2 |
| 快速反复切换菜单 | 5 分钟内同一 URL 不重复检测，界面不堆积请求 | Task 4 |
| MV3 service worker 被回收 | 10s 无回包→提示扩展无响应，缓存不被清空 | Task 4 |

---

### Task 1: 状态判定纯函数 + 单测

**Files:**
- Modify: `browser-extension/shared.js`
- Test: `tests/extension-shared.test.js`

**Interfaces:**
- Produces:
  - `BMExt.LINK_STATES = { OK: 'ok', DEAD: 'dead', UNSURE: 'unsure' }`
  - `BMExt.classifyLinkResult({ status?: number|null, error?: string|null, timedOut?: boolean, durationMs?: number })` → `{ state: 'ok'|'dead'|'unsure', reason: string }`

- [ ] **Step 1: 写失败测试**

在 `tests/extension-shared.test.js` 末尾追加：

```js
test('classifyLinkResult only marks 404/410 as dead', () => {
  const c = B.classifyLinkResult
  assert.deepEqual(c({ status: 200 }), { state: 'ok', reason: '' })
  assert.deepEqual(c({ status: 204 }), { state: 'ok', reason: '' })
  assert.deepEqual(c({ status: 301 }), { state: 'ok', reason: '' })
  assert.equal(c({ status: 404 }).state, 'dead')
  assert.equal(c({ status: 410 }).state, 'dead')
  assert.equal(c({ status: 404 }).reason, 'HTTP 404')
})

test('classifyLinkResult never marks protected or failing sites as dead', () => {
  const c = B.classifyLinkResult
  for (const status of [400, 401, 403, 405, 429, 451, 500, 502, 522, 523, 530]) {
    assert.equal(c({ status }).state, 'unsure', `status ${status}`)
  }
})

test('classifyLinkResult buckets network failures as unsure', () => {
  const c = B.classifyLinkResult
  assert.deepEqual(c({ error: 'Failed to fetch', durationMs: 120 }), { state: 'unsure', reason: '域名或连接失败' })
  assert.deepEqual(c({ error: 'Failed to fetch', durationMs: 9000 }), { state: 'unsure', reason: '请求失败' })
  assert.deepEqual(c({ timedOut: true }), { state: 'unsure', reason: '超时' })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm run test:ext`
Expected: FAIL，`B.classifyLinkResult is not a function`

- [ ] **Step 3: 在 `shared.js` 实现**

在 `buildDuplicateHint` 之后加：

```js
  const LINK_STATES = { OK: 'ok', DEAD: 'dead', UNSURE: 'unsure' }
  const DEAD_STATUSES = [404, 410]
  const DEAD_FAST_FAIL_MS = 3000

  function classifyLinkResult(input) {
    const { status, error, timedOut, durationMs } = input || {}
    if (timedOut) return { state: LINK_STATES.UNSURE, reason: '超时' }
    if (typeof status === 'number' && status > 0) {
      if (status >= 200 && status < 400) return { state: LINK_STATES.OK, reason: '' }
      if (DEAD_STATUSES.includes(status)) return { state: LINK_STATES.DEAD, reason: `HTTP ${status}` }
      if (status >= 400 && status < 500) return { state: LINK_STATES.UNSURE, reason: `HTTP ${status} · 需要登录或有防护` }
      if (status >= 500) return { state: LINK_STATES.UNSURE, reason: `HTTP ${status} · 源站不可达` }
      return { state: LINK_STATES.UNSURE, reason: `HTTP ${status}` }
    }
    if (error) {
      const fast = typeof durationMs === 'number' && durationMs < DEAD_FAST_FAIL_MS
      return { state: LINK_STATES.UNSURE, reason: fast ? '域名或连接失败' : '请求失败' }
    }
    return { state: LINK_STATES.UNSURE, reason: '未取得结果' }
  }
```

并在 `global.BMExt = {...}` 里加上 `LINK_STATES, classifyLinkResult`。

- [ ] **Step 4: 跑测试确认通过**

Run: `npm run test:ext`
Expected: PASS，全部用例通过

- [ ] **Step 5: 提交**

```bash
git add browser-extension/shared.js tests/extension-shared.test.js
git commit -m "feat(ext): add link health status classification"
```

---

### Task 2: 扩展后台批量检测

**Files:**
- Modify: `browser-extension/background.js`（在 `chrome.runtime.onMessage.addListener` 内新增分支）
- Modify: `browser-extension/background.firefox.js`（同等逻辑，`browser.*` / Promise 风格）

**Interfaces:**
- Consumes: `BMExt.classifyLinkResult`
- Produces: 消息 `{ type: 'link-health-check', urls: string[] }` → `{ results: Array<{ url: string, state: string, status: number|null, reason: string }> }`
- Produces: `checkLinks(urls)`（Chromium 版内部函数）

- [ ] **Step 1: 实现检测函数（Chromium）**

在 `background.js` 的 `prefetchBookmarkData` 之后加：

```js
const LINK_HEALTH_CONCURRENCY = 5
const LINK_HEALTH_TIMEOUT = 8000
const LINK_HEALTH_MAX_URLS = 40

function normalizeCheckUrl(raw) {
  try {
    const u = new URL(String(raw || ''))
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : ''
  } catch {
    return ''
  }
}

async function probeOne(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LINK_HEALTH_TIMEOUT)
  const started = Date.now()
  let status = null
  let error = null
  let timedOut = false
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal
    })
    status = response.status
    // 只读状态码，丢掉正文，避免白下载整页
    if (response.body) {
      try { await response.body.cancel() } catch {}
    }
  } catch (e) {
    if (e && e.name === 'AbortError') timedOut = true
    else error = e && e.message ? e.message : String(e)
  } finally {
    clearTimeout(timer)
  }
  const verdict = BMExt.classifyLinkResult({
    status,
    error,
    timedOut,
    durationMs: Date.now() - started
  })
  return { url, state: verdict.state, status, reason: verdict.reason }
}

async function checkLinks(rawUrls) {
  const urls = Array.from(new Set((rawUrls || []).map(normalizeCheckUrl).filter(Boolean)))
    .slice(0, LINK_HEALTH_MAX_URLS)
  const results = []
  let cursor = 0
  const worker = async () => {
    while (cursor < urls.length) {
      const current = urls[cursor++]
      results.push(await probeOne(current))
    }
  }
  await Promise.all(Array.from({ length: Math.min(LINK_HEALTH_CONCURRENCY, urls.length) }, worker))
  return results
}
```

在 `chrome.runtime.onMessage.addListener` 里、`data-changed` 分支之后加：

```js
  if (request.type === 'link-health-check') {
    checkLinks(request.urls)
      .then(results => sendResponse({ results }))
      .catch(error => sendResponse({ results: [], error: String(error) }))
    return true
  }
```

- [ ] **Step 2: 同步实现 Firefox 版**

`background.firefox.js` 的 `onMessage` 是 Promise 风格，加：

```js
  if (request.type === 'link-health-check') {
    return checkLinks(request.urls)
      .then(results => ({ results }))
      .catch(error => ({ results: [], error: String(error) }))
  }
```

并把 `probeOne` / `checkLinks` / `normalizeCheckUrl` 与常量原样复制过去（该文件不 import `shared.js`，`BMExt` 由 `manifest.firefox.json` 的 `background.scripts: ["shared.js", "background.js"]` 先行加载）。

- [ ] **Step 3: 静态核对**

Run: `node -e "new Function(require('fs').readFileSync('browser-extension/background.js','utf8')); console.log('syntax ok')"`
Expected: 输出 `syntax ok`
Run: `node -e "new Function(require('fs').readFileSync('browser-extension/background.firefox.js','utf8')); console.log('syntax ok')"`
Expected: 输出 `syntax ok`

- [ ] **Step 4: 提交**

```bash
git add browser-extension/background.js browser-extension/background.firefox.js
git commit -m "feat(ext): probe bookmark URLs from background"
```

---

### Task 3: content script 桥接与扩展存在标记

**Files:**
- Modify: `browser-extension/content.js`

**Interfaces:**
- Consumes: background 消息 `link-health-check`
- Produces:
  - 页面可读标记 `document.documentElement.dataset.bmExt = <version>`
  - `window.postMessage` 协议：请求 `{ source: 'bm-link-health', reqId: string, urls: string[] }`，应答 `{ source: 'bm-link-health-reply', reqId: string, results: Array, error?: string }`

- [ ] **Step 1: 实现桥接**

在 `content.js` 顶部加标记，末尾加监听：

```js
// 标记扩展已注入，页面据此判断是否显示检测入口
try {
  document.documentElement.dataset.bmExt = chrome.runtime.getManifest().version
} catch (e) {
  // ignore
}
```

```js
const LINK_HEALTH_MAX_URLS = 40

function isValidCheckUrl(raw) {
  try {
    const u = new URL(String(raw || ''))
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (event.origin !== location.origin) return
  const data = event.data
  if (!data || data.source !== 'bm-link-health' || typeof data.reqId !== 'string') return

  const urls = Array.isArray(data.urls) ? data.urls.filter(isValidCheckUrl).slice(0, LINK_HEALTH_MAX_URLS) : []
  if (urls.length === 0) {
    window.postMessage({ source: 'bm-link-health-reply', reqId: data.reqId, results: [] }, location.origin)
    return
  }

  chrome.runtime.sendMessage({ type: 'link-health-check', urls }, (reply) => {
    const payload = reply && Array.isArray(reply.results) ? reply.results : []
    window.postMessage(
      { source: 'bm-link-health-reply', reqId: data.reqId, results: payload, error: reply && reply.error },
      location.origin
    )
  })
})
```

- [ ] **Step 2: 静态核对**

Run: `node -e "new Function(require('fs').readFileSync('browser-extension/content.js','utf8')); console.log('syntax ok')"`
Expected: 输出 `syntax ok`

- [ ] **Step 3: 提交**

```bash
git add browser-extension/content.js
git commit -m "feat(ext): bridge page requests to background link check"
```

---

### Task 4: 网页端纯逻辑 + 缓存 composable

**Files:**
- Create: `src/utils/linkHealth.js`
- Create: `src/composables/useLinkHealth.js`
- Modify: `package.json`（新增 `test:links` 脚本）
- Test: `tests/link-health.test.js`

**Interfaces:**
- Produces（`src/utils/linkHealth.js`）:
  - `LINK_HEALTH_TTL`(24h)、`LINK_HEALTH_MAX_AGE`(30d)、`LINK_HEALTH_MAX_ENTRIES`(2000)、`LINK_HEALTH_BATCH_SIZE`(40)
  - `isEntryFresh(entry, now?, ttl?)` → boolean
  - `selectUrlsToCheck(bookmarks, cache, now?, force?)` → `string[]`
  - `chunkUrls(urls, size?)` → `string[][]`
  - `pruneEntries(entries, now?)` → object
  - `linkStateMeta(state)` → `{ label: string, color: string }`
  - `formatCheckedAt(at, now?)` → string
- Produces（`useLinkHealth()`）:
  - `{ hasExtension, checksEnabled, setEnabled(v), stateOf(url), reasonOf(url), checkedAtOf(url), stats, checkBookmarks(list, { force? }), lastError }`
  - `stats` 形状：`{ ok: number, dead: number, unsure: number, lastCheckedAt: number }`
  - `hasExtension` 是唯一的「扩展可用」判据，不要再导出一个 `extensionReady`

- [ ] **Step 1: 写失败测试**

新建 `tests/link-health.test.js`：

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LINK_HEALTH_TTL,
  isEntryFresh,
  selectUrlsToCheck,
  chunkUrls,
  pruneEntries,
  linkStateMeta,
  formatCheckedAt
} from '../src/utils/linkHealth.js'

const DAY = 24 * 60 * 60 * 1000

test('isEntryFresh respects ttl and missing entries', () => {
  const now = 1_000_000_000_000
  assert.equal(isEntryFresh(null, now), false)
  assert.equal(isEntryFresh({ at: now - 1000 }, now), true)
  assert.equal(isEntryFresh({ at: now - LINK_HEALTH_TTL - 1 }, now), false)
})

test('selectUrlsToCheck skips fresh entries and dedupes', () => {
  const now = 1_000_000_000_000
  const bookmarks = [
    { url: 'https://a.com' },
    { url: 'https://a.com' },
    { url: 'https://b.com' },
    { url: '' },
    { url: 'ftp://c.com' }
  ]
  const cache = { 'https://a.com': { state: 'ok', at: now - 1000 } }
  assert.deepEqual(selectUrlsToCheck(bookmarks, cache, now), ['https://b.com'])
  assert.deepEqual(selectUrlsToCheck(bookmarks, cache, now, true), ['https://a.com', 'https://b.com'])
})

test('chunkUrls never exceeds batch size', () => {
  const urls = Array.from({ length: 95 }, (_, i) => `https://x${i}.com`)
  const chunks = chunkUrls(urls)
  assert.equal(chunks.length, 3)
  assert.equal(chunks[0].length, 40)
  assert.equal(chunks[2].length, 15)
})

test('pruneEntries drops expired and caps count', () => {
  const now = 1_000_000_000_000
  const entries = {
    old: { state: 'ok', at: now - 31 * DAY },
    fresh: { state: 'ok', at: now - DAY }
  }
  assert.deepEqual(Object.keys(pruneEntries(entries, now)), ['fresh'])

  const many = {}
  for (let i = 0; i < 2100; i++) many[`u${i}`] = { state: 'ok', at: now - i }
  assert.equal(Object.keys(pruneEntries(many, now)).length, 2000)
})

test('linkStateMeta returns themed colors only', () => {
  assert.deepEqual(linkStateMeta('ok'), { label: '可访问', color: 'var(--success)' })
  assert.deepEqual(linkStateMeta('dead'), { label: '已失效', color: 'var(--error)' })
  assert.deepEqual(linkStateMeta('unsure'), { label: '待确认', color: 'var(--text-tertiary)' })
  assert.deepEqual(linkStateMeta(undefined), { label: '', color: 'transparent' })
})

test('formatCheckedAt stays short', () => {
  const now = 1_000_000_000_000
  assert.equal(formatCheckedAt(0, now), '')
  assert.equal(formatCheckedAt(now - 30_000, now), '刚刚')
  assert.equal(formatCheckedAt(now - 3 * 60 * 60 * 1000, now), '3 小时前')
  assert.equal(formatCheckedAt(now - 2 * DAY, now), '2 天前')
})
```

并在 `package.json` 的 scripts 里加：

```json
"test:links": "node --test tests/link-health.test.js"
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm run test:links`
Expected: FAIL，`Cannot find module '../src/utils/linkHealth.js'`

- [ ] **Step 3: 实现 `src/utils/linkHealth.js`**

纯函数、无 Vue 依赖，导出上述常量和函数。要点：
- `selectUrlsToCheck` 只接受 `http:`/`https:`，用 `new URL()` 校验，去重后按原顺序返回
- `isEntryFresh` 在 `entry`、`entry.at` 缺失时返回 `false`
- `pruneEntries` 先丢弃超过 `LINK_HEALTH_MAX_AGE` 的，再按 `at` 降序保留前 `LINK_HEALTH_MAX_ENTRIES`
- `linkStateMeta` 未知状态返回 `{ label: '', color: 'transparent' }`

- [ ] **Step 4: 跑测试确认通过**

Run: `npm run test:links`
Expected: PASS，6 个用例全过

- [ ] **Step 5: 实现 `src/composables/useLinkHealth.js`**

模块级单例，`reactive` 缓存 + localStorage 持久化（key `linkHealthCache`），要点：

- `hasExtension`：挂载后轮询 `document.documentElement.dataset.bmExt`，最多 15 次、每次 100ms；读到即置 `true` 并停止
- `checksEnabled`：`localStorage.getItem('linkHealthEnabled') !== 'false'`，`setEnabled` 写回
- `stateOf(url)` / `reasonOf(url)` / `checkedAtOf(url)` 读缓存
- `stats`：`{ dead: number, unsure: number, ok: number, lastCheckedAt: number }`（基于整个缓存）
- `checkBookmarks(list, { force = false } = {})`：
  1. `!checksEnabled || !hasExtension` 直接返回
  2. `selectUrlsToCheck(list, cache, now, force)`
  3. 过滤 5 分钟内已请求过的 URL（模块级 `inflightAt = new Map()`）
  4. `chunkUrls` 分片，逐个 `postMessage` 并等回包，单批 10s 超时（`setTimeout` + `reqId` 匹配）
  5. 超时时置 `lastError = '扩展无响应'`，**不清空已有缓存**
  6. 合并结果写缓存：`{ state, reason, status, at: Date.now() }`，`pruneEntries` 后持久化
- 页面卸载/切后台不需要特殊处理，`postMessage` 超时自然兜底

- [ ] **Step 6: 构建验证**

Run: `npm run build`
Expected: 构建成功，无 `is not defined` 报错

- [ ] **Step 7: 提交**

```bash
git add src/utils/linkHealth.js src/composables/useLinkHealth.js tests/link-health.test.js package.json
git commit -m "feat(nav): add link health cache and bridge composable"
```

---

### Task 5: 卡片圆点与 tooltip 合并

**Files:**
- Modify: `src/components/NavCard.vue`

**Interfaces:**
- Consumes: `useLinkHealth()` 的 `stateOf` / `reasonOf` / `checkedAtOf`；`linkStateMeta` / `formatCheckedAt`

- [ ] **Step 1: 模板加圆点**

把 URL 行改成：

```html
<div class="nav-card-url">
  <span
    v-if="linkMeta.label"
    class="link-health-dot"
    :style="{ background: linkMeta.color }"
    aria-hidden="true"
  ></span>
  <span class="nav-card-url-text">{{ bookmark.url }}</span>
</div>
```

- [ ] **Step 2: 脚本接线**

在 `<script setup>` 中（`getIconUrl` 引入之后）加：

```js
import { useLinkHealth } from '../composables/useLinkHealth'
import { linkStateMeta, formatCheckedAt } from '../utils/linkHealth'

const { stateOf, reasonOf, checkedAtOf } = useLinkHealth()

const linkMeta = computed(() => linkStateMeta(stateOf(props.bookmark.url)))
```

并把 `hoverTitle` 末尾加上：

```js
  if (linkMeta.value.label) {
    const when = formatCheckedAt(checkedAtOf(props.bookmark.url))
    parts.push(`状态：${linkMeta.value.label}${reasonText.value ? ' · ' + reasonText.value : ''}${when ? ' · 检测于 ' + when : ''}`)
  }
```

其中 `reasonText = computed(() => reasonOf(props.bookmark.url) || '')`。

并把 tooltip 的显示条件改为：

```js
const shouldShowTitle = computed(() => isTitleTruncated.value || isDescTruncated.value || !!linkMeta.value.label)
```

注意：模板里 `v-tooltip="shouldShowTitle ? hoverTitle : ''"` 保持不变。

- [ ] **Step 3: 样式**

```css
.nav-card-url {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nav-card-url-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link-health-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}
```

未检测时 `v-if` 不渲染圆点，但 `.nav-card-url` 的 `gap` 在只有单个子元素时不产生间距 —— 为保持占位，改为在圆点位置渲染一个同尺寸的透明占位：

```html
<span v-if="linkMeta.label" class="link-health-dot" :style="{ background: linkMeta.color }" aria-hidden="true"></span>
<span v-else class="link-health-dot link-health-dot-empty" aria-hidden="true"></span>
```

```css
.link-health-dot-empty { background: transparent; }
```

- [ ] **Step 4: 构建验证**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 5: 提交**

```bash
git add src/components/NavCard.vue
git commit -m "feat(nav): show link health dot on bookmark cards"
```

---

### Task 6: 列表变化时触发检测

**Files:**
- Modify: `src/views/NavItemView.vue`

**Interfaces:**
- Consumes: `useLinkHealth().checkBookmarks`
- Produces: 无新导出

- [ ] **Step 1: 接线**

在 `NavItemView.vue` 的 `useAuth()` 引入之后加：

```js
import { useLinkHealth } from '../composables/useLinkHealth'
```

```js
const { checkBookmarks: checkLinkHealth } = useLinkHealth()
```

在 `currentBookmarks` 定义之后加：

```js
// 列表变化（根分类/子菜单/标签筛选/搜索）后补检缺失或过期的链接
watch(
  currentBookmarks,
  (list) => {
    if (!list || list.length === 0) return
    checkLinkHealth(list)
  },
  { immediate: true }
)
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 3: 提交**

```bash
git add src/views/NavItemView.vue
git commit -m "feat(nav): trigger link health check on list change"
```

---

### Task 7: 设置页统计、筛选与未装扩展提示

**Files:**
- Modify: `src/components/NavSettingsModal.vue`（安装说明弹窗用已有的 `BaseDialog`，不新增组件）

**Interfaces:**
- Consumes: `useLinkHealth()` 的 `stats`、`hasExtension`、`checksEnabled`、`setEnabled`、`checkBookmarks`
- Produces: 无新导出

- [ ] **Step 1: 书签 tab 增加统计行**

在 `.bookmark-toolbar.elevated` **之前**插入：

```html
<div class="link-health-bar">
  <span class="link-health-stat" v-if="hasExtension">
    <span class="link-health-dot" style="background: var(--error)"></span>
    {{ linkHealthStats.dead }} 个已失效
    <span class="link-health-sep">·</span>
    <span class="link-health-dot" style="background: var(--text-tertiary)"></span>
    {{ linkHealthStats.unsure }} 个待确认
    <span class="link-health-sep">·</span>
    <span class="link-health-when">{{ linkHealthStats.lastCheckedAt ? formatCheckedAt(linkHealthStats.lastCheckedAt) + '检测' : '尚未检测' }}</span>
  </span>
  <button v-else class="btn-secondary-sm" @click="showLinkHealthInstall = true">
    死链检测 · 需安装扩展
  </button>
  <div class="link-health-actions" v-if="hasExtension">
    <button
      v-for="opt in linkHealthFilters"
      :key="opt.value"
      class="link-health-chip"
      :class="{ active: linkHealthFilter === opt.value }"
      @click="linkHealthFilter = opt.value"
    >{{ opt.label }}</button>
    <button class="btn-secondary-sm" @click="recheckVisible">重新检测</button>
  </div>
</div>
```

- [ ] **Step 2: 未装扩展说明弹窗**

在书签 tab 面板末尾加：

```html
<BaseDialog :show="showLinkHealthInstall" title="需要安装浏览器扩展" max-width="440px" @close="showLinkHealthInstall = false">
  <p class="link-health-install-text">
    死链检测要在你的浏览器里读取目标网站的真实状态码，网页本身受跨域限制做不到。
    安装本项目的浏览器扩展后即可使用，检测请求直接从你的浏览器发出，不经过云端。
  </p>
  <ol class="link-health-install-steps">
    <li>Chrome/Edge：打开 <code>chrome://extensions</code> → 开发者模式 → 加载 <code>browser-extension/</code></li>
    <li>Firefox：<code>about:debugging</code> → 临时载入 <code>manifest.firefox.json</code></li>
    <li>装好后刷新本页，入口会自动变成可用的统计行</li>
  </ol>
  <template #footer>
    <button class="btn-primary-sm" @click="showLinkHealthInstall = false">知道了</button>
  </template>
</BaseDialog>
```

- [ ] **Step 3: 脚本接线**

```js
import { useLinkHealth } from '../composables/useLinkHealth'
import { formatCheckedAt } from '../utils/linkHealth'

// BaseDialog 已在模板中使用；确认文件顶部已有它的 import，有则不要重复引入
const {
  hasExtension,
  checksEnabled,
  setEnabled,
  stateOf,
  stats: linkHealthStats,
  checkBookmarks: checkLinkHealth
} = useLinkHealth()

const showLinkHealthInstall = ref(false)
const linkHealthFilter = ref('all')
const linkHealthFilters = [
  { value: 'all', label: '全部' },
  { value: 'dead', label: '已失效' },
  { value: 'unsure', label: '待确认' }
]

const recheckVisible = () => {
  checkLinkHealth(filteredBookmarks.value, { force: true })
}
```

在 `filteredBookmarks` 的计算链末端追加筛选（先按现有分类/搜索过滤，再按状态过滤）：

```js
const linkHealthFilteredBookmarks = computed(() => {
  if (linkHealthFilter.value === 'all') return filteredBookmarks.value
  return filteredBookmarks.value.filter(bm => stateOf(bm.url) === linkHealthFilter.value)
})
```

并把 `groupedBookmarks` 的数据源从 `filteredBookmarks.value` 换成 `linkHealthFilteredBookmarks.value`。

- [ ] **Step 4: 外观面板加总开关**

在 `activeTab === 'appearance'` 面板的开关列表中，按现有 `.toggle-switch` 结构加一项「书签死链检测」，绑定 `:checked="checksEnabled"` / `@change="setEnabled($event.target.checked)"`，说明文字：`关闭后不自动检测，也不显示卡片圆点`。

- [ ] **Step 5: 样式**

```css
.link-health-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}

.link-health-stat { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); }
.link-health-sep { color: var(--text-tertiary); }
.link-health-when { color: var(--text-tertiary); }
.link-health-actions { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.link-health-chip { padding: 3px 10px; border-radius: 9999px; border: 1px solid var(--border); background: transparent; color: var(--text-secondary); font-size: 12px; cursor: pointer; }
.link-health-chip.active { background: color-mix(in srgb, var(--primary) 14%, transparent); border-color: color-mix(in srgb, var(--primary) 40%, transparent); color: var(--primary); }
.link-health-install-text { font-size: 13px; line-height: 1.6; color: var(--text-secondary); }
.link-health-install-steps { margin-top: 10px; padding-left: 18px; font-size: 12px; line-height: 1.8; color: var(--text-secondary); }
```

- [ ] **Step 6: 构建验证**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 7: 提交**

```bash
git add src/components/NavSettingsModal.vue
git commit -m "feat(nav): add link health stats, filter and install hint in settings"
```

---

### Task 8: 版本号、打包与端到端验收

**Files:**
- Modify: `browser-extension/manifest.json`（`version` → `1.8.0`）
- Modify: `browser-extension/manifest.firefox.json`（`version` → `1.8.0`）
- 核对：`browser-extension/package.ps1`、`browser-extension/package.sh`

- [ ] **Step 1: 升版本**

两个 manifest 的 `"version": "1.7.2"` 改为 `"1.8.0"`。

- [ ] **Step 2: 核对打包白名单**

Run: `Select-String -Path browser-extension/package.ps1,browser-extension/package.sh -Pattern "shared.js","content.js","background"`
Expected: 两个脚本都列出 `shared.js`、`content.js`、`background.js`（Firefox 脚本里是 `background.firefox.js` → 目标名 `background.js`），本次没有新增文件名，白名单无需改动

- [ ] **Step 3: 打包**

Run: `npm run ext:build:win`
Expected: 生成 `browser-extension/dist/bookmark-manager-chromium.zip` 与 `browser-extension/dist/bookmark-manager-firefox.zip`

- [ ] **Step 4: 跑全部单测与构建**

Run: `npm run test:ext`
Expected: PASS
Run: `npm run test:links`
Expected: PASS
Run: `npm run build`
Expected: 构建成功

- [ ] **Step 5: 手工验收（需用户接管登录与装扩展）**

- 装扩展并刷新页面 → 卡片 URL 行出现圆点，正常站为绿
- 找一个已删除的 `*.pages.dev` 书签 → 应为灰色「待确认」（DNS 失败无法区分 404）
- 找一个已删除的自定义域名书签 → 应为红色「已失效」（若返回 404）
- 断网 → 全部变灰「待确认」，且不出现红色
- 卸载扩展并刷新 → 圆点消失，设置里显示「死链检测 · 需安装扩展」
- 反复切换菜单 10 次 → 网络面板中目标站请求数不随切换次数线性增长

- [ ] **Step 6: 提交**

```bash
git add browser-extension/manifest.json browser-extension/manifest.firefox.json
git commit -m "chore(ext): bump version to 1.8.0 for link health"
```
