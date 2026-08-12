const timestamp = Date.now();
const secret = 'NavBookmarkManager2024SecretKey32Chars!';
const d = new TextEncoder().encode(timestamp + '_long_' + secret);
const h = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', d))));
const token = `${timestamp}.long.${h}`;

const resp = await fetch('http://127.0.0.1:8787/api/ai/suggest-category', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    name: 'test',
    url: 'https://github.com/test',
    description: '',
    categories: [{ id: '146', name: '域名', path: '域名' }]
  })
});
const result = await resp.json();
console.log(JSON.stringify(result));
