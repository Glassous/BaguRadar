import { onScopeDispose, readonly, ref } from 'vue'

// 全局只挂一个 window keydown：各组件通过 useShortcuts 注册自己的键位表，
// 由这里统一做守卫与层级仲裁，避免多个监听器互相抢占、同一次按键被处理两遍。

const PREFIX_TIMEOUT = 1200
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable]'
const INTERACTIVE_SELECTOR = 'button, a[href], summary, [role="button"], [role="tab"], [role="option"]'

const layers = []
const helpOpen = ref(false)

let pendingPrefix = ''
let prefixTimer = 0
let scopeSeq = 0
let bound = false

/** 键位表里的键名统一成小写；单字符保留大小写，用来区分 g 与 G。 */
function normalizeBinding(binding) {
  return String(binding)
    .trim()
    .split(/\s+/)
    .map((token) => (token.length === 1 ? token : token.toLowerCase()))
    .join(' ')
}

function normalizeEventKey(event) {
  const key = event.key
  if (!key) return ''
  if (key === ' ' || key === 'Spacebar' || event.code === 'Space') {
    return event.shiftKey ? 'shift+space' : 'space'
  }
  // 单字符已经由浏览器带上 Shift 语义（? 与 G），不再额外加前缀
  if (key.length === 1) return key
  return key.toLowerCase()
}

/** 焦点在输入类元素上时，任何单键都应交给原生输入行为。 */
export function isTypingTarget(target) {
  return target instanceof Element && Boolean(target.closest(EDITABLE_SELECTOR))
}

function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR))
}

function layerActive(layer) {
  return typeof layer.active === 'function' ? Boolean(layer.active()) : true
}

/** 有模态层（帮助 / 设置）打开时，下层键位一律不参与匹配。 */
export function isModalBlocked() {
  return layers.some((layer) => layer.modal && layerActive(layer))
}

export function openHelp() {
  helpOpen.value = true
}

export function closeHelp() {
  helpOpen.value = false
}

function clearPrefix() {
  if (!pendingPrefix) return
  pendingPrefix = ''
  window.clearTimeout(prefixTimer)
  prefixTimer = 0
}

function armPrefix(token) {
  pendingPrefix = token
  window.clearTimeout(prefixTimer)
  prefixTimer = window.setTimeout(() => {
    pendingPrefix = ''
    prefixTimer = 0
  }, PREFIX_TIMEOUT)
}

function activeLayers() {
  const modalOpen = isModalBlocked()
  return layers.filter((layer) => layerActive(layer) && (!modalOpen || layer.modal))
}

function runHandler(event, handler) {
  clearPrefix()
  event.preventDefault()
  handler(event)
}

function handleKeydown(event) {
  // 已被其他处理器消费、或输入法正在组字时直接放行
  if (event.defaultPrevented || event.isComposing) return
  // 带修饰键的组合一律交给浏览器与组件自身，单键体系只处理裸键与 Shift 组合
  if (event.ctrlKey || event.metaKey || event.altKey) {
    clearPrefix()
    return
  }

  const token = normalizeEventKey(event)
  if (!token) return

  if (isTypingTarget(event.target)) {
    clearPrefix()
    return
  }
  // 空格在按钮/链接上要保留“激活”这一原生语义
  if (token === 'space' && isInteractiveTarget(event.target)) return

  const pool = activeLayers()

  // 前缀序列（g h / g g）：先找跨层的续接绑定，再退化成单键匹配
  if (pendingPrefix) {
    for (const layer of pool) {
      for (const entry of layer.entries) {
        if (entry.parts.length === 2 && entry.parts[0] === pendingPrefix && entry.parts[1] === token) {
          runHandler(event, entry.handler)
          return
        }
      }
    }
  }

  for (const layer of pool) {
    for (const entry of layer.entries) {
      if (entry.parts.length === 1 && entry.parts[0] === token) {
        runHandler(event, entry.handler)
        return
      }
    }
  }

  if (!pendingPrefix) {
    const startsPrefix = pool.some((layer) =>
      layer.entries.some((entry) => entry.parts.length === 2 && entry.parts[0] === token),
    )
    if (startsPrefix) {
      armPrefix(token)
      event.preventDefault()
      return
    }
  }

  clearPrefix()
}

function ensureBound() {
  if (bound || typeof window === 'undefined') return
  bound = true
  window.addEventListener('keydown', handleKeydown)
}

/**
 * 注册一段键位表。只能在组件 setup 或 effectScope 内调用，卸载时自动注销。
 * @param {string} scope 作用域标识（便于排查冲突）
 * @param {Record<string, (event: KeyboardEvent) => void>} bindings 键位到处理函数
 * @param {{ priority?: number, modal?: boolean, active?: () => boolean }} [options]
 *   priority 越大越优先；modal 层打开时会屏蔽其他层；active 返回 false 时整层失效
 */
export function useShortcuts(scope, bindings, options = {}) {
  const { priority = 0, modal = false, active = null } = options

  const entries = Object.entries(bindings)
    .filter(([, handler]) => typeof handler === 'function')
    .map(([binding, handler]) => ({
      parts: normalizeBinding(binding).split(' '),
      handler,
    }))

  const layer = {
    id: `${scope}#${(scopeSeq += 1)}`,
    priority,
    modal,
    entries,
    active,
  }

  layers.push(layer)
  // 高优先级在前：匹配时第一个命中的层生效
  layers.sort((a, b) => b.priority - a.priority)
  ensureBound()

  onScopeDispose(() => {
    const index = layers.indexOf(layer)
    if (index !== -1) layers.splice(index, 1)
    clearPrefix()
  })
}

export function useShortcutsHelp() {
  return { helpOpen: readonly(helpOpen), openHelp, closeHelp }
}
