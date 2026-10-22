const IDLE_DELAY = 720
const MIN_THUMB = 26
const GUTTER = 8
const BAR_OFFSET = 6
const MOBILE_BREAKPOINT = 1024

const states = new Set()
let frame = 0
let bound = false

function refreshAll() {
  if (frame) return
  frame = window.requestAnimationFrame(() => {
    frame = 0
    states.forEach((state) => apply(state))
  })
}

function metrics(state) {
  const { el } = state
  const rect = el.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth

  const visible =
    viewportWidth >= MOBILE_BREAKPOINT &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.top < viewportHeight &&
    rect.right > 0

  const scrollable = el.scrollHeight > el.clientHeight + 1
  if (!visible || !scrollable) return null

  const trackHeight = Math.max(rect.height - GUTTER * 2, 40)
  const thumbHeight = Math.max(
    MIN_THUMB,
    Math.min(trackHeight, (el.clientHeight / el.scrollHeight) * trackHeight),
  )
  const maxScroll = el.scrollHeight - el.clientHeight
  const progress = maxScroll > 0 ? Math.min(1, Math.max(0, el.scrollTop / maxScroll)) : 0

  return {
    trackHeight,
    thumbHeight,
    progress,
    maxScroll,
    travel: trackHeight - thumbHeight,
    top: rect.top + GUTTER,
    left: rect.right - BAR_OFFSET,
  }
}

function apply(state) {
  const data = metrics(state)
  state.data = data

  if (!data) {
    state.bar.style.display = 'none'
    state.bar.classList.remove('is-visible')
    return
  }

  state.bar.style.display = 'block'
  state.bar.style.top = `${data.top}px`
  state.bar.style.left = `${data.left}px`
  state.bar.style.height = `${data.trackHeight}px`
  state.thumb.style.height = `${data.thumbHeight}px`
  state.thumb.style.transform = `translateY(${data.progress * data.travel}px)`
}

function hide(state) {
  state.bar.classList.remove('is-visible')
}

function scheduleHide(state) {
  window.clearTimeout(state.timer)
  state.timer = window.setTimeout(() => {
    if (!state.dragging) hide(state)
  }, IDLE_DELAY)
}

function reveal(state) {
  apply(state)
  if (!state.data) return
  state.bar.classList.add('is-visible')
  scheduleHide(state)
}

function onScroll(state) {
  reveal(state)
}

function onThumbPointerDown(state, event) {
  if (!state.data) return
  event.preventDefault()
  state.dragging = true
  state.startY = event.clientY
  state.startScroll = state.el.scrollTop
  state.thumb.setPointerCapture(event.pointerId)
  state.bar.classList.add('is-visible')
  window.clearTimeout(state.timer)
}

function onThumbPointerMove(state, event) {
  if (!state.dragging) return
  const data = metrics(state)
  if (!data || data.travel <= 0) return
  const delta = event.clientY - state.startY
  const next = state.startScroll + (delta / data.travel) * data.maxScroll
  state.el.scrollTop = Math.max(0, Math.min(data.maxScroll, next))
}

function onThumbPointerUp(state) {
  if (!state.dragging) return
  state.dragging = false
  scheduleHide(state)
}

function create(el) {
  if (!el || states.has(el)) return

  const bar = document.createElement('div')
  bar.className = 'osb'
  const thumb = document.createElement('div')
  thumb.className = 'osb-thumb'
  bar.appendChild(thumb)
  document.body.appendChild(bar)

  const state = {
    el,
    bar,
    thumb,
    timer: 0,
    dragging: false,
    data: null,
  }

  state.onScroll = () => onScroll(state)
  state.onPointerDown = (event) => onThumbPointerDown(state, event)
  state.onPointerMove = (event) => onThumbPointerMove(state, event)
  state.onPointerUp = () => onThumbPointerUp(state)

  el.classList.add('has-overlay-scrollbar')
  el.addEventListener('scroll', state.onScroll, { passive: true })
  thumb.addEventListener('pointerdown', state.onPointerDown)
  thumb.addEventListener('pointermove', state.onPointerMove)
  thumb.addEventListener('pointerup', state.onPointerUp)
  thumb.addEventListener('pointercancel', state.onPointerUp)

  states.add(state)
  el.__scrollbarState = state

  if (!bound) {
    bound = true
    window.addEventListener('resize', refreshAll, { passive: true })
    window.addEventListener('scroll', refreshAll, { capture: true, passive: true })
  }

  apply(state)
}

function destroy(el) {
  const state = el?.__scrollbarState
  if (!state) return

  window.clearTimeout(state.timer)
  el.removeEventListener('scroll', state.onScroll)
  state.thumb.removeEventListener('pointerdown', state.onPointerDown)
  state.thumb.removeEventListener('pointermove', state.onPointerMove)
  state.thumb.removeEventListener('pointerup', state.onPointerUp)
  state.thumb.removeEventListener('pointercancel', state.onPointerUp)
  state.bar.remove()
  el.classList.remove('has-overlay-scrollbar')
  delete el.__scrollbarState
  states.delete(state)
}

export const scrollbar = {
  mounted(el) {
    create(el)
  },
  unmounted(el) {
    destroy(el)
  },
}
