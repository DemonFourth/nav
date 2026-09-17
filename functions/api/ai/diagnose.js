import { getAIConfig, joinBaseUrl } from './_shared.js'

/**
 * 判定失败发生在哪一层。
 * cfRay 非空 + 响应体含 "error code: NNNN" → Cloudflare 防护层拦截（请求未到应用层）
 * 其余按 HTTP 状态码归因
 */
function classify(status, { cfRay }, body) {
  const isCfBlock = !!cfRay && /error\s+code\s*:\s*\d{3,5}/i.test(body || '')
  if (isCfBlock) return 'Cloudflare 防护层拦截：请求未到达 API 提供商应用层'
  if (status === 401 || status === 403) return '认证失败：API key 无效、过期或与该端点不匹配'
  if (status === 404) return '端点或模型不存在：检查 baseUrl 路径与模型名'
  if (status === 429 || status === 1015) return '速率限制：已达调用频率/并发/配额上限'
  if (status >= 500) return '服务端错误：API 提供商侧异常'
  if (status === 0) return '网络层失败：连接被拒、DNS 失败或超时'
  if (status >= 200 && status < 300) return '正常'
  return '未知'
}

/**
 * 采集一次出站请求的结构化体检结果。
 */
async function probe(env, { method, path, body }) {
  const config = await getAIConfig(env)
  const url = joinBaseUrl(config.baseUrl, path)
  const headers = new Headers()
  headers.set(config.authHeader, `${config.authPrefix || ''}${config.apiKey}`)

  const result = {
    method,
    path,
    url,
    ok: false,
    status: 0,
    durationMs: 0,
    retryAfter: null,
    cfRay: null,
    contentType: null,
    server: null,
    cfProtectionBlock: false,
    bodyPreview: '',
    networkError: null,
    verdict: ''
  }

  const start = Date.now()
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    })
    result.durationMs = Date.now() - start
    result.status = response.status
    result.ok = response.ok
    result.retryAfter = response.headers.get('retry-after')
    result.cfRay = response.headers.get('cf-ray')
    result.contentType = response.headers.get('content-type')
    result.server = response.headers.get('server')

    const text = await response.text()
    result.bodyPreview = text.replace(/\s+/g, ' ').trim().slice(0, 300)
    result.cfProtectionBlock = !!result.cfRay && /error\s+code\s*:\s*\d{3,5}/i.test(text)
    result.verdict = classify(response.status, { cfRay: result.cfRay }, text)
  } catch (err) {
    result.durationMs = Date.now() - start
    result.networkError = `${err?.cause?.code || err?.name || ''} ${err.message}`
    result.verdict = classify(0, { cfRay: null }, '')
  }

  return result
}

export async function onRequestPost(context) {
  const { env } = context

  try {
    const config = await getAIConfig(env)

    if (!config.apiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: '未配置 API key：环境变量 OPENAI_API_KEY 与设置中的 secret_openai_api_key 均为空'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const maskedKey = config.apiKey.slice(0, 6) + '…' + config.apiKey.slice(-4)

    const models = await probe(env, { method: 'GET', path: 'models' })
    const completion = await probe(env, {
      method: 'POST',
      path: 'chat/completions',
      body: {
        model: config.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1
      }
    })

    const summary = [
      models.ok ? 'models 接口正常' : `models 接口：${models.verdict}`,
      completion.ok ? 'chat/completions 正常' : `chat/completions：${completion.verdict}`
    ].join('；')

    return new Response(JSON.stringify({
      success: true,
      checkedAt: new Date().toISOString(),
      config: {
        apiKeyMasked: maskedKey,
        apiKeyLength: config.apiKey.length,
        baseUrl: config.baseUrl,
        model: config.model,
        authHeader: config.authHeader,
        authPrefix: config.authPrefix,
        source: {
          apiKey: env.OPENAI_API_KEY ? 'env' : 'db',
          baseUrl: env.OPENAI_BASE_URL ? 'env' : 'db',
          model: env.OPENAI_MODEL ? 'env' : 'db'
        }
      },
      checks: { models, completion },
      summary
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('AI diagnose error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || '诊断失败'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
