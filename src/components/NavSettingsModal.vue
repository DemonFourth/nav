<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="nav-settings-overlay" :class="{ 'slider-active': sliderActive }" @click="handleClose">
        <div class="nav-settings-modal" @click.stop>
          <aside class="settings-sidebar" :class="{ collapsed: sidebarCollapsed }">
            <div class="sidebar-header">
              <span class="sidebar-title">设置</span>
              <button class="collapse-btn" @click="toggleSidebarCollapsed" :title="sidebarCollapsed ? '展开侧栏' : '折叠侧栏'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
                  <path v-if="!sidebarCollapsed" d="M15 18l-6-6 6-6"/>
                  <path v-else d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>
            <nav class="sidebar-nav">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                class="nav-tab-btn"
                :class="{ active: activeTab === tab.id }"
                @click="activeTab = tab.id"
              >
                <span v-html="tab.icon"></span>
                {{ tab.name }}
              </button>
            </nav>
            <div class="sidebar-footer">
              <div class="credit-text">Designed by <a href="https://github.com/Leonxlnx/taste-skill" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none;">taste-skill</a></div>
            </div>
          </aside>

          <button class="modal-close-btn" @click="handleClose" title="关闭设置">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>

          <main class="settings-content">
            <!-- Appearance -->
            <div v-show="activeTab === 'appearance'" class="tab-panel">
              <div class="panel-header">
                <h2 class="panel-title">外观</h2>
                <p class="panel-desc">自定义主题、壁纸和卡片样式</p>
              </div>
              <div class="settings-grid">
                <div class="setting-card">
                  <div class="card-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                    </svg>
                    主题
                  </div>
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

                <div class="setting-card">
                  <div class="card-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                    </svg>
                    卡片样式
                  </div>
                  <div class="slider-row" style="margin-bottom:14px;">
                    <span class="slider-label">毛玻璃</span>
                    <input
                      type="range" min="0" max="20"
                      :value="navCardBlur"
                      @mousedown="sliderActive = true"
                      @touchstart="sliderActive = true"
                      @mouseup="sliderActive = false"
                      @touchend="sliderActive = false"
                      @mouseleave="sliderActive = false"
                      @input="e => setNavCardBlur(Number(e.target.value))"
                    />
                    <span class="slider-value">{{ navCardBlur }}px</span>
                  </div>
                  <div class="slider-row">
                    <span class="slider-label">透明度</span>
                    <input
                      type="range" min="0" max="100"
                      :value="navCardOpacity"
                      @mousedown="sliderActive = true"
                      @touchstart="sliderActive = true"
                      @mouseup="sliderActive = false"
                      @touchend="sliderActive = false"
                      @mouseleave="sliderActive = false"
                      @input="e => setNavCardOpacity(Number(e.target.value))"
                    />
                    <span class="slider-value">{{ navCardOpacity }}%</span>
                  </div>
                </div>

                <div class="setting-card">
                  <div class="card-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
                    </svg>
                    界面
                  </div>
                  <div class="toggle-row">
                    <div class="toggle-info">
                      <div class="toggle-name">显示搜索</div>
                      <div class="toggle-desc">显示搜索栏</div>
                    </div>
                    <label class="toggle-switch">
                      <input type="checkbox" :checked="showSearch" @change="toggleSearch" />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                  <div class="toggle-row">
                    <div class="toggle-info">
                      <div class="toggle-name">隐藏空分类</div>
                      <div class="toggle-desc">折叠没有书签的分类</div>
                    </div>
                    <label class="toggle-switch">
                      <input type="checkbox" :checked="hideEmptyCategories" @change="toggleHideEmptyCategories" />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                  <div class="toggle-row">
                    <div class="toggle-info">
                      <div class="toggle-name">公共模式</div>
                      <div class="toggle-desc">书签对外公开可见</div>
                    </div>
                    <label class="toggle-switch">
                      <input type="checkbox" :checked="publicMode" @change="togglePublicMode" />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                  <div class="toggle-row">
                    <div class="toggle-info">
                      <div class="toggle-name">卡片动画</div>
                      <div class="toggle-desc">悬停和入场动画效果</div>
                    </div>
                    <label class="toggle-switch">
                      <input type="checkbox" :checked="navCardAnimation" @change="toggleNavCardAnimation" />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div class="setting-card">
                  <div class="card-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                    </svg>
                    壁纸
                  </div>
                  <div class="toggle-row">
                    <div class="toggle-info">
                      <div class="toggle-name">随机壁纸</div>
                      <div class="toggle-desc">自动从 API 获取</div>
                    </div>
                    <label class="toggle-switch">
                      <input type="checkbox" :checked="randomWallpaper" @change="handleRandomWallpaperToggle" />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                  <div v-if="randomWallpaper" class="input-with-btn" style="margin-top:10px;">
                    <div class="history-input-wrap" style="flex:1;">
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
                  <div class="section-divider"></div>
                  <div class="toggle-row" style="border-top:none;padding-bottom:4px;">
                    <div class="toggle-info">
                      <div class="toggle-name">自定义壁纸</div>
                      <div class="toggle-desc">手动输入壁纸图片 URL</div>
                    </div>
                  </div>
                  <div class="input-with-btn" style="margin-top:0;">
                    <div class="history-input-wrap" style="flex:1;">
                      <input
                        type="text"
                        class="setting-input"
                        :value="navWallpaper"
                        placeholder="输入自定义壁纸 URL"
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

                <div class="setting-card">
                  <div class="card-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    自定义内容
                  </div>
                  <div style="display:flex;flex-direction:column;gap:10px;">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
                      <div class="avatar-preview" @click="triggerAvatarUpload">
                        <img v-if="avatarUrl" :src="avatarUrl" alt="avatar" />
                        <div v-else class="avatar-placeholder">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                        </div>
                      </div>
                      <input ref="avatarInput" type="file" accept="image/*" style="display:none" @change="handleAvatarChange" />
                      <div>
                        <div class="toggle-name">头像</div>
                        <div class="toggle-desc">点击上传自定义头像，图片大小不超过 2MB</div>
                      </div>
                      <button v-if="avatarUrl" class="btn-sm" style="color:#f87171;margin-left:auto;" @click="clearAvatar">移除</button>
                    </div>
                    <div class="section-divider"></div>
                    <input
                      type="text"
                      class="setting-input"
                      :value="customTitle"
                      placeholder="导航站"
                      @change="e => updateCustomTitle(e.target.value)"
                    />
                    <textarea
                      class="setting-input"
                      :value="footerContent"
                      placeholder="页脚内容（支持 HTML）"
                      rows="2"
                      @change="e => updateFooterContent(e.target.value)"
                    ></textarea>
                  </div>
                </div>

                <div class="setting-card full-width">
                  <div class="card-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                    代理设置与图标源测试
                  </div>
                  <div class="input-label" style="margin-bottom:4px;">代理设置</div>
                  <input
                    type="text"
                    class="setting-input"
                    :value="proxyUrl"
                    placeholder="代理地址（如 https://proxy.example.com/icon）"
                    style="margin-bottom:10px;"
                    @change="e => updateProxyUrl(e.target.value)"
                  />
                  <div class="input-with-btn">
                    <input
                      v-model="testDomain"
                      type="text"
                      class="setting-input"
                      placeholder="测试域名（如 google.com）"
                      @keyup.enter="handleTestAll"
                    />
                    <button class="btn-primary-sm" @click="handleTestAll" :disabled="isTesting || !testDomain.trim()">
                      {{ isTesting ? '测试中...' : '测试' }}
                    </button>
                  </div>
                  <div v-if="testResults.length > 0" style="margin-top:12px;overflow-x:auto;">
                    <table class="test-table">
                      <thead>
                        <tr>
                          <th>源</th>
                          <th>直连</th>
                          <th v-if="proxyUrl">代理</th>
                          <th>URL</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="result in testResults" :key="result.id">
                          <td class="source-name">
                            {{ result.name }}
                            <span v-if="!result.enabled" class="status-disabled">(未启用)</span>
                          </td>
                          <td>
                            <span v-if="!result.enabled" class="status-disabled">&minus;</span>
                            <span v-else-if="result.direct.loading" class="status-loading">测试中...</span>
                            <span v-else-if="result.direct.success" class="status-ok">{{ result.direct.size }} {{ result.direct.duration }}ms</span>
                            <span v-else class="status-fail">失败</span>
                          </td>
                          <td v-if="proxyUrl">
                            <span v-if="result.proxy.loading" class="status-loading">测试中...</span>
                            <span v-else-if="result.proxy.success" class="status-ok">{{ result.proxy.size }} {{ result.proxy.duration }}ms</span>
                            <span v-else-if="result.proxy.testedUrl" class="status-fail">失败</span>
                            <span v-else class="status-disabled">&minus;</span>
                          </td>
                          <td class="url-cell">{{ result.direct.testedUrl }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <!-- Data -->
            <div v-show="activeTab === 'data'" class="tab-panel">
              <div class="panel-header">
                <h2 class="panel-title">数据管理</h2>
                <p class="panel-desc">导入、导出、备份和管理书签</p>
              </div>
              <div class="settings-grid">
                <div class="setting-card">
                  <div class="card-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    操作
                  </div>
                  <div class="action-row" @click="$emit('action', 'importExport')">
                    <div class="action-info">
                      <div class="action-name">导入 / 导出</div>
                      <div class="action-desc">备份或恢复书签数据</div>
                    </div>
                    <span class="action-arrow">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </span>
                  </div>
                  <div class="action-row" @click="$emit('action', 'backup')">
                    <div class="action-info">
                      <div class="action-name">云备份</div>
                      <div class="action-desc">同步数据到云端</div>
                    </div>
                    <span class="action-arrow">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </span>
                  </div>
                  <div class="action-row" :style="{ opacity: emptyCategoryCount === 0 ? 0.5 : 1 }" @click="emptyCategoryCount > 0 && $emit('action', 'cleanup')">
                    <div class="action-info">
                      <div class="action-name">清空空分类</div>
                      <div class="action-desc">{{ emptyCategoryCount > 0 ? `当前有 ${emptyCategoryCount} 个空分类` : '暂无空分类' }}</div>
                    </div>
                    <span class="action-arrow">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </span>
                  </div>
                </div>

                <div class="setting-card">
                  <div class="card-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                    统计
                  </div>
                  <div class="stats-bento">
                    <div class="stat-block">
                      <div class="stat-number"><span class="accent">{{ totalBookmarks }}</span></div>
                      <div class="stat-label">总书签</div>
                    </div>
                    <div class="stat-block">
                      <div class="stat-number">{{ privateBookmarks }}</div>
                      <div class="stat-label">私密</div>
                    </div>
                    <div class="stat-block">
                      <div class="stat-number">{{ categories.length }}</div>
                      <div class="stat-label">分类</div>
                    </div>
                    <div class="stat-block">
                      <div class="stat-number">{{ emptyCategoryCount }}</div>
                      <div class="stat-label">空分类</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Menu -->
            <div v-show="activeTab === 'menu'" class="tab-panel menu-tab">
              <div class="menu-editor-grid">
                <!-- Left: Category Tree -->
                <div class="menu-left-panel">
                  <div class="panel-section-header">
                    <h3>菜单结构</h3>
                    <button class="btn-text-primary" @click="openAddDialog">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
                      新增分类
                    </button>
                  </div>
                  <div class="category-tree-menu">
                    <div v-if="dragState.draggingId" class="drag-hint-menu">{{ dragHintText }}</div>
                    <MenuTreeNode
                      v-for="(category, idx) in categoryTree"
                      :key="category.id"
                      :node="category"
                      :depth="0"
                      :sibling-index="idx"
                      :sibling-count="categoryTree.length"
                      :selected-id="selectedCategoryId"
                      :expanded-ids="expandedCategoryIds"
                      :drag-state="dragState"
                      @select="selectCategory"
                      @drag-start="onDragStart"
                      @drag-end="onDragEnd"
                      @drag-over="onDragOver"
                      @drop="onDrop"
                      @toggle-expand="toggleExpand"
                      @move-item="handleMoveItem"
                    />
                  </div>
                </div>

                <!-- Right: Category Detail Form -->
                <div class="menu-right-panel">
                  <div class="panel-section-header">
                    <h3>分类详情</h3>
                  </div>
                  <div v-if="selectedCategoryData" class="detail-form-menu">
                    <div class="form-group-menu">
                      <label>分类名称</label>
                      <input type="text" v-model="editCategoryForm.name" class="setting-input" @change="handleApplyCategoryChanges" />
                    </div>
                    <div class="form-group-menu">
                      <label>父分类</label>
                      <select v-model="editCategoryForm.parentId" class="setting-input" @change="handleApplyCategoryChanges">
                        <option :value="null">无（根分类）</option>
                        <option v-for="cat in availableParentCategories" :key="cat.id" :value="cat.id" :disabled="cat.id === selectedCategoryId">
                          {{ cat.displayName }}
                        </option>
                      </select>
                    </div>
                    <div class="form-group-menu">
                      <label>位置</label>
                      <div class="position-display">
                        第 {{ editCategoryForm.position }} / 共 {{ editCategoryForm.maxPosition }} 项
                      </div>
                    </div>
                    <div class="danger-zone-menu">
                      <h4>危险区域</h4>
                      <button class="btn-danger-sm" @click="openDeleteConfirm">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                        删除此分类
                      </button>
                      <p class="danger-hint-menu">删除分类将同时删除所有子分类和书签</p>
                    </div>
                  </div>
                  <div v-else class="no-selection-menu">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                      <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/>
                    </svg>
                    <p>选择左侧分类以编辑详情</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bookmark Tab -->
            <div v-show="activeTab === 'bookmark'" class="tab-panel bookmark-tab">
              <div class="bookmark-header">
                <div class="bookmark-header-left">
                  <h2 class="bookmark-title">书签管理</h2>
                  <span class="bookmark-count">共 {{ bookmarks.length }} 个书签</span>
                </div>
                <button class="btn-primary-sm" @click="openBookmarkAdd">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
                  新增
                </button>
              </div>
              <div class="bookmark-toolbar elevated">
                <div class="bookmark-search-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <input
                    v-model="bookmarkSearch"
                    type="text"
                    class="bookmark-search-input"
                    placeholder="搜索书签..."
                  />
                  <div class="search-field-wrap" ref="bmSearchFieldRef">
                    <button ref="bmSearchFieldBtnRef" class="search-field-btn" :class="{ active: bookmarkSearchField !== 'all' }" @click="openBmFieldDropdown" :title="'搜索范围: ' + (SEARCH_FIELD_OPTIONS.find(o => o.value === bookmarkSearchField)?.label || '全部字段')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 3v18M3 12h18"/>
                        <circle cx="10" cy="10" r="3"/>
                        <circle cx="14" cy="14" r="3"/>
                      </svg>
                      <span class="search-field-label">{{ SEARCH_FIELD_OPTIONS.find(o => o.value === bookmarkSearchField)?.label }}</span>
                    </button>
                    <Teleport to="body">
                      <Transition name="dropdown">
                        <div v-if="bookmarkSearchFieldOpen" ref="bmSearchFieldDropdownRef" class="search-field-dropdown" :style="bmDropdownStyle">
                          <div
                            v-for="opt in SEARCH_FIELD_OPTIONS"
                            :key="opt.value"
                            class="search-field-option"
                            :class="{ active: bookmarkSearchField === opt.value }"
                            @click="bookmarkSearchField = opt.value; bookmarkSearchFieldOpen = false"
                          >
                            <span class="field-radio" :class="{ checked: bookmarkSearchField === opt.value }"></span>
                            {{ opt.label }}
                          </div>
                        </div>
                      </Transition>
                    </Teleport>
                  </div>
                </div>
                <div class="custom-select-filter" :class="{ open: filterSelectOpen }" ref="filterSelectRef">
                  <div class="filter-select-trigger" @click="filterSelectOpen = !filterSelectOpen">
                    <span class="filter-select-value">{{ selectedFilterCategoryName || '全部分类' }}</span>
                    <svg class="filter-select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </div>
                  <div v-if="filterSelectOpen" class="filter-select-dropdown">
                    <div
                      class="filter-select-option"
                      :class="{ active: bookmarkCategoryFilter === null }"
                      @click="selectFilterCategory(null)"
                    >全部分类</div>
                    <div
                      v-for="cat in categoryFlatList"
                      :key="cat.id"
                      class="filter-select-option"
                      :class="{ active: bookmarkCategoryFilter === cat.id }"
                      @click="selectFilterCategory(cat.id)">
                      {{ cat.displayName }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="bookmark-list">
                <template v-for="group in groupedBookmarks" :key="group.categoryId || '__none__'">
                  <div class="bookmark-group-header">
                    <div class="group-header-left">
                      <span class="group-header-bar"></span>
                      <span class="group-header-name">{{ getCategoryName(group.categoryId) }}</span>
                      <span class="group-header-count">{{ group.bookmarks.length }}</span>
                    </div>
                  </div>
                  <div
                    v-for="bm in group.bookmarks"
                    :key="bm.id"
                    class="bookmark-item"
                    :class="{ selected: selectedBookmarks.has(bm.id) }"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedBookmarks.has(bm.id)"
                      @change="toggleBookmarkSelection(bm.id)"
                      class="bookmark-checkbox"
                    />
                    <div class="bookmark-icon">
                      <img v-if="bm.url" :src="getFaviconUrl(bm.url)" alt="" @error="$event.target.style.display='none'" />
                    </div>
                    <div class="bookmark-info">
                      <div class="bookmark-name">{{ bm.name }}</div>
                      <div class="bookmark-url">{{ bm.url }}</div>
                    </div>
                    <div class="bookmark-category-path">{{ getCategoryPathForBookmark(bm.category_id) }}</div>
                    <div class="bookmark-actions">
                      <button class="bookmark-action-btn" @click="openBookmarkEdit(bm)">编辑</button>
                      <button class="bookmark-action-btn bookmark-action-delete" @click="deleteBookmarkItem(bm)">删除</button>
                    </div>
                  </div>
                </template>
                <div v-if="groupedBookmarks.length === 0" class="bookmark-empty">
                  <p>没有找到匹配的书签</p>
                </div>
              </div>
              <div v-if="selectedBookmarks.size > 0" class="bookmark-footer">
                <span class="bookmark-selected-count">已选择 {{ selectedBookmarks.size }} 个</span>
                <div class="bookmark-batch-actions">
                  <button class="btn-secondary-sm" @click="toggleSelectAll">全选/取消</button>
                  <button class="btn-danger-sm" @click="batchDeleteBookmarks">删除选中</button>
                  <select v-model="bookmarkMoveTarget" class="bookmark-move-select">
                    <option :value="null">移动到...</option>
                    <option v-for="cat in categoryFlatList" :key="cat.id" :value="cat.id">
                      {{ cat.displayName }}
                    </option>
                  </select>
                  <button class="btn-primary-sm" :disabled="!bookmarkMoveTarget" @click="batchMoveBookmarks">移动</button>
                </div>
              </div>
            </div>

            <!-- AI -->
            <div v-show="activeTab === 'ai'" class="tab-panel">
              <div class="panel-header">
                <h2 class="panel-title">AI 助手</h2>
                <p class="panel-desc">配置 AI 功能以获取智能书签建议</p>
              </div>
              <div class="ai-status-bar" :class="{ enabled: aiEnabled }">
                <span class="ai-status-dot"></span>
                <span class="ai-status-text">{{ aiEnabled ? 'AI 功能已启用' : 'AI 功能未配置' }}</span>
              </div>

              <div v-if="isAuthenticated" class="ai-stack">
                <div class="setting-card full-width">
                  <div class="card-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                    </svg>
                    配置
                  </div>
                  <div class="config-fields">
                    <div>
                      <div class="input-label">API 密钥</div>
                      <div class="api-key-input-wrapper">
                        <input v-model="localApiKey" :type="showApiKey ? 'text' : 'password'" placeholder="sk-..." class="setting-input" />
                        <button class="btn-toggle-visibility" @click="showApiKey = !showApiKey">
                          <svg v-if="showApiKey" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div>
                      <div class="input-label">Base URL</div>
                      <input v-model="localBaseUrl" type="text" class="setting-input" />
                    </div>
                    <div>
                      <div class="input-label">模型</div>
                      <input v-model="localModel" type="text" class="setting-input" />
                    </div>
                    <button class="advanced-toggle" @click="showAdvanced = !showAdvanced">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                      高级配置
                    </button>
                    <div v-if="showAdvanced" class="advanced-fields">
                      <div>
                        <div class="input-label">Auth Header</div>
                        <input v-model="localAuthHeader" type="text" class="setting-input" />
                      </div>
                      <div>
                        <div class="input-label">Auth 前缀</div>
                        <input v-model="localAuthPrefix" type="text" class="setting-input" />
                      </div>
                    </div>
                    <button class="btn-primary-sm" style="padding:10px;text-align:center;" @click="saveAISettingsHandler" :disabled="aiSaving">
                      {{ aiSaving ? '保存中...' : '保存配置' }}
                    </button>
                  </div>
                </div>

                <div class="setting-card full-width prompt-card">
                  <div class="card-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    自定义 Prompt
                  </div>
                  <div class="check-row">
                    <span class="check-label">启用自定义提示词</span>
                    <label class="toggle-switch">
                      <input type="checkbox" v-model="localCustomPromptEnabled" />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                  <textarea
                    v-if="localCustomPromptEnabled"
                    v-model="localCustomPrompt"
                      class="setting-input"
                      rows="6"
                      placeholder="输入自定义提示词... 可用变量：{name} {url}"
                  ></textarea>
                  <div v-if="localCustomPromptEnabled" style="margin-top:8px;">
                    <button class="btn-sm" @click="fillPromptTemplate">填充示例</button>
                    <button class="btn-primary-sm" style="margin-left:8px;" @click="savePromptSettings" :disabled="promptSaving">
                      {{ promptSaving ? '保存中...' : '保存 Prompt' }}
                    </button>
                  </div>
                </div>

                <div class="setting-card full-width">
                  <div class="card-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                    功能
                  </div>
                  <div class="ai-features-list">
                    <div class="ai-feature-item">
                      <div class="ai-feature-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </div>
                      <div>
                        <div class="ai-feature-name">智能生成描述</div>
                        <div class="ai-feature-desc">自动生成书签描述</div>
                      </div>
                    </div>
                    <div class="ai-feature-item">
                      <div class="ai-feature-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                      </div>
                      <div>
                        <div class="ai-feature-name">分类推荐</div>
                        <div class="ai-feature-desc">智能分类建议</div>
                      </div>
                    </div>
                    <div class="ai-feature-item">
                      <div class="ai-feature-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </div>
                      <div>
                        <div class="ai-feature-name">批量生成</div>
                        <div class="ai-feature-desc">一次处理多个书签</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="!isAuthenticated" style="padding:24px;text-align:center;color:var(--text-secondary);font-size:0.875rem;">
                <p>登录后可以配置 AI 功能</p>
              </div>
            </div>

            <!-- About -->
            <div v-show="activeTab === 'about'" class="tab-panel">
              <div class="panel-header">
                <h2 class="panel-title">关于</h2>
                <p class="panel-desc">版本信息、技术栈和致谢</p>
              </div>
              <div class="settings-grid">
                <div class="setting-card full-width">
                  <div class="about-logo-area">
                    <div class="about-logo-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <div class="about-title">{{ customTitle || '导航站' }}</div>
                    <div class="about-version">{{ versionInfo }}</div>
                  </div>
                  <div class="about-info-grid">
                    <div class="about-row">
                      <span class="label">框架</span>
                      <span class="value">Vue 3 + Vite</span>
                    </div>
                    <div class="about-row">
                      <span class="label">后端</span>
                      <span class="value">Cloudflare Pages + D1</span>
                    </div>
                    <div class="about-row">
                      <span class="label">运行环境</span>
                      <span class="value">Cloudflare Workers</span>
                    </div>
                    <div class="about-row">
                      <span class="label">许可</span>
                      <span class="value">Apache 2.0</span>
                    </div>
                  </div>
                  <a href="https://github.com/deerwan/nav" target="_blank" class="about-github-link">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    GitHub
                  </a>
                  <div class="about-license">
                    基于 Apache License 2.0 开源
                  </div>
                </div>
              </div>
            </div>
          </main>

          <!-- Pending Bar -->
          <div class="pending-bar" :class="{ visible: hasPendingChanges() }">
            <div class="pending-bar-left">
              <button class="pending-count-btn" @click="showSaveDialog = true">
                {{ getPendingChangeCount() }} 项更改
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <span class="pending-detail-link" @click="showSaveDialog = true">查看详情</span>
            </div>
            <div class="pending-bar-right">
              <button class="btn-discard" @click="handleDiscardAll">放弃</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Dialog 1: Add Category -->
    <Transition name="modal">
      <div v-if="showAddDialog" class="dialog-overlay" @click="showAddDialog = false">
        <div class="dialog-menu" @click.stop>
          <div class="dialog-header">
            <h3>新增分类</h3>
            <button class="dialog-close" @click="showAddDialog = false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="dialog-body">
            <div class="form-group-menu">
              <label>分类名称</label>
              <input
                ref="newCategoryNameInput"
                v-model="newCategoryName"
                type="text"
                class="setting-input"
                placeholder="输入分类名称"
                @keyup.enter="handleConfirmAdd"
              />
            </div>
            <div class="form-group-menu">
              <label>父分类</label>
              <select v-model="newCategoryParentId" class="setting-input">
                <option :value="null">作为根分类</option>
                <option v-for="cat in categoryFlatList" :key="cat.id" :value="cat.id">
                  {{ cat.displayName }}
                </option>
              </select>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="btn-secondary-sm" @click="showAddDialog = false">取消</button>
            <button class="btn-primary-sm" :disabled="!newCategoryName.trim() || categorySaving" @click="handleConfirmAdd">
              {{ categorySaving ? '创建中...' : '创建' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Dialog 2: Delete Confirmation -->
    <Transition name="modal">
      <div v-if="showDeleteConfirm" class="dialog-overlay" @click="showDeleteConfirm = false">
        <div class="dialog-menu" @click.stop>
          <div class="dialog-header">
            <h3>确认删除</h3>
            <button class="dialog-close" @click="showDeleteConfirm = false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="dialog-body">
            <p class="delete-confirm-text">
              确定要删除分类 "<strong>{{ selectedCategoryData?.name }}</strong>" 吗？
            </p>
            <p v-if="selectedCategoryData?.children?.length" class="delete-warning">
              此分类下有 {{ selectedCategoryData.children.length }} 个子分类，它们也会被一并删除。<br/>
              此操作不可恢复。
            </p>
          </div>
          <div class="dialog-footer">
            <button class="btn-secondary-sm" @click="showDeleteConfirm = false">取消</button>
            <button class="btn-danger-sm" @click="handleConfirmDelete">确认删除</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Dialog 3: Save Confirmation -->
    <Transition name="modal">
      <div v-if="showSaveDialog" class="dialog-overlay" @click="showSaveDialog = false">
        <div class="dialog-menu dialog-save" @click.stop>
          <div class="dialog-header">
            <h3>确认保存</h3>
            <button class="dialog-close" @click="showSaveDialog = false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="dialog-body">
            <p class="save-summary">共 {{ getPendingChangeCount() }} 项更改：</p>
            <ul class="change-list">
              <li
                v-for="(change, idx) in pendingChanges"
                :key="idx"
                :class="['change-item', `change-${change.type}`]"
              >
                <span class="change-type">{{ getChangeTypeLabel(change.type) }}</span>
                <span class="change-desc">{{ getChangeDescription(change) }}</span>
              </li>
            </ul>
          </div>
          <div class="dialog-footer">
            <button class="btn-secondary-sm" @click="showSaveDialog = false">取消</button>
            <button class="btn-primary-sm" @click="handleConfirmSave">确认保存</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Dialog 4: Discard Confirmation -->
    <Transition name="modal">
      <div v-if="showDiscardConfirm" class="dialog-overlay" @click="showDiscardConfirm = false">
        <div class="dialog-menu" @click.stop>
          <div class="dialog-header">
            <h3>确认放弃</h3>
            <button class="dialog-close" @click="showDiscardConfirm = false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="dialog-body">
            <p>确定要放弃全部更改吗？此操作不可恢复。</p>
          </div>
          <div class="dialog-footer">
            <button class="btn-secondary-sm" @click="showDiscardConfirm = false">取消</button>
            <button class="btn-danger-sm" @click="handleConfirmDiscard">确认放弃</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Bookmark Add/Edit Dialog -->
    <NavBookmarkEditModal
      :show="showBookmarkDialog"
      :category-options="categoryOptions"
      @close="closeBookmarkDialog"
      @save="handleSaveBookmark"
      ref="navBookmarkEditModalRef"
    />
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useSettings } from '@/composables/useSettings'
import { useTheme } from '@/composables/useTheme'
import { useAuth } from '@/composables/useAuth'
import { useBookmarks } from '@/composables/useBookmarks'
import { useAI } from '@/composables/useAI'
import { useToast } from '@/composables/useToast'
import { useCategoryEditor } from '@/composables/useCategoryEditor'
import { buildCategoryTree, getCategoryPath } from '@/utils/categoryTree'
import { searchBookmarks, SEARCH_FIELD_OPTIONS } from '@/utils/search'
import MenuTreeNode from '@/components/MenuTreeNode.vue'
import NavBookmarkEditModal from '@/components/NavBookmarkEditModal.vue'

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
const { aiEnabled, aiSource, checkAIAvailability, saveAISettings, getAISettings } = useAI()

// Category editor (uses useBookmarks internally)
const {
  categories,
  categoryTree,
  categoryFlatList,
  selectedCategoryId,
  selectedCategory: selectedCategoryData,
  expandedCategoryIds,
  editForm: editCategoryForm,
  availableParentCategories,
  toggleExpand,
  selectCategory,
  moveChildItem,
  dragState,
  dragHintText,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  // Pending system
  pendingChanges,
  initialDataSnapshot,
  captureInitialSnapshot,
  applyFormChanges,
  confirmDelete,
  confirmAddCategory,
  confirmSave,
  discardAll,
  getChangeDescription,
  getChangeTypeLabel,
  getPendingChangeCount,
  hasPendingChanges,
  getPath,
  findItem,
  moveRootItem,
} = useCategoryEditor()

const { bookmarks, fetchData, deleteBookmark, batchOperation, addBookmark, updateBookmark } = useBookmarks()
const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast()

const activeTab = ref('appearance')
const sidebarCollapsed = ref(localStorage.getItem('navSettingsSidebarCollapsed') === 'true')
watch(sidebarCollapsed, (val) => localStorage.setItem('navSettingsSidebarCollapsed', val))

const toggleSidebarCollapsed = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}
const avatarInput = ref(null)
const sliderActive = ref(false)
const showApiHistory = ref(false)
const showWallpaperHistory = ref(false)
const testDomain = ref('')
const isTesting = ref(false)
const testResults = ref([])
const maxMenuItems = ref(7)

const showApiKey = ref(false)
const showAdvanced = ref(false)
const aiSaving = ref(false)
const localApiKey = ref('')
const localBaseUrl = ref('https://api.openai.com/v1')
const localModel = ref('gpt-4o-mini')
const localAuthHeader = ref('Authorization')
const localAuthPrefix = ref('Bearer ')
const localCustomPrompt = ref('')
const localCustomPromptEnabled = ref(false)
const promptSaving = ref(false)

// Dialog state
const showAddDialog = ref(false)
const showDeleteConfirm = ref(false)
const showSaveDialog = ref(false)
const showDiscardConfirm = ref(false)
const newCategoryName = ref('')
const newCategoryParentId = ref(null)
const newCategoryNameInput = ref(null)
const categorySaving = ref(false)

// Bookmark tab state
const bookmarkSearch = ref('')
const bookmarkCategoryFilter = ref(null)
const selectedBookmarks = ref(new Set())
const bookmarkSearchField = ref('all')
const bookmarkSearchFieldOpen = ref(false)
const bmSearchFieldRef = ref(null)
const bmSearchFieldBtnRef = ref(null)
const bmSearchFieldDropdownRef = ref(null)
const bmDropdownStyle = ref({})

const openBmFieldDropdown = () => {
  bookmarkSearchFieldOpen.value = !bookmarkSearchFieldOpen.value
  if (!bookmarkSearchFieldOpen.value) return
  nextTick(() => {
    const rect = bmSearchFieldBtnRef.value?.getBoundingClientRect()
    if (rect) {
      bmDropdownStyle.value = {
        position: 'fixed',
        top: rect.bottom + 4 + 'px',
        right: document.documentElement.clientWidth - rect.right + 'px',
        zIndex: 99999
      }
    }
  })
}

const handleBmSearchClickAway = (e) => {
  if (bmSearchFieldRef.value && !bmSearchFieldRef.value.contains(e.target)) {
    if (bmSearchFieldDropdownRef.value && bmSearchFieldDropdownRef.value.contains(e.target)) return
    bookmarkSearchFieldOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleBmSearchClickAway))
onUnmounted(() => document.removeEventListener('click', handleBmSearchClickAway))

const showBookmarkDialog = ref(false)
const navBookmarkEditModalRef = ref(null)
const bookmarkMoveTarget = ref(null)
const filterSelectOpen = ref(false)
const filterSelectRef = ref(null)

const selectedFilterCategoryName = computed(() => {
  if (bookmarkCategoryFilter.value === null) return ''
  const cat = categoryFlatList.value.find(c => c.id === bookmarkCategoryFilter.value)
  return cat?.name || ''
})

const selectFilterCategory = (id) => {
  bookmarkCategoryFilter.value = id
  filterSelectOpen.value = false
}

const handleFilterClickAway = (e) => {
  if (filterSelectRef.value && !filterSelectRef.value.contains(e.target)) {
    filterSelectOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleFilterClickAway)
})

onUnmounted(() => {
  document.removeEventListener('click', handleFilterClickAway)
})

const categoryOptions = computed(() => {
  if (!categories.value.length) return []
  const { flatList } = buildCategoryTree(categories.value)
  return flatList.map(cat => ({
    id: cat.id,
    displayName: cat.displayName
  }))
})

// Sortable category state
const dragId = ref(null)
const categoryOrder = ref([])

const tabs = [
  {
    id: 'appearance', name: '外观',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33"/><path d="M4.6 9a1.65 1.65 0 0 1-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 1 8.92 4.6"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>'
  },
  {
    id: 'data', name: '数据',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>'
  },
  {
    id: 'menu', name: '菜单',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>'
  },
  {
    id: 'bookmark', name: '书签',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>'
  },
  {
    id: 'ai', name: 'AI',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a4 4 0 0 1 4 4c0 2-2 3-2 5h-4c0-2-2-3-2-5a4 4 0 0 1 4-4z"/><path d="M9 17h6v2a3 3 0 0 1-6 0v-2z"/><path d="M12 22v-3"/></svg>'
  },
  {
    id: 'about', name: '关于',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
  }
]

const themeModes = [
  { value: 'light', label: '亮色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' }
]

const totalBookmarks = computed(() => bookmarks.value.length)
const privateBookmarks = computed(() => bookmarks.value.filter(b => b.is_private).length)
const emptyCategoryCount = ref(0)

const checkEmptyCategories = async () => {
  try {
    const response = await fetch('/api/cleanup-empty-categories', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}` }
    })
    const result = await response.json()
    if (result.success) {
      emptyCategoryCount.value = result.count || 0
    }
  } catch (error) {
    console.error('Failed to check empty categories:', error)
  }
}

watch(() => categories.value, () => {
  checkEmptyCategories()
  // Auto capture initial snapshot when data loads and snapshot is empty
  if (categories.value.length > 0 && initialDataSnapshot.value.length === 0) {
    captureInitialSnapshot()
  }
  // Auto expand root categories to show second level
  if (categories.value.length > 0 && expandedCategoryIds.value.length === 0) {
    categoryTree.value.forEach(cat => {
      if (cat.children?.length > 0 && !expandedCategoryIds.value.includes(cat.id)) {
        expandedCategoryIds.value.push(cat.id)
      }
    })
  }
}, { deep: true })

onMounted(() => {
  checkEmptyCategories()
})

const versionInfo = computed(() => {
  const stored = localStorage.getItem('version')
  return stored || '1.0.0'
})

const sortedCategories = computed(() => {
  if (categoryOrder.value.length > 0) {
    const ordered = categoryOrder.value.map(id => categories.value.find(c => c.id === id)).filter(Boolean)
    const remaining = categories.value.filter(c => !categoryOrder.value.includes(c.id))
    return [...ordered, ...remaining]
  }
  return categories.value
})

const onListDragStart = (id) => {
  dragId.value = id
}

const onListDragOver = (id) => {
  if (dragId.value === null || dragId.value === id) return
  const list = sortedCategories.value
  const fromIdx = list.findIndex(c => c.id === dragId.value)
  const toIdx = list.findIndex(c => c.id === id)
  if (fromIdx === -1 || toIdx === -1) return

  const newOrder = list.map(c => c.id)
  const [moved] = newOrder.splice(fromIdx, 1)
  newOrder.splice(toIdx, 0, moved)
  categoryOrder.value = newOrder
}

const onListDragEnd = () => {
  dragId.value = null
}

const onListDrop = (targetId) => {
  if (dragId.value === null || dragId.value === targetId) return
  const list = sortedCategories.value
  const fromIdx = list.findIndex(c => c.id === dragId.value)
  const toIdx = list.findIndex(c => c.id === targetId)
  if (fromIdx === -1 || toIdx === -1) return

  const newOrder = list.map(c => c.id)
  const [moved] = newOrder.splice(fromIdx, 1)
  newOrder.splice(toIdx, 0, moved)
  categoryOrder.value = newOrder
}

const moveCategory = (index, direction) => {
  const list = sortedCategories.value
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= list.length) return
  const newOrder = list.map(c => c.id)
  const [moved] = newOrder.splice(index, 1)
  newOrder.splice(newIndex, 0, moved)
  categoryOrder.value = newOrder
}

// Use functions from useCategoryEditor (already imported)

// Bookmark tab computed
const filteredBookmarks = computed(() => {
  let result = bookmarks.value
  if (bookmarkCategoryFilter.value) {
    result = result.filter(b => b.category_id === bookmarkCategoryFilter.value)
  }
  if (bookmarkSearch.value) {
    result = searchBookmarks(result, bookmarkSearch.value, { field: bookmarkSearchField.value })
  }
  return result
})

const groupedBookmarks = computed(() => {
  const groups = {}
  filteredBookmarks.value.forEach(bm => {
    const catId = bm.category_id || '__none__'
    if (!groups[catId]) {
      groups[catId] = { categoryId: bm.category_id, bookmarks: [] }
    }
    groups[catId].bookmarks.push(bm)
  })
  const sorted = Object.values(groups)
  sorted.sort((a, b) => {
    const idxA = categoryFlatList.value.findIndex(c => c.id === a.categoryId)
    const idxB = categoryFlatList.value.findIndex(c => c.id === b.categoryId)
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB)
  })
  return sorted
})

function getCategoryPathForBookmark(categoryId) {
  if (!categoryId) return '无分类'
  const { map } = buildCategoryTree(categories.value)
  const path = getCategoryPath(categoryId, map)
  return path.map(c => c.name).join(' / ')
}

function getCategoryName(categoryId) {
  if (!categoryId) return '未分类'
  const cat = categoryFlatList.value.find(c => c.id === categoryId)
  return cat ? cat.displayName : '未分类'
}

function getFaviconUrl(url) {
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
  } catch {
    return ''
  }
}

// Category dialog handlers
const openAddDialog = () => {
  showAddDialog.value = true
  newCategoryName.value = ''
  newCategoryParentId.value = null
  setTimeout(() => newCategoryNameInput.value?.focus(), 100)
}
const handleConfirmAdd = async () => {
  categorySaving.value = true
  try {
    const result = await confirmAddCategory(newCategoryName.value, newCategoryParentId.value)
    if (result.success) {
      toastSuccess('已创建新分类')
      showAddDialog.value = false
      newCategoryName.value = ''
      newCategoryParentId.value = null
    } else {
      toastError(result.error || '创建失败')
    }
  } finally {
    categorySaving.value = false
  }
}

const handleApplyCategoryChanges = async () => {
  if (categorySaving.value) return
  categorySaving.value = true
  try {
    await applyFormChanges()
  } finally {
    categorySaving.value = false
  }
}

const openDeleteConfirm = () => { showDeleteConfirm.value = true }

const handleMoveItem = (node, direction) => {
  const parentId = node.parent_id ?? null
  if (parentId === null) {
    moveRootItem(node.id, direction)
  } else {
    moveChildItem(parentId, node.id, direction)
  }
}
const handleConfirmDelete = async () => {
  categorySaving.value = true
  try {
    const result = await confirmDelete(selectedCategoryId.value)
    if (result.success) {
      showDeleteConfirm.value = false
    }
  } finally {
    categorySaving.value = false
  }
}
const handleConfirmSave = async () => {
  await confirmSave()
  showSaveDialog.value = false
}
const handleDiscardAll = () => { showDiscardConfirm.value = true }
const handleConfirmDiscard = () => { discardAll(); showDiscardConfirm.value = false }

// Bookmark handlers
const toggleBookmarkSelection = (id) => {
  if (selectedBookmarks.value.has(id)) {
    selectedBookmarks.value.delete(id)
  } else {
    selectedBookmarks.value.add(id)
  }
  selectedBookmarks.value = new Set(selectedBookmarks.value)
}
const toggleSelectAll = () => {
  if (selectedBookmarks.value.size === filteredBookmarks.value.length) {
    selectedBookmarks.value.clear()
  } else {
    filteredBookmarks.value.forEach(bm => selectedBookmarks.value.add(bm.id))
  }
  selectedBookmarks.value = new Set(selectedBookmarks.value)
}
const deleteBookmarkItem = async (bookmark) => {
  if (!confirm(`确定要删除书签 "${bookmark.name}" 吗？`)) return
  const result = await deleteBookmark(bookmark.id)
  if (result.success) {
    toastSuccess('已删除书签')
  } else {
    toastError(result.error || '删除失败')
  }
}
const batchDeleteBookmarks = async () => {
  const ids = Array.from(selectedBookmarks.value)
  if (ids.length === 0) return
  if (!confirm(`确定要删除 ${ids.length} 个书签吗？`)) return
  const result = await batchOperation('delete', ids)
  if (result.success) {
    toastSuccess(`已删除 ${ids.length} 个书签`)
    selectedBookmarks.value.clear()
    selectedBookmarks.value = new Set()
  } else {
    toastError('批量删除失败')
  }
}
const batchMoveBookmarks = async () => {
  const ids = Array.from(selectedBookmarks.value)
  if (ids.length === 0 || !bookmarkMoveTarget.value) return
  const result = await batchOperation('moveCategory', ids, { category_id: bookmarkMoveTarget.value })
  if (result.success) {
    toastSuccess(`已移动 ${ids.length} 个书签`)
    selectedBookmarks.value.clear()
    selectedBookmarks.value = new Set()
    bookmarkMoveTarget.value = null
  } else {
    toastError('批量移动失败')
  }
}
const openBookmarkAdd = () => {
  if (navBookmarkEditModalRef.value) {
    navBookmarkEditModalRef.value.open(null)
  }
  showBookmarkDialog.value = true
}
const openBookmarkEdit = (bookmark) => {
  if (navBookmarkEditModalRef.value) {
    navBookmarkEditModalRef.value.open(bookmark)
  }
  showBookmarkDialog.value = true
}
const closeBookmarkDialog = () => {
  showBookmarkDialog.value = false
}
const handleSaveBookmark = async (bookmark, formData) => {
  if (!formData.name.trim() || !formData.url.trim()) {
    toastError('名称和 URL 不能为空')
    return
  }
  let result
  if (bookmark) {
    result = await updateBookmark(bookmark.id, formData)
  } else {
    result = await addBookmark(formData)
  }
  if (result.success) {
    toastSuccess(bookmark ? '已更新书签' : '已添加书签')
    closeBookmarkDialog()
  } else if (result.duplicate) {
    toastError(result.error || '该 URL 已存在')
  } else {
    toastError(result.error || '保存失败')
  }
}

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
      let iconUrl = result.url.replace('{domain}', testDomain.value).replace('{origin}', `https://${testDomain.value}`)
      if (useLarger) iconUrl += iconUrl.includes('?') ? '&larger=true' : '?larger=true'
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
    if (localApiKey.value) settingsToSave.apiKey = localApiKey.value
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
    await fetchData({ forceRefresh: true })
  } else {
    document.body.style.overflow = ''
  }
})

watch(showAddDialog, (val) => {
  if (val) {
    setTimeout(() => newCategoryNameInput.value?.focus(), 100)
  }
})
</script>

<style scoped>
/* ===== CSS Variables ===== */
.nav-settings-overlay {
  --ov-bg: color-mix(in srgb, var(--bg) 88%, transparent);
  --ov-border: var(--border);
  --ov-glow-1: color-mix(in srgb, var(--success) 6%, transparent);
  --ov-glow-2: color-mix(in srgb, var(--info) 4%, transparent);
  --ov-shadow: 0 0 0 1px color-mix(in srgb, var(--shadow) 35%, transparent), 0 40px 120px -20px var(--shadow-xl);

  --sidebar-border: var(--border);
  --text-primary: var(--text);
  --text-secondary: var(--text-secondary);
  --text-muted: var(--text-tertiary);
  --nav-text: var(--text-secondary);
  --nav-text-hover: var(--text);
  --nav-bg-hover: var(--bg-hover);
  --nav-active-bg: color-mix(in srgb, var(--success) 10%, transparent);
  --nav-active-text: var(--success);
  --nav-indicator: var(--success);

  --card-bg: color-mix(in srgb, var(--bg) 78%, transparent);
  --card-border: var(--border);
  --card-border-hover: var(--border-light);
  --card-shadow-hover: 0 8px 32px -12px var(--shadow-md);
  --card-hover-bg: color-mix(in srgb, var(--bg-secondary) 92%, transparent);

  --toggle-bg: var(--bg-tertiary);
  --toggle-dot: var(--text-tertiary);
  --toggle-active-bg: color-mix(in srgb, var(--success) 28%, transparent);
  --toggle-active-dot: var(--success);

  --input-bg: var(--bg-secondary);
  --input-border: var(--border);
  --input-text: var(--text);
  --input-placeholder: var(--text-tertiary);

  --accent: var(--success);
  --accent-bg: color-mix(in srgb, var(--success) 12%, transparent);
  --accent-border: color-mix(in srgb, var(--success) 22%, transparent);

  --slider-track: var(--bg-tertiary);
  --slider-thumb: var(--success);

  --row-divider: var(--border-light);
  --scrollbar-thumb: var(--border);
}

.nav-settings-overlay {
  position: fixed;
  inset: 5%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  border-radius: var(--radius-lg, 16px);
  overflow: hidden;
}

.nav-settings-overlay.slider-active {
  opacity: 0.15 !important;
  pointer-events: none;
}

.nav-settings-modal {
  width: 100%;
  height: 100%;
  background: var(--ov-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 28px;
  border: 1px solid var(--ov-border);
  box-shadow: var(--ov-shadow);
  display: flex;
  overflow: hidden;
  position: relative;
}

.nav-settings-modal::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 28px;
  background: linear-gradient(145deg, var(--ov-glow-1) 0%, var(--ov-glow-2) 30%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}

/* ===== Sidebar ===== */
.settings-sidebar {
  width: 150px;
  flex-shrink: 0;
  padding: 28px 16px;
  border-right: 1px solid var(--sidebar-border);
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
  transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.sidebar-header {
  padding: 0 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--sidebar-border);
}

.sidebar-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.collapse-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: var(--nav-bg-hover);
  border-color: var(--card-border);
  color: var(--text-primary);
}

.collapse-btn svg { width: 14px; height: 14px; }

.modal-close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--nav-bg-hover);
  border: 1px solid var(--card-border);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-close-btn:hover {
  background: color-mix(in srgb, var(--error) 14%, transparent);
  border-color: color-mix(in srgb, var(--error) 22%, transparent);
  color: var(--error);
}

.modal-close-btn svg { width: 14px; height: 14px; }

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 16px;
}

.nav-tab-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: transparent;
  border: none;
  border-radius: 10px;
  color: var(--nav-text);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  text-align: left;
  width: 100%;
  position: relative;
  font-family: inherit;
}

.nav-tab-btn svg {
  width: 16px; height: 16px;
  flex-shrink: 0;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.nav-tab-btn:hover {
  color: var(--nav-text-hover);
  background: var(--nav-bg-hover);
}

.nav-tab-btn.active {
  color: var(--nav-active-text);
  background: var(--nav-active-bg);
}

.nav-tab-btn.active::before {
  content: '';
  position: absolute;
  left: -16px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--nav-indicator);
  border-radius: 0 3px 3px 0;
}

.nav-tab-btn.active svg { opacity: 1; }

/* ===== Content ===== */
.settings-content {
  flex: 1;
  padding: 28px 20px;
  overflow-y: auto;
  position: relative;
  z-index: 1;
}

.settings-content::-webkit-scrollbar { width: 4px; }
.settings-content::-webkit-scrollbar-track { background: transparent; }
.settings-content::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 2px; }

.tab-panel { animation: fadeSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1); }

@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.panel-header { margin-bottom: 28px; }
.panel-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}
.panel-desc { font-size: 0.8rem; color: var(--text-secondary); font-weight: 400; }

/* ===== Grid ===== */
.settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.settings-grid .full-width { grid-column: 1 / -1; }

.setting-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 20px;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.setting-card:hover {
  background: var(--card-hover-bg);
  border-color: var(--card-border-hover);
  box-shadow: var(--card-shadow-hover);
}

.card-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-label svg { width: 14px; height: 14px; opacity: 0.5; }

/* ===== Toggle ===== */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}
.toggle-row + .toggle-row { border-top: 1px solid var(--row-divider); }
.toggle-info { flex: 1; }
.toggle-name { font-size: 0.8125rem; font-weight: 500; color: var(--text-primary); }
.toggle-desc { font-size: 0.7rem; color: var(--text-secondary); margin-top: 1px; }

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}
.toggle-switch input { opacity: 0; width: 0; height: 0; }

.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--toggle-bg);
  border-radius: 11px;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: pointer;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 16px; height: 16px;
  left: 3px; bottom: 3px;
  background: var(--toggle-dot);
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.toggle-switch input:checked + .toggle-slider {
  background: var(--toggle-active-bg);
}
.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(18px);
  background: var(--toggle-active-dot);
}

/* ===== Theme Selector ===== */
.theme-selector { display: flex; gap: 6px; }

.theme-btn {
  flex: 1;
  padding: 8px 10px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  text-align: center;
  font-family: inherit;
}

.theme-btn:hover { background: var(--nav-bg-hover); color: var(--nav-text-hover); }
.theme-btn.active {
  background: var(--accent-bg);
  border-color: var(--accent-border);
  color: var(--accent);
}

/* ===== Input ===== */
.setting-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 10px;
  color: var(--input-text);
  font-size: 0.8125rem;
  font-family: inherit;
  outline: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.setting-input:focus {
  border-color: var(--accent-border);
  background: var(--card-hover-bg);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.06);
}

.setting-input::placeholder { color: var(--input-placeholder); }

.setting-input[disabled] {
  opacity: 0.4;
  cursor: not-allowed;
}

textarea.setting-input {
  min-height: 80px;
  resize: vertical;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 0.75rem;
  line-height: 1.6;
}

.input-with-btn { display: flex; gap: 8px; }
.input-with-btn .setting-input { flex: 1; }

.input-label {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.btn-sm {
  padding: 8px 14px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  font-family: inherit;
}
.btn-sm:hover { background: var(--nav-bg-hover); color: var(--nav-text-hover); }

.btn-primary-sm {
  padding: 8px 14px;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  border-radius: 10px;
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: inherit;
  white-space: nowrap;
}
.btn-primary-sm:hover { background: rgba(16, 185, 129, 0.18); }
.btn-primary-sm:disabled { opacity: 0.5; cursor: not-allowed; }

/* ===== Slider ===== */
.slider-row { display: flex; align-items: center; gap: 12px; }

.slider-row input[type="range"] {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: var(--slider-track);
  border-radius: 2px;
  outline: none;
}

.slider-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px; height: 16px;
  background: var(--slider-thumb);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid var(--accent-border);
  transition: all 0.15s;
}

.slider-row input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
}

.slider-value {
  min-width: 42px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
  font-family: 'SF Mono', Monaco, monospace;
  text-align: right;
}

.slider-label { font-size: 0.75rem; color: var(--text-secondary); }

/* ===== Credit ===== */
.sidebar-footer {
  padding-top: 12px;
  border-top: 1px solid var(--sidebar-border, rgba(255,255,255,0.05));
}

.credit-text {
  font-size: 0.6rem;
  color: var(--text-muted);
  text-align: center;
  padding: 6px 0;
  opacity: 0.6;
  letter-spacing: 0.02em;
}

/* ===== Collapsed Sidebar ===== */
.settings-sidebar.collapsed {
  width: 52px;
  min-width: 52px;
  padding: 28px 8px;
}

.settings-sidebar.collapsed .sidebar-title {
  display: none;
}

.settings-sidebar.collapsed .nav-tab-btn {
  justify-content: center;
  padding: 10px 0;
  gap: 0;
}

.settings-sidebar.collapsed .nav-tab-btn span {
  display: none;
}

.settings-sidebar.collapsed .nav-tab-btn.active::before {
  left: -8px;
}

.settings-sidebar.collapsed .sidebar-footer {
  display: none;
}

.settings-sidebar.collapsed .collapse-btn {
  border: none;
  background: transparent;
}

.settings-sidebar.collapsed .collapse-btn:hover {
  background: var(--nav-bg-hover);
}

/* ===== Test Table ===== */
.test-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.7rem;
}

.test-table th {
  text-align: left;
  padding: 8px 10px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--row-divider);
  font-weight: 500;
  white-space: nowrap;
}

.test-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--row-divider);
  color: var(--text-primary);
}

.test-table tr:last-child td { border-bottom: none; }

.source-name { font-weight: 500; }
.status-ok { color: var(--accent); }
.status-fail { color: var(--error); }
.status-loading { color: var(--accent); opacity: 0.7; }
.status-disabled { color: var(--text-muted); }
.url-cell {
  font-size: 0.65rem;
  color: var(--text-muted);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== AI Stack ===== */
.ai-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.advanced-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-left: 8px;
}

/* ===== Stats ===== */
.stats-bento { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }

.stat-block {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 18px;
  text-align: center;
}

.stat-number {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.03em;
  line-height: 1;
  font-family: 'SF Mono', Monaco, monospace;
}

.stat-number .accent { color: var(--accent); }

.stat-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-top: 6px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 500;
}

/* ===== Action Row ===== */
.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  cursor: pointer;
  transition: all 0.2s;
}
.action-row + .action-row { border-top: 1px solid var(--row-divider); }
.action-row:hover .action-arrow { transform: translateX(4px); }

.action-info .action-name { font-size: 0.8125rem; font-weight: 500; color: var(--text-primary); }
.action-info .action-desc { font-size: 0.7rem; color: var(--text-secondary); margin-top: 1px; }

.action-arrow { color: var(--text-muted); transition: all 0.2s; }
.action-arrow svg { width: 16px; height: 16px; }

/* ===== Sortable ===== */
.sortable-list { display: flex; flex-direction: column; gap: 6px; }

.sortable-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: default;
}

.sortable-item:hover {
  background: var(--card-hover-bg);
  border-color: var(--card-border-hover);
}

.sortable-item.dragging { opacity: 0.4; }

.sort-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--text-muted);
  cursor: grab;
  flex-shrink: 0;
  transition: color 0.2s;
}
.sort-handle:hover { color: var(--text-secondary); }
.sort-handle:active { cursor: grabbing; }
.sort-handle svg { width: 16px; height: 16px; }

.sort-order-num {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-muted);
  font-family: 'SF Mono', Monaco, monospace;
  min-width: 18px;
  text-align: center;
}

.sort-item-info { flex: 1; min-width: 0; }
.sort-item-name { font-size: 0.8125rem; font-weight: 600; color: var(--text-primary); }
.sort-item-meta { font-size: 0.7rem; color: var(--text-secondary); margin-top: 1px; }

.sort-badge {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.1);
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sort-arrows {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sort-arrow-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px; height: 18px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.sort-arrow-btn:hover:not(:disabled) {
  background: var(--nav-bg-hover);
  color: var(--nav-text-hover);
  border-color: var(--card-border);
}

.sort-arrow-btn:disabled { opacity: 0.25; cursor: not-allowed; }
.sort-arrow-btn svg { width: 12px; height: 12px; }

/* ===== Menu Editor Grid ===== */
.menu-tab {
  padding: 0 !important;
}

.menu-editor-grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 0.75rem;
  min-height: 500px;
  padding: 0.5rem;
}

.menu-left-panel {
  border-right: 1px solid var(--card-border);
  padding: 1rem;
  overflow-y: auto;
  max-height: 600px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  margin: 0.5rem;
}

.menu-right-panel {
  padding: 1rem;
  overflow-y: auto;
  max-height: 600px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  margin: 0.5rem;
}

.panel-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: var(--card-bg);
}

.panel-section-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
}

.btn-text-primary {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  transition: all 0.15s;
}

.btn-text-primary:hover {
  background: var(--accent-alpha-10);
}

.drag-hint-menu {
  background: var(--accent-alpha-10);
  border: 1px solid var(--accent);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  font-size: 0.8rem;
  color: var(--accent);
  text-align: center;
}

.category-tree-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.drag-hint-menu {
  background: var(--accent-alpha-10);
  border: 1px solid var(--accent);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  font-size: 0.8rem;
  color: var(--accent);
  text-align: center;
}

/* Detail Form */
.detail-form-menu {
  padding: 0.5rem 0;
}

.detail-form-menu .form-group-menu:first-child {
  margin-top: 0.5rem;
}

.detail-form-menu .form-group-menu:last-of-type {
  margin-bottom: 1.5rem;
}

.form-group-menu {
  margin-bottom: 1rem;
}

.form-group-menu label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 0.375rem;
}

.form-group-menu .setting-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--card-border);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text);
  font-size: 0.875rem;
  transition: all 0.2s;
}

.form-group-menu .setting-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-alpha-10);
}

.position-controls-menu {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.icon-btn-menu {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 2px solid var(--card-border);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.icon-btn-menu:hover:not(:disabled) {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--ov-bg);
}

.icon-btn-menu:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.position-value-menu {
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent);
  min-width: 2rem;
  text-align: center;
}

.form-actions-menu {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  margin-top: 0.75rem;
  background: var(--card-bg);
}

.btn-secondary-sm {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--card-border);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary-sm:hover {
  background: var(--nav-bg-hover);
}

.btn-primary-sm {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: var(--ov-bg);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary-sm:hover {
  filter: brightness(1.1);
}

.danger-zone-menu {
  margin-top: 1.5rem;
  padding: 1rem;
  border: 1px solid var(--error-alpha-20);
  border-radius: 8px;
  background: color-mix(in srgb, var(--error) 4%, transparent);
}

.danger-zone-menu h4 {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--error);
  margin-bottom: 0.5rem;
}

.btn-danger-sm {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 8px;
  background: var(--error);
  color: white;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  transition: all 0.15s;
}

.btn-danger-sm:hover {
  filter: brightness(1.1);
}

.danger-hint-menu {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 0.375rem;
}

.no-selection-menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: var(--text-muted);
  text-align: center;
  border: 1px dashed var(--card-border);
  border-radius: 8px;
  margin: 0.5rem 0;
}

.no-selection-menu svg {
  opacity: 0.3;
  margin-bottom: 0.75rem;
}

.no-selection-menu p {
  font-size: 0.875rem;
}

/* ===== Avatar ===== */
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

.avatar-preview img { width: 100%; height: 100%; object-fit: cover; }

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--input-bg);
  color: var(--text-muted);
}

.avatar-placeholder svg { width: 24px; height: 24px; }

/* ===== History Dropdown ===== */
.history-input-wrap { position: relative; }

.history-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--nav-bg);
  border: 1px solid var(--nav-border);
  border-radius: 10px;
  overflow: hidden;
  z-index: 10;
  box-shadow: 0 12px 40px var(--shadow-xl);
}

.history-item {
  padding: 8px 12px;
  font-size: 0.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.history-item:hover {
  background: var(--nav-bg-hover);
  color: var(--text-primary);
}

/* ===== AI ===== */
.ai-status-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  margin-bottom: 16px;
}

.ai-status-bar.enabled {
  background: rgba(16, 185, 129, 0.06);
  border-color: rgba(16, 185, 129, 0.12);
}

.ai-status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--toggle-dot);
  flex-shrink: 0;
}

.ai-status-bar.enabled .ai-status-dot {
  background: var(--accent);
  animation: breathe 2s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.2); }
}

.ai-status-text { font-size: 0.8rem; color: var(--text-secondary); }
.ai-status-bar.enabled .ai-status-text { color: var(--accent); }

.ai-features-list { display: flex; flex-direction: column; gap: 10px; }

.ai-feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 10px;
}

.ai-feature-icon {
  width: 32px; height: 32px;
  border-radius: 8px;
  background: var(--accent-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ai-feature-icon svg { width: 16px; height: 16px; color: var(--accent); }

.ai-feature-name { font-size: 0.8125rem; font-weight: 500; color: var(--text-primary); }
.ai-feature-desc { font-size: 0.7rem; color: var(--text-secondary); margin-top: 1px; }

.api-key-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.api-key-input-wrapper .setting-input { flex: 1; }

.btn-toggle-visibility {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.btn-toggle-visibility:hover {
  color: var(--accent);
  border-color: var(--accent-border);
}

.btn-toggle-visibility svg { width: 18px; height: 18px; }

.advanced-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 6px 0;
  transition: color 0.2s;
  font-family: inherit;
}

.advanced-toggle:hover { color: var(--text-primary); }
.advanced-toggle svg { width: 12px; height: 12px; }

.prompt-card { margin-top: 16px; }

.check-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.check-label { font-size: 0.8125rem; color: var(--text-primary); }

/* ===== About ===== */
.about-logo-area { text-align: center; padding: 16px 0; }

.about-logo-icon {
  width: 56px; height: 56px;
  background: linear-gradient(135deg, var(--accent-bg), rgba(6, 182, 212, 0.08));
  border: 1px solid var(--accent-border);
  border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 12px;
}

.about-logo-icon svg { width: 28px; height: 28px; color: var(--accent); }

.about-title { font-size: 1.05rem; font-weight: 700; color: var(--text-primary); }
.about-version {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 4px;
  font-family: 'SF Mono', Monaco, monospace;
}

.about-info-grid { display: grid; gap: 2px; margin-top: 16px; }

.about-row {
  display: flex; justify-content: space-between;
  padding: 10px 14px;
  background: var(--card-bg);
  border-radius: 8px;
  font-size: 0.8rem;
}

.about-row .label { color: var(--text-secondary); }
.about-row .value { color: var(--text-primary); font-weight: 500; }

.about-github-link {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin-top: 16px; padding: 10px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.8125rem;
  transition: all 0.2s;
}

.about-github-link:hover { background: var(--nav-bg-hover); color: var(--nav-text-hover); }
.about-github-link svg { width: 16px; height: 16px; }

.about-license {
  text-align: center; font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 16px; padding-top: 16px;
  border-top: 1px solid var(--row-divider);
}

/* ===== Modal Transition ===== */
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

/* ===== Responsive ===== */
@media (max-width: 900px) {
  .nav-settings-overlay { inset: 0; border-radius: 0; }
  .nav-settings-modal { flex-direction: column; border-radius: 0; }
  .settings-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--sidebar-border);
    padding: 16px;
  }
  .settings-sidebar.collapsed {
    width: 100%;
    min-width: unset;
    padding: 16px;
  }
  .settings-sidebar.collapsed .sidebar-title,
  .settings-sidebar.collapsed .nav-tab-btn span,
  .settings-sidebar.collapsed .sidebar-footer {
    display: revert;
  }
  .settings-sidebar.collapsed .nav-tab-btn {
    justify-content: flex-start;
    padding: 10px 14px;
    gap: 10px;
  }
  .settings-sidebar.collapsed .nav-tab-btn.active::before {
    left: -16px;
  }
  .sidebar-nav { flex-direction: row; overflow-x: auto; padding-top: 8px; gap: 4px; }
  .nav-tab-btn { white-space: nowrap; flex-shrink: 0; }
  .nav-tab-btn::before { display: none; }
  .settings-content { padding: 20px; }
      .settings-grid { grid-template-columns: 1fr; }
}

/* ===== Pending Bar ===== */
.pending-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--card-bg);
  border-top: 1px solid var(--card-border);
  padding: 0.875rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 10;
}
.pending-bar.visible {
  transform: translateY(0);
}
.pending-bar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pending-bar-right {
  display: flex;
  align-items: center;
}
.pending-count-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  border-radius: 8px;
  color: var(--accent);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}
.pending-count-btn:hover {
  background: rgba(16, 185, 129, 0.18);
}
.pending-count-btn svg {
  transition: transform 0.2s;
}
.pending-count-btn:hover svg {
  transform: rotate(180deg);
}
.pending-detail-link {
  font-size: 0.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: all 0.2s;
}
.pending-detail-link:hover {
  color: var(--accent);
  text-decoration-color: var(--accent);
}
.btn-discard {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}
.btn-discard:hover {
  background: color-mix(in srgb, var(--error) 12%, transparent);
  border-color: color-mix(in srgb, var(--error) 22%, transparent);
  color: var(--error);
}

/* ===== Dialogs ===== */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: var(--nav-glass);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}
.dialog-menu {
  background: var(--nav-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--nav-border);
  border-radius: 16px;
  width: 90%;
  max-width: 440px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 48px var(--shadow-xl);
}
.dialog-save {
  max-width: 520px;
}
.dialog-bookmark {
  max-width: 500px;
}
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--card-border);
}
.dialog-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}
.dialog-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.dialog-close:hover {
  background: color-mix(in srgb, var(--error) 12%, transparent);
  color: var(--error);
}
.dialog-body {
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--card-border);
}

/* Delete confirmation */
.delete-confirm-text {
  font-size: 0.875rem;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}
.delete-confirm-text strong {
  color: var(--accent);
}
.delete-warning {
  font-size: 0.8rem;
  color: var(--error);
  background: color-mix(in srgb, var(--error) 10%, transparent);
  padding: 10px 12px;
  border-radius: 8px;
  margin: 0;
  line-height: 1.5;
}

/* Save confirmation */
.save-summary {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin: 0 0 12px 0;
}
.change-list {
  list-style: none;
  max-height: 300px;
  overflow-y: auto;
  padding: 0;
  margin: 0;
}
.change-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 6px;
  font-size: 0.8125rem;
}
.change-item:last-child {
  margin-bottom: 0;
}
.change-create {
  background: color-mix(in srgb, var(--success) 10%, transparent);
  border-left: 3px solid var(--success);
}
.change-rename {
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  border-left: 3px solid var(--primary);
}
.change-reorder {
  background: color-mix(in srgb, var(--warning) 10%, transparent);
  border-left: 3px solid var(--warning);
}
.change-move {
  background: color-mix(in srgb, var(--info) 10%, transparent);
  border-left: 3px solid var(--info);
}
.change-delete {
  background: color-mix(in srgb, var(--error) 10%, transparent);
  border-left: 3px solid var(--error);
}
.change-type {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}
.change-create .change-type { color: var(--success); background: color-mix(in srgb, var(--success) 18%, transparent); }
.change-rename .change-type { color: var(--primary); background: color-mix(in srgb, var(--primary) 18%, transparent); }
.change-reorder .change-type { color: var(--warning); background: color-mix(in srgb, var(--warning) 18%, transparent); }
.change-move .change-type { color: var(--info); background: color-mix(in srgb, var(--info) 18%, transparent); }
.change-delete .change-type { color: var(--error); background: color-mix(in srgb, var(--error) 18%, transparent); }
.change-desc {
  color: var(--text-primary);
  line-height: 1.4;
}

/* Position display */
.position-display {
  font-size: 0.875rem;
  color: var(--text-secondary);
  padding: 8px 0;
}

/* ===== Bookmark Tab ===== */
.bookmark-tab {
  padding: 0 !important;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.bookmark-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--card-border);
}
.bookmark-header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.bookmark-header .btn-primary-sm {
  padding: 4px 8px;
  font-size: 0.75rem;
  white-space: nowrap;
  flex-shrink: 0;
  flex: none;
}
.bookmark-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}
.bookmark-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
}
.bookmark-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--card-border);
}
.bookmark-toolbar.elevated {
  position: relative;
  z-index: 2;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.bookmark-search-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 8px;
  transition: all 0.2s;
}
.bookmark-search-wrap:focus-within {
  border-color: var(--accent-border);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.06);
}
.bookmark-search-wrap svg {
  color: var(--text-muted);
  flex-shrink: 0;
}
.bookmark-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.8125rem;
  font-family: inherit;
}

.bookmark-search-input::placeholder {
  color: var(--input-placeholder);
}
.custom-select-filter {
  position: relative;
  min-width: 130px;
}

.filter-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 10px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s;
  user-select: none;
}

.filter-select-trigger:hover {
  border-color: var(--accent-border);
}

.custom-select-filter.open .filter-select-trigger {
  border-color: var(--accent-border);
}

.filter-select-value {
  font-size: 0.75rem;
  color: var(--input-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.filter-select-arrow {
  width: 14px;
  height: 14px;
  stroke-width: 2;
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform 0.2s;
}

.custom-select-filter.open .filter-select-arrow {
  transform: rotate(180deg);
}

.filter-select-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  z-index: 100;
  max-height: 220px;
  overflow-y: auto;
}

.filter-select-option {
  padding: 8px 12px;
  font-size: 0.75rem;
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s;
}

.filter-select-option:hover {
  background: var(--bg-secondary);
}

.filter-select-option.active {
  color: var(--accent);
  font-weight: 600;
}
.bookmark-list {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  min-height: 0;
}
.bookmark-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 6px 14px;
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg);
  cursor: pointer;
  user-select: none;
}
.bookmark-group-header .group-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bookmark-group-header .group-header-bar {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--accent);
  flex-shrink: 0;
}
.bookmark-group-header .group-header-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.01em;
}
.bookmark-group-header .group-header-count {
  font-size: 0.65rem;
  color: var(--text-muted);
  background: var(--bg-secondary);
  padding: 1px 6px;
  border-radius: 6px;
  font-weight: 500;
}
.bookmark-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--row-divider);
  transition: background 0.15s;
}
.bookmark-item:hover {
  background: var(--card-hover-bg);
}
.bookmark-item.selected {
  background: var(--accent-bg);
}
.bookmark-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--accent);
}
.bookmark-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.bookmark-icon img {
  width: 16px;
  height: 16px;
  border-radius: 2px;
}
.bookmark-info {
  flex: 1;
  min-width: 0;
}
.bookmark-name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bookmark-url {
  font-size: 0.7rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bookmark-category-path {
  font-size: 0.7rem;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bookmark-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.bookmark-action-btn {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.7rem;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.bookmark-action-btn:hover {
  background: var(--nav-bg-hover);
  color: var(--text-primary);
}
.bookmark-action-delete:hover {
  background: color-mix(in srgb, var(--error) 12%, transparent);
  border-color: color-mix(in srgb, var(--error) 22%, transparent);
  color: var(--error);
}
.bookmark-empty {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--text-muted);
}
.bookmark-empty p {
  font-size: 0.875rem;
}
.bookmark-footer {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--card-border);
  background: var(--card-bg);
}
.bookmark-selected-count {
  font-size: 0.75rem;
  color: var(--accent);
  font-weight: 600;
}
.bookmark-batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-width: 0;
  margin-left: auto;
}
.bookmark-batch-actions .btn-secondary-sm,
.bookmark-batch-actions .btn-danger-sm,
.bookmark-batch-actions .btn-primary-sm {
  flex: none;
  white-space: nowrap;
  width: auto;
}
.bookmark-move-select {
  padding: 4px 8px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.75rem;
  font-family: inherit;
  cursor: pointer;
  outline: none;
  max-width: 120px;
}
</style>

<style>
/* Non-scoped: <option> elements don't inherit scoped data-v attributes */
.bookmark-move-select option,
.dialog-bookmark .setting-input option,
.dialog-menu .setting-input option {
  background: var(--bg);
  color: var(--text);
}

/* Unified search field dropdown styles (shared with NavSearch.vue) */
/* Uses global CSS variables (--text-tertiary, --bg-secondary, --border, --success, --text) */
/* because Teleported elements don't inherit scoped CSS variable definitions */
.search-field-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-field-btn {
  background: none;
  border: none;
  outline: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 6px;
  color: var(--text-tertiary);
  transition: all 0.2s;
  font-size: 0.8rem;
}

.search-field-btn:hover {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
}

.search-field-btn.active {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 15%, transparent);
}

.search-field-label {
  font-size: 0.75rem;
  line-height: 1;
}

.search-field-dropdown {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 6px;
  min-width: 120px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.15);
}

.search-field-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 0.85rem;
  color: var(--text);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
  white-space: nowrap;
}

.search-field-option:hover {
  background: color-mix(in srgb, var(--success) 10%, transparent);
}

.search-field-option.active {
  color: var(--success);
}

.field-radio {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--text-tertiary);
  flex-shrink: 0;
  transition: all 0.2s;
}

.field-radio.checked {
  border-color: var(--success);
  background: var(--success);
  box-shadow: inset 0 0 0 3px var(--bg-secondary);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
