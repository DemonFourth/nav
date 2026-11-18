<template>
  <BaseDialog :show="show" :title="dialogTitle" max-width="480px" @close="emit('close')">
    <div class="move-dialog">
      <CategoryParentPicker
        v-model="selectedParentId"
        :options="options"
        :root-current="currentParentId === null"
        list-label="目标分类"
        search-placeholder="搜索目标分类…"
        note="换父级后分类会追加到目标分类末尾，可在列表中拖拽微调顺序。"
        max-height="320px"
      />
    </div>

    <template #footer>
      <div class="move-footer">
        <span class="move-current">当前：{{ currentPathLabel }}</span>
        <div class="move-footer-actions">
          <button type="button" class="btn-secondary-sm" @click="emit('close')">取消</button>
          <button type="button" class="btn-primary-sm" :disabled="!canConfirm" @click="confirm">
            {{ saving ? '移动中…' : '移动' }}
          </button>
        </div>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import BaseDialog from '@/components/BaseDialog.vue'
import CategoryParentPicker from '@/components/CategoryParentPicker.vue'
import { buildParentOptions } from '@/utils/categoryParents.js'
import { buildCategoryTree, getCategoryPath } from '@/utils/categoryTree.js'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  category: {
    type: Object,
    default: null
  },
  categories: {
    type: Array,
    default: () => []
  },
  saving: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'confirm'])

const selectedParentId = ref(null)

const currentParentId = computed(() => props.category?.parent_id ?? null)

const dialogTitle = computed(() =>
  props.category ? `移动「${props.category.name}」到…` : '移动到…'
)

const options = computed(() => {
  if (!props.category) return []
  return buildParentOptions(props.categories, {
    excludeId: props.category.id,
    currentParentId: currentParentId.value
  })
})

const currentPathLabel = computed(() => {
  if (!props.category) return '根分类'
  if (currentParentId.value === null) return '根分类'
  const { map } = buildCategoryTree(props.categories)
  const path = getCategoryPath(currentParentId.value, map)
  return path.length ? path.map(item => item.name).join(' / ') : '根分类'
})

const canConfirm = computed(() =>
  !props.saving &&
  props.category != null &&
  selectedParentId.value !== currentParentId.value
)

const confirm = () => {
  if (!canConfirm.value) return
  emit('confirm', { parentId: selectedParentId.value })
}

watch(() => props.show, (visible) => {
  if (!visible) return
  selectedParentId.value = currentParentId.value
})
</script>

<style scoped>
.move-dialog {
  display: flex;
  flex-direction: column;
}

.move-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.move-current {
  flex: 1;
  min-width: 0;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.move-footer-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
