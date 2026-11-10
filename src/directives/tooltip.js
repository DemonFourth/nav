// src/directives/tooltip.js
// v-tooltip 指令：显示跟随鼠标的自定义 tooltip
// 用法：v-tooltip="'文本'" | v-tooltip="变量" | v-tooltip="条件 ? '文本' : ''"
// 空字符串/undefined 时不显示

let tooltipEl = null
let activeEl = null
let hideTimeout = null
let showTimeout = null
let followRaf = null
let pointerX = 0
let pointerY = 0
const SHOW_DELAY = 500

function ensureTooltip() {
  if (tooltipEl) return tooltipEl
  tooltipEl = document.createElement('div')
  tooltipEl.className = 'app-tooltip'
  tooltipEl.setAttribute('role', 'tooltip')
  document.body.appendChild(tooltipEl)
  return tooltipEl
}

function removeTooltip() {
  if (tooltipEl && tooltipEl.parentNode) {
    tooltipEl.parentNode.removeChild(tooltipEl)
  }
  tooltipEl = null
}

function positionTooltip(x, y) {
  if (!tooltipEl) return
  const offset = 12
  let left = x + offset
  let top = y + offset

  const rect = tooltipEl.getBoundingClientRect()
  if (left + rect.width > window.innerWidth) {
    left = x - rect.width - offset
  }
  if (top + rect.height > window.innerHeight) {
    top = y - rect.height - offset
  }
  if (left < 0) left = 0
  if (top < 0) top = 0

  tooltipEl.style.left = left + 'px'
  tooltipEl.style.top = top + 'px'
  tooltipEl.style.position = 'fixed'
}

function showTooltip(el, text) {
  const tip = ensureTooltip()
  tip.textContent = text
  tip.classList.add('visible')
  positionTooltip(pointerX, pointerY)
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.classList.remove('visible')
}

const onMouseEnter = (event) => {
  const el = event.currentTarget
  const text = el.__vTooltipText
  if (!text) return
  activeEl = el
  pointerX = event.clientX
  pointerY = event.clientY
  clearTimeout(hideTimeout)
  clearTimeout(showTimeout)
  showTimeout = setTimeout(() => {
    const currentText = el.__vTooltipText
    if (!currentText) return
    showTooltip(el, currentText)
  }, SHOW_DELAY)
}

const onMouseMove = (event) => {
  pointerX = event.clientX
  pointerY = event.clientY
  if (activeEl !== event.currentTarget || !tooltipEl?.classList.contains('visible')) return
  if (followRaf) return
  followRaf = requestAnimationFrame(() => {
    followRaf = null
    positionTooltip(pointerX, pointerY)
  })
}

const onMouseLeave = () => {
  clearTimeout(showTimeout)
  if (followRaf) {
    cancelAnimationFrame(followRaf)
    followRaf = null
  }
  if (!activeEl) return
  hideTimeout = setTimeout(hideTooltip, 100)
  activeEl = null
}

const onScroll = () => {
  clearTimeout(showTimeout)
  hideTooltip()
}

export const tooltipDirective = {
  mounted(el, binding) {
    el.__vTooltipText = binding.value
    el.addEventListener('mouseenter', onMouseEnter)
    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mouseleave', onMouseLeave)
    if (!window.__vTooltipScrollBound) {
      window.__vTooltipScrollBound = true
      window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    }
  },
  updated(el, binding) {
    el.__vTooltipText = binding.value
    // 文案被清空（如关联下拉已展开）时立即收起，不等鼠标移出
    if (!binding.value && activeEl === el) {
      clearTimeout(showTimeout)
      hideTooltip()
      activeEl = null
    }
  },
  unmounted(el) {
    el.removeEventListener('mouseenter', onMouseEnter)
    el.removeEventListener('mousemove', onMouseMove)
    el.removeEventListener('mouseleave', onMouseLeave)
    delete el.__vTooltipText
    if (activeEl === el) {
      clearTimeout(showTimeout)
      if (followRaf) {
        cancelAnimationFrame(followRaf)
        followRaf = null
      }
      hideTooltip()
      activeEl = null
    }
  },
}

export default tooltipDirective
