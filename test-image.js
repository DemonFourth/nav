async function test() {
  const baseUrl = 'https://apihub.agnes-ai.com/v1';
  const apiKey = 'sk-IzWQaVRkaVw84P77xlA66x5M792A3VHIFtslA3plQev0t94D';
  const model = 'agnes-2.5-flash';

  // 测试1: 正常请求
  console.log('=== 正常请求 ===');
  const r1 = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 50
    })
  });
  const d1 = await r1.json();
  console.log('status:', r1.status, 'content:', d1.choices?.[0]?.message?.content?.slice(0, 100));
  if (d1.error) console.log('error:', d1.error);

  // 测试2: 带图片的请求（模拟可能的错误情况）
  console.log('\n=== 带图片的请求 ===');
  const r2 = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '描述这张图片' },
          { type: 'image_url', image_url: { url: 'https://example.com/image.png' } }
        ]
      }],
      max_tokens: 50
    })
  });
  const d2 = await r2.json();
  console.log('status:', r2.status);
  if (d2.error) console.log('error:', JSON.stringify(d2.error));
  else console.log('content:', d2.choices?.[0]?.message?.content?.slice(0, 100));
}

test();
