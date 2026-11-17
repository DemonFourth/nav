/**
 * 浏览器扩展共享纯逻辑（classic script）
 *
 * 同时被以下环境加载：
 * - popup.html / options.html（<script src="shared.js">）
 * - background.js（MV3 service worker，importScripts）
 * - manifest.firefox.json（MV2 background scripts）
 * - Node（tests/extension-shared.test.js，ESM 副作用导入）
 *
 * 只放无副作用、可测试的纯函数；所有导出挂在 globalThis.BMExt。
 */
(function (global) {
  const SHORT_TTL = 30 * 60 * 1000
  const LONG_TTL = 30 * 24 * 60 * 60 * 1000
  const RENEW_THRESHOLD = 5 * 60 * 1000
  const CACHE_FRESH_MS = 60 * 1000
  const CACHE_OLD_MS = 7 * 24 * 60 * 60 * 1000

  /**
   * token 格式：`<issuedAt>.<type>.<hash>`，或旧格式 `<issuedAt>.<hash>`（视为 short）。
   * @param {string} token
   * @returns {'short'|'long'}
   */
  function getTokenType(token) {
    const parts = String(token || '').split('.')
    return parts.length === 3 && parts[1] === 'long' ? 'long' : 'short'
  }

  /**
   * 与服务端 functions/_middleware.js 的 validateToken 保持一致：
   * short 30 分钟，long 30 天。
   * @param {string} token
   * @returns {number|null} 过期时间戳（ms），无法解析时返回 null
   */
  function parseTokenExpiry(token) {
    const issuedAt = Number(String(token || '').split('.')[0])
    if (!Number.isFinite(issuedAt) || issuedAt <= 0) return null
    return issuedAt + (getTokenType(token) === 'long' ? LONG_TTL : SHORT_TTL)
  }

  /**
   * 是否应该主动续期：仅在「未过期且剩余时间小于阈值」时返回 true。
   * @param {number} tokenExpiry
   * @param {number} [now]
   * @returns {boolean}
   */
  function shouldRenewToken(tokenExpiry, now = Date.now()) {
    if (!tokenExpiry) return false
    const remaining = tokenExpiry - now
    return remaining > 0 && remaining < RENEW_THRESHOLD
  }

  /**
   * 缓存年龄分档。
   * @param {number} timestamp
   * @param {number} [now]
   * @returns {'none'|'fresh'|'stale'|'old'}
   */
  function cacheState(timestamp, now = Date.now()) {
    if (!timestamp || !Number.isFinite(Number(timestamp))) return 'none'
    const age = now - Number(timestamp)
    if (age < CACHE_FRESH_MS) return 'fresh'
    if (age < CACHE_OLD_MS) return 'stale'
    return 'old'
  }

  /**
   * 延迟分档。
   * @param {number|null|undefined} ms
   * @returns {'fast'|'medium'|'slow'|'error'}
   */
  function latencyLevel(ms) {
    if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return 'error'
    if (ms <= 500) return 'fast'
    if (ms <= 1500) return 'medium'
    return 'slow'
  }

  /**
   * 延迟展示文案。
   * @param {number|null|undefined} ms
   * @returns {string}
   */
  function formatLatency(ms) {
    if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return '超时'
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
  }

  /**
   * 相对时间文案（"最近成功于…"这类补充说明用）。
   * 只输出短文本，避免挤占弹窗宽度。
   * @param {number|null|undefined} timestamp
   * @param {number} [now]
   * @returns {string}
   */
  function formatRelativeTime(timestamp, now = Date.now()) {
    const ts = Number(timestamp)
    if (!ts || !Number.isFinite(ts)) return ''

    const diff = now - ts
    if (diff < 5000) return '刚刚'
    if (diff < 60 * 1000) return `${Math.floor(diff / 1000)} 秒前`
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前`
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前`
  }

  /**
   * URL 查重内联提示。
   * @param {{ category_name?: string }} bookmark
   * @returns {string}
   */
  function buildDuplicateHint(bookmark) {
    const category = (bookmark && bookmark.category_name) || '未分类'
    return `⚠️ 已在「${category}」保存过`
  }

  const LINK_STATES = { OK: 'ok', DEAD: 'dead', UNSURE: 'unsure' }
  const DEAD_STATUSES = [404, 410]
  const DEAD_FAST_FAIL_MS = 3000

  /**
   * 只允许公网主机。content script 对任意页面开放，若不过滤内网地址，
   * 任何网页都能借扩展探测 127.0.0.1 / 192.168.x / 169.254.169.254。
   * @param {string} hostname
   * @returns {boolean}
   */
  function isBlockedHost(hostname) {
    const host = String(hostname || '').toLowerCase()
    if (!host) return true
    if (host === 'localhost' || host.endsWith('.localhost')) return true
    if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) return true
    if (host === '0.0.0.0') return true

    const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (v4) {
      const a = Number(v4[1])
      const b = Number(v4[2])
      if (a === 0 || a === 10 || a === 127) return true
      if (a === 169 && b === 254) return true
      if (a === 172 && b >= 16 && b <= 31) return true
      if (a === 192 && b === 168) return true
      if (a === 100 && b >= 64 && b <= 127) return true
      if (a >= 224) return true
    }

    if (host.startsWith('[')) {
      const v6 = host.slice(1, -1)
      if (v6 === '::' || v6 === '::1') return true
      if (v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')) return true
    }

    return false
  }

  /**
   * 把书签 URL 归一化成可探测的地址；非 http(s) 或内网地址返回空字符串。
   * @param {string} raw
   * @returns {string}
   */
  function normalizeCheckUrl(raw) {
    try {
      const u = new URL(String(raw || ''))
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
      if (isBlockedHost(u.hostname)) return ''
      return u.href
    } catch (e) {
      return ''
    }
  }

  /**
   * 把一次链接探测的结果归成三态。
   * 只有 404/410 算「已失效」，其余一律「待确认」，避免误删书签。
   * @param {{ status?: number|null, error?: string|null, timedOut?: boolean, durationMs?: number }} input
   * @returns {{ state: 'ok'|'dead'|'unsure', reason: string }}
   */
  function classifyLinkResult(input) {
    const { status, error, timedOut, durationMs } = input || {}
    if (timedOut) return { state: LINK_STATES.UNSURE, reason: '超时' }
    if (typeof status === 'number' && status > 0) {
      if (status >= 200 && status < 400) return { state: LINK_STATES.OK, reason: '' }
      if (DEAD_STATUSES.includes(status)) return { state: LINK_STATES.DEAD, reason: `HTTP ${status}` }
      if (status >= 400 && status < 500) {
        return { state: LINK_STATES.UNSURE, reason: `HTTP ${status} · 需要登录或有防护` }
      }
      if (status >= 500) return { state: LINK_STATES.UNSURE, reason: `HTTP ${status} · 源站不可达` }
      return { state: LINK_STATES.UNSURE, reason: `HTTP ${status}` }
    }
    if (error) {
      const fast = typeof durationMs === 'number' && durationMs < DEAD_FAST_FAIL_MS
      return { state: LINK_STATES.UNSURE, reason: fast ? '域名或连接失败' : '请求失败' }
    }
    return { state: LINK_STATES.UNSURE, reason: '未取得结果' }
  }

  global.BMExt = {
    SHORT_TTL,
    LONG_TTL,
    RENEW_THRESHOLD,
    getTokenType,
    parseTokenExpiry,
    shouldRenewToken,
    cacheState,
    latencyLevel,
    formatLatency,
    formatRelativeTime,
    buildDuplicateHint,
    LINK_STATES,
    classifyLinkResult,
    isBlockedHost,
    normalizeCheckUrl
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
