<template>
  <aside class="menu-detail" aria-label="分类详情">
    <template v-if="node">
      <header class="detail-head">
        <div class="detail-eyebrow">分类详情</div>
        <h3 class="detail-title" :title="node.name">{{ node.name }}</h3>
        <p class="detail-path" :title="meta?.parentPath || '根分类'">
          {{ meta?.parentPath || '根分类' }}
        </p>
      </header>

      <div class="detail-body">
        <div class="detail-field">
          <label class="detail-label" for="menu-detail-name">名称</label>
          <input
            id="menu-detail-name"
            ref="nameInputRef"
            class="detail-input"
            type="text"
            maxlength="40"
            autocomplete="off"
            :value="name"
            :disabled="saving"
            @input="$emit('update:name', $event.target.value)"
            @keydown.enter.prevent="$emit('save')"
            @keydown.esc.prevent="$emit('cancel')"
          />
          <p v-if="nameError" class="detail-error">{{ nameError }}</p>
        </div>

        <div class="detail-field">
          <div class="detail-label-row">
            <label class="detail-label" for="menu-detail-description">描述</label>
            <span class="detail-counter">{{ description.length }}/50</span>
          </div>
          <input
            id="menu-detail-description"
            ref="descriptionInputRef"
            class="detail-input"
            type="text"
            maxlength="50"
            autocomplete="off"
            placeholder="可选，导航栏悬浮时显示"
            :value="description"
            :disabled="saving"
            @input="$emit('update:description', $event.target.value)"
            @keydown.enter.prevent="$emit('save')"
            @keydown.esc.prevent="$emit('cancel')"
          />
        </div>

        <dl class="detail-meta">
          <div class="detail-meta-row">
            <dt>父级</dt>
            <dd>
              <span class="detail-meta-value" :title="meta?.parentName || '根分类'">
                {{ meta?.parentName || '根分类' }}
              </span>
              <button class="detail-link" type="button" :disabled="saving" @click="$emit('action', 'move')">
                移动到…
              </button>
            </dd>
          </div>
          <div class="detail-meta-row">
            <dt>位置</dt>
            <dd>
              <span class="detail-meta-value">
                第 {{ meta?.position ?? 1 }} / 共 {{ meta?.siblingCount ?? 1 }} 项
              </span>
            </dd>
          </div>
          <div class="detail-meta-row">
            <dt>书签</dt>
            <dd>
              <span class="detail-meta-value">{{ meta?.bookmarkCount ?? 0 }} 个（含子分类）</span>
            </dd>
          </div>
          <div class="detail-meta-row">
            <dt>子分类</dt>
            <dd>
              <span class="detail-meta-value">{{ meta?.childCount ?? 0 }} 个</span>
            </dd>
          </div>
        </dl>

        <div class="detail-tip">同级排序请直接拖拽左侧行；跨层级请用「移动到…」。</div>

        <div class="detail-actions">
          <button class="detail-action" type="button" :disabled="saving" @click="$emit('action', 'create-child')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            新建子分类
          </button>
          <button class="detail-action is-danger" type="button" :disabled="saving" @click="$emit('action', 'delete')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            删除分类
          </button>
        </div>
      </div>

      <footer class="detail-footer">
        <span v-if="dirty" class="detail-dirty">
          <span class="detail-dirty-dot"></span>
          未保存
        </span>
        <button class="detail-btn" type="button" :disabled="!dirty || saving" @click="$emit('cancel')">
          取消
        </button>
        <button class="detail-btn is-primary" type="button" :disabled="!dirty || saving" @click="$emit('save')">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </footer>
    </template>

    <div v-else class="detail-empty">
      <p>选择左侧分类查看详情</p>
    </div>
  </aside>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  node: {
    type: Object,
    default: null
  },
  name: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  meta: {
    type: Object,
    default: null
  },
  dirty: {
    type: Boolean,
    default: false
  },
  saving: {
    type: Boolean,
    default: false
  },
  nameError: {
    type: String,
    default: ''
  }
})

defineEmits(['update:name', 'update:description', 'save', 'cancel', 'action'])

const nameInputRef = ref(null)
const descriptionInputRef = ref(null)

const focusName = () => {
  nameInputRef.value?.focus()
  nameInputRef.value?.select?.()
}

const focusDescription = () => {
  descriptionInputRef.value?.focus()
  descriptionInputRef.value?.select?.()
}

defineExpose({ focusName, focusDescription })
</script>

<style scoped>
.menu-detail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  border-left: 1px solid var(--nav-border, var(--border));
  background: color-mix(in srgb, var(--nav-bg, var(--bg)) 55%, transparent);
}

/* ===== 头部 ===== */
.detail-head {
  flex: 0 0 auto;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--nav-border, var(--border));
}

.detail-eyebrow {
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.detail-title {
  margin: 4px 0 2px;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-path {
  margin: 0;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== 表单 ===== */
.detail-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overscroll-behavior: contain;
}

.detail-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.detail-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.detail-counter {
  font-size: 0.625rem;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.detail-input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 9px;
  border: 1px solid var(--nav-border, var(--border));
  border-radius: 8px;
  background: var(--input-bg, var(--bg-secondary));
  color: var(--text);
  font-size: 0.75rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.detail-input:focus {
  border-color: color-mix(in srgb, var(--nav-primary) 55%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.detail-input::placeholder {
  color: var(--text-tertiary);
}

.detail-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.detail-error {
  margin: 0;
  font-size: 0.6875rem;
  color: var(--error);
}

/* ===== 元信息 ===== */
.detail-meta {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.detail-meta-row dt {
  flex: 0 0 44px;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.detail-meta-row dd {
  flex: 1;
  min-width: 0;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.detail-meta-value {
  flex: 1;
  min-width: 0;
  font-size: 0.6875rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-link {
  flex-shrink: 0;
  padding: 2px 8px;
  border: 1px solid var(--nav-border, var(--border));
  border-radius: 6px;
  background: transparent;
  color: var(--nav-primary);
  font-size: 0.625rem;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.detail-link:hover:not(:disabled) {
  background: color-mix(in srgb, var(--nav-primary) 12%, transparent);
  border-color: color-mix(in srgb, var(--nav-primary) 40%, transparent);
}

.detail-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.detail-tip {
  padding: 8px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--nav-primary) 7%, transparent);
  font-size: 0.625rem;
  line-height: 1.5;
  color: var(--text-tertiary);
}

/* ===== 操作 ===== */
.detail-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-action {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid var(--nav-border, var(--border));
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.detail-action svg {
  width: 13px;
  height: 13px;
}

.detail-action:hover:not(:disabled) {
  background: var(--nav-bg-hover, var(--bg-hover));
  color: var(--text);
}

.detail-action.is-danger {
  color: var(--error);
  border-color: color-mix(in srgb, var(--error) 28%, transparent);
}

.detail-action.is-danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--error) 12%, transparent);
  color: var(--error);
}

.detail-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== 底部保存条 ===== */
.detail-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--nav-border, var(--border));
  background: var(--nav-glass, var(--bg));
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
}

.detail-dirty {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-right: auto;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.detail-dirty-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nav-primary);
}

.detail-btn {
  padding: 6px 14px;
  border: 1px solid var(--nav-border, var(--border));
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.detail-btn:hover:not(:disabled) {
  background: var(--nav-bg-hover, var(--bg-hover));
  color: var(--text);
}

.detail-btn.is-primary {
  border-color: color-mix(in srgb, var(--nav-primary) 45%, transparent);
  background: color-mix(in srgb, var(--nav-primary) 14%, transparent);
  color: var(--nav-primary);
  font-weight: 500;
}

.detail-btn.is-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--nav-primary) 22%, transparent);
}

.detail-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ===== 空态 ===== */
.detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  text-align: center;
}
</style>
