const FETCH_TIMEOUT_MS = 10000
const MAX_HTML_BYTES = 256 * 1024
const HEAD_END_RE = /<\/head\s*>/i
const NON_HTML_PREFIXES = [
  'image/',
  'video/',
  'audio/',
  'application/json',
  'application/pdf',
  'application/octet-stream',
  'application/zip'
]

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

// 标题/描述都在 <head> 里，读到 </head> 就停，避免为 1MB+ 的页面把整页下载完
async function readHeadHtml(response) {
  if (!response.body) return ''

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let html = ''
  let received = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      html += decoder.decode(value, { stream: true })
      if (HEAD_END_RE.test(html) || received >= MAX_HTML_BYTES) break
    }
  } finally {
    // 提前结束时主动断开，否则剩余页面还会继续下载
    reader.cancel().catch(() => {})
  }

  return html + decoder.decode()
}

// GET fetch website metadata
export async function onRequestGet(context) {
  const { request } = context
  const url = new URL(request.url)
  const targetUrl = url.searchParams.get('url')

  if (!targetUrl) {
    return json({ success: false, error: 'URL parameter is required' }, 400)
  }

  let parsed
  try {
    parsed = new URL(targetUrl)
  } catch {
    return json({ success: false, error: 'URL 格式不正确' }, 400)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return json({ success: false, error: '仅支持 http/https 地址' }, 400)
  }

  let response
  try {
    response = await fetch(parsed.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return json({ success: false, error: '目标网站响应超时，请手动输入' }, 504)
    }
    return json({ success: false, error: '无法访问目标网站，请手动输入' }, 502)
  }

  if (!response.ok) {
    return json({ success: false, error: `目标网站返回 HTTP ${response.status}` }, 502)
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase()
  if (NON_HTML_PREFIXES.some(prefix => contentType.startsWith(prefix))) {
    return json({ success: false, error: '目标地址不是网页，请手动输入' }, 415)
  }

  try {
    const html = await readHeadHtml(response)

    // 解析 HTML 提取标题和描述
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);

    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);

    const title = ogTitleMatch?.[1] || titleMatch?.[1] || '';
    const description = ogDescMatch?.[1] || descMatch?.[1] || '';

    // 清理标题和描述
    const cleanTitle = title.trim().replace(/\s+/g, ' ').substring(0, 100);
    const cleanDesc = description.trim().replace(/\s+/g, ' ').substring(0, 200);

    return json({
      success: true,
      title: cleanTitle,
      description: cleanDesc
    })
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return json({ success: false, error: '目标网站响应超时，请手动输入' }, 504)
    }
    return json({ success: false, error: '无法读取网页内容，请手动输入' }, 502)
  }
}
