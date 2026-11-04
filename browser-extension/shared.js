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
   * URL 查重内联提示。
   * @param {{ category_name?: string }} bookmark
   * @returns {string}
   */
  function buildDuplicateHint(bookmark) {
    const category = (bookmark && bookmark.category_name) || '未分类'
    return `⚠️ 已在「${category}」保存过`
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
    buildDuplicateHint
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
