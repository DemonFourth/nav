import { reactive } from 'vue'
import { useSettings } from './useSettings'

// 图标获取统一模块：
// - 所有界面（卡片/搜索/编辑弹窗/设置书签列表）共用一份"每个书签当前尝试的源"记忆
// - 某界面失败切换源后，其他界面直接使用记忆的源，不再各自从头遍历
// - 记忆持久化到 localStorage（key = bookmark.id，value = 源 id 或 null=已耗尽）
// - 自定义 icon 失效自动回退：记录"失败的自定义 icon URL"，失效时回退源链（方案 A）
// - 刷新戳：点击"重新获取"时更新，给源 URL 追加 ?t=<戳> 绕过浏览器缓存，真正重新请求

const STORAGE_KEY = 'bookmarkIconSourceMemory'
const BROKEN_KEY = 'bookmarkCustomIconBroken'
const REFRESH_KEY = 'bookmarkIconRefreshStamp'

const { iconSources, parseIconSourceUrl } = useSettings()

const iconMemory = reactive(loadMemory())
const customIconBroken = reactive(loadBrokenMemory())
const iconRefresh = reactive(loadRefreshMemory())

function loadMemory() {
  const map = new Map()
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    for (const [key, value] of Object.entries(raw)) {
      if (value !== null && value !== undefined) {
        map.set(key, value)
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return map
}

function loadBrokenMemory() {
  const map = new Map()
  try {
    const raw = JSON.parse(localStorage.getItem(BROKEN_KEY) || '{}')
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string' && value) {
        map.set(key, value)
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return map
}

function loadRefreshMemory() {
  const map = new Map()
  try {
    const raw = JSON.parse(localStorage.getItem(REFRESH_KEY) || '{}')
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'number' && value) {
        map.set(key, value)
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return map
}

function persistRefresh() {
  try {
    const obj = {}
    for (const [key, value] of iconRefresh) {
      if (typeof value === 'number') {
        obj[key] = value
      }
    }
    localStorage.setItem(REFRESH_KEY, JSON.stringify(obj))
  } catch {
    // storage unavailable
  }
}

function persist() {
  try {
    const obj = {}
    for (const [key, value] of iconMemory) {
      if (value !== undefined && value !== null) {
        obj[key] = value
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  } catch {
    // storage unavailable
  }
}

function persistBroken() {
  try {
    const obj = {}
    for (const [key, value] of customIconBroken) {
      if (typeof value === 'string' && value) {
        obj[key] = value
      }
    }
    localStorage.setItem(BROKEN_KEY, JSON.stringify(obj))
  } catch {
    // storage unavailable
  }
}

function getKey(bookmark) {
  return bookmark && bookmark.id != null ? String(bookmark.id) : ''
}

function getSources(bookmark) {
  if (!bookmark || !bookmark.url) return []
  try {
    return iconSources.value
      .filter(s => s.enabled)
      .map(s => ({ id: s.id, url: parseIconSourceUrl(s.url, bookmark.url) }))
      .filter(s => s.url)
  } catch {
    return []
  }
}

function getState(key) {
  if (!iconMemory.has(key)) {
    iconMemory.set(key, undefined)
  }
  return iconMemory.get(key)
}

function withRefresh(url, key) {
  const stamp = key ? iconRefresh.get(key) : undefined
  if (!stamp) return url
  return url.includes('?') ? url + '&t=' + stamp : url + '?t=' + stamp
}

export function getIconUrl(bookmark) {
  if (!bookmark) return ''

  const key = getKey(bookmark)
  if (bookmark.icon && bookmark.icon.trim()) {
    if (!key) return bookmark.icon
    if (customIconBroken.get(key) !== bookmark.icon) {
      return bookmark.icon
    }
    // 自定义 icon 已被标记失效 → 回退源链
  }

  const list = getSources(bookmark)
  if (list.length === 0) return ''

  if (!key) return list[0].url

  const remembered = getState(key)
  if (remembered === null) return '' // 已耗尽，回退字母图标

  let idx = 0
  if (remembered !== undefined) {
    const found = list.findIndex(s => s.id === remembered)
    idx = found >= 0 ? found : 0
  }
  return withRefresh(list[idx].url, key)
}

export function handleIconError(bookmark) {
  if (!bookmark || !bookmark.id) return

  const key = getKey(bookmark)
  const hasCustomIcon = !!(bookmark.icon && bookmark.icon.trim())
  if (hasCustomIcon && customIconBroken.get(key) !== bookmark.icon) {
    // 自定义 icon 加载失败 → 标记失效并回退源链（不改数据库）
    customIconBroken.set(key, bookmark.icon)
    persistBroken()
    return
  }

  const list = getSources(bookmark)
  if (list.length === 0) return

  const remembered = getState(key)
  let currentIdx = 0
  if (remembered !== undefined && remembered !== null) {
    const found = list.findIndex(s => s.id === remembered)
    currentIdx = found >= 0 ? found : 0
  }

  const next = currentIdx + 1
  iconMemory.set(key, next >= list.length ? null : list[next].id)
  persist()
}

export function resetIconMemory() {
  iconMemory.clear()
  customIconBroken.clear()
  iconRefresh.clear()
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(BROKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  } catch {
    // ignore
  }
}

export function resetBookmarkIconMemory(id) {
  if (id == null) return
  const key = String(id)
  iconMemory.delete(key)
  customIconBroken.delete(key)
  iconRefresh.delete(key)
  persist()
  persistBroken()
  persistRefresh()
}

export function refreshBookmarkIcon(id) {
  if (id == null) return
  const key = String(id)
  iconMemory.delete(key)
  customIconBroken.delete(key)
  iconRefresh.set(key, Date.now())
  persist()
  persistBroken()
  persistRefresh()
}
