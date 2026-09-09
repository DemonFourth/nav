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

    const transformed = rewriter.transform(response)
    const reader = transformed.body.getReader()
    // 流式读取并提前终止：找到 icon 链接后不再下载剩余 HTML
    const MAX_HTML_BYTES = 64 * 1024
    let consumed = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) consumed += value.byteLength
        if (iconUrl || consumed >= MAX_HTML_BYTES) {
          await reader.cancel()
          break
        }
      }
    } catch (e) {
      // 提前取消读取可能抛错，忽略
    }

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
