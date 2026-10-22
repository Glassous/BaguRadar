<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Monitor, Moon, Settings2, Sun, X } from '@lucide/vue'
import { useTheme } from '../composables/useTheme'

const WARM_UP_DURATION = 160

const props = defineProps({
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const { mode, setMode } = useTheme()
const panelRef = ref(null)
const backdropRef = ref(null)
let lastFocused = null
let warmTimer = 0

const options = [
  { value: 'system', label: '跟随系统', icon: Monitor },
  { value: 'light', label: '亮色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
]

function handleKeydown(event) {
  if (event.key === 'Escape') emit('close')
}

function unlockBody() {
  document.removeEventListener('keydown', handleKeydown)
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
      document.addEventListener('keydown', handleKeydown)
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

            <div class="mt-4 flex items-center justify-between">
              <a
                href="https://github.com/Glassous/BaguRadar"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub 仓库"
                title="GitHub 仓库"
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
