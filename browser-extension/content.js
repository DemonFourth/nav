// Content script: captures page metadata for AI features
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