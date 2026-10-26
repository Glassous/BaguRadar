<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  toc: { type: Array, default: () => [] },
  // list：竖排目录（宽屏侧栏、折叠面板）；rail：顶部左右滑动的章节条
  variant: { type: String, default: 'list' },
})

const isRail = computed(() => props.variant === 'rail')

const activeId = ref('')
const rootRef = ref(null)
const navRef = ref(null)
let observer = null
let lockUntil = 0
let scrollContainer = null

function nearBottom() {
  if (scrollContainer instanceof HTMLElement) {
    return (
      scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 32
    )
  }
  return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 32
}

function handleScroll() {
  if (Date.now() < lockUntil || !props.toc.length) return
  if (nearBottom()) activeId.value = props.toc[props.toc.length - 1].id
}

function detachScroll() {
  const target = scrollContainer || window
  target.removeEventListener('scroll', handleScroll)
  scrollContainer = null
}

function attachScroll() {
  detachScroll()
  scrollContainer = rootRef.value?.closest('.app-scroll') || null
  const target = scrollContainer || window
  target.addEventListener('scroll', handleScroll, { passive: true })
}

function disconnect() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
}

function buildObserver() {
  disconnect()
  if (!props.toc.length || typeof IntersectionObserver === 'undefined') return

  observer = new IntersectionObserver(
    (entries) => {
      if (Date.now() < lockUntil) return
      if (nearBottom()) {
        activeId.value = props.toc[props.toc.length - 1].id
        return
      }
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible.length) activeId.value = visible[0].target.id
    },
    { rootMargin: '-24px 0px -68% 0px', threshold: 0 },
  )

  props.toc.forEach((item) => {
    const element = document.getElementById(item.id)
    if (element) observer.observe(element)
  })
}

watch(
  () => props.toc,
  async (items) => {
    activeId.value = items[0]?.id || ''
    await nextTick()
    buildObserver()
    attachScroll()
  },
  { immediate: true },
)

onMounted(attachScroll)

// 横向条带里当前章节可能滚出视野，正文推进时把它带回中间
function revealActive() {
  const nav = navRef.value
  if (!nav || !isRail.value || nav.clientWidth === 0) return
  const index = props.toc.findIndex((item) => item.id === activeId.value)
  const item = index >= 0 ? nav.children[index] : null
  if (!item) return

  const max = nav.scrollWidth - nav.clientWidth
  if (max <= 0) return
  // offsetLeft 相对的是 offsetParent，这里用 rect 换算成条带内的坐标更稳
  const itemLeft = item.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft
  const left = itemLeft - (nav.clientWidth - item.offsetWidth) / 2
  nav.scrollTo({ left: Math.max(0, Math.min(max, left)), behavior: 'smooth' })
}

watch(activeId, () => {
  revealActive()
})

// 竖屏下的章节条只有横向滚动：把竖向滚轮转换成横向位移，鼠标也能滑动
function handleWheel(event) {
  const nav = navRef.value
  if (!nav) return
  if (nav.scrollWidth - nav.clientWidth <= 1) return
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
  event.preventDefault()
  nav.scrollLeft += event.deltaY
}

onBeforeUnmount(() => {
  disconnect()
  detachScroll()
})

function goTo(id) {
  const element = document.getElementById(id)
  if (!element) return
  activeId.value = id
  lockUntil = Date.now() + 900
  element.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div v-if="toc.length" ref="rootRef">
    <nav
      v-if="isRail"
      ref="navRef"
      class="toc-rail scroll-area"
      aria-label="本文目录"
      @wheel="handleWheel"
    >
      <button
        v-for="item in toc"
        :key="item.id"
        type="button"
        class="toc-rail__item cursor-pointer"
        :data-level="item.level"
        :data-active="activeId === item.id ? 'true' : 'false'"
        @click="goTo(item.id)"
      >
        {{ item.text }}
      </button>
    </nav>

    <template v-else>
      <p class="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-faint">On this page</p>
      <p class="mt-1 text-[12.5px] font-semibold text-ink">本文目录</p>

      <nav
        ref="navRef"
        v-scrollbar
        class="article-toc-nav scroll-area mt-3 overflow-y-auto border-l border-line pb-4"
      >
        <button
          v-for="item in toc"
          :key="item.id"
          type="button"
          class="toc-link block w-full cursor-pointer py-1 pr-2 text-left text-[11.5px] leading-snug"
          :class="[
            item.level === 3 ? 'pl-6 text-[11px]' : 'pl-3',
            activeId === item.id ? 'font-medium' : 'text-ink-faint hover:text-ink-soft',
          ]"
          :data-active="activeId === item.id ? 'true' : 'false'"
          @click="goTo(item.id)"
        >
          {{ item.text }}
        </button>
      </nav>
    </template>
  </div>
</template>
