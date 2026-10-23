<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Keyboard, LayoutGrid, Monitor, Moon, Radar, Settings2, Sun, X } from '@lucide/vue'
import { useEasterEgg } from '../composables/useEasterEgg'
import { useMapView } from '../composables/useMapView'
import { useShortcuts, openHelp } from '../composables/useShortcuts'
import { useTheme } from '../composables/useTheme'

const WARM_UP_DURATION = 160

const props = defineProps({
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const { mode, setMode } = useTheme()
const { viewMode, supports3d, setView, redetect } = useMapView()
const { enabled: easterEgg, setEnabled: setEasterEgg } = useEasterEgg()
const panelRef = ref(null)
const backdropRef = ref(null)
let lastFocused = null
let warmTimer = 0

const options = [
  { value: 'system', label: '跟随系统', icon: Monitor },
  { value: 'light', label: '亮色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
]

// 知识地图默认视图：与首页知识地图右上角的切换器共用同一份持久化偏好
const mapViewOptions = [
  { value: '3d', label: '雷达视图', icon: Radar, hint: '3D 知识雷达（首次进入时才加载）' },
  { value: 'list', label: '列表视图', icon: LayoutGrid, hint: '章节卡片列表，兼容性最好' },
]

function mapViewHint(option) {
  if (option.value === '3d' && !supports3d.value) return '当前设备不支持 WebGL，3D 雷达不可用'
  return option.hint
}

function pickMapView(value) {
  if (value === '3d' && !supports3d.value) return
  setView(value)
}

// 模态层：Esc / ? 由快捷键内核统一分发，不再单独挂 document 监听
useShortcuts(
  'settings-dialog',
  {
    escape: () => emit('close'),
    '?': () => openShortcuts(),
  },
  { priority: 100, modal: true, active: () => props.open },
)

// 从设置跳到快捷键面板：关闭设置会退掉它压入的历史记录，
// 必须等 popstate 落地后再打开帮助，否则帮助刚压入的条目会被这次回退一起弹掉。
function openShortcuts() {
  emit('close')

  let settled = false
  const run = () => {
    if (settled) return
    settled = true
    window.removeEventListener('popstate', run)
    window.clearTimeout(fallback)
    openHelp()
  }
  const fallback = window.setTimeout(run, 180)
  window.addEventListener('popstate', run, { once: true })
}

function unlockBody() {
  document.body.style.overflow = ''
}

// 预热遮罩层：以极低不透明度渲染一次，让浏览器提前完成 backdrop-filter
// 的背景采样与合成层建立，避免首次打开时模糊效果晚于弹窗出现。
function warmUpBackdrop() {
  const el = backdropRef.value
  if (!el) return
  el.classList.add('is-warm')
  warmTimer = window.setTimeout(() => {
    el.classList.remove('is-warm')
    warmTimer = 0
  }, WARM_UP_DURATION)
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      lastFocused = document.activeElement
      await nextTick()
      // 面板渲染完成后再锁定滚动，避免首帧整页重排拖慢遮罩的模糊采样
      document.body.style.overflow = 'hidden'
      panelRef.value?.focus()
      return
    }

    unlockBody()
    if (lastFocused instanceof HTMLElement) lastFocused.focus()
  },
)

onMounted(warmUpBackdrop)

onBeforeUnmount(() => {
  unlockBody()
  window.clearTimeout(warmTimer)
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center pl-[calc(1rem+var(--safe-left))] pr-[calc(1rem+var(--safe-right))] pt-8 pb-[calc(2rem+var(--safe-bottom))]"
      :class="{ 'pointer-events-none': !open }"
      :aria-hidden="!open"
    >
      <div
        ref="backdropRef"
        class="dialog-backdrop absolute inset-0 bg-black/45"
        :class="{ 'is-open': open }"
        @click="open && emit('close')"
      />

      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="scale-[0.97] opacity-0"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="scale-[0.98] opacity-0"
      >
        <div
          v-if="open"
          ref="panelRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
          tabindex="-1"
          class="dialog-card relative max-h-[calc(100dvh-4rem-var(--safe-bottom))] w-full max-w-[360px] overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl outline-none"
        >
          <div class="flex items-center gap-3 px-5 py-4">
            <span
              class="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary-soft/60 text-primary-ink"
            >
              <Settings2 :size="17" />
            </span>
            <div class="min-w-0 flex-1">
              <h2 id="settings-title" class="text-[15px] font-semibold tracking-tight text-ink">设置</h2>
            </div>
            <button
              type="button"
              class="-mr-1 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label="关闭设置"
              @click="emit('close')"
            >
              <X :size="16" />
            </button>
          </div>

          <div class="px-5 py-5">
            <p class="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-faint">颜色模式</p>

            <div class="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="颜色模式">
              <button
                v-for="option in options"
                :key="option.value"
                type="button"
                role="radio"
                :aria-checked="mode === option.value"
                class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border px-2 py-3.5 transition-all duration-200"
                :class="
                  mode === option.value
                    ? 'border-primary/45 bg-primary-soft/40 text-primary-ink'
                    : 'border-line bg-canvas/50 text-ink-soft hover:border-line-strong hover:bg-surface-2/60'
                "
                @click="setMode(option.value)"
              >
                <component :is="option.icon" :size="17" />
                <span class="text-[11.5px] font-medium">{{ option.label }}</span>
              </button>
            </div>

            <div class="mt-5 flex items-baseline justify-between gap-2">
              <p class="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-faint">
                知识地图默认视图
              </p>
              <button
                type="button"
                class="-mb-0.5 shrink-0 cursor-pointer text-[10px] font-medium text-primary-ink transition-opacity hover:opacity-70"
                v-tooltip="'按当前设备能力重新检测，并覆盖已保存的选择'"
                @click="redetect()"
              >
                重置
              </button>
            </div>

            <div class="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="知识地图默认视图">
              <button
                v-for="option in mapViewOptions"
                :key="option.value"
                type="button"
                role="radio"
                :aria-checked="viewMode === option.value"
                :disabled="option.value === '3d' && !supports3d"
                v-tooltip="mapViewHint(option)"
                class="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
                :class="
                  viewMode === option.value
                    ? 'border-primary/45 bg-primary-soft/40 text-primary-ink'
                    : 'border-line bg-canvas/50 text-ink-soft hover:border-line-strong hover:bg-surface-2/60'
                "
                @click="pickMapView(option.value)"
              >
                <component :is="option.icon" :size="13" />
                <span class="text-[11.5px] font-medium">{{ option.label }}</span>
              </button>
            </div>

            <p class="mt-2 text-[10px] leading-relaxed text-ink-faint">
              首次启动按设备能力自动选定并记住结果，之后不再重复检测。
            </p>

            <div class="mt-5 flex items-center justify-between gap-3">
              <p class="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-faint">彩蛋</p>
              <button
                type="button"
                role="switch"
                :aria-checked="easterEgg"
                aria-label="探头彩蛋"
                class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                :class="easterEgg ? 'border-primary/60 bg-primary' : 'border-line bg-surface-2'"
                @click="setEasterEgg(!easterEgg)"
              >
                <span
                  aria-hidden="true"
                  class="absolute top-1/2 left-1 size-4 -translate-y-1/2 rounded-full transition-all duration-200"
                  :class="easterEgg ? 'translate-x-[20px] bg-canvas' : 'translate-x-0 bg-ink-faint'"
                />
              </button>
            </div>

            <p class="mt-2 text-[10px] leading-relaxed text-ink-faint">
              Taffy 会时不时从侧栏边缘探出头；关闭后不再出现，可随时再打开。
            </p>

            <p class="mt-5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-faint">
              键盘
            </p>

            <button
              type="button"
              class="group mt-3 flex w-full cursor-pointer items-center gap-3 rounded-xl border border-line bg-canvas/50 px-3.5 py-2.5 text-left transition-all duration-200 hover:border-primary/40 hover:bg-surface-2/60"
              aria-keyshortcuts="?"
              @click="openShortcuts"
            >
              <span
                class="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft transition-colors group-hover:border-primary/35 group-hover:text-primary-ink"
              >
                <Keyboard :size="15" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-[12.5px] font-medium text-ink">快捷键一览</span>
                <span class="mt-0.5 block text-[10.5px] text-ink-faint">
                  搜索、目录、阅读全文按键
                </span>
              </span>
              <kbd class="kbd-chip">?</kbd>
            </button>

            <div class="mt-4 flex items-center justify-between">
              <a
                href="https://github.com/Glassous/BaguRadar"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub 仓库"
                v-tooltip="'GitHub 仓库'"
                class="-ml-1.5 inline-flex size-7 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" class="size-4" aria-hidden="true">
                  <path
                    d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z"
                  />
                </svg>
              </a>
              <span class="text-[10.5px] text-ink-faint">Apache-2.0</span>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>
