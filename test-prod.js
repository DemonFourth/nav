// 直接用 D1 的 key 调 Agnes API（绕过服务端）
const apiKey = 'sk-IzWQaVRkaVw84P77xlA66x5M792A3VHIFtslA3plQev0t94D';

async function test() {
  // 测试1: 直接调 Agnes API
  console.log('=== 直接调 Agnes API ===');
  const r1 = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'agnes-2.5-flash',
      messages: [
        { role: 'system', content: 'Output ONLY valid JSON. Format: {"categoryId":NUMBER,"reason":"中文"}. You MUST choose one of the provided category IDs.' },
        { role: 'user', content: 'Bookmark: New API | https://new-api.bookmark.de5.net/das\nCategories: 146=域名,147=VPS(虚拟机),148=影视资源,149=网络IP工具\n{"categoryId":' }
      ],
      temperature: 0.1, max_tokens: 800, reasoning: { effort: 'none' }
    })
  });
  const d1 = await r1.json();
  console.log('finish_reason:', d1.choices?.[0]?.finish_reason);
  console.log('content:', JSON.stringify(d1.choices?.[0]?.message?.content)?.slice(0, 150));

  // 测试2: 调生产环境 API（无 auth）
  console.log('\n=== 调生产环境 API（无 auth）===');
  const r2 = await fetch('https://nav.bookmark.de5.net/api/ai/suggest-category', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'New API',
      url: 'https://new-api.bookmark.de5.net/das',
      description: 'API服务管理仪表盘',
      categories: [
        { id: '146', name: '域名', path: '域名' },
        { id: '147', name: 'VPS(虚拟机)', path: 'VPS(虚拟机)' },
        { id: '148', name: '影视资源', path: '影视资源' },
        { id: '149', name: '网络IP工具', path: '网络IP工具' }
      ]
    })
  });
  console.log('status:', r2.status);
  const d2 = await r2.json();
  console.log('result:', JSON.stringify(d2));
}

test();
