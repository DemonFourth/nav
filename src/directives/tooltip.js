// src/directives/tooltip.js
// v-tooltip 指令：显示跟随鼠标的自定义 tooltip
// 用法：v-tooltip="'文本'" | v-tooltip="变量" | v-tooltip="条件 ? '文本' : ''"
// 空字符串/undefined 时不显示

let tooltipEl = null
let activeEl = null
let hideTimeout = null

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

function showTooltip(el, text, event) {
  const tip = ensureTooltip()
  tip.textContent = text
  tip.classList.add('visible')

  const offset = 12
  let left = event.clientX + offset
  let top = event.clientY + offset

  const rect = tip.getBoundingClientRect()
  if (left + rect.width > window.innerWidth) {
    left = event.clientX - rect.width - offset
  }
  if (top + rect.height > window.innerHeight) {
    top = event.clientY - rect.height - offset
  }
  if (left < 0) left = 0
  if (top < 0) top = 0

  tip.style.left = left + 'px'
  tip.style.top = top + 'px'
  tip.style.position = 'fixed'
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.classList.remove('visible')
}

const onMouseEnter = (event) => {
  const el = event.currentTarget
  const text = el.__vTooltipText
  if (!text) return
  activeEl = el
  clearTimeout(hideTimeout)
  showTooltip(el, text, event)
}

const onMouseLeave = () => {
  if (!activeEl) return
  hideTimeout = setTimeout(hideTooltip, 100)
  activeEl = null
}

const onScroll = () => {
  hideTooltip()
}

export const tooltipDirective = {
  mounted(el, binding) {
    el.__vTooltipText = binding.value
    el.addEventListener('mouseenter', onMouseEnter)
    el.addEventListener('mouseleave', onMouseLeave)
    if (!window.__vTooltipScrollBound) {
      window.__vTooltipScrollBound = true
      window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    }
  },
  updated(el, binding) {
    el.__vTooltipText = binding.value
  },
  unmounted(el) {
    el.removeEventListener('mouseenter', onMouseEnter)
    el.removeEventListener('mouseleave', onMouseLeave)
    delete el.__vTooltipText
    if (activeEl === el) {
      hideTooltip()
      activeEl = null
    }
  },
}

export default tooltipDirective
