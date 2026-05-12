<template>
  <div class="settings-section">
    <h2 class="section-title">外观设置</h2>
    
    <!-- 头像设置 -->
    <div class="form-group">
      <label class="form-label">头像设置</label>
      <div class="avatar-settings">
        <div class="avatar-preview">
          <img 
            :src="avatarUrl || defaultAvatarIcon" 
            alt="当前头像"
          />
        </div>
        <div class="avatar-actions">
          <button type="button" class="avatar-btn avatar-btn-upload" @click="handleUploadAvatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            上传头像
          </button>
        </div>
      </div>
      <div class="form-hint">上传自定义头像，图片大小不超过 2MB</div>
      <input 
        ref="avatarInput" 
        type="file" 
        accept="image/*" 
        style="display: none" 
        @change="handleAvatarChange"
      />
    </div>
    
    <!-- 自定义标题 -->
    <div class="form-group">
      <label class="form-label">自定义标题</label>
      <div class="form-row">
        <input 
          type="text" 
          :value="customTitle" 
          class="form-input" 
          readonly
        />
        <button class="text-btn" @click="$emit('editTitle')">
          编辑
        </button>
      </div>
      <div class="form-hint">修改页面顶部标题文字</div>
    </div>
    
    <!-- 自定义页脚 -->
    <div class="form-group">
      <label class="form-label">自定义页脚</label>
      <div class="form-row">
        <div class="footer-preview" v-html="footerContent"></div>
        <button class="text-btn" @click="$emit('editFooter')">
          编辑
        </button>
      </div>
      <div class="form-hint">修改页面底部内容（支持HTML）</div>
    </div>
    
    <!-- 主题模式 -->
    <div class="form-group">
      <label class="form-label">主题模式</label>
      <div class="form-row">
        <select 
          class="form-select"
          :value="themeMode"
          @change="handleThemeChange"
        >
          <option value="light">🌞 亮色模式</option>
          <option value="dark">🌙 暗色模式</option>
          <option value="system">💻 跟随系统</option>
        </select>
      </div>
      <div class="form-hint">
        {{ 
          themeMode === 'light' ? '使用亮色主题' : 
          themeMode === 'dark' ? '使用暗色主题' : 
          '根据系统设置自动切换主题'
        }}
      </div>
    </div>
    
    <!-- 显示搜索栏 -->
    <div class="form-group">
      <label class="form-label">显示搜索栏</label>
      <div class="form-row">
        <span class="form-text">{{ showSearch ? '已开启' : '已关闭' }}</span>
        <label class="switch">
          <input 
            type="checkbox" 
            :checked="showSearch"
            @change="$emit('toggleSearch')"
          >
          <span class="slider"></span>
        </label>
      </div>
      <div class="form-hint">在顶部显示搜索功能</div>
    </div>
    
    <!-- 搜索引擎列表开关 -->
    <div v-if="showSearch" class="form-group">
      <label class="form-label">搜索引擎列表</label>
      <div class="form-row">
        <span class="form-text">{{ enabledSearchEnginesPanel ? '已开启' : '已关闭' }}</span>
        <label class="switch">
          <input 
            type="checkbox" 
            :checked="enabledSearchEnginesPanel"
            @change="toggleSearchEnginesPanel"
          >
          <span class="slider"></span>
        </label>
      </div>
      <div class="form-hint">在搜索栏中显示快速搜索引擎列表</div>
    </div>
    
    <!-- 搜索引擎配置 -->
    <div v-if="showSearch && enabledSearchEnginesPanel" class="form-group">
      <label class="form-label">快速搜索引擎</label>
      <div class="form-hint" style="margin-bottom: 0.75rem;">选择要在搜索栏中显示的搜索引擎</div>
      <div class="engines-grid">
        <label 
          v-for="engine in allEngines" 
          :key="engine.id"
          class="engine-checkbox"
        >
          <input 
            type="checkbox"
            :checked="enabledEngines.includes(engine.id)"
            @change="toggleEngine(engine.id)"
          />
          <span class="engine-label">
            <img 
              v-if="engine.icon.startsWith('http')" 
              :src="engine.icon" 
              class="engine-icon-img" 
              :alt="engine.name"
            />
            <span v-else class="engine-icon">{{ engine.icon }}</span>
            {{ engine.name }}
          </span>
        </label>
      </div>
    </div>
    
    <!-- 隐藏空分类 -->
    <div class="form-group">
      <label class="form-label">隐藏空分类</label>
      <div class="form-row">
        <span class="form-text">{{ hideEmptyCategories ? '已开启' : '已关闭' }}</span>
        <label class="switch">
          <input 
            type="checkbox" 
            :checked="hideEmptyCategories"
            @change="$emit('toggleHideEmpty')"
          >
          <span class="slider"></span>
        </label>
      </div>
      <div class="form-hint">不显示没有书签的分类</div>
    </div>

    <!-- 公开模式 -->
    <div class="form-group">
      <label class="form-label">访问模式</label>
      <div class="form-row">
        <span class="form-text">{{ publicMode ? '公开模式' : '非公开模式' }}</span>
        <label class="switch">
          <input
            type="checkbox"
            :checked="publicMode"
            @change="$emit('togglePublicMode')"
          >
          <span class="slider"></span>
        </label>
      </div>
      <div class="form-hint">
        {{ publicMode ? '未登录用户可访问公开书签' : '未登录用户无法访问书签和分类' }}
      </div>
    </div>
    
    <!-- 随机壁纸 -->
    <div class="form-group">
      <label class="form-label">随机壁纸</label>
      <div class="form-row">
        <span class="form-text">{{ randomWallpaper ? '已开启' : '已关闭' }}</span>
        <label class="switch">
          <input 
            type="checkbox" 
            :checked="randomWallpaper"
            @change="$emit('toggleRandomWallpaper')"
          >
          <span class="slider"></span>
        </label>
      </div>
      <div class="form-hint">启用后会在页面背景显示随机壁纸</div>
    </div>
    
    <!-- 壁纸API接口 -->
    <div v-if="randomWallpaper" class="form-group">
      <label class="form-label">壁纸API接口</label>
      <div class="form-row">
        <input 
          type="text" 
          :value="wallpaperApi || '未设置'" 
          class="form-input" 
          readonly
        />
        <button type="button" class="text-btn" @click="openDialog">
          编辑
        </button>
      </div>
      <div class="form-hint">自定义随机壁纸API接口地址（留空则不显示壁纸）</div>
    </div>

    <!-- 风格 -->
    <div class="form-group">
      <label class="form-label">风格</label>
      <div class="form-row">
        <span class="form-text">{{ displayMode === 'nav-item' ? '导航站' : '默认' }}</span>
        <label class="switch">
          <input 
            type="checkbox" 
            :checked="displayMode === 'nav-item'"
            @change="$emit('toggleDisplayMode')"
          >
          <span class="slider"></span>
        </label>
      </div>
    </div>

    <!-- 图标获取设置 -->
    <div class="form-group">
      <label class="form-label">图标获取设置</label>
      
      <!-- 图标源列表 -->
      <div class="icon-sources-list">
        <div 
          v-for="(source, index) in iconSources" 
          :key="source.id"
          class="icon-source-item"
        >
          <div class="source-controls">
            <button 
              class="move-btn" 
              @click="$emit('moveIconSource', source.id, 'up')"
              :disabled="index === 0"
              title="上移"
            >↑</button>
            <button 
              class="move-btn" 
              @click="$emit('moveIconSource', source.id, 'down')"
              :disabled="index === iconSources.length - 1"
              title="下移"
            >↓</button>
          </div>
          <div class="source-info">
            <span class="source-name">{{ source.name }}</span>
            <span class="source-url">{{ source.url }}</span>
          </div>
          <label class="switch">
            <input 
              type="checkbox" 
              :checked="source.enabled"
              @change="$emit('toggleIconSourceEnabled', source.id)"
            >
            <span class="slider"></span>
          </label>
          <button 
            class="delete-btn" 
            @click="$emit('removeIconSource', source.id)"
            title="删除"
          >×</button>
        </div>
      </div>

      <!-- 添加新源 -->
      <div v-if="showAddSource" class="add-source-form">
        <input 
          v-model="newSourceName" 
          type="text" 
          placeholder="源名称（如：My Source）"
          class="form-input"
        />
        <input 
          v-model="newSourceUrl" 
          type="text" 
          placeholder="URL，使用 {domain} 或 {origin} 作为占位符"
          class="form-input"
        />
        <div class="add-source-hint">占位符说明：{domain} = 域名，{origin} = 网站origin</div>
        <div class="add-source-buttons">
          <button class="text-btn" @click="showAddSource = false">取消</button>
          <button class="btn btn-primary" @click="handleAddSource">添加</button>
        </div>
      </div>

      <button 
        v-if="!showAddSource" 
        class="text-btn add-source-btn" 
        @click="showAddSource = true"
      >
        + 添加新源
      </button>
    </div>

    <!-- 代理设置 -->
    <div class="form-group">
      <label class="form-label">代理设置</label>
      <div class="form-row">
        <input 
          v-model="proxyInput" 
          type="text" 
          placeholder="如：https://proxy.example.com/proxy?url=（无代理则留空）"
          class="form-input"
          @blur="handleProxyBlur"
        />
      </div>
      <div class="form-hint">仅在无代理获取全部失败后启用，用于解决网络问题</div>
    </div>

    <!-- 图标源测试 -->
    <div class="form-group">
      <label class="form-label">测试图标源</label>
      <div class="form-row">
        <input 
          v-model="testDomain" 
          type="text" 
          placeholder="输入域名，如：google.com"
          class="form-input"
          @keyup.enter="handleTestAll"
        />
        <button 
          class="btn btn-primary" 
          @click="handleTestAll"
          :disabled="isTesting"
        >
          {{ isTesting ? '测试中...' : '测试全部' }}
        </button>
      </div>
      
      <!-- 测试结果 -->
      <div v-if="testResults.length > 0" class="test-results">
        <div 
          v-for="result in testResults" 
          :key="result.id"
          class="test-result-item"
        >
          <div class="result-status">
            <span v-if="!result.enabled" class="status-disabled">⊘ 未启用</span>
            <span v-else-if="result.loading" class="status-loading">⟳ 测试中</span>
            <span v-else-if="result.success" class="status-success">✓ 成功</span>
            <span v-else class="status-error">✗ {{ result.error }}</span>
          </div>
          <div class="result-info">
            <span class="result-name">{{ result.name }}</span>
            <span v-if="result.size" class="result-size">{{ result.size }}</span>
            <span v-if="result.duration" class="result-duration">{{ result.duration }}ms</span>
          </div>
          <img 
            v-if="result.success && result.imageUrl" 
            :src="result.imageUrl" 
            class="result-preview"
            alt="预览"
          />
        </div>
      </div>
    </div>
    
    <!-- API接口编辑对话框 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showApiDialog" class="dialog-overlay" @click="showApiDialog = false">
          <div class="dialog-box api-dialog" @click.stop>
            <h3 class="dialog-title">编辑壁纸API接口</h3>
            
            <div class="form-group">
              <label>API接口地址 *</label>
              <input 
                v-model="apiInput" 
                type="text" 
                placeholder="请输入API接口地址，例如：https://api.example.com/wallpaper"
                @keyup.enter="handleConfirm"
                autofocus
              >
              <div class="form-hint">请输入返回图片URL的API接口地址</div>
            </div>
            
            <div class="form-group">
              <div class="example-apis">
                <div class="example-title">示例接口（点击快速填入）：</div>
                <button 
                  type="button"
                  class="example-btn" 
                  @click="apiInput = 'https://api.paugram.com/wallpaper/'"
                >
                  Paugram 壁纸 API
                </button>
                <button 
                  type="button"
                  class="example-btn" 
                  @click="apiInput = 'https://picsum.photos/1920/1080'"
                >
                  Lorem Picsum 随机图片
                </button>
              </div>
            </div>
            
            <p v-if="error" class="error-message">{{ error }}</p>
            
            <div class="dialog-buttons">
              <button class="text-btn" @click="handleCancel">取消</button>
              <button class="btn btn-primary" @click="handleConfirm">确认</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, nextTick, computed } from 'vue'
import { useSearchEngines } from '../../composables/useSearchEngines'

const props = defineProps({
  themeMode: String,
  isDark: Boolean,
  showSearch: Boolean,
  hideEmptyCategories: Boolean,
  publicMode: Boolean,
  customTitle: String,
  avatarUrl: String,
  username: {
    type: String,
    default: '用户'
  },
  footerContent: String,
  randomWallpaper: Boolean,
  wallpaperApi: String,
  displayMode: String,
  iconSources: Array,
  proxyUrl: String
})

const emit = defineEmits([
  'editTitle', 
  'editFooter', 
  'uploadAvatar',
  'setThemeMode', 
  'toggleSearch', 
  'toggleHideEmpty', 
  'togglePublicMode',
  'toggleRandomWallpaper',
  'updateWallpaperApi',
  'toggleDisplayMode',
  'addIconSource',
  'removeIconSource',
  'toggleIconSourceEnabled',
  'moveIconSource',
  'updateProxyUrl'
])

const { SEARCH_ENGINES, enabledEngines, enabledSearchEnginesPanel, toggleEngine, toggleSearchEnginesPanel } = useSearchEngines()

const allEngines = computed(() => SEARCH_ENGINES)

const showApiDialog = ref(false)
const apiInput = ref('')
const error = ref('')
const avatarInput = ref(null)

const showAddSource = ref(false)
const newSourceName = ref('')
const newSourceUrl = ref('')
const proxyInput = ref('')
const testDomain = ref('')
const isTesting = ref(false)
const testResults = ref([])

const defaultAvatarIcon = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'

// 初始化代理输入
if (props.proxyUrl) {
  proxyInput.value = props.proxyUrl
}

// 添加新源
const handleAddSource = () => {
  if (!newSourceUrl.value.trim()) {
    return
  }
  emit('addIconSource', {
    name: newSourceName.value || newSourceUrl.value,
    url: newSourceUrl.value.trim()
  })
  newSourceName.value = ''
  newSourceUrl.value = ''
  showAddSource.value = false
}

// 代理输入失焦保存
const handleProxyBlur = () => {
  emit('updateProxyUrl', proxyInput.value)
}

// 测试所有图标源
const handleTestAll = async () => {
  const domain = testDomain.value.trim()
  if (!domain) return
  
  isTesting.value = true
  testResults.value = []
  
  // 初始化结果
  testResults.value = props.iconSources.map(s => ({
    id: s.id,
    name: s.name,
    url: s.url,
    enabled: s.enabled,
    loading: s.enabled,
    success: false,
    error: '',
    size: '',
    duration: 0,
    imageUrl: ''
  }))
  
  // 测试每个启用的源
  for (const result of testResults.value) {
    if (!result.enabled) continue
    
    try {
      const iconUrl = result.url
        .replace('{domain}', domain)
        .replace('{origin}', `https://${domain}`)
      
      const startTime = Date.now()
      const response = await fetch(iconUrl, { mode: 'cors' })
      const duration = Date.now() - startTime
      
      if (response.ok) {
        const blob = await response.blob()
        const img = new Image()
        
        await new Promise((resolve) => {
          img.onload = resolve
          img.onerror = resolve
          img.src = URL.createObjectURL(blob)
        })
        
        result.success = true
        result.size = `${img.width}x${img.height}`
        result.duration = duration
        result.imageUrl = img.src
      } else {
        result.success = false
        result.error = `HTTP ${response.status}`
        result.duration = duration
      }
    } catch (err) {
      result.success = false
      result.error = err.message || '请求失败'
    }
    
    result.loading = false
  }
  
  isTesting.value = false
}

const handleUploadAvatar = () => {
  avatarInput.value?.click()
}

const handleAvatarChange = (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件')
    return
  }

  if (file.size > 2 * 1024 * 1024) {
    alert('图片大小不能超过 2MB')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    emit('uploadAvatar', e.target.result)
  }
  reader.readAsDataURL(file)
  
  event.target.value = ''
}

const handleThemeChange = (event) => {
  emit('setThemeMode', event.target.value)
}

const handleConfirm = () => {
  error.value = ''
  
  const trimmedUrl = apiInput.value.trim()
  
  // 如果为空，也允许（用于清除API）
  if (trimmedUrl === '') {
    emit('updateWallpaperApi', '')
    showApiDialog.value = false
    return
  }
  
  // 验证URL格式
  try {
    new URL(trimmedUrl)
    emit('updateWallpaperApi', trimmedUrl)
    showApiDialog.value = false
  } catch {
    error.value = '请输入有效的URL地址'
  }
}

const handleCancel = () => {
  apiInput.value = props.wallpaperApi || ''
  error.value = ''
  showApiDialog.value = false
}

// 打开对话框时初始化输入值
const openDialog = (e) => {
  if (e) {
    e.preventDefault()
    e.stopPropagation()
  }
  apiInput.value = props.wallpaperApi || ''
  error.value = ''
  showApiDialog.value = true
  // 确保对话框显示
  nextTick(() => {
    const dialog = document.querySelector('.api-dialog')
    if (dialog) {
      const input = dialog.querySelector('input')
      if (input) input.focus()
    }
  })
}
</script>

<style scoped>
.settings-section {
  max-width: 800px;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 1.5rem;
}


.form-group {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: transparent;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
}

.form-label {
  display: block;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text);
  margin-bottom: 0.75rem;
}


.form-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.form-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.9375rem;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
}

.form-input:read-only {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: not-allowed;
}

.form-select {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.9375rem;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  background-size: 1em;
  padding-right: 2rem;
}

.form-select:focus {
  outline: none;
  border-color: var(--primary);
}

.form-text {
  flex: 1;
  color: var(--text);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.form-hint {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-top: 0.5rem;
}


.avatar-settings {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.avatar-preview {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-full);
  overflow: hidden;
  border: 2px solid var(--border);
  flex-shrink: 0;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
}

.avatar-btn {
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-sm);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  transition: all 0.2s ease;
  width: 100%;
}

.avatar-btn svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.avatar-btn-upload {
  background: var(--primary);
  color: white;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.avatar-btn-upload:hover {
  background: var(--primary-dark);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  transform: translateY(-1px);
}

.avatar-btn-upload:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
}

.footer-preview {
  flex: 1;
  padding: 0.5rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  color: var(--text-secondary);
  max-height: 60px;
  overflow: hidden;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: background-color 0.2s ease;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--primary);
}

.text-btn {
  background: transparent;
  border: none;
  color: var(--text);
  font-size: 0.9375rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: color 0.2s ease;
  font-weight: 500;
}

.text-btn:hover {
  color: var(--primary);
}

.switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 32px;
  flex-shrink: 0;
}
</style>

<!-- 对话框样式必须非 scoped，因为使用了 Teleport -->
<style>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.api-dialog {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: var(--radius);
  padding: 1.5rem;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  position: relative;
  z-index: 10001;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

html.dark .api-dialog {
  background: rgba(15, 23, 42, 0.85);
  border-color: rgba(255, 255, 255, 0.1);
}

.api-dialog .dialog-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 1.5rem;
}

.api-dialog .form-group {
  margin-bottom: 1.5rem;
}

.api-dialog .form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text);
  margin-bottom: 0.5rem;
}

.api-dialog .form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.95rem;
  transition: var(--transition);
}

.api-dialog .form-group input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.api-dialog .form-hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
}

.api-dialog .dialog-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.api-dialog .example-apis {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.api-dialog .example-title {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.api-dialog .example-btn {
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 0.875rem;
  cursor: pointer;
  transition: var(--transition);
  text-align: left;
}

.api-dialog .example-btn:hover {
  background: var(--bg-hover);
  border-color: var(--primary);
  color: var(--primary);
}

.api-dialog .error-message {
  color: var(--error);
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.api-dialog .text-btn {
  background: transparent;
  border: none;
  color: var(--text);
  font-size: 0.9375rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: color 0.2s ease;
  font-weight: 500;
}

.api-dialog .text-btn:hover {
  color: var(--primary);
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--border);
  transition: var(--transition);
  border-radius: var(--radius-full);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.slider:before {
  position: absolute;
  content: "";
  height: 24px;
  width: 24px;
  left: 4px;
  bottom: 4px;
  background: white;
  transition: var(--transition);
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.switch input:checked + .slider {
  background: var(--primary);
  box-shadow: inset 0 2px 4px rgba(99, 102, 241, 0.3);
}

.switch input:checked + .slider:before {
  transform: translateX(28px);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.switch:hover .slider {
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.15);
}

.switch:hover input:checked + .slider {
  box-shadow: inset 0 2px 4px rgba(99, 102, 241, 0.4);
}

.engines-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.engine-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--bg);
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
  user-select: none;
}

.engine-checkbox:hover {
  border-color: var(--primary);
  background: var(--bg-hover);
}

.engine-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--primary);
}

.engine-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  color: var(--text);
  font-weight: 500;
}

.engine-icon {
  font-size: 1.125rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.engine-icon-img {
  width: 18px;
  height: 18px;
  object-fit: contain;
  border-radius: 2px;
}

.icon-sources-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.icon-source-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.source-controls {
  display: flex;
  gap: 0.25rem;
}

.move-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  background: var(--bg);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  color: var(--text-secondary);
  transition: var(--transition);
}

.move-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.move-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.source-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.source-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text);
}

.source-url {
  font-size: 0.75rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 1.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: var(--transition);
}

.delete-btn:hover {
  color: var(--error);
  background: var(--bg-hover);
}

.add-source-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  margin-bottom: 0.75rem;
}

.add-source-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.add-source-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.add-source-btn {
  margin-top: 0.5rem;
}

.test-results {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

.test-result-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.result-status {
  min-width: 100px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-success {
  color: var(--success);
}

.status-error {
  color: var(--error);
}

.status-disabled {
  color: var(--text-secondary);
}

.status-loading {
  color: var(--primary);
}

.result-info {
  flex: 1;
  display: flex;
  gap: 1rem;
  align-items: center;
}

.result-name {
  font-size: 0.875rem;
  color: var(--text);
}

.result-size,
.result-duration {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.result-preview {
  width: 32px;
  height: 32px;
  object-fit: contain;
  border-radius: 4px;
  background: white;
}
</style>
