<template>
  <BaseDialog :show="show" title="新增分类" max-width="440px" body-fill @close="handleClose">
    <div class="form-group-menu">
      <label>分类名称</label>
      <input
        ref="nameInput"
        v-model="name"
        type="text"
        class="setting-input"
        placeholder="输入分类名称"
        @keyup.enter="handleConfirm"
      />
    </div>

    <div class="form-group-menu is-grow">
      <label>父分类</label>
      <CategoryParentPicker
        v-model="parentId"
        :options="parentOptions"
        root-label="作为根分类"
        note="分类会排在所选父分类的末尾；同一父分类下不能重名。"
        max-height="240px"
        fill
      />
    </div>

    <template #footer>
      <button class="btn-secondary-sm" @click="handleClose">取消</button>
      <button class="btn-primary-sm" :disabled="!name.trim() || saving" @click="handleConfirm">
        {{ saving ? '创建中...' : '创建' }}
      </button>
    </template>
  </BaseDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import BaseDialog from './BaseDialog.vue'
import CategoryParentPicker from './CategoryParentPicker.vue'
import { buildParentOptions } from '@/utils/categoryParents.js'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  categories: {
    type: Array,
    default: () => []
  },
  defaultParentId: {
    type: [String, Number],
    default: null
  },
  saving: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'confirm'])

const name = ref('')
const parentId = ref(null)
const nameInput = ref(null)

const parentOptions = computed(() => buildParentOptions(props.categories))

const handleClose = () => {
  emit('close')
}

const handleConfirm = () => {
  const trimmedName = name.value.trim()
  if (!trimmedName || props.saving) return
  emit('confirm', { name: trimmedName, parentId: parentId.value })
}

watch(() => props.show, (visible) => {
  if (!visible) return
  name.value = ''
  parentId.value = props.defaultParentId ?? null
  setTimeout(() => nameInput.value?.focus(), 100)
})
</script>

<style scoped>
.form-group-menu {
  margin-bottom: 14px;
}

.form-group-menu:last-child {
  margin-bottom: 0;
}

/* 父分类组吃掉弹窗剩余高度：窗口矮时由列表自己缩短，
   而不是让 .dialog-body 滚动把列表底部和提示裁掉 */
.form-group-menu.is-grow {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.form-group-menu.is-grow > label {
  flex: 0 0 auto;
}

.form-group-menu label {
  display: block;
  margin-bottom: 6px;
  color: var(--nav-text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
}

.setting-input {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 12px;
  border: 1px solid var(--nav-border);
  border-radius: 8px;
  background: var(--nav-card-bg);
  color: var(--nav-text);
  font-size: 0.875rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.setting-input:focus {
  border-color: color-mix(in srgb, var(--nav-primary) 55%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--nav-primary) 15%, transparent);
}

.setting-input::placeholder {
  color: var(--nav-text-secondary);
}
</style>
