// 统一的悬停提示：替代浏览器原生 title，支持快捷键键帽、自动翻转与键盘聚焦。
// 全局只维护一个 DOM 节点，避免每个按钮各挂一层浮层。

const SHOW_DELAY = 150
const HIDE_DELAY = 80
const GAP = 8
const EDGE = 8

const states = new WeakMap()

let host = null
let activeEl = null
let showTimer = 0
let hideTimer = 0
let dismissBound = false

function canHover() {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(hover: hover)').matches
}

function normalize(value) {
  if (typeof value === 'string') return { text: value.trim(), key: '', placement: 'top' }
  if (value && typeof value === 'object') {
    return {
      text: String(value.text ?? '').trim(),
      key: value.key ? String(value.key) : '',
      placement: value.placement === 'bottom' ? 'bottom' : 'top',
    }
  }
  return { text: '', key: '', placement: 'top' }
}

function ensureHost() {
  if (host) return host
  host = document.createElement('div')
  host.className = 'app-tooltip'
  host.setAttribute('role', 'tooltip')
  host.setAttribute('aria-hidden', 'true')
  document.body.appendChild(host)
  return host
}

/** 写入文案与键帽；返回配置，空文案返回 null 表示不展示。 */
function render(value) {
  const config = normalize(value)
  if (!config.text) return null

  const el = ensureHost()
  el.textContent = ''

  const text = document.createElement('span')
  text.className = 'app-tooltip__text'
  text.textContent = config.text
  el.appendChild(text)

  if (config.key) {
    const key = document.createElement('kbd')
    key.className = 'app-tooltip__key'
    key.textContent = config.key
    el.appendChild(key)
  }

  el.dataset.placement = config.placement
  return config
}

function place(el, target, placement) {
  const rect = target.getBoundingClientRect()
  const box = el.getBoundingClientRect()

  let side = placement
  if (side === 'top' && rect.top - box.height - GAP < EDGE) side = 'bottom'
  else if (side === 'bottom' && rect.bottom + box.height + GAP > window.innerHeight - EDGE) side = 'top'

  const centered = rect.left + rect.width / 2 - box.width / 2
  const x = Math.min(Math.max(EDGE, centered), Math.max(EDGE, window.innerWidth - box.width - EDGE))
  const y = side === 'top' ? rect.top - box.height - GAP : rect.bottom + GAP

  el.style.left = `${Math.round(x)}px`
  el.style.top = `${Math.round(y)}px`
  el.dataset.side = side
}

function onDismissKey(event) {
  if (event.key === 'Escape') hideNow()
}

function bindDismiss() {
  if (dismissBound) return
  dismissBound = true
  // 滚动时目标位置已经失效，直接收起比跟随更稳
  window.addEventListener('scroll', hideNow, true)
  window.addEventListener('resize', hideNow)
  window.addEventListener('blur', hideNow)
  document.addEventListener('keydown', onDismissKey, true)
}

function unbindDismiss() {
  if (!dismissBound) return
  dismissBound = false
  window.removeEventListener('scroll', hideNow, true)
  window.removeEventListener('resize', hideNow)
  window.removeEventListener('blur', hideNow)
  document.removeEventListener('keydown', onDismissKey, true)
}

function hideNow() {
  window.clearTimeout(showTimer)
  window.clearTimeout(hideTimer)
  showTimer = 0
  hideTimer = 0
  activeEl = null
  unbindDismiss()
  host?.classList.remove('is-visible')
}

function showNow(target) {
  const state = states.get(target)
  if (!state || !canHover()) return

  const config = render(state.value)
  if (!config) return

  const el = ensureHost()
  activeEl = target
  el.classList.remove('is-visible')
  place(el, target, config.placement)
  // 强制同步一次布局：从隐藏态进入时位移过渡要从当前位置起步
  void el.offsetWidth
  el.classList.add('is-visible')
  bindDismiss()
}

function scheduleShow(target, delay) {
  window.clearTimeout(hideTimer)
  hideTimer = 0
  window.clearTimeout(showTimer)
  showTimer = window.setTimeout(() => {
    showTimer = 0
    showNow(target)
  }, delay)
}

function scheduleHide() {
  window.clearTimeout(showTimer)
  showTimer = 0
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(hideNow, HIDE_DELAY)
}

/**
 * v-tooltip="'文案'" 或 v-tooltip="{ text, key, placement }"
 * key 会渲染成一枚键帽，placement 支持 top / bottom。
 */
export const tooltip = {
  mounted(el, binding) {
    // 原生 title 会和自绘提示重叠，挂载时直接摘掉
    el.removeAttribute('title')

    const state = { value: binding.value, listeners: {} }

    const onEnter = () => scheduleShow(el, SHOW_DELAY)
    const onLeave = () => scheduleHide()
    const onFocus = (event) => {
      // 只有键盘聚焦才弹提示，鼠标点击不该顺带冒一个
      try {
        if (!event.target.matches(':focus-visible')) return
      } catch {
        // 老浏览器不支持 :focus-visible，退化成不提示
        return
      }
      scheduleShow(el, 0)
    }
    const onBlur = () => scheduleHide()
    const onClick = () => hideNow()

    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
    el.addEventListener('focusin', onFocus)
    el.addEventListener('focusout', onBlur)
    el.addEventListener('click', onClick, true)

    state.listeners = { onEnter, onLeave, onFocus, onBlur, onClick }
    states.set(el, state)
  },

  updated(el, binding) {
    const state = states.get(el)
    if (!state) return
    // title 可能被模板重新写回，更新时再摘一次
    el.removeAttribute('title')

    if (binding.value === binding.oldValue) return
    state.value = binding.value
    if (activeEl !== el || !host) return

    // 提示正挂着时内容要立刻跟上（例如标题随路由变化）
    const config = render(binding.value)
    if (!config) hideNow()
    else place(host, el, config.placement)
  },

  beforeUnmount(el) {
    const state = states.get(el)
    if (!state) return

    const { onEnter, onLeave, onFocus, onBlur, onClick } = state.listeners
    el.removeEventListener('mouseenter', onEnter)
    el.removeEventListener('mouseleave', onLeave)
    el.removeEventListener('focusin', onFocus)
    el.removeEventListener('focusout', onBlur)
    el.removeEventListener('click', onClick, true)

    states.delete(el)
    if (activeEl === el) hideNow()
  },
}
