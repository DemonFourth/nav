const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4o-mini'

async function fetchSettings(env, keys) {
  if (!keys.length) return {}
  const placeholders = keys.map(() => '?').join(', ')
  const statement = `SELECT key, value FROM settings WHERE key IN (${placeholders})`
  const values = await env.DB.prepare(statement).bind(...keys).all()
  const map = {}
  values.results.forEach(row => {
    map[row.key] = row.value
  })
  return map
}

export async function getAIConfig(env) {
  const settings = await fetchSettings(env, [
    'secret_openai_api_key',
    'ai_base_url',
    'ai_model',
    'ai_auth_header',
    'ai_auth_prefix'
  ])

  const apiKey = env.OPENAI_API_KEY || settings.secret_openai_api_key || ''
  const baseUrl = (env.OPENAI_BASE_URL || settings.ai_base_url || DEFAULT_BASE_URL).trim()
  const model = (env.OPENAI_MODEL || settings.ai_model || DEFAULT_MODEL).trim()
  const authHeader = (env.OPENAI_AUTH_HEADER || settings.ai_auth_header || 'Authorization').trim()
  const authPrefix = env.OPENAI_AUTH_PREFIX !== undefined
    ? env.OPENAI_AUTH_PREFIX
    : (settings.ai_auth_prefix !== undefined ? settings.ai_auth_prefix : 'Bearer ')

  return {
    apiKey,
    baseUrl,
    model,
    authHeader,
    authPrefix
  }
}

export function joinBaseUrl(baseUrl, path) {
  if (!path) {
    throw new Error('Missing OpenAI path')
  }
  if (path.includes('://')) {
    throw new Error('Path must be relative when using proxy')
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  return normalizedBase + normalizedPath
}

/**
 * 从 AI 回复中提取 JSON 对象。
 * 支持多种格式：直接 JSON、markdown 代码块、前后文字包裹、自然语言提取、截断恢复。
 * @param {string} text - AI 回复文本
 * @param {Set<number>} validIds - 合法的 categoryId 集合，用于校验和截断恢复
 * @returns {{ categoryId: number, reason: string } | null}
 */
export function extractJson(text, validIds = new Set()) {
  if (!text) return null
  const trimmed = text.trim()

  // 尝试 1：直接解析整段文本
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed.categoryId !== 'undefined') return parsed
  } catch (_) {}

  // 尝试 2：从代码块 ```json ... ``` 或 ``` ... ``` 中提取
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim())
      if (parsed && typeof parsed.categoryId !== 'undefined') return parsed
    } catch (_) {}
  }

  // 尝试 3：非贪婪匹配第一个合法 JSON 对象
  const jsonMatch = trimmed.match(/\{[\s\S]*?\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed && typeof parsed.categoryId !== 'undefined') return parsed
    } catch (_) {}
  }

  // 尝试 4：从左往右扫描，找到第一个 { 后逐个字符尝试解析
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '{') {
      for (let j = i + 1; j <= trimmed.length; j++) {
        const chunk = trimmed.slice(i, j)
        if (chunk.endsWith('}')) {
          try {
            const parsed = JSON.parse(chunk)
            if (parsed && typeof parsed.categoryId !== 'undefined') return parsed
          } catch (_) {}
        }
      }
    }
  }

  // 尝试 5：AI 可能直接输出自然语言，从中提取 categoryId 数字和 reason 文本
  const idMatch = trimmed.match(/(?:categoryId|分类\s*ID|推荐)\s*[：:]\s*(\d+)/)
  if (idMatch) {
    const reasonMatch = trimmed.replace(/.*(?:categoryId|分类\s*ID|推荐)\s*[：:]\s*\d+.*/i, '').trim()
    return { categoryId: Number.parseInt(idMatch[1], 10), reason: reasonMatch || '' }
  }

  // 尝试 6：finish_reason=length 时输出被截断，从所有数字中找匹配的 categoryId
  for (const num of trimmed.matchAll(/\b(\d+)\b/g)) {
    const n = Number.parseInt(num[1], 10)
    if (validIds.has(n)) {
      return { categoryId: n, reason: trimmed.trim() }
    }
  }

  return null
}

export async function callOpenAI(env, { path, method = 'POST', body, headers = {} }) {
  const config = await getAIConfig(env)

  if (!config.apiKey) {
    throw new Error('Missing OpenAI API key')
  }

  const url = joinBaseUrl(config.baseUrl, path)

  const finalHeaders = new Headers(headers)
  if (!finalHeaders.has(config.authHeader)) {
    finalHeaders.set(config.authHeader, `${config.authPrefix || ''}${config.apiKey}`)
  }

  if (body && !(body instanceof ReadableStream) && typeof body === 'object' && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json')
    body = JSON.stringify(body)
  }

  const response = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body instanceof ReadableStream ? body : body ?? undefined
  })

  if (!response.ok) {
    let details = ''
    try {
      const errorData = await response.json()
      details = errorData.error?.message || errorData.error || JSON.stringify(errorData)
    } catch (err) {
      details = await response.text()
    }

    // 将 OpenAI content filter 错误映射为友好提示
    if (details.includes('content policy') || details.includes('content filter') || details.includes('blocked by')) {
      throw new Error('内容审核：请求内容触发了安全策略，请修改后重试')
    }

    throw new Error(details || `OpenAI request failed with status ${response.status}`)
  }

  return response
}
