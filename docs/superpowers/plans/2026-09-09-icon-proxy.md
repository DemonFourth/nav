# 自建 HTMLRewriter 图标代理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增一个自建图标代理端点（`/api/icon-proxy`），用 Cloudflare 原生 HTMLRewriter 解析目标网站真实 favicon，并作为第 6 个图标源接入现有图标回退链

**Architecture:** 新建 Pages Function 端点复用 `fetch-metadata.js` 的"服务端抓取"先例；前端仅需在 `defaultIconSources` 加一条源 + 让 `parseIconSourceUrl` 支持 `{url}` 占位符 + 老用户 localStorage 合并逻辑。图标加载失败时自动回退到现有三方源，不影响现有行为。

**Tech Stack:** Cloudflare Pages Functions, HTMLRewriter, Vue 3 Composition API, `caches.default`

## Global Constraints

- 代理端点必须加入 `_middleware.js` 的 GET 白名单（未登录访客可加载图标）
- 代理端点只接受 `http:` / `https:` scheme，防止 SSRF
- 代理响应只允许 image content-type
- 新图标源默认 `enabled: false`，用户手动开启，不改变现有默认行为
- 图标源 ID 用固定字符串 `'6'`（现有源用 `'1'`~`'5'`）
- 验证方式：`npm run build` 成功 + 手动浏览器测试（项目无测试框架）
- 修改文件前必须获得用户批准

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `functions/api/icon-proxy.js` | 新增 | GET 端点，HTMLRewriter 解析 favicon，caches.default 缓存 |
| `functions/_middleware.js` | 修改 | GET 白名单加入 `/api/icon-proxy` |
| `src/composables/useSettings.js` | 修改 | `parseIconSourceUrl` 支持 `{url}`；`defaultIconSources` 加新源；localStorage 合并逻辑 |

---

## Task 1: 创建 icon-proxy 端点

**Files:**
- Create: `functions/api/icon-proxy.js`

**Interfaces:**
- Produces: `onRequestGet(context)` — GET `/api/icon-proxy?url=<bookmarkUrl>` 返回图片响应（Content-Type: image/*，Cache-Control: public, max-age=86400）

- [ ] **Step 1: 创建端点文件**

```js
// GET /api/icon-proxy?url=<目标网站完整URL>
const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
}

async function fetchFavicon(targetUrl) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(targetUrl, {
      headers: REQUEST_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) throw new Error('Site unreachable')

    let iconUrl = null

    const rewriter = new HTMLRewriter()
      .on('link[rel="apple-touch-icon"]', {
        element(e) {
          if (!iconUrl) {
            const href = e.getAttribute('href')
            if (href) iconUrl = href
          }
        },
      })
      .on('link[rel~="icon"]', {
        element(e) {
          if (!iconUrl) {
            const href = e.getAttribute('href')
            if (href) iconUrl = href
          }
        },
      })

    await rewriter.transform(response).text()

    let finalUrl
    if (iconUrl) {
      finalUrl = new URL(iconUrl, targetUrl).toString()
    } else {
      finalUrl = new URL('/favicon.ico', targetUrl).toString()
    }

    const iconResponse = await fetch(finalUrl, { headers: REQUEST_HEADERS })

    if (iconResponse.ok && iconResponse.headers.get('content-type')?.includes('image')) {
      return iconResponse
    }
  } catch (e) {
    // 任何错误返回 null，前端会回退到其他图标源
  }
  return null
}

export async function onRequestGet(context) {
  const { request, waitUntil } = context
  const url = new URL(request.url)
  const targetUrl = url.searchParams.get('url')

  if (!targetUrl) {
    return new Response('Missing URL', { status: 400 })
  }

  // 仅允许 http/https，防止 SSRF
  let parsed
  try {
    parsed = new URL(targetUrl)
  } catch {
    return new Response('Invalid URL', { status: 400 })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return new Response('Invalid scheme', { status: 400 })
  }

  // 尝试读缓存
  const cache = caches.default
  const cacheKey = new Request(url.toString(), request)
  const cached = await cache.match(cacheKey)
  if (cached) return cached

  const iconResponse = await fetchFavicon(targetUrl)
  if (!iconResponse) {
    return new Response('Icon not found', { status: 404 })
  }

  const response = new Response(iconResponse.body, {
    headers: {
      'Content-Type': iconResponse.headers.get('Content-Type') || 'image/x-icon',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })

  waitUntil(cache.put(cacheKey, response.clone()))
  return response
}
```

- [ ] **Step 2: 验证文件语法**

运行: `npm run build`
Expected: 构建成功（Pages Functions 会随构建打包校验）

- [ ] **Step 3: 提交**

```bash
git add functions/api/icon-proxy.js
git commit -m "feat: add HTMLRewriter icon proxy endpoint"
```

---

## Task 2: 加入 middleware GET 白名单

**Files:**
- Modify: `functions/_middleware.js:82-89`

**Interfaces:**
- Consumes: `functions/api/icon-proxy.js` 的 `onRequestGet`
- Produces: 未登录 GET `/api/icon-proxy?url=...` 返回 200 而非 401

- [ ] **Step 1: 在 GET 白名单数组中添加路径**

在 `functions/_middleware.js` 的 `url.pathname === '/api/fetch-metadata'` 行后新增：

```js
       url.pathname === '/api/icon-proxy' ||
```

修改后该条件块应为：

```js
  if (request.method === 'GET' && 
      (url.pathname === '/api/bookmarks' || 
       url.pathname === '/api/categories' ||
       url.pathname === '/api/fetch-metadata' ||
       url.pathname === '/api/icon-proxy' ||
       url.pathname === '/api/settings' ||
       url.pathname === '/api/ai/status')) {
    return await next();
  }
```

- [ ] **Step 2: 验证语法**

运行: `npm run build`
Expected: 构建成功

- [ ] **Step 3: 提交**

```bash
git add functions/_middleware.js
git commit -m "feat: allow unauthenticated GET on /api/icon-proxy"
```

---

## Task 3: 前端接入 — {url} 占位符 + 新图标源 + localStorage 合并

**Files:**
- Modify: `src/composables/useSettings.js:53-61`（defaultIconSources 与 iconSources 初始化）
- Modify: `src/composables/useSettings.js:334-350`（parseIconSourceUrl）

**Interfaces:**
- Consumes: `useSettings.js` 现有的 `iconSources`、`parseIconSourceUrl`
- Produces:
  - `parseIconSourceUrl(sourceUrl, bookmarkUrl, useLarger)` 现在额外替换 `{url}` → `encodeURIComponent(url.href)`
  - `defaultIconSources` 新增 `{ id: '6', name: '自建代理', url: '/api/icon-proxy?url={url}', enabled: false, useLarger: false }`
  - `iconSources` 初始化时对已存 localStorage 数据做默认源合并

- [ ] **Step 1: 修改 defaultIconSources，添加自建代理源**

```js
// 图标源配置
const defaultIconSources = [
  { id: '1', name: 'Favicon.im', url: 'https://favicon.im/{domain}', enabled: true, useLarger: false },
  { id: '2', name: 'Icon Horse', url: 'https://icon.horse/icon/{domain}', enabled: true, useLarger: false },
  { id: '3', name: 'Favicon Extractor', url: 'https://www.faviconextractor.com/favicon/{domain}', enabled: true, useLarger: false },
  { id: '4', name: 'DuckDuckGo', url: 'https://icons.duckduckgo.com/ip3/{domain}.ico', enabled: false, useLarger: false },
  { id: '5', name: '网站自身 favicon', url: '{origin}/favicon.ico', enabled: true, useLarger: false },
  { id: '6', name: '自建代理', url: '/api/icon-proxy?url={url}', enabled: false, useLarger: false },
]
```

- [ ] **Step 2: 修改 iconSources 初始化逻辑，合并默认源**

将 `useSettings.js:61`：

```js
const iconSources = ref(JSON.parse(localStorage.getItem('iconSources') || 'null') || [...defaultIconSources])
```

改为：

```js
// 合并默认源：老用户 localStorage 已存在时，补充缺失的默认源（如自建代理）
function mergeIconSources(stored) {
  if (!Array.isArray(stored) || stored.length === 0) return [...defaultIconSources]
  const merged = [...stored]
  for (const def of defaultIconSources) {
    if (!merged.some(s => s.id === def.id || s.url === def.url)) {
      merged.push({ ...def })
    }
  }
  return merged
}

const iconSources = ref(mergeIconSources(JSON.parse(localStorage.getItem('iconSources') || 'null')))
```

- [ ] **Step 3: 修改 parseIconSourceUrl 支持 {url} 占位符**

将 `useSettings.js:335-350` 的 `parseIconSourceUrl` 函数改为：

```js
  // 解析图标源 URL，替换占位符
  const parseIconSourceUrl = (sourceUrl, bookmarkUrl, useLarger = false) => {
    try {
      const url = new URL(bookmarkUrl)
      const domain = url.hostname
      const origin = url.origin
      let result = sourceUrl
        .replace('{domain}', domain)
        .replace('{origin}', origin)
        .replace('{url}', encodeURIComponent(url.href))
      if (useLarger) {
        result += result.includes('?') ? '&larger=true' : '?larger=true'
      }
      return result
    } catch {
      return ''
    }
  }
```

- [ ] **Step 4: 验证构建**

运行: `npm run build`
Expected: 构建成功

- [ ] **Step 5: 手动验证**

1. 运行 `npm run dev`，打开 http://localhost:3000
2. 导航站模式（`displayMode === 'nav-item'`）或默认模式均可
3. 打开设置 → 图标源，确认"自建代理"源出现且默认关闭
4. 开启"自建代理"，观察卡片图标加载；关闭其他源，确认代理源能单独提供图标
5. 清除 localStorage（`localStorage.removeItem('iconSources')`），刷新确认新源出现在默认列表

> 注：本地 dev 模式下 Pages Functions 通过 vite 插件提供，`caches.default` 在开发环境可用；如代理源在本地失败，属预期（本地服务器抓取受限），生产部署后验证为准。

- [ ] **Step 6: 提交**

```bash
git add src/composables/useSettings.js
git commit -m "feat: integrate self-hosted icon proxy as icon source"
```

---

## Task 4: 最终验证

- [ ] **Step 1: 完整构建**

运行: `npm run build`
Expected: 构建成功，无报错

- [ ] **Step 2: 部署后生产验证**

1. `npm run deploy` 部署到 Cloudflare Pages
2. 浏览器访问生产域名，未登录状态下导航页图标正常加载（验证 middleware 白名单生效，无 401）
3. 设置中开启"自建代理"图标源，验证它能解析真实 favicon（对比 favicon.im 命中率）
4. 打开控制台 Network，确认 `/api/icon-proxy` 响应带 `Cache-Control: public, max-age=86400`，第二次访问命中 304/缓存

- [ ] **Step 3: 提交（如验证中有修复）**

```bash
git add -A
git commit -m "fix: resolve issues found in icon-proxy production verification"
```
