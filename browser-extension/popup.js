const TOKEN_TTL = 15 * 60 * 1000;
const TOKEN_RENEW_THRESHOLD = 5 * 60 * 1000; // 剩余5分钟时自动续期
const CACHE_TTL = 5 * 60 * 1000; // 分类和标签缓存5分钟
let settings = {};
let categories = [];
let tagItems = [];
let allTags = [];

function storageGet(area, keys) {
  return new Promise(resolve => chrome.storage[area].get(keys, resolve));
}

function storageSet(area, items) {
  return new Promise(resolve => chrome.storage[area].set(items, resolve));
}

function storageRemove(area, keys) {
  return new Promise(resolve => chrome.storage[area].remove(keys, resolve));
}

async function savePrefetchCache() {
  const cacheData = {
    categories,
    tags: allTags,
    timestamp: Date.now()
  };
  // Chromium: 写入 session 存储（内存级）
  if (chrome.storage.session) {
    await chrome.storage.session.set({ prefetchCache: cacheData });
  }
  // Firefox fallback: 写入 local 存储
  await storageSet('local', { prefetchCache: cacheData });
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

  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    categories = cache.categories || [];
    allTags = cache.tags || [];
    return true;
  }
  return false;
}

function parseTokenExpiry(token) {
  try {
    const [timestamp] = token.split('.');
    const issuedAt = Number(timestamp);
    if (Number.isNaN(issuedAt)) return null;
    return issuedAt + TOKEN_TTL;
  } catch (error) {
    return null;
  }
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

// 检查 token 是否需要续期
function shouldRenewToken(tokenExpiry) {
  if (!tokenExpiry) return false;
  const remaining = tokenExpiry - Date.now();
  return remaining > 0 && remaining < TOKEN_RENEW_THRESHOLD;
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

    const expiry = parseTokenExpiry(result.token);
    await storageSet('local', {
      authToken: result.token,
      tokenExpiry: expiry
    });

    // 更新 settings 对象
    settings.authToken = result.token;
    settings.tokenExpiry = expiry;

    return true;
  } catch (error) {
    console.error('Auto renew token error:', error);
    return false;
  }
}

// 确保 token 有效（检查并自动续期）
async function ensureTokenValid() {
  if (!settings.authToken || !settings.tokenExpiry) {
    return false;
  }

  const now = Date.now();
  if (now > settings.tokenExpiry) {
    // Token 已过期，尝试自动续期
    return await autoRenewToken();
  }

  if (shouldRenewToken(settings.tokenExpiry)) {
    // Token 即将过期，自动续期
    return await autoRenewToken();
  }

  return true;
}

async function loadSettings() {
  const result = await storageGet('local', ['serverUrl', 'authToken', 'tokenExpiry', 'autoRenew']);
  let { serverUrl = '', authToken = '', tokenExpiry = 0, autoRenew = false } = result;

  if (authToken) {
    const expiry = tokenExpiry || parseTokenExpiry(authToken);
    if (!expiry || Date.now() > expiry) {
      // Token 已过期，如果启用了自动续期，尝试续期
      if (autoRenew) {
        const renewed = await autoRenewToken();
        if (renewed) {
          // 重新获取续期后的 token
          const { authToken: newToken, tokenExpiry: newExpiry } = await storageGet('local', ['authToken', 'tokenExpiry']);
          if (newToken && newExpiry && Date.now() < newExpiry) {
            authToken = newToken;
            tokenExpiry = newExpiry;
          } else {
            await storageRemove('local', ['authToken', 'tokenExpiry']);
            authToken = '';
            tokenExpiry = 0;
          }
        } else {
          await storageRemove('local', ['authToken', 'tokenExpiry']);
          authToken = '';
          tokenExpiry = 0;
        }
      } else {
        await storageRemove('local', ['authToken', 'tokenExpiry']);
        authToken = '';
        tokenExpiry = 0;
      }
    }
  }

  settings = { serverUrl, authToken, tokenExpiry, autoRenew };
  return settings;
}

function showSection(sectionId) {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('form-section').classList.add('hidden');
  document.getElementById('loading-section').classList.add('hidden');
  document.getElementById(sectionId).classList.remove('hidden');
}

function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('status-message');
  statusEl.textContent = message;
  statusEl.className = `status-message status-${type}`;
  statusEl.classList.remove('hidden');
  
  setTimeout(() => {
    statusEl.classList.add('hidden');
  }, 4000);
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

async function loadCategories() {
  try {
    await ensureTokenValid();
    
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    if (settings.authToken) {
      headers.set('Authorization', `Bearer ${settings.authToken}`);
    }

    const response = await fetch(`${settings.serverUrl}/api/categories`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        await storageRemove('local', ['authToken', 'tokenExpiry']);
        settings.authToken = '';
      }
      throw new Error('Failed to load categories');
    }
    
    const result = await response.json();
    const rawCategories = result.data || [];

    const categoryMap = new Map();
    rawCategories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat });
    });

    categories = rawCategories.map(cat => {
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
    
    categories = sortCategories(categories);
    
    return true;
  } catch (error) {
    console.error('Failed to load categories:', error);
    return false;
  }
}

async function loadTags() {
  try {
    await ensureTokenValid();
    
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    if (settings.authToken) {
      headers.set('Authorization', `Bearer ${settings.authToken}`);
    }

    const response = await fetch(`${settings.serverUrl}/api/bookmarks?limit=1000`, {
      method: 'GET',
      headers
    });
    
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
    
    allTags = Array.from(tagSet).sort();
    return true;
  } catch (error) {
    console.error('Failed to load tags:', error);
    return false;
  }
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
  await ensureTokenValid();

  const titleEl = document.getElementById('title');
  const urlEl = document.getElementById('url');
  const descEl = document.getElementById('description');
  const aiBtn = document.getElementById('ai-btn');

  if (!titleEl.value || !urlEl.value) {
    showStatus('请先填写标题和URL', 'error');
    return;
  }

  aiBtn.disabled = true;
  aiBtn.innerHTML = '<span>⏳ 生成中...</span>';

  try {
    const pageMeta = await fetchPageMetadata(urlEl.value)
    const descriptionToSend = pageMeta ? (pageMeta.metaDescription || pageMeta.ogDescription) : descEl.value

    const response = await fetch(`${settings.serverUrl}/api/ai/generate-description`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.authToken}`
      },
      body: JSON.stringify({
        name: titleEl.value,
        url: urlEl.value,
        pageMeta
      })
    });

    const result = await response.json();

    if (result.success && result.description) {
      descEl.value = result.description
      showStatus('✅ AI描述生成成功', 'success');
    } else {
      showStatus(result.error || 'AI描述生成失败', 'error');
    }
  } catch (error) {
    console.error('AI generate error:', error);
    showStatus('AI功能暂时不可用', 'error');
  } finally {
    aiBtn.disabled = false;
    aiBtn.innerHTML = '<span>🤖 AI生成描述</span>';
  }
}

async function suggestCategory() {
  await ensureTokenValid();

  const titleEl = document.getElementById('title');
  const urlEl = document.getElementById('url');
  const descEl = document.getElementById('description');
  const categoryEl = document.getElementById('category');
  const aiCategoryBtn = document.getElementById('ai-category-btn');

  if (!titleEl.value || !urlEl.value) {
    showStatus('请先填写标题和URL', 'error');
    return;
  }

  if (categories.length === 0) {
    showStatus('没有可用的分类', 'error');
    return;
  }

  aiCategoryBtn.disabled = true;
  aiCategoryBtn.innerHTML = '<span>⏳ 推荐中...</span>';

  try {
    const pageMeta = await fetchPageMetadata(urlEl.value)
    const descriptionToSend = pageMeta ? (pageMeta.metaDescription || pageMeta.ogDescription) : descEl.value

    const response = await fetch(`${settings.serverUrl}/api/ai/suggest-category`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.authToken}`
      },
      body: JSON.stringify({
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
      })
    });

    const result = await response.json();

    if (result.success && result.categoryId !== undefined && result.categoryId !== null) {
      const categoryId = String(result.categoryId);
      const matchedCategory = categories.find(cat => String(cat.id) === categoryId);

      if (matchedCategory) {
        selectCategory(matchedCategory.id, matchedCategory.path)
        const reason = result.reason ? `（${result.reason}）` : ''
        showStatus(`✅ 推荐分类：${matchedCategory.path}${reason}`, 'success');
      } else {
        showStatus('AI推荐的分类不存在，请刷新分类后重试', 'error');
      }
    } else {
      showStatus(result.error || 'AI推荐分类失败', 'error');
    }
  } catch (error) {
    console.error('AI suggest category error:', error);
    showStatus('AI功能暂时不可用', 'error');
  } finally {
    aiCategoryBtn.disabled = false;
    aiCategoryBtn.innerHTML = '<span>🏷️ AI推荐分类</span>';
  }
}

async function saveBookmark(event) {
  event.preventDefault();
  
  // 确保 token 有效
  await ensureTokenValid();
  
  const title = document.getElementById('title').value.trim();
  const url = document.getElementById('url').value.trim();
  const description = document.getElementById('description').value.trim();
  const categoryInput = document.getElementById('category-input');
  const categoryId = categoryInput?.dataset?.selectedId || '';
  const isPrivate = document.getElementById('is-private').checked;
  
  if (!title || !url || !categoryId) {
    showStatus('请填写所有必填项', 'error');
    return;
  }
  
  const saveBtn = document.getElementById('save-btn');
  const saveText = document.getElementById('save-text');
  saveBtn.disabled = true;
  saveText.textContent = '保存中...';
  
  try {
    const response = await fetch(`${settings.serverUrl}/api/bookmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.authToken}`
      },
      body: JSON.stringify({
        name: title,
        url: url,
        description: description || null,
        icon: null,
        category_id: parseInt(categoryId, 10),
        is_private: isPrivate,
        tags: tagItems.join(',')
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showStatus('✅ 书签保存成功', 'success');
      // 通知 background 刷新预取缓存
      try {
        chrome.runtime.sendMessage({ type: 'data-changed' });
      } catch (e) {
        // background 不可用时忽略
      }
      setTimeout(() => {
        window.close();
      }, 1000);
    } else if (response.status === 409 && result.duplicate) {
      // 处理重复 URL 的情况
      const categoryName = result.existingBookmark?.category_name || '未知分类';
      showStatus(`⚠️ 该 URL 已存在于"${categoryName}"分类中`, 'warning');
      saveBtn.disabled = false;
      saveText.textContent = '保存书签';
    } else {
      showStatus(result.error || '保存失败', 'error');
      saveBtn.disabled = false;
      saveText.textContent = '保存书签';
    }
  } catch (error) {
    console.error('Save error:', error);
    showStatus('网络错误，请检查服务器地址', 'error');
    saveBtn.disabled = false;
    saveText.textContent = '保存书签';
  }
}

async function init() {
  await loadSettings();
  
  if (!settings.serverUrl || !settings.authToken) {
    showSection('auth-section');
    return;
  }
  
  const cacheLoaded = await loadPrefetchCache();
  
  if (cacheLoaded) {
    showSection('form-section');
    getTabInfo();
    // 后台异步刷新保持最新
    Promise.all([loadCategories(), loadTags()]).then(() => {
      savePrefetchCache();
    });
  } else {
    showSection('loading-section');
    const [categoriesLoaded] = await Promise.all([loadCategories(), loadTags()]);
    if (!categoriesLoaded) {
      showSection('auth-section');
      return;
    }
    savePrefetchCache();
    getTabInfo();
    showSection('form-section');
  }
}

async function getTabInfo() {
  const contextInfo = await maybeUseContextInfo();
  const tab = contextInfo || await getCurrentTab();
  if (tab) {
    const titleEl = document.getElementById('title');
    if (titleEl && !titleEl.value) {
      titleEl.value = tab.title || '';
    }
    document.getElementById('url').value = tab.url || '';
  }

  // 抓取页面元数据用于 AI 功能
  fetchPageMetadata(tab?.url).then(pageMeta => {
    if (!pageMeta) return

    const descEl = document.getElementById('description')
    if (descEl && !descEl.value) {
      descEl.value = pageMeta.metaDescription || pageMeta.ogDescription || ''
    }
  })
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

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { type: 'get-page-metadata' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          resolve(null)
        } else {
          resolve(response)
        }
      })
    })
  } catch (error) {
    console.error('Failed to fetch page metadata:', error)
    return null
  }
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
  if (area === 'local' && (changes.serverUrl || changes.authToken)) {
    init();
  }
});
