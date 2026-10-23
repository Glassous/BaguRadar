<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowUp, ChevronRight, MonitorDown, Settings2, X } from '@lucide/vue'
import BrandMark from './BrandMark.vue'
import SettingsDialog from './SettingsDialog.vue'
import TreeNode from './TreeNode.vue'
import StatePanel from './StatePanel.vue'
import TaffyPeek from './TaffyPeek.vue'
import { dismissOverlay, useBackClose } from '../composables/useBackClose'
import { useCatalog } from '../composables/useCatalog'
import { useInstallApp } from '../composables/useInstallApp'

const props = defineProps({
  open: { type: Boolean, default: false },
  collapsed: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const asideClass = computed(() => {
  if (props.open) return 'translate-x-0 shadow-2xl'
  if (props.collapsed) return '-translate-x-full lg:shadow-none'
  return '-translate-x-full lg:translate-x-0 lg:shadow-none'
})

const STORAGE_KEY = 'baguradar-sidebar-path'
const route = useRoute()
const { state, ensureCatalog } = useCatalog()

const pathStack = ref([])
const scrollRef = ref(null)
const settingsOpen = ref(false)
const savedIds = readSavedPath()

// 设置弹窗同样接入系统返回键
useBackClose('settings', settingsOpen)

const { installed, promptInstall } = useInstallApp()
const installHint = ref('')
let installHintTimer = 0

function showInstallHint(text) {
  installHint.value = text
  window.clearTimeout(installHintTimer)
  installHintTimer = window.setTimeout(() => {
    installHint.value = ''
  }, 4000)
}

async function requestInstall() {
  const outcome = await promptInstall()
  // 浏览器未提供安装提示（或已被关闭）时，引导用户走浏览器菜单
  if (outcome === 'unavailable') {
    showInstallHint('请在浏览器菜单中手动安装，或添加到主屏幕')
  }
}

onBeforeUnmount(() => {
  window.clearTimeout(installHintTimer)
})

const activeId = computed(() => {
  if (route.name !== 'doc') return ''
  const value = route.params.pathMatch
  return (Array.isArray(value) ? value.join('/') : value || '').replace(/\.md$/i, '')
})

const depth = computed(() => pathStack.value.length)

const direction = ref('forward')
const levelTransition = computed(() => `level-${direction.value}`)

const levelNodes = computed(() => {
  const current = pathStack.value[pathStack.value.length - 1]
  return current ? current.children || [] : state.tree
})

const activeTrailIds = computed(() => {
  if (!activeId.value) return []
  return (findTrail(state.tree, activeId.value) || []).map((node) => node.id)
})

function readSavedPath() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const ids = JSON.parse(raw)
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []
  } catch (error) {
    console.error('[BaguRadar] 读取目录路径失败', error)
    return []
  }
}

function persistPath() {
  try {
    const ids = pathStack.value.map((node) => node.id)
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch (error) {
    console.error('[BaguRadar] 保存目录路径失败', error)
  }
}

function resolvePath(ids) {
  const stack = []
  let nodes = state.tree
  for (const id of ids || []) {
    const matched = (nodes || []).find((node) => node?.type === 'dir' && node.id === id)
    if (!matched) break
    stack.push(matched)
    nodes = matched.children || []
  }
  return stack
}

function findTrail(nodes, targetId, trail = []) {
  for (const node of nodes || []) {
    if (!node) continue
    if (node.type === 'doc') {
      if (node.id === targetId) return trail
      continue
    }
    const next = findTrail(node.children || [], targetId, [...trail, node])
    if (next) return next
  }
  return null
}

function resetScroll() {
  nextTick(() => scrollRef.value?.scrollTo({ top: 0, behavior: 'smooth' }))
}

function enter(node) {
  direction.value = 'forward'
  pathStack.value = [...pathStack.value, node]
  persistPath()
  resetScroll()
}

function goToDepth(count) {
  const target = Math.max(0, Math.min(count, pathStack.value.length))
  if (target === pathStack.value.length) return
  direction.value = target > pathStack.value.length ? 'forward' : 'back'
  pathStack.value = pathStack.value.slice(0, target)
  persistPath()
  resetScroll()
}

function handleNavClick(event) {
  if (!event.target.closest?.('a')) return
  // 导航触发的关闭不参与历史回退，避免和路由的 push 抢历史栈
  dismissOverlay('sidebar')
  emit('close')
}

let restored = false

watch(
  [() => state.loaded, activeId],
  ([loaded, id]) => {
    if (!loaded) return
    if (id) {
      const trail = findTrail(state.tree, id)
      if (trail) {
        const trailIds = trail.map((node) => node.id).join('/')
        const currentIds = pathStack.value.map((node) => node.id).join('/')
        if (trailIds !== currentIds) {
          direction.value = trail.length > pathStack.value.length ? 'forward' : 'back'
          pathStack.value = trail
          persistPath()
        }
      }
    } else if (!restored) {
      const stack = resolvePath(savedIds)
      if (stack.length) pathStack.value = stack
    }
    restored = true
  },
  { immediate: true },
)

ensureCatalog()
</script>

<template>
  <div>
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-200"
      leave-to-class="opacity-0"
    >
      <button
        v-if="props.open"
        type="button"
        class="fixed inset-0 z-40 cursor-default bg-black/35 backdrop-blur-[2px] lg:hidden"
        aria-label="关闭目录"
        @click="emit('close')"
      />
    </Transition>

    <aside
      class="app-sidebar fixed bottom-0 left-0 z-40 flex w-[90%] max-w-[360px] flex-col border-r border-line bg-canvas/95 pl-[var(--safe-left)] backdrop-blur-xl transition-transform duration-300 ease-out lg:w-[312px] lg:bg-canvas/60"
      :class="asideClass"
      :inert="props.collapsed && !props.open"
    >
      <!-- 已安装应用的顶栏已承载品牌信息，侧栏内不再重复 -->
      <div class="absolute right-0 left-[var(--safe-left)] top-0 z-10 flex h-14 items-center gap-2 px-4 wco:hidden">
        <div class="sidebar-header-mask" aria-hidden="true" />
        <RouterLink
          to="/"
          class="group relative z-10 flex min-w-0 items-center gap-2.5"
          aria-label="返回首页"
          @click="emit('close')"
        >
          <span class="text-primary transition-transform duration-300 group-hover:scale-105">
            <BrandMark :size="25" animated />
          </span>
          <span class="flex min-w-0 flex-col leading-none">
            <span class="text-[14.5px] font-semibold tracking-tight text-ink">BaguRadar</span>
            <span class="mt-1 truncate text-[10px] tracking-[0.12em] text-ink-faint">
              计算机八股文知识库
            </span>
          </span>
        </RouterLink>
        <button
          type="button"
          class="relative z-10 ml-auto inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
          aria-label="关闭目录"
          @click="emit('close')"
        >
          <X :size="15" />
        </button>
      </div>

      <div
        ref="scrollRef"
        v-scrollbar
        class="scroll-area flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2.5 pb-[calc(5rem+var(--safe-bottom))] pt-14 wco:pt-3"
      >
        <div class="grid h-10 items-center px-2">
          <Transition :name="levelTransition">
            <p
              v-if="!depth"
              key="root"
              class="col-start-1 row-start-1 text-[16px] font-bold tracking-[0.02em] text-ink"
            >
              目录
            </p>
            <div
              v-else
              key="breadcrumb"
              class="col-start-1 row-start-1 flex min-w-0 items-center gap-1"
            >
              <button
                type="button"
                class="-ml-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-primary-soft text-primary-ink transition-colors hover:bg-primary hover:text-canvas"
                aria-label="返回上一级目录"
                @click="goToDepth(depth - 1)"
              >
                <ArrowUp :size="15" />
              </button>
              <nav class="flex min-w-0 flex-1 items-center gap-1" aria-label="目录路径">
                <button
                  type="button"
                  class="shrink-0 cursor-pointer text-[13px] font-semibold text-ink-faint transition-colors hover:text-primary-ink"
                  @click="goToDepth(0)"
                >
                  目录
                </button>
                <template v-for="(crumb, index) in pathStack" :key="crumb.id">
                  <ChevronRight :size="12" class="shrink-0 text-ink-faint/60" aria-hidden="true" />
                  <button
                    v-if="index < depth - 1"
                    type="button"
                    class="min-w-0 max-w-[7rem] shrink cursor-pointer truncate text-[13px] font-semibold text-ink-faint transition-colors hover:text-primary-ink"
                    @click="goToDepth(index + 1)"
                  >
                    {{ crumb.title }}
                  </button>
                  <span
                    v-else
                    class="min-w-0 truncate text-[15px] font-bold text-ink"
                    aria-current="page"
                  >
                    {{ crumb.title }}
                  </span>
                </template>
              </nav>
            </div>
          </Transition>
        </div>

        <StatePanel
          v-if="state.loading && !state.tree.length"
          variant="loading"
          :lines="8"
          class="px-2"
        />
        <StatePanel
          v-else-if="state.error"
          variant="error"
          title="目录加载失败"
          :message="state.error"
          action-label="重新加载"
          compact
          @retry="ensureCatalog(true)"
        />
        <div v-else class="grid">
          <Transition :name="levelTransition">
            <nav
              v-if="levelNodes.length"
              :key="`level-${depth}`"
              aria-label="章节目录"
              class="col-start-1 row-start-1 space-y-0.5 pt-1"
              @click="handleNavClick"
            >
              <TreeNode
                v-for="(node, index) in levelNodes"
                :key="node.id"
                :node="node"
                :index="index"
                :show-number="depth === 0"
                :active-id="activeId"
                :active-trail="activeTrailIds"
                @enter="enter"
              />
            </nav>
            <p
              v-else
              :key="`empty-${depth}`"
              class="col-start-1 row-start-1 px-3 py-6 text-center text-[13px] text-ink-faint"
            >
              {{ depth ? '该目录暂无内容' : '暂无目录内容' }}
            </p>
          </Transition>
        </div>
      </div>

      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-1 opacity-0"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="translate-y-1 opacity-0"
      >
        <p
          v-if="installHint"
          role="status"
          class="pointer-events-none absolute right-[18px] bottom-[60px] left-[calc(18px+var(--safe-left))] z-10 rounded-xl border border-line bg-surface/95 px-3 py-2 text-center text-[11px] leading-relaxed text-ink-faint shadow-soft backdrop-blur"
        >
          {{ installHint }}
        </p>
      </Transition>

      <div class="absolute bottom-[calc(1rem+var(--safe-bottom))] left-[calc(18px+var(--safe-left))] z-10 flex items-center gap-2">
        <button
          type="button"
          class="inline-flex h-9 w-[104px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-medium text-ink-soft shadow-soft transition-all duration-200 hover:border-primary/45 hover:text-primary-ink hover:shadow-lg"
          aria-label="打开设置"
          aria-haspopup="dialog"
          @click="settingsOpen = true"
        >
          <Settings2 :size="14" />
          设置
        </button>

        <!-- 浏览器支持 <install> 时由其渲染可信安装按钮，其余浏览器显示内部降级按钮 -->
        <install v-if="!installed" class="install-action inline-flex h-9 w-[104px] shrink-0">
          <button
            type="button"
            class="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-3 text-[12px] font-medium text-ink-soft shadow-soft transition-all duration-200 hover:border-primary/45 hover:text-primary-ink hover:shadow-lg"
            aria-label="安装应用"
            @click="requestInstall"
          >
            <MonitorDown :size="14" />
            安装应用
          </button>
        </install>
      </div>
    </aside>

    <!-- 彩蛋挂在 aside 外层：aside 折叠位移会连带 fixed 子元素，这里须独立于其外 -->
    <TaffyPeek :collapsed="props.collapsed" />

    <SettingsDialog :open="settingsOpen" @close="settingsOpen = false" />
  </div>
</template>
