<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
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
})
</script>

<template>
  <div class="app-shell h-dvh overflow-hidden bg-canvas text-ink">
    <AppTitlebar />
    <div class="page-atmosphere" aria-hidden="true" />

    <button
      v-show="!sidebarOpen"
      type="button"
      class="app-float-toggle fixed left-[calc(0.75rem+var(--safe-left))] z-30 inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-line bg-surface shadow-soft transition-[left,box-shadow,border-color] duration-300 ease-out hover:border-primary/45 hover:shadow-lg"
      :class="sidebarCollapsed ? '' : 'lg:left-[324px]'"
      aria-label="切换侧栏"
      aria-controls="app-sidebar"
      :aria-expanded="!sidebarCollapsed"
      @click="toggleSidebar"
    >
      <span class="flex w-4 flex-col items-start gap-[5px]">
        <span class="block h-[1.5px] w-full rounded-full bg-ink-soft" />
        <span class="block h-[1.5px] w-[58%] rounded-full bg-ink-soft" />
      </span>
    </button>

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
    </main>
  </div>
</template>
