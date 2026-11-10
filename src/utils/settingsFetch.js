/**
 * 首屏 settings / theme / searchEngines 三个 composable 各自请求 /api/settings，
 * 这里把短时间内的连续调用合并成一次网络请求。
 * 失败返回 null，由调用方保留原有降级逻辑（本地缓存 + 提示）。
 */
const TTL = 3000
const RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 500
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
let cache = null

async function requestSettings(headers) {
  let lastError = null
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await fetch('/api/settings', { headers })
      if (response.status >= 500) {
        lastError = new Error(`Server error ${response.status}`)
        if (attempt < RETRY_ATTEMPTS - 1) {
          await sleep(RETRY_DELAY_MS * (attempt + 1))
          continue
        }
        return null
      }
      if (!response.ok) return null
      const data = await response.json()
      return data?.success ? data.data : null
    } catch (error) {
      lastError = error
      if (attempt < RETRY_ATTEMPTS - 1) {
        await sleep(RETRY_DELAY_MS * (attempt + 1))
      }
    }
  }
  throw lastError
}

/**
 * @param {Record<string, string>} [headers]
 * @returns {Promise<Record<string, string> | null>} settings 表的数据对象
 */
export async function fetchSettingsShared(headers = {}) {
  const isAuth = Boolean(headers.Authorization)
  const now = Date.now()

  // 已登录与未登录拿到的数据可能不同，缓存按认证态隔离
  if (cache && cache.isAuth === isAuth && now - cache.at < TTL) {
    return cache.promise
  }

  const promise = requestSettings(headers).catch((error) => {
    cache = null
    throw error
  })

  cache = { at: now, isAuth, promise }
  return promise
}

/** 保存设置后调用，避免紧接着的读取拿到旧快照 */
export function invalidateSettingsFetch() {
  cache = null
}
