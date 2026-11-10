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

test('读到 </head> 即停止，不再下载剩余页面', async () => {
  const head = '<html><head><title>慢站标题</title><meta name="description" content="慢站描述"></head>'
  let pulls = 0
  const stream = new ReadableStream({
    pull(controller) {
      pulls++
      if (pulls === 1) {
        controller.enqueue(new TextEncoder().encode(head))
      } else {
        // 正文若被继续读取，这里会抛错让测试失败
        controller.error(new Error('不应继续读取正文'))
      }
    }
  }, { highWaterMark: 0 })

  await withFetch(
    async () => new Response(stream, { status: 200, headers: { 'Content-Type': 'text/html' } }),
    async () => {
      const { status, body } = await callApi('https://example.com')
      assert.equal(status, 200)
      assert.equal(body.title, '慢站标题')
      assert.equal(body.description, '慢站描述')
      assert.equal(pulls, 1)
    }
  )
})

test('非网页内容返回明确提示', async () => {
  await withFetch(
    async () => new Response('%PDF-1.4', { status: 200, headers: { 'Content-Type': 'application/pdf' } }),
    async () => {
      const { status, body } = await callApi('https://example.com/a.pdf')
      assert.equal(status, 415)
      assert.equal(body.error, '目标地址不是网页，请手动输入')
    }
  )
})

const withFinalUrl = (response, url) => {
  Object.defineProperty(response, 'url', { value: url, configurable: true })
  return response
}

test('被重定向到登录页时提示需要登录', async () => {
  await withFetch(
    async () => withFinalUrl(
      new Response('<html><head><title></title></head></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
      'https://accounts.feishu.cn/accounts/page/login?app_id=169'
    ),
    async () => {
      const { status, body } = await callApi('https://miaoda.feishu.cn/home')
      assert.equal(status, 401)
      assert.equal(body.error, '页面需要登录，无法自动获取')
    }
  )
})

test('普通重定向不误判为登录页', async () => {
  const html = '<html><head><title>正常标题</title></head><body></body></html>'
  await withFetch(
    async () => withFinalUrl(
      new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } }),
      'https://example.com/page'
    ),
    async () => {
      const { status, body } = await callApi('https://www.example.com/page')
      assert.equal(status, 200)
      assert.equal(body.title, '正常标题')
    }
  )
})
