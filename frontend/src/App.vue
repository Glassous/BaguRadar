<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Share2 } from '@lucide/vue'
import AppSearch from './components/AppSearch.vue'
import AppSidebar from './components/AppSidebar.vue'
import AppTitlebar from './components/AppTitlebar.vue'
import ShortcutsDialog from './components/ShortcutsDialog.vue'
import { useBackClose } from './composables/useBackClose'
import { useCatalog } from './composables/useCatalog'
import { openHelp, useShortcuts } from './composables/useShortcuts'
import { useTheme } from './composables/useTheme'
import { useToast } from './composables/useToast'
import { copyText } from './utils/clipboard'

const DESKTOP_QUERY = '(min-width: 1024px)'

const route = useRoute()
const router = useRouter()
const { ensureCatalog } = useCatalog()
const { toggleMode } = useTheme()
const { toast, showToast } = useToast()
const sidebarOpen = ref(false)
const sidebarCollapsed = ref(false)
const searchExpanded = ref(false)
const isDesktopViewport = ref(true)
const mainRef = ref(null)
const desktopMedia = window.matchMedia(DESKTOP_QUERY)
const year = new Date().getFullYear()

// 正文滚动发生在这个容器上，供阅读进度记录复用
provide('appScrollEl', mainRef)

// 移动端抽屉接入返回键/返回手势
useBackClose('sidebar', sidebarOpen)

// 移动端搜索展开后，两侧浮动按钮让位（推出屏幕）
const searchPushed = computed(() => searchExpanded.value && !isDesktopViewport.value)

// 复制链接的快捷键只在文章页注册，提示里的键帽跟着页面变化
const copyLinkTip = computed(() => ({
  text: '复制本页链接',
  key: route.name === 'doc' ? 'c' : '',
}))

function isDesktop() {
  return desktopMedia.matches
}

function handleDesktopChange(event) {
  isDesktopViewport.value = event.matches
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

// 目录聚焦：桌面确保侧栏展开后把焦点交给第一个条目，移动端直接拉起抽屉
function focusCatalog() {
  if (!isDesktop()) {
    sidebarOpen.value = true
    return
  }
  sidebarCollapsed.value = false
  // 等侧栏位移动画推进一点再聚焦，避免焦点环停在还在滑动的元素上
  window.setTimeout(() => {
    document
      .querySelector('#app-sidebar nav a, #app-sidebar nav button')
      ?.focus({ preventScroll: true })
  }, 260)
}

// 首页章节详情自己处理 Esc，这里不再往上叠一层帮助浮层
function openShortcutHelp() {
  if (document.querySelector('[data-overlay="chapter-detail"]')) return
  openHelp()
}

// 全站键位：只放跨页面通用的动作，页面内细粒度键位由各视图自行注册
useShortcuts('global', {
  '?': () => openShortcutHelp(),
  '[': () => toggleSidebar(),
  t: () => toggleMode(),
  'g h': () => router.push('/'),
  'g l': () => focusCatalog(),
})

// 分享入口常驻右上角：点击后只复制当前页面链接
async function copyPageLink() {
  try {
    await copyText(window.location.href)
    showToast('链接已复制')
  } catch (error) {
    console.error('[BaguRadar] 复制链接失败', error)
    showToast('复制失败')
  }
}

watch(
  () => route.fullPath,
  async () => {
    sidebarOpen.value = false
    await nextTick()
    // 搜索结果跳转由 DocView 定位到命中段落，这里不能把滚动位置重置到顶部
    if (route.query.q) return
    mainRef.value?.scrollTo({ top: 0, behavior: 'instant' })
  },
)

onMounted(() => {
  isDesktopViewport.value = desktopMedia.matches
  desktopMedia.addEventListener('change', handleDesktopChange)
  ensureCatalog()
})

onBeforeUnmount(() => {
  desktopMedia.removeEventListener('change', handleDesktopChange)
})
</script>

<template>
  <div class="app-shell h-dvh overflow-hidden bg-canvas text-ink">
    <AppTitlebar />
    <div class="page-atmosphere" aria-hidden="true" />

    <button
      v-show="!sidebarOpen"
      type="button"
      class="app-float-toggle fixed left-[calc(0.75rem+var(--safe-left))] z-30 inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-line bg-surface shadow-soft transition-[left,box-shadow,border-color,transform,opacity] duration-300 ease-out hover:border-primary/45 hover:shadow-lg lg:size-10"
      :class="[
        sidebarCollapsed ? '' : 'lg:left-[324px]',
        searchPushed ? 'pointer-events-none -translate-x-[160%] opacity-0' : '',
      ]"
      aria-label="切换侧栏"
      aria-controls="app-sidebar"
      aria-keyshortcuts="["
      v-tooltip="{ text: '切换侧栏', key: '[' }"
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
      class="app-float-action fixed right-[calc(0.75rem+var(--safe-right))] z-30 inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-ink-soft shadow-soft transition-[box-shadow,border-color,color,transform,opacity] duration-300 ease-out hover:border-primary/45 hover:text-primary-ink hover:shadow-lg lg:size-10"
      :class="searchPushed ? 'pointer-events-none translate-x-[160%] opacity-0' : ''"
      aria-label="复制本页链接"
      :aria-keyshortcuts="route.name === 'doc' ? 'c' : undefined"
      v-tooltip="copyLinkTip"
      @click="copyPageLink"
    >
      <Share2 :size="16" />
    </button>

    <AppSearch
      v-show="!sidebarOpen"
      v-model:expanded="searchExpanded"
      :collapsed="sidebarCollapsed"
    />

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-1 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-y-1 opacity-0"
    >
      <p
        v-if="toast"
        role="status"
        class="app-float-hint pointer-events-none fixed right-[calc(0.75rem+var(--safe-right))] z-30 rounded-full border border-line bg-surface/95 px-3 py-1 text-[11px] leading-none text-ink-faint shadow-soft backdrop-blur"
      >
        {{ toast }}
      </p>
    </Transition>

    <AppSidebar
      id="app-sidebar"
      :open="sidebarOpen"
      :collapsed="sidebarCollapsed"
      @close="sidebarOpen = false"
    />

    <ShortcutsDialog />

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
