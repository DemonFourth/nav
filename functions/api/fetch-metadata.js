const FETCH_TIMEOUT_MS = 10000

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

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

  try {
    const html = await response.text()

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
