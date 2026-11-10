import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchPageMetadata } from '../src/utils/pageMetadata.js'

const withFetch = async (impl, fn) => {
  const original = globalThis.fetch
  globalThis.fetch = impl
  try {
    return await fn()
  } finally {
    globalThis.fetch = original
  }
}

test('成功时返回标题与描述', async () => {
  await withFetch(
    async () => new Response(
      JSON.stringify({ success: true, title: '示例站点', description: '示例描述' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ),
    async () => {
      const result = await fetchPageMetadata('https://example.com')
      assert.deepEqual(result, { success: true, title: '示例站点', description: '示例描述' })
    }
  )
})

test('后端失败的 error 文案原样透出', async () => {
  await withFetch(
    async () => new Response(
      JSON.stringify({ success: false, error: '目标网站返回 HTTP 403' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    ),
    async () => {
      const result = await fetchPageMetadata('https://example.com')
      assert.equal(result.success, false)
      assert.equal(result.error, '目标网站返回 HTTP 403')
    }
  )
})

test('非 JSON 响应不抛异常，返回兜底文案', async () => {
  await withFetch(
    async () => new Response('<html>SPA</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    async () => {
      const result = await fetchPageMetadata('https://example.com')
      assert.equal(result.success, false)
      assert.equal(result.error, '获取失败，请手动输入')
    }
  )
})

test('网络错误返回网络错误文案', async () => {
  await withFetch(
    async () => { throw new TypeError('Failed to fetch') },
    async () => {
      const result = await fetchPageMetadata('https://example.com')
      assert.equal(result.success, false)
      assert.equal(result.error, '网络错误，请手动输入')
    }
  )
})

test('请求超时会被中止并提示超时', async () => {
  const started = Date.now()
  await withFetch(
    (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const err = new Error('aborted')
        err.name = 'AbortError'
        reject(err)
      })
    }),
    async () => {
      const result = await fetchPageMetadata('https://example.com', { timeoutMs: 50 })
      assert.equal(result.success, false)
      assert.equal(result.error, '获取超时（1 秒），请手动输入')
      assert.ok(Date.now() - started < 2000, '应在超时后立即返回')
    }
  )
})

test('超时文案按秒数取整', async () => {
  await withFetch(
    async () => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    },
    async () => {
      const result = await fetchPageMetadata('https://example.com', { timeoutMs: 15000 })
      assert.equal(result.error, '获取超时（15 秒），请手动输入')
    }
  )
})
