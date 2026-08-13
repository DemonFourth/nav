# API 安全加固实施方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为公开 API 端点添加 KV 速率限制，防止批量爬取和 AI 额度滥用，同时隐藏 AI 配置敏感信息。

**Architecture:** 复用现有 `RATE_LIMIT_STORAGE` KV namespace（`functions/api/login.js` 已在使用）。在 `_middleware.js` 中增加一个速率限制检查阶段，在认证之前拦截请求。每个端点有独立的限速规则（窗口时长、次数上限），通过中间件的全局 KV 辅助函数统一处理。

**Tech Stack:** Cloudflare Workers KV (`RATE_LIMIT_STORAGE`)，现有 `wrangler.toml` 已绑定 `RATE_LIMIT_STORAGE`。

## Global Constraints

- 书签公开是设计需求，公开端点不加认证，仅加速率限制
- CORS 保持 `*`，不改动（为浏览器扩展需要）
- KV 变量名必须为 `RATE_LIMIT_STORAGE`（已配置）
- **所有请求统一限速**（包括已认证用户），防止泄露 token 被恶意脚本批量调用
- AI 相关端点的限速必须更严格（保护 AI 额度）
- 限速返回 HTTP 429 + `Retry-After` header
- 速率限制辅助函数放在 `_middleware.js` 中，不新建文件
- 每个限速规则有独立 KV key 前缀，互不干扰

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `functions/_middleware.js` | 修改 | 新增 `checkRateLimit()` 辅助函数 + 在各公开端点调用 |
| `functions/api/ai/status.js` | 修改 | 移除 `baseUrl` 和 `model` 字段 |
| `wrangler.toml` | 无改动 | KV namespace 已配置 |

---

## 限速规则表

| 端点 | 窗口 | 次数 | KV key 格式 | 说明 |
|------|------|------|-------------|------|
| `GET /api/bookmarks` | 1 分钟 | 30 次 | `rl_bookmarks:{ip}` | 防批量爬取全部书签 |
| `GET /api/bookmarks/search` | 1 分钟 | 30 次 | `rl_bookmarks_search:{ip}` | 防搜索爬取 |
| `GET /api/categories` | 5 分钟 | 60 次 | `rl_categories:{ip}` | 防分类结构爬取 |
| `GET /api/settings` | 5 分钟 | 60 次 | `rl_settings:{ip}` | 防设置信息爬取 |
| `GET /api/fetch-metadata` | 1 分钟 | 30 次 | `rl_fetch_metadata:{ip}` | 防 metadata 爬取 |
| `GET /api/ai/status` | 5 分钟 | 60 次 | `rl_ai_status:{ip}` | 防配置信息爬取 |
| `POST /api/ai/proxy` | 1 分钟 | 2 次 | `rl_ai_proxy:{ip}` | 防 AI 额度消耗（通用代理最严格） |
| `POST /api/ai/generate-description` | 1 分钟 | 10 次 | `rl_ai_gen:{ip}` | 防 AI 描述生成滥用 |
| `POST /api/ai/suggest-category` | 1 分钟 | 10 次 | `rl_ai_suggest:{ip}` | 防 AI 分类推荐滥用 |
| `POST /api/ai/batch-generate-descriptions` | 1 分钟 | 3 次 | `rl_ai_batch_gen:{ip}` | 防批量 AI 生成 |
| `POST /api/ai/batch-classify` | 1 分钟 | 3 次 | `rl_ai_batch_class:{ip}` | 防批量 AI 分类 |

---

## 实施前提检查

在开始实施前确认：

1. `wrangler.toml` 中 `RATE_LIMIT_STORAGE` KV 绑定已存在（当前项目已有，可跳过）
2. `functions/api/login.js` 的限速代码作为参考模式

---

### Task 1: 在 _middleware.js 中添加速率限制辅助函数

**Files:**
- Modify: `functions/_middleware.js`

**Interfaces:**
- Produces: `checkRateLimit()` 辅助函数，在后续 Task 2 中被调用
- 参数: `{ env, request, path, limit, windowMs, kvNamespaceKey }`
- 返回: `Response` (429) 或 `null` (通过)

- [ ] **Step 1: 编写辅助函数 checkRateLimit**

在 `functions/_middleware.js` 的 `validateToken()` 函数下方（`onRequest` 之前）添加以下函数：

```javascript
async function checkRateLimit(context, { limit, windowMs, kvNamespaceKey }) {
  const { env, request } = context
  const url = new URL(request.url)

  if (!env.RATE_LIMIT_STORAGE) {
    return null
  }

  // 仅信任 CF-Connecting-IP（客户端控制的 X-Forwarded-For 已被移除）
  const clientIp = request.headers.get('CF-Connecting-IP') || '127.0.0.1'

  const rateLimitKey = `rl_${kvNamespaceKey}_${clientIp}`
  const now = Date.now()

  try {
    const rateLimitValue = await env.RATE_LIMIT_STORAGE.get(rateLimitKey)
    let recentAttempts = []

    if (rateLimitValue) {
      recentAttempts = JSON.parse(rateLimitValue).filter(t => now - t < windowMs)
    }

    if (recentAttempts.length >= limit) {
      const oldestAttempt = recentAttempts[0]
      // 防止 retryAfter 为 0 或负值（RFC 7231）
      const retryAfter = Math.max(1, Math.ceil((oldestAttempt + windowMs - now) / 1000))
      return new Response(JSON.stringify({
        success: false,
        error: '请求过于频繁，请稍后再试'
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter)
        }
      })
    }

    recentAttempts.push(now)
    // 截断到 limit + 10，防止高 QPS 下 KV 条目超过 25KB 上限
    recentAttempts = recentAttempts.slice(0, limit + 10)
    await env.RATE_LIMIT_STORAGE.put(rateLimitKey, JSON.stringify(recentAttempts), {
      expirationTtl: Math.ceil(windowMs / 1000)
    })

    return null
  } catch (error) {
    if (error.name === 'SyntaxError') {
      // KV 数据损坏：清理旧 key 并放行
      await env.RATE_LIMIT_STORAGE.delete(rateLimitKey).catch(() => {})
      return null
    }
    console.error(`[rate-limit] ${url.pathname} for ${clientIp}:`, error.message)
    return null
  }
}
```

- [ ] **Step 2: 导出 checkRateLimit（不导出，仅供 onRequest 使用）**

不需要导出，该函数在同一个文件内 `onRequest` 中直接调用。

- [ ] **Step 3: 确认 checkRateLimit 在 onRequest 之前定义**

`checkRateLimit` 必须位于 `async function validateToken()` 之后、`export async function onRequest()` 之前。

- [ ] **Step 4: 构建验证**

```bash
npm run build
```

期望：构建成功，无语法错误。

- [ ] **Step 5: 提交**

```bash
git add functions/_middleware.js
git commit -m "feat: add rate limit helper in middleware"
```

---

### Task 2: 在 _middleware.js 的 onRequest 中调用速率限制

**Files:**
- Modify: `functions/_middleware.js`（同 Task 1 的文件）

**Interfaces:**
- Consumes: `checkRateLimit()` 辅助函数（Task 1 产出）
- 在认证检查之前执行限速检查

- [ ] **Step 1: 在 onRequest 中定义端点限速映射**

在 `onRequest` 函数内、CORS 头定义之后、`if (url.pathname === '/api/login')` 之前，添加限速规则映射：

```javascript
// 端点限速规则（所有请求统一限速，包括已认证用户）
const RATE_LIMIT_RULES = {
  'GET /api/bookmarks': { limit: 30, windowMs: 60 * 1000, kvNamespaceKey: 'bookmarks' },
  'GET /api/bookmarks/search': { limit: 30, windowMs: 60 * 1000, kvNamespaceKey: 'bookmarks_search' },
  'GET /api/categories': { limit: 60, windowMs: 300 * 1000, kvNamespaceKey: 'categories' },
  'GET /api/settings': { limit: 60, windowMs: 300 * 1000, kvNamespaceKey: 'settings' },
  'GET /api/fetch-metadata': { limit: 30, windowMs: 60 * 1000, kvNamespaceKey: 'fetch_metadata' },
  'GET /api/ai/status': { limit: 60, windowMs: 300 * 1000, kvNamespaceKey: 'ai_status' },
  'POST /api/ai/proxy': { limit: 2, windowMs: 60 * 1000, kvNamespaceKey: 'ai_proxy' },
  'POST /api/ai/generate-description': { limit: 10, windowMs: 60 * 1000, kvNamespaceKey: 'ai_gen' },
  'POST /api/ai/suggest-category': { limit: 10, windowMs: 60 * 1000, kvNamespaceKey: 'ai_suggest' },
  'POST /api/ai/batch-generate-descriptions': { limit: 3, windowMs: 60 * 1000, kvNamespaceKey: 'ai_batch_gen' },
  'POST /api/ai/batch-classify': { limit: 3, windowMs: 60 * 1000, kvNamespaceKey: 'ai_batch_class' },
}
```

- [ ] **Step 2: 在认证检查之前插入限速调用**

在 `onRequest` 中，找到以下这段代码之后：

```javascript
  // 登录接口不需要验证
  if (url.pathname === '/api/login') {
    return await next()
  }
```

在这段代码**之后**添加：

```javascript
  // 速率限制检查
  // 精确匹配优先，其次按最后一个 / 向上回退匹配（如 /api/bookmarks/123 → /api/bookmarks）
  let rateLimitRule = RATE_LIMIT_RULES[`${request.method} ${url.pathname}`]

  if (!rateLimitRule) {
    const lastSlashIdx = url.pathname.lastIndexOf('/')
    if (lastSlashIdx > 0) {
      const shorterPath = url.pathname.slice(0, lastSlashIdx)
      rateLimitRule = RATE_LIMIT_RULES[`${request.method} ${shorterPath}`]
    }
  }

  if (rateLimitRule) {
    const rateLimitResponse = await checkRateLimit(context, rateLimitRule)
    if (rateLimitResponse) {
      return rateLimitResponse
    }
  }
```

**匹配逻辑说明**：
- `GET /api/bookmarks/search` → 精确匹配 `GET /api/bookmarks/search`
- `GET /api/bookmarks/123` → 回退到 `/api/bookmarks` → 匹配 `GET /api/bookmarks`
- `POST /api/ai/proxy` → 精确匹配 `POST /api/ai/proxy`
- `GET /api/bookmarks-extra` → 回退到 `/api` → 无匹配（不会误伤 bookmarks-extra）
- `GET /api/other-endpoint` → 无匹配，跳过限速

- [ ] **Step 3: 确认限速在公开端点白名单之前执行**

当前代码结构应该是：
```
1. CORS/OPTIONS 处理
2. 安全响应头
3. /api/login 放行
4. ★ 速率限制检查（新增）
5. 公开 GET 端点放行（已有）
6. /api/settings POST 认证检查
7. 其他 API 认证检查
8. await next() + 加响应头
```

确保 Step 2 的代码插在位置 4（在 `// 登录接口不需要验证` 之后，在 `// GET请求的bookmarks...` 之前）。

- [ ] **Step 4: 构建验证**

```bash
npm run build
```

期望：构建成功。

- [ ] **Step 5: 提交**

```bash
git add functions/_middleware.js
git commit -m "feat: enforce rate limiting on public and AI endpoints"
```

---

### Task 3: 隐藏 /api/ai/status 的敏感信息

**Files:**
- Modify: `functions/api/ai/status.js`

**Interfaces:**
- 修改返回 JSON，移除 `baseUrl` 和 `model` 字段
- `enabled` 和 `source` 保持不变

- [ ] **Step 1: 修改返回结构**

打开 `functions/api/ai/status.js`，找到第 21-27 行：

```javascript
return new Response(JSON.stringify({
  success: true,
  enabled,
  source: hasEnvKey ? 'env' : (hasDbKey ? 'db' : 'none'),
  baseUrl: config.baseUrl,
  model: config.model
}), {
  status: 200,
  headers: { 'Content-Type': 'application/json' }
})
```

替换为：

```javascript
return new Response(JSON.stringify({
  success: true,
  enabled,
  source: hasEnvKey ? 'env' : (hasDbKey ? 'db' : 'none')
}), {
  status: 200,
  headers: { 'Content-Type': 'application/json' }
})
```

- [ ] **Step 2: 确认 getAIConfig 调用仍然需要（enabled 依赖 config.apiKey）**

`config` 变量仍在使用（第 19 行 `const enabled = !!config.apiKey`），不需要移除 `getAIConfig` 调用。

- [ ] **Step 3: 构建验证**

```bash
npm run build
```

期望：构建成功。

- [ ] **Step 4: 提交**

```bash
git add functions/api/ai/status.js
git commit -m "fix: hide AI baseUrl and model from /api/ai/status response"
```

---

### Task 4: 部署到 Cloudflare Pages 并验证

**Files:**
- 无新文件

- [ ] **Step 1: 确认 wrangler.toml 中 RATE_LIMIT_STORAGE 绑定存在**

检查 `wrangler.toml` 是否包含以下配置：

```toml
kv_namespaces = [
  { binding = "RATE_LIMIT_STORAGE", id = "..." }
]
```

如果 `id` 为空或缺失，需要执行：

```bash
npx wrangler kv:namespace create RATE_LIMIT_STORAGE
```

然后用返回的 namespace ID 填入 `wrangler.toml`。

- [ ] **Step 2: 部署**

```bash
npm run deploy
```

- [ ] **Step 3: 验证 /api/ai/status 不再暴露敏感信息**

```bash
curl -s https://nav.bookmark.de5.net/api/ai/status
```

期望输出：

```json
{"success":true,"enabled":true,"source":"env"}
```

不应包含 `baseUrl` 和 `model` 字段。

- [ ] **Step 4: 验证速率限制生效**

连续快速请求 `/api/bookmarks`（超过 30 次）：

```bash
for i in $(seq 1 35); do
  curl -s -o /dev/null -w "%{http_code}\n" https://nav.bookmark.de5.net/api/bookmarks
  sleep 0.1
done
```

期望：前 30 次返回 200，第 31 次起返回 429。

- [ ] **Step 5: 验证 AI proxy 限速（2次/分钟）**

```bash
for i in $(seq 1 4); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://nav.bookmark.de5.net/api/ai/proxy \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"path":"models","method":"GET"}'
  sleep 0.5
done
```

期望：前 2 次返回正常响应，第 3 次起返回 429。

- [ ] **Step 6: 验证路径匹配不会误伤**

`GET /api/bookmarks-extra` 不应被限速（该端点不存在，但也不会被错误匹配到 bookmarks）：

```bash
for i in $(seq 1 50); do
  curl -s -o /dev/null -w "%{http_code}\n" https://nav.bookmark.de5.net/api/bookmarks-extra
  sleep 0.1
done
```

期望：所有请求返回 404 或 200，不会出现 429。

- [ ] **Step 7: 提交（如有本地改动）**

```bash
git add .
git commit -m "chore: verify rate limiting and ai status fix on production"
```

---

## 回滚方案

如果部署后出现意外问题：

```bash
# 回滚到上一个版本
git revert HEAD~3..HEAD
npm run deploy
```

三个 commit 按依赖顺序排列，每个都可以独立回滚：
1. `fix: hide AI baseUrl and model` — 最安全，可独立回滚
2. `feat: enforce rate limiting` — 如限速导致误杀，可单独回滚
3. `feat: add rate limit helper` — 基础函数，无副作用

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 速率限制误伤正常用户（同一 IP 多用户） | 低 | 中 | 限速较宽松（30次/分钟），且 5 分钟窗口更宽松 |
| KV 数据损坏导致限速失效 | 极低 | 低 | `SyntaxError` 时自动清理损坏 key 后放行 |
| KV 网络故障导致限速失效（fail-open） | 低 | 低 | 基础设施故障时应放行而非阻断正常用户 |
| 速率限制增加 API 响应延迟 | 中 | 低 | KV 操作约 1-3ms，在可接受范围 |
| 客户端 IP 为 127.0.0.1（非 CF 流量） | 低 | 低 | 所有请求走同一个 key，等于无限制，回退安全 |
| X-Forwarded-For 伪造绕过限速 | 已修复 | — | 已移除该 header 回退，仅信任 CF-Connecting-IP |
| 路径匹配误伤非目标端点 | 已修复 | — | 已改为只回退到上一个 `/` 段，不越界匹配 |
| retryAfter 为 0 或负值 | 已修复 | — | 已使用 `Math.max(1, ...)` 确保最小值为 1 |
| 高 QPS 下 KV 条目超限 | 已修复 | — | 已截断数组到 limit + 10 |