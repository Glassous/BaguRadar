<script setup>
import { nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Share2 } from '@lucide/vue'
import AppSidebar from './components/AppSidebar.vue'
import AppTitlebar from './components/AppTitlebar.vue'
import { useBackClose } from './composables/useBackClose'
import { useCatalog } from './composables/useCatalog'

const DESKTOP_QUERY = '(min-width: 1024px)'

const route = useRoute()
const { ensureCatalog } = useCatalog()
const sidebarOpen = ref(false)
const sidebarCollapsed = ref(false)
const mainRef = ref(null)
const desktopMedia = window.matchMedia(DESKTOP_QUERY)
const year = new Date().getFullYear()

// 正文滚动发生在这个容器上，供阅读进度记录复用
provide('appScrollEl', mainRef)

// 移动端抽屉接入返回键/返回手势
useBackClose('sidebar', sidebarOpen)

function isDesktop() {
  return desktopMedia.matches
}

function handleDesktopChange(event) {
  // 进入桌面断点后抽屉不再是浮层，顺手清掉它的历史记录
  if (event.matches) sidebarOpen.value = false
}

function toggleSidebar() {
  if (isDesktop()) {
    sidebarCollapsed.value = !sidebarCollapsed.value
    // 侧栏与主区宽度变化后，重新计算悬浮滚动条的位置
    window.setTimeout(() => window.dispatchEvent(new Event('resize')), 320)
    return
  }
  sidebarOpen.value = true
}

// 分享入口常驻右上角：点击后只复制当前页面链接
const shareHint = ref('')
let shareHintTimer = 0

function showShareHint(message) {
  shareHint.value = message
  window.clearTimeout(shareHintTimer)
  shareHintTimer = window.setTimeout(() => {
    shareHint.value = ''
  }, 2000)
}

// 非安全上下文（无 Clipboard API）时的兜底复制
function legacyCopy(text) {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const copied = document.execCommand('copy')
  area.remove()
  if (!copied) throw new Error('execCommand copy failed')
}

async function copyPageLink() {
  const url = window.location.href

  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url)
    else legacyCopy(url)
    showShareHint('链接已复制')
  } catch (error) {
    console.error('[BaguRadar] 复制链接失败', error)
    showShareHint('复制失败')
  }
}

watch(
  () => route.fullPath,
  async () => {
    sidebarOpen.value = false
    await nextTick()
    mainRef.value?.scrollTo({ top: 0, behavior: 'instant' })
  },
)

onMounted(() => {
  desktopMedia.addEventListener('change', handleDesktopChange)
  ensureCatalog()
})

onBeforeUnmount(() => {
  desktopMedia.removeEventListener('change', handleDesktopChange)
  window.clearTimeout(shareHintTimer)
})
</script>

<template>
  <div class="app-shell h-dvh overflow-hidden bg-canvas text-ink">
    <AppTitlebar />
    <div class="page-atmosphere" aria-hidden="true" />

    <button
      v-show="!sidebarOpen"
      type="button"
      class="app-float-toggle fixed left-[calc(0.75rem+var(--safe-left))] z-30 inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-line bg-surface shadow-soft transition-[left,box-shadow,border-color] duration-300 ease-out hover:border-primary/45 hover:shadow-lg lg:size-10"
      :class="sidebarCollapsed ? '' : 'lg:left-[324px]'"
      aria-label="切换侧栏"
      aria-controls="app-sidebar"
      :aria-expanded="!sidebarCollapsed"
      @click="toggleSidebar"
    >
      <span class="flex w-[18px] flex-col items-start gap-[5px] lg:w-4">
        <span class="block h-[1.5px] w-full rounded-full bg-ink-soft" />
        <span class="block h-[1.5px] w-[58%] rounded-full bg-ink-soft" />
      </span>
    </button>

    <button
      v-show="!sidebarOpen"
      type="button"
      class="app-float-action fixed right-[calc(0.75rem+var(--safe-right))] z-30 inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-ink-soft shadow-soft transition-[box-shadow,border-color,color] duration-300 ease-out hover:border-primary/45 hover:text-primary-ink hover:shadow-lg lg:size-10"
      aria-label="复制本页链接"
      title="复制本页链接"
      @click="copyPageLink"
    >
      <Share2 :size="16" />
    </button>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-1 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-y-1 opacity-0"
    >
      <p
        v-if="shareHint"
        role="status"
        class="app-float-hint pointer-events-none fixed right-[calc(0.75rem+var(--safe-right))] z-30 rounded-full border border-line bg-surface/95 px-3 py-1 text-[11px] leading-none text-ink-faint shadow-soft backdrop-blur"
      >
        {{ shareHint }}
      </p>
    </Transition>

    <AppSidebar
      id="app-sidebar"
      :open="sidebarOpen"
      :collapsed="sidebarCollapsed"
      @close="sidebarOpen = false"
    />

    <main
      ref="mainRef"
      v-scrollbar
      class="app-scroll h-full overflow-y-auto pt-14 pl-[var(--safe-left)] pr-[var(--safe-right)] transition-[margin-left] duration-300 ease-out lg:pt-0"
      :class="sidebarCollapsed ? 'lg:ml-0' : 'lg:ml-[312px]'"
    >
      <RouterView />

      <footer
        class="mx-auto w-full max-w-[1280px] px-4 pb-[calc(1.5rem+var(--safe-bottom))] pt-10 text-[10.5px] leading-none text-ink-faint sm:px-6"
      >
        © {{ year }} BaguRadar
      </footer>
    </main>
  </div>
</template>
