import { onBeforeUnmount, watch } from 'vue'

// 把页面内的浮层接到浏览器历史栈上：浮层打开时压一条无 URL 变化的记录，
// 这样 Android 的返回键 / 返回手势只会先关掉浮层，而不会直接退页面或退出应用。

const STATE_KEY = '__baguradarOverlay'
const stack = []
let seq = 0
let bound = false

function currentMarker() {
  const state = window.history.state
  return state && typeof state === 'object' ? state[STATE_KEY] || null : null
}

function clearMarker() {
  const state = window.history.state
  if (!state || typeof state !== 'object' || !(STATE_KEY in state)) return
  const next = { ...state }
  delete next[STATE_KEY]
  window.history.replaceState(next, '')
}

function handlePopState() {
  const current = currentMarker()
  // 找到当前历史条目对应的浮层深度，其上方的一律关闭
  let keep = -1
  if (current) {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (stack[i].marker === current) {
        keep = i
        break
      }
    }
  }

  while (stack.length - 1 > keep) {
    const record = stack.pop()
    record.close()
  }
}

function bind() {
  if (bound || typeof window === 'undefined') return
  bound = true
  window.addEventListener('popstate', handlePopState)
}

function push(id, close) {
  bind()
  if (stack.some((record) => record.id === id)) return

  const marker = `${id}#${(seq += 1)}`
  window.history.pushState({ ...(window.history.state || {}), [STATE_KEY]: marker }, '')
  stack.push({ id, marker, close })
}

function drop(id, { back = false } = {}) {
  const index = stack.findIndex((record) => record.id === id)
  if (index === -1) return

  const isTop = index === stack.length - 1
  const [record] = stack.splice(index, 1)

  if (!back) {
    // 仅清理当前条目上的标记：历史条目本身保留，交给路由或下一次返回自然消费
    if (currentMarker() === record.marker) clearMarker()
    return
  }

  if (isTop && currentMarker() === record.marker) window.history.back()
}

/**
 * 让浮层响应系统返回键。
 * @param {string} id 浮层唯一标识
 * @param {import('vue').Ref<boolean>} isOpen 浮层开关
 */
export function useBackClose(id, isOpen) {
  watch(isOpen, (open) => {
    if (open) {
      push(id, () => {
        isOpen.value = false
      })
      return
    }
    drop(id, { back: true })
  })

  onBeforeUnmount(() => drop(id))
}

// 因导航而关闭浮层时调用：只丢弃记录，不回退历史，避免和路由 push 抢栈
export function dismissOverlay(id) {
  drop(id)
}
