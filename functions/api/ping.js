// 极简连通性探测端点：供浏览器扩展与导航站测速使用，不需要 token
export async function onRequestGet(context) {
  // 本地 wrangler 开发时没有 request.cf，返回空串由前端降级展示
  const colo = context?.request?.cf?.colo || '';
  return new Response(JSON.stringify({ ok: true, ts: Date.now(), colo }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
