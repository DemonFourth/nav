const appSettings = {
  serverUrl: '',
  authToken: '',
  tokenExpiry: 0,
  autoRenew: false
}

let categories = [];
let tagItems = [];
let allTags = [];
let categoriesLoaded = false;
let formDirty = false;
let prefetchCacheRecord = null;
let cacheTimestamp = 0;
let renewingPromise = null;
const inFlight = { categories: null, tags: null, bootstrap: null };
const requestTimings = [];

function storageGet(area, keys) {
  return new Promise(resolve => chrome.storage[area].get(keys, resolve));
}

function storageSet(area, items) {
  return new Promise(resolve => chrome.storage[area].set(items, resolve));
}

function storageRemove(area, keys) {
  return new Promise(resolve => chrome.storage[area].remove(keys, resolve));
}

async function writeCache() {
  const cacheData = {
    categories,
    tags: allTags,
    timestamp: Date.now(),
    serverUrl: appSettings.serverUrl
  };
  // Chromium: 写入 session 存储（内存级）
  if (chrome.storage.session) {
    await chrome.storage.session.set({ prefetchCache: cacheData });
  }
  // Firefox fallback: 写入 local 存储
  await storageSet('local', { prefetchCache: cacheData });

  prefetchCacheRecord = cacheData;
  cacheTimestamp = cacheData.timestamp;
}

async function clearPrefetchCache() {
  prefetchCacheRecord = null;
  cacheTimestamp = 0;
  if (chrome.storage.session) {
    await chrome.storage.session.remove('prefetchCache');
  }
  await storageRemove('local', 'prefetchCache');
}

function readCache() {
  return prefetchCacheRecord;
}

async function loadPrefetchCache() {
  let cache = null;

  // 优先从 chrome.storage.session 读取（内存级，几乎 0ms）
  if (chrome.storage.session) {
    const result = await chrome.storage.session.get('prefetchCache');
    cache = result.prefetchCache;
  }

  // fallback: 从 local 存储读取
  if (!cache) {
    const result = await storageGet('local', 'prefetchCache');
    cache = result.prefetchCache;
  }

  if (!cache) return null;

  // 换过服务器地址后，旧分类不能复用，否则会保存到不存在的 category_id
  if (cache.serverUrl && cache.serverUrl !== appSettings.serverUrl) {
    await clearPrefetchCache();
    return null;
  }

  prefetchCacheRecord = cache;
  cacheTimestamp = cache.timestamp || 0;
  categories = Array.isArray(cache.categories) ? cache.categories : [];
  allTags = Array.isArray(cache.tags) ? cache.tags : [];
  return cache;
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

    appSettings.authToken = result.token;
    appSettings.tokenExpiry = expiry;

    return true;
  } catch (error) {
    console.error('Auto renew token error:', error);
    return false;
  }
}

// 确保 token 有效：过期或临近过期时续期，并保证并发请求只触发一次续期
async function ensureTokenValid() {
  if (!appSettings.authToken || !appSettings.tokenExpiry) {
    return false;
  }

  const now = Date.now();
  const expired = now > appSettings.tokenExpiry;
  if (!expired && !BMExt.shouldRenewToken(appSettings.tokenExpiry, now)) {
    return true;
  }

  if (!appSettings.autoRenew) {
    return false;
  }

  if (!renewingPromise) {
    renewingPromise = autoRenewToken().finally(() => {
      renewingPromise = null;
    });
  }

  return renewingPromise;
}

async function loadSettings() {
  const result = await storageGet('local', ['serverUrl', 'authToken', 'tokenExpiry', 'autoRenew']);
  const { serverUrl = '', authToken = '', tokenExpiry = 0, autoRenew = false } = result;

  appSettings.serverUrl = serverUrl;
  appSettings.authToken = authToken;
  appSettings.tokenExpiry = tokenExpiry || BMExt.parseTokenExpiry(authToken) || 0;
  appSettings.autoRenew = autoRenew === true;

  return appSettings;
}

function showSection(sectionId) {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('form-section').classList.add('hidden');
  document.getElementById('loading-section').classList.add('hidden');
  document.getElementById(sectionId).classList.remove('hidden');
}

let toastTimer = null;

function showToast(message, type = 'info') {
  const toastEl = document.getElementById('toast');
  if (!toastEl) return;

  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.className = `toast toast-${type}`;
  toastTimer = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3000);
}

function markFormDirty() {
  formDirty = true;
}

function recordTiming(label, ms, ok) {
  requestTimings.push({ label, ms: Math.round(ms), ok, at: Date.now() });
  if (requestTimings.length > 20) requestTimings.shift();
}

async function handleUnauthorized() {
  appSettings.authToken = '';
  appSettings.tokenExpiry = 0;
  await storageRemove('local', ['authToken', 'tokenExpiry']);
  showSection('auth-section');
  showToast('登录已过期，请重新登录', 'error');
}

async function apiFetch(path, options = {}) {
  const { method = 'GET', body = null, timeout = 8000, label = '请求', auth = true } = options;

  if (auth) {
    await ensureTokenValid();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const start = performance.now();

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && appSettings.authToken) {
      headers.Authorization = `Bearer ${appSettings.authToken}`;
    }

    const response = await fetch(`${appSettings.serverUrl}${path}`, {
      method,
      headers,
      signal: controller.signal,
      body: body === null ? undefined : JSON.stringify(body)
    });

    recordTiming(label, performance.now() - start, response.ok);

    if (response.status === 401 && auth) {
      await handleUnauthorized();
      const unauthorizedError = new Error('Unauthorized');
      unauthorizedError.kind = 'unauthorized';
      throw unauthorizedError;
    }

    return response;
  } catch (error) {
    if (error.kind === 'unauthorized') throw error;

    recordTiming(label, performance.now() - start, false);
    const isTimeout = error.name === 'AbortError';
    const requestError = new Error(isTimeout ? 'Request timeout' : 'Network error');
    requestError.kind = isTimeout ? 'timeout' : 'network';
    throw requestError;
  } finally {
    clearTimeout(timer);
  }
}

function setCategoryLoading(loading) {
  categoriesLoaded = !loading;

  const input = document.getElementById('category-input');
  const saveBtn = document.getElementById('save-btn');

  if (loading) {
    if (input) {
      input.disabled = true;
      input.placeholder = '正在加载分类…';
    }
    if (saveBtn) saveBtn.disabled = true;
    renderConnection({ mode: 'loading', label: '正在加载分类…' });
    return;
  }

  if (input) {
    input.disabled = false;
    input.placeholder = '选择分类...';
  }
  if (saveBtn) saveBtn.disabled = false;
}

function renderConnection(state = {}) {
  const bar = document.getElementById('connection-bar');
  const dot = document.getElementById('connection-dot');
  const text = document.getElementById('connection-text');
  const main = document.getElementById('connection-main');
  if (!bar || !dot || !text) return;

  const { mode = 'idle', ms = null, stale = false, label = '', retry = null } = state;

  bar.classList.remove('hidden');
  dot.className = 'connection-dot';
  if (main) {
    main.disabled = false;
    main.onclick = null;
  }

  if (mode === 'offline') {
    text.textContent = label || '未连接';
    dot.classList.add('is-error');
    return;
  }

  if (mode === 'loading') {
    text.textContent = label || '正在连接…';
    return;
  }

  if (mode === 'error') {
    text.textContent = label || '请求失败';
    dot.classList.add('is-error');
    if (main && typeof retry === 'function') {
      main.disabled = false;
      main.onclick = () => {
        main.disabled = true;
        retry();
      };
    } else if (main) {
      main.disabled = true;
    }
    return;
  }

  if (mode === 'idle') {
    text.textContent = label || '已连接';
    return;
  }

  text.textContent = (label ? `${label} ` : '') + BMExt.formatLatency(ms) + (stale ? ' · 数据较旧' : '');
  dot.classList.add(`is-${BMExt.latencyLevel(ms)}`);
}

function renderConnectionFromTimings() {
  const last = requestTimings[requestTimings.length - 1];
  const stale = BMExt.cacheState(cacheTimestamp) === 'old';

  if (!last) {
    renderConnection({ mode: 'idle', label: '已连接' });
    return;
  }

  if (!last.ok) {
    renderConnection({ mode: 'error', label: `${last.label}失败`, retry: null });
    return;
  }

  // 后端还没有 /api/ping 时，用最近一次真实请求的耗时代替 ping 数字
  if (!pingSupported) {
    renderConnection({ mode: 'ok', ms: last.ms, stale, label: last.label });
    return;
  }

  renderConnection({ mode: 'ok', ms: last.ms, stale });
}

let pingSupported = true;

async function pingServer() {
  if (!pingSupported || !appSettings.serverUrl) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  const start = performance.now();

  try {
    const response = await fetch(`${appSettings.serverUrl}/api/ping`, {
      signal: controller.signal,
      cache: 'no-store'
    });

    // 老版本后端没有该路由：静默降级，不再反复探测
    if (response.status === 404 || response.status === 405) {
      pingSupported = false;
      return null;
    }

    if (!response.ok) return null;

    return performance.now() - start;
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function renderConnectionPanel() {
  const panel = document.getElementById('connection-panel');
  if (!panel) return;

  panel.innerHTML = '';

  const entries = requestTimings.slice(-5).reverse();
  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'connection-row';
    empty.textContent = '暂无请求记录';
    panel.appendChild(empty);
  } else {
    entries.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'connection-row';

      const label = document.createElement('span');
      label.className = 'connection-row-label';
      label.textContent = entry.ok ? entry.label : `${entry.label}（失败）`;

      const value = document.createElement('span');
      value.textContent = BMExt.formatLatency(entry.ms);

      row.append(label, value);
      panel.appendChild(row);
    });
  }

  const actions = document.createElement('div');
  actions.className = 'connection-panel-actions';

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.textContent = '重新测速';
  retryBtn.addEventListener('click', async () => {
    retryBtn.disabled = true;
    const ms = await pingServer();
    retryBtn.disabled = false;

    if (ms === null) {
      renderConnectionFromTimings();
    } else {
      renderConnection({ mode: 'ok', ms, stale: BMExt.cacheState(cacheTimestamp) === 'old' });
    }
  });

  if (!pingSupported) {
    retryBtn.classList.add('hidden');
  }

  actions.appendChild(retryBtn);
  panel.appendChild(actions);
}

function toggleConnectionPanel() {
  const panel = document.getElementById('connection-panel');
  if (!panel) return;

  const willShow = panel.classList.contains('hidden');
  if (willShow) {
    renderConnectionPanel();
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
  }
}

function schedulePingIfIdle() {
  setTimeout(async () => {
    const recent = requestTimings.some(timing => Date.now() - timing.at < 300);
    if (recent) {
      renderConnectionFromTimings();
      return;
    }

    const ms = await pingServer();
    if (ms === null) {
      renderConnectionFromTimings();
    } else {
      renderConnection({ mode: 'ok', ms, stale: BMExt.cacheState(cacheTimestamp) === 'old' });
    }
  }, 300);
}

let duplicateCheckSeq = 0;

function setDuplicateHint(bookmark) {
  const hint = document.getElementById('duplicate-hint');
  if (!hint) return;

  if (!bookmark) {
    hint.classList.add('hidden');
    hint.textContent = '';
    return;
  }

  hint.textContent = '';

  const text = document.createElement('span');
  text.textContent = `${BMExt.buildDuplicateHint(bookmark)} · `;

  const link = document.createElement('a');
  link.href = bookmark.url;
  link.textContent = '打开';
  link.addEventListener('click', (event) => {
    event.preventDefault();
    chrome.tabs.create({ url: bookmark.url });
    window.close();
  });

  hint.append(text, link);
  hint.classList.remove('hidden');
}

async function checkDuplicateUrl(url) {
  const targetUrl = (url || '').trim();
  if (!targetUrl) {
    setDuplicateHint(null);
    return;
  }

  const seq = ++duplicateCheckSeq;

  try {
    if (!appSettings.serverUrl || !appSettings.authToken) {
      setDuplicateHint(null);
      return;
    }

    const response = await apiFetch(
      `/api/bookmarks?url=${encodeURIComponent(targetUrl)}`,
      { label: '查重' }
    );

    if (seq !== duplicateCheckSeq) return;
    if (!response.ok) {
      setDuplicateHint(null);
      return;
    }

    const result = await response.json();
    if (seq !== duplicateCheckSeq) return;

    // 旧版后端会忽略 url 参数并返回全量列表，此时不能据此判断重复
    if (result.exactUrl !== true) {
      setDuplicateHint(null);
      return;
    }

    const existing = (result.data || [])[0];
    if (!existing) {
      setDuplicateHint(null);
      return;
    }

    setDuplicateHint(existing);
  } catch (error) {
    if (seq === duplicateCheckSeq) {
      setDuplicateHint(null);
    }
  }
}


function sortCategories(cats) {
  return cats.sort((a, b) => {
    const depth = c => {
      if (!c || !c.path) return 0;
      return c.path.split(' / ').length - 1;
    };
    const depthA = depth(a);
    const depthB = depth(b);
    if (depthA !== depthB) {
      return depthA - depthB;
    }
    const pathA = a?.path || a?.name || '';
    const pathB = b?.path || b?.name || '';
    return pathA.localeCompare(pathB, 'zh-CN');
  });
}

function renderCategoryOptions(cats, keyword = '') {
  const optionsContainer = document.querySelector('.select-options');
  if (!optionsContainer) return;
  
  optionsContainer.innerHTML = '';
  
  const filtered = keyword 
    ? cats.filter(cat => {
        const path = cat?.path || cat?.name || '';
        return path.toLowerCase().includes(keyword.toLowerCase());
      })
    : cats;
  
  if (filtered.length === 0) {
    optionsContainer.innerHTML = '<div class="select-no-results">无匹配分类</div>';
    return;
  }
  
  filtered.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'select-option';
    div.dataset.value = String(cat.id);
    const displayPath = cat?.path || cat?.name || '未命名分类';
    div.textContent = displayPath;
    
    const depth = displayPath.split(' / ').length - 1;
    div.style.paddingLeft = '12px';
    
    if (depth > 0) {
      div.classList.add('is-child');
    }
    
    div.addEventListener('click', () => selectCategory(cat.id, displayPath));
    optionsContainer.appendChild(div);
  });
}

function selectCategory(id, path) {
  const input = document.getElementById('category-input');
  const suggestions = document.getElementById('category-suggestions');
  
  if (input) {
    input.value = path;
    input.dataset.selectedId = id;
  }
  hideCategorySuggestions();
}

function showCategorySuggestions() {
  const suggestions = document.getElementById('category-suggestions');
  if (suggestions) suggestions.classList.remove('hidden');
}

function hideCategorySuggestions() {
  const suggestions = document.getElementById('category-suggestions');
  if (suggestions) suggestions.classList.add('hidden');
}

function renderCategorySuggestions(query = '') {
  const suggestions = document.getElementById('category-suggestions');
  if (!suggestions) return;
  
  const queryLower = query.toLowerCase();
  const filtered = categories.filter(cat => {
    const path = cat?.path || cat?.name || '';
    return !query || path.toLowerCase().includes(queryLower);
  });
  
  if (filtered.length === 0) {
    suggestions.innerHTML = '<div class="suggestion-no-results">无匹配分类</div>';
    showCategorySuggestions();
    return;
  }
  
  suggestions.innerHTML = filtered.map(cat => {
    const displayPath = cat?.path || cat?.name || '未命名分类';
    return `<div class="category-suggestion" data-id="${cat.id}" data-path="${displayPath}">${displayPath}</div>`;
  }).join('');
  
  suggestions.querySelectorAll('.category-suggestion').forEach(el => {
    el.addEventListener('click', () => {
      selectCategory(el.dataset.id, el.dataset.path);
      const input = document.getElementById('category-input');
      if (input) input.value = el.dataset.path;
    });
  });
  
  fitSuggestionDropdown(document.getElementById('category-input'), suggestions);
  showCategorySuggestions();
}

function addTag(tag) {
  const trimmed = tag.trim();
  if (trimmed && !tagItems.includes(trimmed)) {
    tagItems.push(trimmed);
    renderTags();
  }
}

function removeTag(index) {
  tagItems.splice(index, 1);
  renderTags();
}

function renderTags() {
  const tagsList = document.getElementById('tags-list');
  if (!tagsList) return;
  
  tagsList.innerHTML = '';
  tagItems.forEach((tag, index) => {
    const span = document.createElement('span');
    span.className = 'tag-item';
    span.innerHTML = `${tag}<button type="button" class="tag-remove" data-index="${index}">×</button>`;
    tagsList.appendChild(span);
  });
  
  document.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeTag(parseInt(btn.dataset.index, 10));
    });
  });
}

function handleTagInputKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const input = e.target;
    const value = input.value.trim();
    if (value) {
      addTag(value);
      input.value = '';
    }
    hideTagSuggestions();
  } else if (e.key === 'Escape') {
    hideTagSuggestions();
  }
}

function showTagSuggestions() {
  const suggestions = document.getElementById('tags-suggestions');
  if (suggestions) {
    suggestions.classList.remove('hidden');
  }
}

function hideTagSuggestions() {
  const suggestions = document.getElementById('tags-suggestions');
  if (suggestions) {
    suggestions.classList.add('hidden');
  }
}

function fitSuggestionDropdown(triggerEl, dropdownEl) {
  if (!triggerEl || !dropdownEl) return;
  const triggerRect = triggerEl.getBoundingClientRect();
  const popupHeight = window.innerHeight;
  const popupWidth = window.innerWidth;
  const spaceBelow = popupHeight - triggerRect.bottom - 4;
  const maxHeight = Math.min(Math.max(spaceBelow, 60), 200);
  dropdownEl.style.position = 'fixed';
  dropdownEl.style.top = (triggerRect.bottom + 4) + 'px';
  dropdownEl.style.left = triggerRect.left + 'px';
  dropdownEl.style.width = triggerRect.width + 'px';
  dropdownEl.style.maxHeight = maxHeight + 'px';
}

function renderTagSuggestions(query = '') {
  const suggestions = document.getElementById('tags-suggestions');
  if (!suggestions) return;
  
  const queryLower = query.toLowerCase();
  const availableTags = allTags.filter(tag => 
    !tagItems.includes(tag) && 
    (!query || tag.toLowerCase().includes(queryLower))
  );
  
  if (availableTags.length === 0) {
    suggestions.innerHTML = '';
    hideTagSuggestions();
    return;
  }
  
  suggestions.innerHTML = availableTags.map(tag => 
    `<div class="tag-suggestion" data-tag="${tag}">${tag}</div>`
  ).join('');
  
  fitSuggestionDropdown(document.querySelector('.tags-input-container'), suggestions);
  
  suggestions.querySelectorAll('.tag-suggestion').forEach(el => {
    el.addEventListener('click', () => {
      addTag(el.dataset.tag);
      const input = document.getElementById('tags-input');
      if (input) input.value = '';
      hideTagSuggestions();
    });
  });
  
  showTagSuggestions();
}

function openSelectDropdown() {
  const dropdown = document.querySelector('.select-dropdown');
  const searchInput = document.querySelector('.select-search');
  
  if (!dropdown || !searchInput) {
    console.error('Dropdown or search input not found');
    return;
  }
  
  dropdown.classList.remove('hidden');
  searchInput.focus();
  renderCategoryOptions(categories);
}

function closeSelectDropdown() {
  const dropdown = document.querySelector('.select-dropdown');
  const searchInput = document.querySelector('.select-search');
  
  dropdown.classList.add('hidden');
  searchInput.value = '';
}

function toggleSelectDropdown() {
  const dropdown = document.querySelector('.select-dropdown');
  if (!dropdown) {
    console.error('Dropdown element not found');
    return;
  }
  if (dropdown.classList.contains('hidden')) {
    openSelectDropdown();
  } else {
    closeSelectDropdown();
  }
}

function initSelectDropdown() {
  const trigger = document.querySelector('.select-trigger');
  const searchInput = document.querySelector('.select-search');
  
  if (!trigger || !searchInput) {
    console.error('Select trigger or search input not found');
    return;
  }
  
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSelectDropdown();
  });
  
  searchInput.addEventListener('input', (e) => {
    renderCategoryOptions(categories, e.target.value);
  });
  
  searchInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  document.addEventListener('click', (e) => {
    const select = document.querySelector('.searchable-select');
    if (!select || !select.contains(e.target)) {
      closeSelectDropdown();
    }
  });
}

function buildCategoriesFromRows(rawCategories) {
  const categoryMap = new Map();
  rawCategories.forEach(cat => {
    categoryMap.set(cat.id, { ...cat });
  });

  const withPaths = rawCategories.map(cat => {
    const base = categoryMap.get(cat.id);
    const segments = [];
    const visited = new Set();
    let current = base;

    while (current) {
      if (visited.has(current.id)) {
        console.warn('Circular reference detected in category:', cat.id);
        break;
      }
      visited.add(current.id);
      segments.unshift(current.name || '未命名');
      if (!current.parent_id) {
        break;
      }
      current = categoryMap.get(current.parent_id);
    }

    return {
      ...base,
      path: segments.join(' / ')
    };
  });

  return sortCategories(withPaths);
}

async function refreshCategories() {
  if (inFlight.categories) return inFlight.categories;

  inFlight.categories = (async () => {
    try {
      const response = await apiFetch('/api/categories', { label: '分类' });
      if (!response.ok) {
        throw new Error(`Failed to load categories (${response.status})`);
      }

      const result = await response.json();
      categories = buildCategoriesFromRows(result.data || []);
      setCategoryLoading(false);
      await writeCache();
      renderConnectionFromTimings();
      return true;
    } catch (error) {
      if (error.kind !== 'unauthorized') {
        console.error('Failed to load categories:', error);
        renderConnection({ mode: 'error', label: '分类加载失败', retry: refreshCategories });
      }
      return false;
    } finally {
      inFlight.categories = null;
    }
  })();

  return inFlight.categories;
}

async function refreshTags() {
  if (inFlight.tags) return inFlight.tags;

  inFlight.tags = (async () => {
    try {
      const response = await apiFetch('/api/bookmarks?limit=1000', { label: '标签' });
      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      const bookmarks = result.data || [];

      const tagSet = new Set();
      bookmarks.forEach(bm => {
        if (bm.tags) {
          bm.tags.split(',').forEach(tag => {
            const trimmed = tag.trim();
            if (trimmed) {
              tagSet.add(trimmed);
            }
          });
        }
      });

      allTags = Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'zh-CN'));
      await writeCache();
      renderConnectionFromTimings();
      return true;
    } catch (error) {
      if (error.kind !== 'unauthorized') {
        console.error('Failed to load tags:', error);
      }
      return false;
    } finally {
      inFlight.tags = null;
    }
  })();

  return inFlight.tags;
}

async function refreshLegacyData() {
  const [categoriesOk] = await Promise.all([refreshCategories(), refreshTags()]);
  return categoriesOk;
}

function applyBootstrap(payload) {
  categories = sortCategories(payload.categories || []);
  allTags = payload.tags || [];
  categoriesLoaded = true;
  setCategoryLoading(false);
  writeCache();
  renderConnectionFromTimings();
}

async function refreshBootstrap() {
  if (inFlight.bootstrap) return inFlight.bootstrap;

  inFlight.bootstrap = (async () => {
    try {
      const response = await apiFetch('/api/bootstrap', { label: '分类标签' });

      // 老版本后端还没有该路由：回退到两次请求
      if (response.status === 404 || response.status === 405) {
        return refreshLegacyData();
      }

      if (!response.ok) {
        throw new Error(`Failed to load bootstrap (${response.status})`);
      }

      const payload = await response.json();
      applyBootstrap(payload);
      return true;
    } catch (error) {
      if (error.kind === 'unauthorized') {
        return false;
      }

      console.error('Failed to load bootstrap:', error);
      renderConnection({ mode: 'error', label: '加载失败', retry: refreshBootstrap });
      return false;
    } finally {
      inFlight.bootstrap = null;
    }
  })();

  return inFlight.bootstrap;
}

async function getCurrentTab() {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      resolve(tabs && tabs.length ? tabs[0] : null);
    });
  });
}

async function maybeUseContextInfo() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'request-context-info' }, info => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(info || null);
    });
  });
}

async function generateDescription() {
  const titleEl = document.getElementById('title');
  const urlEl = document.getElementById('url');
  const descEl = document.getElementById('description');
  const aiBtn = document.getElementById('ai-btn');

  if (!titleEl.value || !urlEl.value) {
    showToast('请先填写标题和URL', 'error');
    return;
  }

  aiBtn.disabled = true;
  aiBtn.innerHTML = '<span>⏳ 生成中...</span>';

  try {
    const pageMeta = await fetchPageMetadata(urlEl.value)

    const response = await apiFetch('/api/ai/generate-description', {
      method: 'POST',
      label: 'AI',
      body: {
        name: titleEl.value,
        url: urlEl.value,
        pageMeta
      }
    });

    const result = await response.json();

    if (result.success && result.description) {
      descEl.value = result.description
      showToast('✅ AI描述生成成功', 'success');
    } else {
      showToast(result.error || 'AI描述生成失败', 'error');
    }
  } catch (error) {
    console.error('AI generate error:', error);
    if (error.kind !== 'unauthorized') {
      showToast(error.kind === 'timeout' ? 'AI生成超时，请重试' : 'AI功能暂时不可用', 'error');
    }
  } finally {
    aiBtn.disabled = false;
    aiBtn.innerHTML = '<span>🤖 AI生成描述</span>';
  }
}

async function suggestCategory() {
  const titleEl = document.getElementById('title');
  const urlEl = document.getElementById('url');
  const descEl = document.getElementById('description');
  const aiCategoryBtn = document.getElementById('ai-category-btn');

  if (!titleEl.value || !urlEl.value) {
    showToast('请先填写标题和URL', 'error');
    return;
  }

  if (categories.length === 0) {
    showToast('没有可用的分类', 'error');
    return;
  }

  aiCategoryBtn.disabled = true;
  aiCategoryBtn.innerHTML = '<span>⏳ 推荐中...</span>';

  try {
    const pageMeta = await fetchPageMetadata(urlEl.value)
    const descriptionToSend = pageMeta ? (pageMeta.metaDescription || pageMeta.ogDescription) : descEl.value

    const response = await apiFetch('/api/ai/suggest-category', {
      method: 'POST',
      label: 'AI',
      body: {
        name: titleEl.value,
        url: urlEl.value,
        description: descriptionToSend || '',
        categories: categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          path: cat.path
        })),
        tags: tagItems.join(','),
        notes: document.getElementById('notes')?.value || ''
      }
    });

    const result = await response.json();

    if (result.success && result.categoryId !== undefined && result.categoryId !== null) {
      const categoryId = String(result.categoryId);
      const matchedCategory = categories.find(cat => String(cat.id) === categoryId);

      if (matchedCategory) {
        selectCategory(matchedCategory.id, matchedCategory.path)
        const reason = result.reason ? `（${result.reason}）` : ''
        showToast(`✅ 推荐分类：${matchedCategory.path}${reason}`, 'success');
      } else {
        showToast('AI推荐的分类不存在，请刷新分类后重试', 'error');
      }
    } else {
      showToast(result.error || 'AI推荐分类失败', 'error');
    }
  } catch (error) {
    console.error('AI suggest category error:', error);
    if (error.kind !== 'unauthorized') {
      showToast(error.kind === 'timeout' ? 'AI推荐超时，请重试' : 'AI功能暂时不可用', 'error');
    }
  } finally {
    aiCategoryBtn.disabled = false;
    aiCategoryBtn.innerHTML = '<span>🏷️ AI推荐分类</span>';
  }
}

async function saveBookmark(event) {
  event.preventDefault();

  const title = document.getElementById('title').value.trim();
  const url = document.getElementById('url').value.trim();
  const description = document.getElementById('description').value.trim();
  const categoryInput = document.getElementById('category-input');
  const categoryId = categoryInput?.dataset?.selectedId || '';
  const isPrivate = document.getElementById('is-private').checked;

  if (!title || !url || !categoryId) {
    showToast('请填写所有必填项', 'error');
    return;
  }

  const saveBtn = document.getElementById('save-btn');
  const saveText = document.getElementById('save-text');
  saveBtn.disabled = true;
  saveText.textContent = '保存中...';

  try {
    const response = await apiFetch('/api/bookmarks', {
      method: 'POST',
      timeout: 10000,
      label: '保存',
      body: {
        name: title,
        url: url,
        description: description || null,
        icon: null,
        category_id: parseInt(categoryId, 10),
        is_private: isPrivate,
        tags: tagItems.join(',')
      }
    });

    const result = await response.json();

    if (result.success) {
      showToast('✅ 书签保存成功', 'success');
      // 通知 background 刷新预取缓存
      try {
        chrome.runtime.sendMessage({ type: 'data-changed' });
      } catch (e) {
        // background 不可用时忽略
      }
      // 保留 1 秒，让用户看清成功提示
      setTimeout(() => {
        window.close();
      }, 1000);
    } else if (response.status === 409 && result.duplicate) {
      // 处理重复 URL 的情况：内联提示 + 恢复按钮，不关窗
      setDuplicateHint(result.existingBookmark || { url });
      saveBtn.disabled = false;
      saveText.textContent = '保存书签';
    } else {
      showToast(result.error || '保存失败', 'error');
      saveBtn.disabled = false;
      saveText.textContent = '保存书签';
    }
  } catch (error) {
    if (error.kind !== 'unauthorized') {
      console.error('Save error:', error);
      showToast(error.kind === 'timeout' ? '连接超时，请重试' : '网络错误，请检查服务器地址', 'error');
    }
    saveBtn.disabled = false;
    saveText.textContent = '保存书签';
  }
}

async function init() {
  await loadSettings();

  if (!appSettings.serverUrl || !appSettings.authToken) {
    showSection('auth-section');
    renderConnection({ mode: 'offline' });
    return;
  }

  const tokenExpired = appSettings.tokenExpiry > 0 && Date.now() > appSettings.tokenExpiry;
  if (tokenExpired && !appSettings.autoRenew) {
    // 清掉已过期 token，避免后续请求带着它撞 401
    await storageRemove('local', ['authToken', 'tokenExpiry']);
    appSettings.authToken = '';
    appSettings.tokenExpiry = 0;
    showSection('auth-section');
    renderConnection({ mode: 'offline', label: '登录已过期' });
    return;
  }

  const cache = await loadPrefetchCache();

  showSection('form-section');
  setCategoryLoading(categories.length === 0);

  if (!cache || BMExt.cacheState(cacheTimestamp) !== 'fresh') {
    // 后台刷新，不阻塞表单渲染
    refreshBootstrap();
  }

  getTabInfo();
  schedulePingIfIdle();
}

async function getTabInfo() {
  if (formDirty) return;

  const contextInfo = await maybeUseContextInfo();
  const tab = contextInfo || await getCurrentTab();
  if (!tab || formDirty) return;

  const titleEl = document.getElementById('title');
  if (titleEl && !titleEl.value) {
    titleEl.value = tab.title || '';
  }

  const urlEl = document.getElementById('url');
  if (urlEl && !urlEl.value) {
    urlEl.value = tab.url || '';
  }

  checkDuplicateUrl(document.getElementById('url')?.value || '')

  // 抓取页面元数据自动填充描述（不覆盖用户已输入的内容）
  fetchPageMetadata(tab?.url).then(pageMeta => {
    const descEl = document.getElementById('description')
    if (!descEl || formDirty || descEl.value.trim()) return

    if (pageMeta && (pageMeta.metaDescription || pageMeta.ogDescription)) {
      descEl.value = pageMeta.metaDescription || pageMeta.ogDescription
    }
  })
}

// 供 chrome.scripting.executeScript 按需注入，函数必须自包含
function readPageMetadataInPage() {
  try {
    const metaContent = (selector) => document.querySelector(selector)?.content || ''
    const segments = location.pathname.split('/').filter(Boolean)

    const stripUrlSuffix = (text) => {
      if (!text) return ''
      if (segments.length >= 2) {
        const suffix = ` - ${segments[0]}/${segments[1]}`
        if (text.endsWith(suffix)) {
          return text.slice(0, -suffix.length).trim()
        }
      }
      return text
    }

    return {
      title: document.title || '',
      metaDescription: stripUrlSuffix(metaContent('meta[name="description"]')),
      ogDescription: stripUrlSuffix(metaContent('meta[property="og:description"]')),
      h1: document.querySelector('h1')?.textContent?.trim() || '',
      keywords: metaContent('meta[name="keywords"]')
    }
  } catch (e) {
    return null
  }
}

/**
 * 从当前标签页抓取页面元数据（title, meta description, OG description, h1, keywords）
 * 用于增强 AI 生成描述和推荐分类的上下文
 */
async function fetchPageMetadata(tabUrl) {
  if (!tabUrl) return null
  if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('edge://') || tabUrl.startsWith('about:')) {
    return null
  }

  try {
    const tab = await getCurrentTab()
    if (!tab || !tab.id) return null

    const fromContentScript = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { type: 'get-page-metadata' }, (response) => {
        resolve(chrome.runtime.lastError ? null : response || null)
      })
    })
    if (fromContentScript) return fromContentScript

    // 扩展更新前已打开的页面没有 content script，按需注入读取，无需刷新
    if (chrome.scripting?.executeScript) {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: readPageMetadataInPage
      })
      return injection?.result || null
    }
  } catch (error) {
    console.error('Failed to fetch page metadata:', error)
    return null
  }

  return null
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  
  document.getElementById('goto-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  document.getElementById('bookmark-form').addEventListener('submit', saveBookmark);

  const urlInput = document.getElementById('url');
  urlInput.addEventListener('input', () => {
    duplicateCheckSeq++;
    setDuplicateHint(null);
  });
  urlInput.addEventListener('blur', () => {
    checkDuplicateUrl(urlInput.value);
  });
  
  document.getElementById('ai-btn').addEventListener('click', generateDescription);
  
  document.getElementById('ai-category-btn').addEventListener('click', suggestCategory);
  
  const tagsInput = document.getElementById('tags-input');
  tagsInput.addEventListener('keydown', handleTagInputKeydown);
  tagsInput.addEventListener('input', (e) => {
    const value = e.target.value;
    if (value.trim()) {
      renderTagSuggestions(value);
    } else {
      renderTagSuggestions();
    }
  });
  tagsInput.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (allTags.length > 0) {
      renderTagSuggestions();
    }
    tagsInput.focus();
  });
  tagsInput.addEventListener('blur', () => {
    setTimeout(hideTagSuggestions, 300);
  });
  tagsInput.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (allTags.length > 0) {
      renderTagSuggestions();
    }
    tagsInput.focus();
  });
  
  const categoryInput = document.getElementById('category-input');
  categoryInput.addEventListener('input', (e) => {
    renderCategorySuggestions(e.target.value);
  });
  categoryInput.addEventListener('blur', () => {
    setTimeout(hideCategorySuggestions, 300);
  });
  categoryInput.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (categories.length > 0) {
      renderCategorySuggestions();
    }
    categoryInput.focus();
  });

  ['title', 'url', 'description', 'category-input', 'tags-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', markFormDirty);
  });

  const privateInput = document.getElementById('is-private');
  if (privateInput) privateInput.addEventListener('change', markFormDirty);

  const detailBtn = document.getElementById('connection-detail-btn');
  if (detailBtn) {
    detailBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleConnectionPanel();
    });
  }
});

document.addEventListener('click', (event) => {
  const panel = document.getElementById('connection-panel');
  const bar = document.getElementById('connection-bar');
  if (!panel || panel.classList.contains('hidden')) return;
  if (panel.contains(event.target) || (bar && bar.contains(event.target))) return;
  panel.classList.add('hidden');
});

document.addEventListener('mousedown', (e) => {
  const tagsInput = document.getElementById('tags-input');
  const tagsSuggestions = document.getElementById('tags-suggestions');
  const categoryInput = document.getElementById('category-input');
  const categorySuggestions = document.getElementById('category-suggestions');
  
  if (tagsInput && !tagsInput.contains(e.target) && tagsSuggestions && !tagsSuggestions.contains(e.target)) {
    hideTagSuggestions();
  }
  if (categoryInput && !categoryInput.contains(e.target) && categorySuggestions && !categorySuggestions.contains(e.target)) {
    hideCategorySuggestions();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  // 换服务器地址需要重建整个弹窗状态（含缓存隔离）
  if (changes.serverUrl) {
    pingSupported = true;
    requestTimings.length = 0;
    init();
    return;
  }

  // options 页登录成功后同步 token，不必重建
  if (changes.authToken && changes.authToken.newValue) {
    appSettings.authToken = changes.authToken.newValue;
    appSettings.tokenExpiry = BMExt.parseTokenExpiry(changes.authToken.newValue) || appSettings.tokenExpiry;
  }
});
