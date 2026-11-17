let contextInfo = null;
let tokenCheckInterval = null;

const CHECK_INTERVAL = 5 * 60 * 1000; // 每5分钟检查一次

const PREFETCH_CACHE_KEY = 'prefetchCache';
const PREFETCH_TTL = 5 * 60 * 1000; // 预取缓存5分钟

function storageGet(area, keys) {
  return browser.storage[area].get(keys);
}

function storageSet(area, items) {
  return browser.storage[area].set(items);
}

// 密码解密函数（与 options.js 保持一致）
async function decryptPassword(encryptedPassword) {
  try {
    const combined = Uint8Array.from(atob(encryptedPassword), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('bookmark-extension-encryption-key-32-byte!'),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const salt = new TextEncoder().encode('bookmark-salt-16-byte');
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    try {
      return atob(encryptedPassword);
    } catch {
      return '';
    }
  }
}

// 自动续期 token
async function autoRenewToken() {
  const { serverUrl = '', username = '', encryptedPassword = '', autoRenew = false } = await storageGet('local', ['serverUrl', 'username', 'encryptedPassword', 'autoRenew']);
  
  if (!autoRenew || !serverUrl || !username || !encryptedPassword) {
    return false;
  }

  try {
    const password = await decryptPassword(encryptedPassword);
    if (!password) {
      console.error('Failed to decrypt password');
      return false;
    }

    const response = await fetch(`${serverUrl}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      console.error('Auto renew token failed: HTTP', response.status);
      return false;
    }

    const result = await response.json();
    if (!result.success || !result.token) {
      console.error('Auto renew token failed: Invalid response');
      return false;
    }

    const expiry = BMExt.parseTokenExpiry(result.token);
    await storageSet('local', {
      authToken: result.token,
      tokenExpiry: expiry
    });

    return true;
  } catch (error) {
    console.error('Auto renew token error:', error);
    return false;
  }
}

// 检查并自动续期 token
async function checkAndRenewToken() {
  try {
    const { authToken = '', tokenExpiry = 0, autoRenew = false } = await storageGet('local', ['authToken', 'tokenExpiry', 'autoRenew']);
    
    if (!autoRenew || !authToken) {
      return;
    }

    const expiry = tokenExpiry || BMExt.parseTokenExpiry(authToken);
    if (!expiry) {
      return;
    }

    // 如果 token 已过期或即将过期，自动续期
    if (Date.now() >= expiry || BMExt.shouldRenewToken(expiry)) {
      await autoRenewToken();
    }
  } catch (error) {
    console.error('Token check error:', error);
  }
}

// 启动定期检查
function startTokenCheck() {
  // 清除之前的定时器
  if (tokenCheckInterval) {
    clearInterval(tokenCheckInterval);
  }

  // 立即检查一次
  checkAndRenewToken();

  // 设置定期检查
  tokenCheckInterval = setInterval(() => {
    checkAndRenewToken();
  }, CHECK_INTERVAL);
}

// 停止定期检查
function stopTokenCheck() {
  if (tokenCheckInterval) {
    clearInterval(tokenCheckInterval);
    tokenCheckInterval = null;
  }
}

// 优先使用聚合接口：一次请求拿到分类（含 path）与标签
async function fetchBootstrapCache(serverUrl, headers) {
  try {
    const response = await fetch(`${serverUrl}/api/bootstrap`, { headers });

    // 老版本后端没有该路由时回退
    if (response.status === 404 || response.status === 405) return null;
    if (!response.ok) return null;

    const payload = await response.json();
    if (!Array.isArray(payload.categories) || !Array.isArray(payload.tags)) return null;

    return {
      categories: payload.categories,
      tags: payload.tags,
      timestamp: Date.now(),
      serverUrl
    };
  } catch (error) {
    return null;
  }
}

// 旧后端回退：分类 + 全量书签两次请求
async function fetchLegacyCache(serverUrl, headers) {
  try {
    const [categoriesRes, bookmarksRes] = await Promise.all([
      fetch(`${serverUrl}/api/categories`, { headers }),
      fetch(`${serverUrl}/api/bookmarks?limit=1000`, { headers })
    ]);

    if (!categoriesRes.ok || !bookmarksRes.ok) return null;

    const categoriesData = await categoriesRes.json();
    const bookmarksData = await bookmarksRes.json();
    const rawCategories = categoriesData.data || [];
    const rawBookmarks = bookmarksData.data || [];

    // 构建分类 path
    const categoryMap = new Map();
    rawCategories.forEach(cat => categoryMap.set(cat.id, { ...cat }));

    const processedCategories = rawCategories.map(cat => {
      const segments = [];
      const visited = new Set();
      let current = categoryMap.get(cat.id);
      while (current) {
        if (visited.has(current.id)) break;
        visited.add(current.id);
        segments.unshift(current.name || '未命名');
        if (!current.parent_id) break;
        current = categoryMap.get(current.parent_id);
      }
      return { ...cat, path: segments.join(' / ') };
    });

    // 提取 tags
    const tagSet = new Set();
    rawBookmarks.forEach(bm => {
      if (bm.tags) {
        bm.tags.split(',').forEach(tag => {
          const trimmed = tag.trim();
          if (trimmed) tagSet.add(trimmed);
        });
      }
    });

    return {
      categories: processedCategories,
      tags: Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'zh-CN')),
      timestamp: Date.now(),
      serverUrl
    };
  } catch (error) {
    return null;
  }
}

// 预取书签数据（分类 + 标签）
async function prefetchBookmarkData() {
  const { serverUrl = '', authToken = '' } = await storageGet('local', ['serverUrl', 'authToken']);
  if (!serverUrl || !authToken) return false;

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };

    let cacheData = await fetchBootstrapCache(serverUrl, headers);
    if (!cacheData) {
      cacheData = await fetchLegacyCache(serverUrl, headers);
    }
    if (!cacheData) return false;

    // Firefox: 写入 local 存储
    await storageSet('local', { [PREFETCH_CACHE_KEY]: cacheData });

    return true;
  } catch (error) {
    console.error('Prefetch failed:', error);
    return false;
  }
}

// ---- 死链检测：从浏览器直接请求目标站，只读状态码，不经过云端 ----
const LINK_HEALTH_CONCURRENCY = 5
const LINK_HEALTH_TIMEOUT = 8000
const LINK_HEALTH_MAX_URLS = 40

// 只允许公网主机：网页可以把 postMessage 发给扩展，若不拦内网地址，
// 任意网页都能借扩展当端口扫描器（127.0.0.1 / 192.168.x / 169.254.169.254 等）
function isBlockedHost(hostname) {
  const host = String(hostname || '').toLowerCase()
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) return true
  if (host === '0.0.0.0') return true

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const a = Number(v4[1])
    const b = Number(v4[2])
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a >= 224) return true
  }

  if (host.startsWith('[')) {
    const v6 = host.slice(1, -1)
    if (v6 === '::' || v6 === '::1') return true
    if (v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')) return true
  }

  return false
}

function normalizeCheckUrl(raw) {
  try {
    const u = new URL(String(raw || ''))
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    if (isBlockedHost(u.hostname)) return ''
    return u.href
  } catch {
    return ''
  }
}

async function probeOne(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LINK_HEALTH_TIMEOUT)
  const started = Date.now()
  let status = null
  let error = null
  let timedOut = false

  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal
    })
    status = response.status
    // 只读状态码，立刻丢弃正文，避免白下载整页
    if (response.body) {
      try { await response.body.cancel() } catch (e) {}
    }
  } catch (e) {
    if (e && e.name === 'AbortError') timedOut = true
    else error = (e && e.message) ? e.message : String(e)
  } finally {
    clearTimeout(timer)
  }

  const verdict = BMExt.classifyLinkResult({
    status,
    error,
    timedOut,
    durationMs: Date.now() - started
  })

  return { url, state: verdict.state, status, reason: verdict.reason }
}

async function checkLinks(rawUrls) {
  const urls = Array.from(new Set((rawUrls || []).map(normalizeCheckUrl).filter(Boolean)))
    .slice(0, LINK_HEALTH_MAX_URLS)

  const results = []
  let cursor = 0
  const run = async () => {
    while (cursor < urls.length) {
      const current = urls[cursor++]
      results.push(await probeOne(current))
    }
  }

  const width = Math.min(LINK_HEALTH_CONCURRENCY, urls.length)
  await Promise.all(Array.from({ length: width }, run))
  return results
}

// Firefox 把 http(s)://*/* 放在 optional_permissions，未授权时后台跨站 fetch 会被拦。
// 提前判定，避免每次都发一批注定失败的请求，并把原因带回页面。
const LINK_HEALTH_ORIGINS = ['http://*/*', 'https://*/*']

async function hasLinkHealthHostAccess() {
  try {
    if (!browser.permissions || !browser.permissions.contains) return true
    return await browser.permissions.contains({ origins: LINK_HEALTH_ORIGINS })
  } catch (e) {
    return true
  }
}

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: 'save-bookmark',
    title: '添加书签',
    contexts: ['page', 'link']
  });
  
  // 启动 token 检查
  startTokenCheck();

  // 安装时预取一次数据
  prefetchBookmarkData();
});

// 监听存储变化：按当前 authToken + autoRenew 决定启动/停止检查
browser.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  if (changes.autoRenew === undefined && changes.authToken === undefined) return;

  const { autoRenew = false, authToken = '' } = await storageGet('local', ['autoRenew', 'authToken']);
  if (autoRenew && authToken) {
    startTokenCheck();
  } else {
    stopTokenCheck();
  }
});

// 扩展启动时检查配置并启动检查
browser.runtime.onStartup.addListener(() => {
  storageGet('local', ['autoRenew', 'authToken']).then(({ autoRenew = false, authToken = '' }) => {
    if (autoRenew && authToken) {
      startTokenCheck();
    }
  });
  // 启动时预取一次数据
  prefetchBookmarkData();
});

async function openPopup() {
  if (browser.browserAction && browser.browserAction.openPopup) {
    try {
      await browser.browserAction.openPopup();
      return;
    } catch (error) {
      // fall back
    }
  }

  await browser.windows.create({
    url: browser.runtime.getURL('popup.html'),
    type: 'popup',
    width: 420,
    height: 640
  });
}

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save-bookmark') {
    contextInfo = {
      url: info.linkUrl || info.pageUrl || (tab ? tab.url : ''),
      title: info.selectionText || (tab ? tab.title : ''),
      from: 'contextMenu'
    };
    openPopup();
    setTimeout(() => {
      contextInfo = null;
    }, 5000);
  }
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'request-context-info') {
    const info = contextInfo;
    contextInfo = null;
    return Promise.resolve(info);
  }

  if (request.type === 'get-prefetch-data') {
    return storageGet('local', PREFETCH_CACHE_KEY).then(result => {
      const cache = result[PREFETCH_CACHE_KEY];
      if (cache && Date.now() - cache.timestamp < PREFETCH_TTL) {
        return cache;
      }
      return null;
    });
  }

  if (request.type === 'data-changed') {
    prefetchBookmarkData();
    return Promise.resolve({ success: true });
  }

  if (request.type === 'link-health-check') {
    return hasLinkHealthHostAccess().then(granted => {
      if (!granted) {
        return {
          results: [],
          error: 'Firefox 需要先在扩展设置页授予「访问所有网站」权限，否则无法读取目标网站状态码'
        };
      }
      return checkLinks(request.urls)
        .then(results => ({ results }))
        .catch(error => ({ results: [], error: String(error) }));
    });
  }
});

browser.browserAction.onClicked.addListener(tab => {
  contextInfo = {
    url: tab.url || '',
    title: tab.title || '',
    from: 'browserAction'
  };
});
