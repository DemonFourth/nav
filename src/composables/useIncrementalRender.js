import { ref, computed, watch, nextTick, onUnmounted } from 'vue'

// 行级增量渲染（统一管理）：
// - rows：扁平化行数组（ref/computed）
// - pageSize：每批渲染行数
// - scrollRootRef：滚动容器 ref（默认视口）
// - activateWhen：getter，变为 true 时初始化观察器（用于 v-if/v-show tab 场景）
// 返回 sentinelRef 供模板绑定哨兵元素，rendered/hasMore 用于渲染。

export function useIncrementalRender(rows, { pageSize = 60, scrollRootRef = null, activateWhen = null } = {}) {
  const sentinelRef = ref(null)
  const visibleCount = ref(pageSize)
  let observer = null

  const hasMore = computed(() => visibleCount.value < rows.value.length)
  const rendered = computed(() => rows.value.slice(0, visibleCount.value))

  function reset() {
    visibleCount.value = rows.value.length > 0
      ? Math.min(pageSize, rows.value.length)
      : pageSize
  }

  function setup() {
    observer?.disconnect()
    const sentinel = sentinelRef.value
    if (!sentinel) return
    const root = scrollRootRef?.value || null
    observer = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting) && hasMore.value) {
        visibleCount.value += pageSize
      }
    }, { root, rootMargin: '300px 0px' })
    observer.observe(sentinel)
  }

  watch(rows, () => {
    reset()
    nextTick(setup)
  })

  if (activateWhen) {
    watch(activateWhen, (val) => {
      if (val) {
        reset()
        nextTick(setup)
      }
    })
  }

  onUnmounted(() => {
    observer?.disconnect()
    observer = null
  })

  return { sentinelRef, rendered, hasMore, reset, setup }
}
