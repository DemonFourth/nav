import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestGet } from '../functions/api/fetch-metadata.js'

const withFetch = async (impl, fn) => {
  const original = globalThis.fetch
  globalThis.fetch = impl
  try {
    return await fn()
  } finally {
    globalThis.fetch = original
  }
}

const callApi = async (targetUrl) => {
  const query = targetUrl == null ? '' : `?url=${encodeURIComponent(targetUrl)}`
  const response = await onRequestGet({
    request: new Request(`https://nav.example.com/api/fetch-metadata${query}`)
  })
  return { status: response.status, body: await response.json() }
}

test('缺少 url 参数返回 400', async () => {
  const { status, body } = await callApi(null)
  assert.equal(status, 400)
  assert.equal(body.success, false)
})

test('拒绝非 http/https 地址', async () => {
  const { status, body } = await callApi('ftp://example.com/a')
  assert.equal(status, 400)
  assert.equal(body.error, '仅支持 http/https 地址')
})

test('目标站非 2xx 返回明确的 HTTP 状态', async () => {
  await withFetch(
    async () => new Response('forbidden', { status: 403 }),
    async () => {
      const { status, body } = await callApi('https://example.com')
      assert.equal(status, 502)
      assert.equal(body.error, '目标网站返回 HTTP 403')
    }
  )
})

test('抓取超时返回 504', async () => {
  await withFetch(
    async () => { throw new DOMException('The operation timed out.', 'TimeoutError') },
    async () => {
      const { status, body } = await callApi('https://example.com')
      assert.equal(status, 504)
      assert.equal(body.error, '目标网站响应超时，请手动输入')
    }
  )
})

test('网络异常返回 502', async () => {
  await withFetch(
    async () => { throw new TypeError('fetch failed') },
    async () => {
      const { status, body } = await callApi('https://example.com')
      assert.equal(status, 502)
      assert.equal(body.error, '无法访问目标网站，请手动输入')
    }
  )
})

test('优先解析 og:title / og:description', async () => {
  const html = `<!doctype html><html><head>
    <title>普通标题</title>
    <meta name="description" content="普通描述">
    <meta property="og:title" content="OG 标题">
    <meta property="og:description" content="OG 描述">
  </head></html>`

  await withFetch(
    async () => new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } }),
    async () => {
      const { status, body } = await callApi('https://example.com')
      assert.equal(status, 200)
      assert.equal(body.success, true)
      assert.equal(body.title, 'OG 标题')
      assert.equal(body.description, 'OG 描述')
    }
  )
})

test('无 meta 时返回空字符串而不报错', async () => {
  await withFetch(
    async () => new Response('<html><head><title></title></head></html>', { status: 200 }),
    async () => {
      const { status, body } = await callApi('https://example.com')
      assert.equal(status, 200)
      assert.equal(body.success, true)
      assert.equal(body.title, '')
      assert.equal(body.description, '')
    }
  )
})
