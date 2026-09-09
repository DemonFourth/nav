<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// 懒加载图标：slot 内容（<img>）仅在元素进入视口附近时才渲染，
// 避免一次性为所有书签并发请求图标。各界面通过 size 传入图标盒尺寸。

defineProps({
  size: {
    type: Number,
    default: 24
  }
})

const rootRef = ref(null)
const visible = ref(false)
let observer = null

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) {
      visible.value = true
      observer?.disconnect()
    }
  }, { rootMargin: '200px 0px' })
  if (rootRef.value) observer.observe(rootRef.value)
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <span
    ref="rootRef"
    class="lazy-icon"
    :style="{ width: size + 'px', height: size + 'px' }"
  >
    <slot v-if="visible" />
  </span>
</template>

<style scoped>
.lazy-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
