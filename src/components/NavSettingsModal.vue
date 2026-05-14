<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="nav-settings-overlay" :class="{ 'slider-active': sliderActive }" @click="handleClose">
        <div class="nav-settings-modal" @click.stop>
          <div class="settings-header">
            <h2 class="settings-title">设置</h2>
            <button class="settings-close" @click="handleClose">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="settings-tabs">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="tab-btn"
              :class="{ active: activeTab === tab.id }"
              @click="activeTab = tab.id"
            >
              {{ tab.name }}
            </button>
          </div>

          <div class="settings-content">
            <div v-if="activeTab === 'appearance'" class="tab-panel">
              <div class="setting-group">
                <div class="setting-item">
                  <div class="setting-label">深色模式</div>
                  <div class="theme-selector">
                    <button
                      v-for="mode in themeModes"
                      :key="mode.value"
                      class="theme-btn"
                      :class="{ active: themeMode === mode.value }"
                      @click="setThemeMode(mode.value)"
                    >
                      {{ mode.label }}
                    </button>
                  </div>
                </div>

                <div class="setting-item">
                  <div class="setting-label">显示搜索</div>
                  <label class="toggle-switch">
                    <input type="checkbox" :checked="showSearch" @change="toggleSearch" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>

                <div class="setting-item">
                  <div class="setting-label">隐藏空分类</div>
                  <label class="toggle-switch">
                    <input type="checkbox" :checked="hideEmptyCategories" @change="toggleHideEmptyCategories" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>

                <div class="setting-item">
                  <div class="setting-label">公共模式</div>
                  <label class="toggle-switch">
                    <input type="checkbox" :checked="publicMode" @change="togglePublicMode" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>

<div class="setting-group">
                  <div class="group-header">壁纸设置</div>

                  <div class="setting-item">
                    <div class="setting-label">随机壁纸</div>
                    <label class="toggle-switch">
                      <input
                        type="checkbox"
                        :checked="randomWallpaper"
                        @change="handleRandomWallpaperToggle"
                      />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>

                  <div v-if="randomWallpaper" class="setting-item nested">
                    <div class="setting-label">壁纸 API</div>
                    <div class="history-input-wrap">
                      <input
                        type="text"
                        class="setting-input"
                        :value="wallpaperApi"
                        placeholder="输入壁纸 API 地址"
                        @change="e => updateWallpaperApi(e.target.value)"
                        @focus="showApiHistory = true"
                        @blur="onApiHistoryBlur"
                      />
                      <div v-if="showApiHistory && wallpaperApiHistory.length > 0" class="history-dropdown">
                        <div
                          v-for="(item, i) in wallpaperApiHistory"
                          :key="i"
                          class="history-item"
                          @mousedown.prevent="selectApiHistory(item)"
                        >
                          {{ item }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="setting-item">
                    <div class="setting-label">自定义壁纸</div>
                    <div class="history-input-wrap">
                      <input
                        type="text"
                        class="setting-input"
                        :value="randomWallpaper ? '' : navWallpaper"
                        placeholder="输入壁纸 URL"
                        :disabled="randomWallpaper"
                        @change="e => handleNavWallpaperChange(e.target.value)"
                        @focus="showWallpaperHistory = true"
                        @blur="onWallpaperHistoryBlur"
                      />
                      <div v-if="showWallpaperHistory && navWallpaperHistory.length > 0" class="history-dropdown">
                        <div
                          v-for="(item, i) in navWallpaperHistory"
                          :key="i"
                          class="history-item"
                          @mousedown.prevent="selectWallpaperHistory(item)"
                        >
                          {{ item }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="setting-item">
                  <div class="setting-label">导航卡片动画</div>
                  <label class="toggle-switch">
                    <input type="checkbox" :checked="navCardAnimation" @change="toggleNavCardAnimation" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>

                <div class="setting-group">
                  <div class="group-header">卡片外观</div>
                  <div class="setting-item blur-slider-item">
                    <div class="setting-label">毛玻璃</div>
                    <div class="blur-slider-container">
                      <input
                        type="range"
                        min="0"
                        max="20"
                        :value="navCardBlur"
                        @mousedown="sliderActive = true"
                        @touchstart="sliderActive = true"
                        @mouseup="sliderActive = false"
                        @touchend="sliderActive = false"
                        @mouseleave="sliderActive = false"
                        @input="e => setNavCardBlur(Number(e.target.value))"
                        class="blur-slider"
                      />
                      <span class="blur-value">{{ navCardBlur }}px</span>
                    </div>
                  </div>
                  <div class="setting-item blur-slider-item">
                    <div class="setting-label">透明度</div>
                    <div class="blur-slider-container">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        :value="navCardOpacity"
                        @mousedown="sliderActive = true"
                        @touchstart="sliderActive = true"
                        @mouseup="sliderActive = false"
                        @touchend="sliderActive = false"
                        @mouseleave="sliderActive = false"
                        @input="e => setNavCardOpacity(Number(e.target.value))"
                        class="blur-slider"
                      />
                      <span class="blur-value">{{ navCardOpacity }}%</span>
                    </div>
                  </div>
                </div>

                <div class="setting-item">
                  <div class="setting-label">自定义标题</div>
                  <input
                    type="text"
                    class="setting-input"
                    :value="customTitle"
                    placeholder="导航站"
                    @change="e => updateCustomTitle(e.target.value)"
                  />
                </div>

                <div class="setting-item">
                  <div class="setting-label">自定义页脚</div>
                  <textarea
                    class="setting-textarea"
                    :value="footerContent"
                    placeholder="输入页脚内容，支持 HTML"
                    rows="3"
                    @change="e => updateFooterContent(e.target.value)"
                  ></textarea>
                </div>

                <div class="setting-item">
                  <div class="setting-label">代理设置</div>
                  <input
                    type="text"
                    class="setting-input"
                    :value="proxyUrl"
                    placeholder="https://your-proxy.com/icon"
                    @change="e => updateProxyUrl(e.target.value)"
                  />
                </div>

                <div class="setting-group">
                  <div class="group-header">图标获取设置</div>
                  <div class="icon-test-controls">
                    <input
                      v-model="testDomain"
                      type="text"
                      placeholder="输入域名，如：google.com"
                      class="setting-input"
                      @keyup.enter="handleTestAll"
                    />
                    <button
                      class="btn-test-all"
                      @click="handleTestAll"
                      :disabled="isTesting || !testDomain.trim()"
                    >
                      {{ isTesting ? '测试中...' : '测试全部' }}
                    </button>
                  </div>
                  <div v-if="testResults.length > 0" class="test-results">
                    <table class="test-table">
                      <thead>
                        <tr>
                          <th>图标源</th>
                          <th>直连</th>
                          <th v-if="proxyUrl">代理</th>
                          <th>URL</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="result in testResults" :key="result.id">
                          <td class="source-name-cell">
                            {{ result.name }}
                            <span v-if="!result.enabled" class="status-disabled">(未启用)</span>
                          </td>
                          <td>
                            <span v-if="!result.enabled" class="status-disabled">⊘</span>
                            <span v-else-if="result.direct.loading" class="status-loading">⟳</span>
                            <span v-else-if="result.direct.success" class="status-success">✓ {{ result.direct.size }} {{ result.direct.duration }}ms</span>
                            <span v-else class="status-error">✗ {{ result.direct.error }}</span>
                          </td>
                          <td v-if="proxyUrl">
                            <span v-if="result.proxy.loading" class="status-loading">⟳</span>
                            <span v-else-if="result.proxy.success" class="status-success">✓ {{ result.proxy.size }} {{ result.proxy.duration }}ms</span>
                            <span v-else-if="result.proxy.testedUrl" class="status-error">✗ {{ result.proxy.error }}</span>
                            <span v-else class="status-disabled">-</span>
                          </td>
                          <td class="url-cell">{{ result.direct.testedUrl }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="setting-item">
                  <div class="setting-label">头像</div>
                  <div class="avatar-setting">
                    <div class="avatar-preview" @click="triggerAvatarUpload">
                      <img v-if="avatarUrl" :src="avatarUrl" alt="avatar" />
                      <div v-else class="avatar-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                      </div>
                    </div>
                    <input
                      ref="avatarInput"
                      type="file"
                      accept="image/*"
                      style="display: none"
                      @change="handleAvatarChange"
                    />
                    <button v-if="avatarUrl" class="btn-text" @click="clearAvatar">移除</button>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="activeTab === 'data'" class="tab-panel">
              <div class="setting-group">
                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-label">导入/导出</div>
                    <div class="setting-desc">备份或恢复您的书签数据</div>
                  </div>
                  <button class="btn-action" @click="$emit('action', 'importExport')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    管理
                  </button>
                </div>

                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-label">云备份</div>
                    <div class="setting-desc">将数据备份到云端</div>
                  </div>
                  <button class="btn-action" @click="$emit('action', 'backup')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                    备份
                  </button>
                </div>

                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-label">清空空分类</div>
                    <div class="setting-desc">当前有 {{ emptyCategoryCount }} 个空分类</div>
                  </div>
                  <button
                    class="btn-action danger"
                    :disabled="emptyCategoryCount === 0"
                    @click="$emit('action', 'cleanup')"
                  >
                    清理
                  </button>
                </div>
              </div>

              <div class="stats-card">
                <div class="stats-title">书签统计</div>
                <div class="stats-grid">
                  <div class="stat-item">
                    <div class="stat-value">{{ totalBookmarks }}</div>
                    <div class="stat-label">总书签</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-value">{{ privateBookmarks }}</div>
                    <div class="stat-label">私密</div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="activeTab === 'ai'" class="tab-panel">
              <div class="ai-status" :class="{ enabled: aiEnabled }">
                <div class="status-indicator"></div>
                <span>{{ aiEnabled ? 'AI 功能已启用' : 'AI 功能未配置' }}</span>
              </div>

              <div v-if="isAuthenticated" class="ai-config-section">
                <div class="setting-item">
                  <div class="setting-label">API 密钥</div>
                  <div class="api-key-input-wrapper">
                    <input
                      v-model="localApiKey"
                      :type="showApiKey ? 'text' : 'password'"
                      placeholder="sk-..."
                      class="setting-input"
                    />
                    <button
                      v-if="localApiKey"
                      type="button"
                      class="btn-toggle-visibility"
                      @click="showApiKey = !showApiKey"
                    >
                      <svg v-if="showApiKey" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <div class="setting-item">
                  <div class="setting-label">Base URL</div>
                  <input
                    v-model="localBaseUrl"
                    type="text"
                    placeholder="https://api.openai.com/v1"
                    class="setting-input"
                  />
                </div>

                <div class="setting-item">
                  <div class="setting-label">模型名称</div>
                  <input
                    v-model="localModel"
                    type="text"
                    placeholder="gpt-4o-mini"
                    class="setting-input"
                  />
                </div>

                <div class="advanced-settings">
                  <button
                    type="button"
                    class="btn-collapse"
                    @click="showAdvanced = !showAdvanced"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" :style="{ transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0deg)' }">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    高级配置
                  </button>

                  <div v-if="showAdvanced" class="advanced-content">
                    <div class="setting-item">
                      <div class="setting-label">认证 Header</div>
                      <input
                        v-model="localAuthHeader"
                        type="text"
                        placeholder="Authorization"
                        class="setting-input"
                      />
                    </div>

                    <div class="setting-item">
                      <div class="setting-label">认证前缀</div>
                      <input
                        v-model="localAuthPrefix"
                        type="text"
                        placeholder="Bearer "
                        class="setting-input"
                      />
                    </div>
                  </div>
                </div>

                <div class="setting-actions">
                  <button
                    class="btn-primary"
                    @click="saveAISettingsHandler"
                    :disabled="aiSaving"
                  >
                    {{ aiSaving ? '保存中...' : '保存配置' }}
                  </button>
                </div>
              </div>

              <div v-if="isAuthenticated" class="prompt-settings">
                <h3 class="subsection-title">自定义 Prompt 提示词</h3>
                <p class="subsection-description">自定义提示词用于生成书签描述</p>

                <div class="setting-item">
                  <div class="setting-label">启用自定义提示词</div>
                  <label class="toggle-switch">
                    <input type="checkbox" v-model="localCustomPromptEnabled" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>

                <div v-if="localCustomPromptEnabled" class="setting-item">
                  <div class="setting-label">自定义提示词</div>
                  <textarea
                    v-model="localCustomPrompt"
                    class="setting-textarea"
                    rows="8"
                    placeholder="输入自定义 Prompt... 可用变量：{name} {url}"
                  ></textarea>
                  <div class="example-templates">
                    <button class="btn-secondary-sm" @click="fillPromptTemplate">填充示例</button>
                  </div>
                </div>

                <div class="setting-actions">
                  <button
                    class="btn-primary"
                    @click="savePromptSettings"
                    :disabled="promptSaving"
                  >
                    {{ promptSaving ? '保存中...' : '保存 Prompt' }}
                  </button>
                </div>
              </div>

              <div v-if="!isAuthenticated" class="ai-enable-prompt">
                <p>登录后可以配置 AI 功能</p>
              </div>

              <div class="ai-features-info">
                <h4>AI 功能说明</h4>
                <ul class="feature-list">
                  <li><strong>智能生成描述</strong></li>
                  <li><strong>分类推荐</strong></li>
                  <li><strong>批量生成</strong></li>
                </ul>
              </div>
            </div>

            <div v-if="activeTab === 'about'" class="tab-panel">
              <div class="about-content">
                <div class="about-logo">
                  <span class="logo-icon">📚</span>
                  <h3>{{ customTitle }}</h3>
                </div>

                <div class="about-info">
                  <div class="info-row">
                    <span class="info-label">版本</span>
                    <span class="info-value">{{ versionInfo }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">构建</span>
                    <span class="info-value">Vue 3 + Vite + Cloudflare</span>
                  </div>
                </div>

                <div class="about-links">
                  <a href="https://github.com/deerwan/nav" target="_blank" class="about-link">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    GitHub
                  </a>
                </div>

                <div class="about-license">
                  <p>基于 Apache License 2.0 开源</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useSettings } from '@/composables/useSettings'
import { useTheme } from '@/composables/useTheme'
import { useAuth } from '@/composables/useAuth'
import { useBookmarks } from '@/composables/useBookmarks'
import { useAI } from '@/composables/useAI'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'action'])

const {
  themeMode, showSearch, hideEmptyCategories, publicMode,
  customTitle, avatarUrl, footerContent, randomWallpaper, wallpaperApi,
  displayMode, navCardAnimation, navCardBlur, navCardOpacity, navWallpaper, iconSources, proxyUrl,
  toggleSearch, toggleHideEmptyCategories, togglePublicMode,
  updateCustomTitle, updateFooterContent, toggleRandomWallpaper,
  updateWallpaperApi, updateAvatarUrl, toggleDisplayMode,
  toggleNavCardAnimation, updateNavWallpaper, setNavCardBlur, setNavCardOpacity,
  toggleIconSourceEnabled, toggleIconSourceLarger,
  moveIconSource, updateProxyUrl,
  navWallpaperHistory, wallpaperApiHistory
} = useSettings()

const { isDark, setThemeMode } = useTheme()
const { isAuthenticated } = useAuth()
const { categories, bookmarks } = useBookmarks()
const { aiEnabled, aiSource, checkAIAvailability, saveAISettings, getAISettings } = useAI()
const { success: toastSuccess, error: toastError } = useToast()

const activeTab = ref('appearance')
const avatarInput = ref(null)
const sliderActive = ref(false)
const showApiHistory = ref(false)
const showWallpaperHistory = ref(false)
const testDomain = ref('')
const isTesting = ref(false)
const testResults = ref([])

const tabs = [
  { id: 'appearance', name: '外观' },
  { id: 'data', name: '数据' },
  { id: 'ai', name: 'AI' },
  { id: 'about', name: '关于' }
]

const themeModes = [
  { value: 'light', label: '亮色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' }
]

const localApiKey = ref('')
const localBaseUrl = ref('https://api.openai.com/v1')
const localModel = ref('gpt-4o-mini')
const localAuthHeader = ref('Authorization')
const localAuthPrefix = ref('Bearer ')
const showApiKey = ref(false)
const showAdvanced = ref(false)
const aiSaving = ref(false)
const localCustomPrompt = ref('')
const localCustomPromptEnabled = ref(false)
const promptSaving = ref(false)

const totalBookmarks = computed(() => bookmarks.value.length)
const privateBookmarks = computed(() => bookmarks.value.filter(b => b.is_private).length)
const emptyCategoryCount = computed(() => categories.value.filter(c => !c.parent_id && (!c.bookmarks || c.bookmarks.length === 0)).length)

const versionInfo = computed(() => {
  const stored = localStorage.getItem('version')
  return stored || '1.0.0'
})

const handleClose = () => {
  emit('close')
}

const triggerAvatarUpload = () => {
  avatarInput.value?.click()
}

const handleAvatarChange = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async (event) => {
    await updateAvatarUrl(event.target.result)
  }
  reader.readAsDataURL(file)
}

const clearAvatar = async () => {
  await updateAvatarUrl('')
}

const handleRandomWallpaperToggle = () => {
  if (!randomWallpaper.value) {
    window.__savedWallpaper = navWallpaper.value
    updateNavWallpaper('')
  }
  toggleRandomWallpaper()
  if (!randomWallpaper.value && window.__savedWallpaper) {
    updateNavWallpaper(window.__savedWallpaper)
    window.__savedWallpaper = null
  }
}

const handleNavWallpaperChange = (value) => {
  if (randomWallpaper.value) return
  updateNavWallpaper(value)
}

const onApiHistoryBlur = () => {
  setTimeout(() => { showApiHistory.value = false }, 200)
}

const onWallpaperHistoryBlur = () => {
  setTimeout(() => { showWallpaperHistory.value = false }, 200)
}

const selectApiHistory = (item) => {
  updateWallpaperApi(item)
  showApiHistory.value = false
}

const selectWallpaperHistory = (item) => {
  updateNavWallpaper(item)
  showWallpaperHistory.value = false
}

const handleTestAll = async () => {
  if (!testDomain.value.trim()) return

  isTesting.value = true
  testResults.value = iconSources.value.map(source => ({
    id: source.id,
    name: source.name,
    url: source.url,
    enabled: source.enabled,
    direct: { loading: true, success: false, error: null, size: null, duration: null, testedUrl: null },
    proxy: { loading: false, success: false, error: null, size: null, duration: null, testedUrl: null }
  }))

  try {
    await Promise.all(testResults.value.map(async (result) => {
      const source = iconSources.value.find(s => s.id === result.id)
      const useLarger = source?.useLarger || false

      let iconUrl = result.url
        .replace('{domain}', testDomain.value)
        .replace('{origin}', `https://${testDomain.value}`)

      if (useLarger) {
        iconUrl += iconUrl.includes('?') ? '&larger=true' : '?larger=true'
      }

      result.direct.testedUrl = iconUrl

      if (!result.enabled) {
        result.direct.loading = false
        result.direct.success = false
        result.direct.error = '未启用'
      } else {
        const startTime = Date.now()
        try {
          const img = new Image()
          await new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = () => reject(new Error('加载失败'))
            img.src = iconUrl
          })
          result.direct.success = true
          result.direct.size = `${img.width}x${img.height}`
          result.direct.duration = Date.now() - startTime
        } catch (err) {
          result.direct.success = false
          result.direct.error = err.message || '请求失败'
          result.direct.duration = Date.now() - startTime
        }
        result.direct.loading = false
      }

      if (proxyUrl.value) {
        result.proxy.loading = true
        const proxyIconUrl = proxyUrl.value + encodeURIComponent(iconUrl)
        result.proxy.testedUrl = proxyIconUrl

        const startTime2 = Date.now()
        try {
          const img2 = new Image()
          await new Promise((resolve, reject) => {
            img2.onload = resolve
            img2.onerror = () => reject(new Error('加载失败'))
            img2.src = proxyIconUrl
          })
          result.proxy.success = true
          result.proxy.size = `${img2.width}x${img2.height}`
          result.proxy.duration = Date.now() - startTime2
        } catch (err) {
          result.proxy.success = false
          result.proxy.error = err.message || '请求失败'
          result.proxy.duration = Date.now() - startTime2
        }
        result.proxy.loading = false
      }
    }))
  } finally {
    isTesting.value = false
  }
}

const loadAISettings = async () => {
  if (!isAuthenticated.value) return
  const result = await getAISettings()
  if (result.success) {
    localApiKey.value = result.apiKey || ''
    localBaseUrl.value = result.baseUrl || 'https://api.openai.com/v1'
    localModel.value = result.model || 'gpt-4o-mini'
    localAuthHeader.value = result.authHeader || 'Authorization'
    localAuthPrefix.value = result.authPrefix !== undefined ? result.authPrefix : 'Bearer '
  }
}

const saveAISettingsHandler = async () => {
  aiSaving.value = true
  try {
    const settingsToSave = {
      baseUrl: localBaseUrl.value,
      model: localModel.value,
      authHeader: localAuthHeader.value,
      authPrefix: localAuthPrefix.value
    }
    if (localApiKey.value) {
      settingsToSave.apiKey = localApiKey.value
    }
    const result = await saveAISettings(settingsToSave)
    if (result.success) {
      toastSuccess('AI 配置已保存')
      localApiKey.value = ''
      await loadAISettings()
      await checkAIAvailability()
    } else {
      toastError(result.error || '保存失败')
    }
  } catch (error) {
    toastError('保存失败')
  } finally {
    aiSaving.value = false
  }
}

const loadPrompts = async () => {
  if (!isAuthenticated.value) return
  const result = await getAISettings()
  if (result.success) {
    localCustomPrompt.value = result.customPromptDescription || ''
    localCustomPromptEnabled.value = result.customPromptDescriptionEnabled || false
  }
}

const savePromptSettings = async () => {
  promptSaving.value = true
  try {
    const result = await saveAISettings({
      customPromptDescription: localCustomPrompt.value,
      customPromptDescriptionEnabled: localCustomPromptEnabled.value
    })
    if (result.success) {
      toastSuccess('Prompt 配置已保存')
    } else {
      toastError(result.error || '保存失败')
    }
  } catch (error) {
    toastError('保存失败')
  } finally {
    promptSaving.value = false
  }
}

const fillPromptTemplate = () => {
  localCustomPrompt.value = `为以下书签生成简洁的中文描述：

名称：{name}
链接：{url}

要求：
1. 使用简体中文
2. 一句话说明网站功能或内容，20字以内
3. 直接返回描述文本，不要引号或其他格式

示例：
- GitHub → 全球最大的代码托管和协作平台
- 知乎 → 中文互联网高质量问答社区
- MDN Web Docs → Web 技术权威文档和学习资源`
  toastSuccess('已填充示例模板')
}

watch(() => props.show, async (newVal) => {
  if (newVal) {
    activeTab.value = 'appearance'
    document.body.style.overflow = 'hidden'
    if (isAuthenticated.value) {
      await checkAIAvailability()
      await loadAISettings()
      await loadPrompts()
    }
  } else {
    document.body.style.overflow = ''
  }
})
</script>
<style scoped>
.nav-settings-overlay {
  position: fixed;
  inset: 5%;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.nav-settings-modal {
  width: 100%;
  height: 100%;
  background: linear-gradient(165deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 25px 80px rgba(0, 0, 0, 0.5);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.settings-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
}

.settings-close {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.settings-close:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #f87171;
  transform: rotate(90deg);
}

.settings-close svg {
  width: 18px;
  height: 18px;
}

.settings-tabs {
  display: flex;
  gap: 4px;
  padding: 12px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.tab-btn {
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #f1f5f9;
  background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
  color: #60a5fa;
  background: rgba(57, 157, 255, 0.15);
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.settings-content::-webkit-scrollbar {
  width: 6px;
}

.settings-content::-webkit-scrollbar-track {
  background: transparent;
}

.settings-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.tab-panel {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.setting-group .group-header {
  margin-bottom: 4px;
}

.setting-group .icon-test-controls {
  margin-bottom: 4px;
}

.setting-group .test-results {
  margin-top: 4px;
}

.setting-group .setting-item {
  padding: 10px 12px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  gap: 16px;
}

.setting-item.nested {
  margin-top: -8px;
  background: transparent;
  border: none;
  padding: 8px 16px 8px 32px;
}

.setting-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #f1f5f9;
}

.setting-info {
  flex: 1;
}

.setting-desc {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 2px;
}

.theme-selector {
  display: flex;
  gap: 4px;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px;
  border-radius: 8px;
}

.theme-btn {
  padding: 6px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #64748b;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.2s;
}

.theme-btn:hover {
  color: #f1f5f9;
}

.theme-btn.active {
  background: rgba(57, 157, 255, 0.3);
  color: #60a5fa;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  cursor: pointer;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  transition: all 0.3s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  bottom: 3px;
  background: #fff;
  border-radius: 50%;
  transition: all 0.3s;
}

.toggle-switch input:checked + .toggle-slider {
  background: rgba(57, 157, 255, 0.5);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
  background: #60a5fa;
}

.setting-input {
  flex: 1;
  max-width: 420px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #f1f5f9;
  font-size: 0.8125rem;
  outline: none;
  transition: all 0.2s;
}

.setting-input:focus {
  border-color: rgba(57, 157, 255, 0.5);
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 3px rgba(57, 157, 255, 0.1);
}

.setting-input::placeholder {
  color: #475569;
}

.avatar-setting {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar-preview {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.avatar-preview:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  color: #64748b;
}

.avatar-placeholder svg {
  width: 24px;
  height: 24px;
}

.btn-text {
  background: none;
  border: none;
  color: #ef4444;
  font-size: 0.8125rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-text:hover {
  background: rgba(239, 68, 68, 0.1);
}

.btn-action {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: rgba(57, 157, 255, 0.15);
  border: 1px solid rgba(57, 157, 255, 0.3);
  border-radius: 8px;
  color: #60a5fa;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-action:hover {
  background: rgba(57, 157, 255, 0.25);
  border-color: rgba(57, 157, 255, 0.5);
}

.btn-action.danger {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #f87171;
}

.btn-action.danger:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

.btn-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-action svg {
  width: 16px;
  height: 16px;
}

.stats-card {
  margin-top: 24px;
  padding: 16px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 10px;
}

.stats-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #818cf8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}

.stats-grid {
  display: flex;
  gap: 24px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #f1f5f9;
}

.stat-label {
  font-size: 0.75rem;
  color: #64748b;
}

.ai-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  color: #64748b;
  font-size: 0.875rem;
}

.ai-status.enabled {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.3);
  color: #34d399;
}

.ai-status .status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.ai-field {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #94a3b8;
  font-size: 0.8125rem;
}

.ai-field.locked {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-enable-prompt {
  padding: 24px;
  text-align: center;
  color: #64748b;
  font-size: 0.875rem;
  line-height: 1.6;
}

.about-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 24px;
}

.about-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 3rem;
}

.about-logo h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
}

.about-info {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.info-label {
  color: #64748b;
  font-size: 0.8125rem;
}

.info-value {
  color: #f1f5f9;
  font-size: 0.8125rem;
}

.about-links {
  display: flex;
  gap: 12px;
}

.about-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #94a3b8;
  text-decoration: none;
  font-size: 0.8125rem;
  transition: all 0.2s;
}

.about-link:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f1f5f9;
  border-color: rgba(255, 255, 255, 0.2);
}

.about-link svg {
  width: 18px;
  height: 18px;
}

.about-license {
  color: #475569;
  font-size: 0.75rem;
}

.ai-config-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}

.api-key-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.api-key-input-wrapper .setting-input {
  flex: 1;
}

.btn-toggle-visibility {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.btn-toggle-visibility:hover {
  color: #60a5fa;
  border-color: rgba(57, 157, 255, 0.3);
}

.btn-toggle-visibility svg {
  width: 20px;
  height: 20px;
}

.advanced-settings {
  padding-top: 12px;
}

.btn-collapse {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  color: #60a5fa;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  padding: 8px 0;
  transition: color 0.2s;
}

.btn-collapse:hover {
  color: #93c5fd;
}

.btn-collapse svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
  transition: transform 0.2s;
}

.advanced-content {
  margin-top: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.btn-primary {
  padding: 10px 20px;
  background: rgba(57, 157, 255, 0.2);
  border: 1px solid rgba(57, 157, 255, 0.4);
  border-radius: 8px;
  color: #60a5fa;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: rgba(57, 157, 255, 0.3);
  border-color: rgba(57, 157, 255, 0.5);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-features-info {
  margin-top: 20px;
  padding: 16px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 10px;
}

.ai-features-info h4 {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #818cf8;
  margin: 0 0 10px 0;
}

.feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.feature-list li {
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.5;
}

.feature-list li strong {
  color: #94a3b8;
}

.prompt-settings {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.subsection-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0 0 6px 0;
}

.subsection-description {
  color: #64748b;
  font-size: 0.75rem;
  line-height: 1.5;
  margin: 0 0 16px 0;
}

.setting-textarea {
  width: 100%;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #f1f5f9;
  font-size: 0.8125rem;
  font-family: 'Monaco', 'Menlo', monospace;
  line-height: 1.6;
  resize: vertical;
  min-height: 120px;
  outline: none;
  transition: all 0.2s;
}

.setting-textarea:focus {
  border-color: rgba(57, 157, 255, 0.5);
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 3px rgba(57, 157, 255, 0.1);
}

.setting-textarea::placeholder {
  color: #475569;
}

.example-templates {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.btn-secondary-sm {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #94a3b8;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary-sm:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f1f5f9;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  cursor: pointer;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  transition: all 0.3s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  bottom: 3px;
  background: #fff;
  border-radius: 50%;
  transition: all 0.3s;
}

.toggle-switch input:checked + .toggle-slider {
  background: rgba(57, 157, 255, 0.5);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
  background: #60a5fa;
}

.group-header {
  font-size: 0.875rem;
  font-weight: 600;
  color: #94a3b8;
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.icon-sources-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.icon-source-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

.source-info {
  flex: 1;
  min-width: 0;
}

.source-name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #e2e8f0;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-url {
  font-size: 0.6875rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-icon-test,
.btn-icon-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon-test {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.btn-icon-test:hover {
  background: rgba(59, 130, 246, 0.25);
}

.btn-icon-remove {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.btn-icon-remove:hover {
  background: rgba(239, 68, 68, 0.25);
}

.btn-icon-test svg,
.btn-icon-remove svg {
  width: 14px;
  height: 14px;
}

.add-icon-source {
  display: flex;
  gap: 8px;
}

.add-icon-source .setting-input {
  flex: 1;
}

.btn-add-source {
  padding: 8px 16px;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 8px;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-add-source:hover {
  background: rgba(59, 130, 246, 0.3);
}

.toggle-switch.small {
  width: 36px;
  height: 20px;
}

.toggle-switch.small .toggle-slider::before {
  width: 14px;
  height: 14px;
}

.toggle-switch.small input:checked + .toggle-slider::before {
  transform: translateX(16px);
}

.icon-test-controls {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.icon-test-controls .setting-input {
  flex: 1;
}

.btn-test-all {
  padding: 8px 16px;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 8px;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-test-all:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.3);
}

.btn-test-all:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.test-results {
  overflow-x: auto;
}

.test-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
}

.test-table th {
  text-align: left;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  font-weight: 500;
  white-space: nowrap;
}

.test-table td {
  padding: 10px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: #e2e8f0;
}

.test-table tr:last-child td {
  border-bottom: none;
}

.source-name-cell {
  font-weight: 500;
  color: #e2e8f0;
}

.url-cell {
  font-size: 0.625rem;
  color: #64748b;
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-success {
  color: #4ade80;
}

.status-error {
  color: #f87171;
}

.status-loading {
  color: #60a5fa;
}

.status-disabled {
  color: #64748b;
}

.nav-settings-overlay.slider-active {
  opacity: 0.15 !important;
  pointer-events: none;
}

.blur-slider-item {
  flex-wrap: wrap;
}

.blur-slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  width: 100%;
}

.blur-slider {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.blur-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: #60a5fa;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s;
}

.blur-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.blur-value {
  font-size: 0.75rem;
  color: #94a3b8;
  min-width: 36px;
  text-align: right;
}

.history-input-wrap {
  position: relative;
  flex: 1;
  max-width: 420px;
}

.history-input-wrap .setting-input {
  max-width: 100%;
  width: 100%;
}

.history-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  margin-top: 4px;
  max-height: 180px;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.history-item {
  padding: 8px 12px;
  font-size: 0.75rem;
  color: #cbd5e1;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.history-item:last-child {
  border-bottom: none;
}

.history-item:hover {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

/* Modal Animation */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .nav-settings-modal,
.modal-leave-to .nav-settings-modal {
  transform: scale(0.95) translateY(20px);
}
</style>