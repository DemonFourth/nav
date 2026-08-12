// 生成 token 并测试
const timestamp = Date.now();
const secret = 'NavBookmarkManager2024SecretKey32Chars!';
const d = new TextEncoder().encode(timestamp + '_long_' + secret);
const h = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', d))));
const token = `${timestamp}.long.${h}`;
console.log('token:', token.slice(0, 30) + '...');

// 测试 suggest-category
const resp = await fetch('https://nav.bookmark.de5.net/api/ai/suggest-category', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    name: 'test',
    url: 'https://github.com/test',
    description: '',
    categories: [{ id: '146', name: '域名', path: '域名' }]
  })
});
console.log('status:', resp.status);
console.log('headers:', Object.fromEntries(resp.headers.entries()));
const result = await resp.json();
console.log('result:', JSON.stringify(result));
