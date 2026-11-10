const DEFAULT_TIMEOUT_MS = 15000

/**
 * 抓取网页标题/描述。超时、网络错误、后端失败都返回 { success: false, error }，不抛异常。
 */
export async function fetchPageMetadata(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`/api/fetch-metadata?url=${encodeURIComponent(url)}`, {
      signal: controller.signal
    })
    const data = await response.json().catch(() => null)
    if (data?.success) {
      return { success: true, title: data.title || '', description: data.description || '' }
    }
    return { success: false, error: data?.error || '获取失败，请手动输入' }
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      return { success: false, error: `获取超时（${Math.ceil(timeoutMs / 1000)} 秒），请手动输入` }
    }
    return { success: false, error: '网络错误，请手动输入' }
  } finally {
    clearTimeout(timer)
  }
}
