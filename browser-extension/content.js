// Content script: captures page metadata for AI features
function capturePageMeta() {
  try {
    const title = document.title || ''
    const metaDesc = document.querySelector('meta[name="description"]')?.content || ''
    const ogDesc = document.querySelector('meta[property="og:description"]')?.content || ''
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