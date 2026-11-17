// Content script: captures page metadata for AI features
// 标记扩展已注入，网页据此判断是否显示死链检测入口
try {
  document.documentElement.dataset.bmExt = chrome.runtime.getManifest().version
} catch (e) {
  // ignore
}

function stripUrlSuffix(text) {
  if (!text) return ''

  try {
    const segments = location.pathname.split('/').filter(Boolean)
    if (segments.length >= 2) {
      const suffix = ` - ${segments[0]}/${segments[1]}`
      if (text.endsWith(suffix)) {
        return text.slice(0, -suffix.length).trim()
      }
    }
  } catch (e) {
    // ignore malformed location
  }

  return text
}

function capturePageMeta() {
  try {
    const title = document.title || ''
    const metaDesc = stripUrlSuffix(document.querySelector('meta[name="description"]')?.content || '')
    const ogDesc = stripUrlSuffix(document.querySelector('meta[property="og:description"]')?.content || '')
    const h1 = document.querySelector('h1')?.textContent?.trim() || ''
    const keywords = document.querySelector('meta[name="keywords"]')?.content || ''
    return { title, metaDescription: metaDesc, ogDescription: ogDesc, h1, keywords }
  } catch (e) {
    return null
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'get-page-metadata') {
    sendResponse(capturePageMeta())
    return true
  }
})

// ---- 死链检测桥接：网页 postMessage → 后台 fetch ----
const LINK_HEALTH_MAX_URLS = 40

function isValidCheckUrl(raw) {
  try {
    const u = new URL(String(raw || ''))
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch (e) {
    return false
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (event.origin !== location.origin) return

  const data = event.data
  if (!data || data.source !== 'bm-link-health' || typeof data.reqId !== 'string') return

  const urls = Array.isArray(data.urls)
    ? data.urls.filter(isValidCheckUrl).slice(0, LINK_HEALTH_MAX_URLS)
    : []

  if (urls.length === 0) {
    window.postMessage(
      { source: 'bm-link-health-reply', reqId: data.reqId, results: [] },
      location.origin
    )
    return
  }

  try {
    chrome.runtime.sendMessage({ type: 'link-health-check', urls }, (reply) => {
      const payload = reply && Array.isArray(reply.results) ? reply.results : []
      window.postMessage(
        {
          source: 'bm-link-health-reply',
          reqId: data.reqId,
          results: payload,
          error: reply && reply.error
        },
        location.origin
      )
    })
  } catch (e) {
    window.postMessage(
      { source: 'bm-link-health-reply', reqId: data.reqId, results: [], error: String(e) },
      location.origin
    )
  }
})