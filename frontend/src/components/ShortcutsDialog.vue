<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Keyboard, X } from '@lucide/vue'
import { useBackClose } from '../composables/useBackClose'
import { useShortcuts, useShortcutsHelp } from '../composables/useShortcuts'

const PANEL_ID = 'shortcuts-dialog'

const { helpOpen, openHelp, closeHelp } = useShortcutsHelp()

// useBackClose 需要可写 ref：关闭时走 closeHelp，保持 helpOpen 单一数据源
const visible = computed({
  get: () => helpOpen.value,
  set: (value) => (value ? openHelp() : closeHelp()),
})

const panelRef = ref(null)
let lastFocused = null

// 展示用键位表：combos 里每一项是一次按键序列（多枚键帽连按），多项之间是“或”的关系
const groups = computed(() => [
  {
    key: 'global',
    title: '全站',
    en: 'Global',
    wide: true,
    items: [
      { combos: [['/']], label: '搜索文章' },
      { combos: [['?']], label: '打开快捷键帮助' },
      { combos: [['[']], label: '折叠 / 展开目录' },
      { combos: [['t']], label: '切换深色 / 浅色' },
      { combos: [['g', 'h']], label: '返回首页' },
      { combos: [['g', 'l']], label: '打开并聚焦目录' },
      { combos: [['Esc']], label: '关闭当前浮层' },
    ],
  },
  {
    key: 'search',
    title: '搜索',
    en: 'Search',
    wide: false,
    items: [
      { combos: [['↑'], ['↓']], label: '选择结果' },
      { combos: [['Home'], ['End']], label: '跳到首条 / 末条' },
      { combos: [['PgUp'], ['PgDn']], label: '按页翻动结果' },
      { combos: [['Enter']], label: '打开选中结果' },
      { combos: [['Esc']], label: '关闭搜索面板' },
    ],
  },
  {
    key: 'reading',
    title: '阅读',
    en: 'Reading',
    wide: false,
    items: [
      { combos: [['j'], ['k']], label: '向下 / 向上滚动' },
      { combos: [['Space'], ['Shift', 'Space']], label: '整屏下翻 / 上翻' },
      { combos: [['h'], ['l']], label: '上一小节 / 下一小节' },
      { combos: [['p'], ['n']], label: '上一篇 / 下一篇' },
      { combos: [['g', 'g']], label: '回到文首' },
      { combos: [['Shift', 'G']], label: '跳到文末' },
      { combos: [['c']], label: '复制本页链接' },
      { combos: [['Shift', 'C']], label: '复制视口内代码块' },
    ],
  },
])

// 模态层：打开时屏蔽下层键位，只保留关闭动作
useShortcuts(
  PANEL_ID,
  {
    escape: () => closeHelp(),
    '?': () => closeHelp(),
  },
  { priority: 100, modal: true, active: () => visible.value },
)

// 浮层接系统返回键，Android 返回手势先关面板而不是退出页面
useBackClose(PANEL_ID, visible)

watch(visible, async (open) => {
  if (open) {
    lastFocused = document.activeElement
    await nextTick()
    document.body.style.overflow = 'hidden'
    panelRef.value?.focus()
    return
  }

  document.body.style.overflow = ''
  if (lastFocused instanceof HTMLElement) lastFocused.focus()
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center pl-[calc(1rem+var(--safe-left))] pr-[calc(1rem+var(--safe-right))] pt-8 pb-[calc(2rem+var(--safe-bottom))]"
      :class="{ 'pointer-events-none': !visible }"
      :aria-hidden="!visible"
    >
      <div
        class="dialog-backdrop absolute inset-0 bg-black/45"
        :class="{ 'is-open': visible }"
        @click="visible && closeHelp()"
      />

      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="scale-[0.97] opacity-0"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="scale-[0.98] opacity-0"
      >
        <div
          v-if="visible"
          ref="panelRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-title"
          tabindex="-1"
          class="dialog-card relative flex max-h-[min(86dvh,720px)] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl outline-none"
        >
          <div class="flex items-center gap-3 px-5 py-4">
            <span
              class="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary-soft/60 text-primary-ink"
            >
              <Keyboard :size="17" />
            </span>
            <div class="min-w-0 flex-1">
              <h2 id="shortcuts-title" class="text-[15px] font-semibold tracking-tight text-ink">
                键盘快捷键
              </h2>
              <p class="mt-0.5 text-[10.5px] text-ink-faint">输入框内不生效，随时按 ? 唤出</p>
            </div>
            <button
              type="button"
              class="-mr-1 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label="关闭快捷键帮助"
              @click="closeHelp"
            >
              <X :size="16" />
            </button>
          </div>

          <div class="scroll-area min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
            <div class="sm:grid sm:grid-cols-2 sm:gap-x-6">
              <section
                v-for="group in groups"
                :key="group.key"
                class="mt-4 first:mt-0"
                :class="group.wide ? 'sm:col-span-2' : ''"
              >
                <div class="flex items-center gap-2">
                  <p class="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-faint">
                    {{ group.title }}
                  </p>
                  <span class="h-px flex-1 bg-line" aria-hidden="true" />
                  <span class="font-mono text-[9px] tracking-[0.16em] text-ink-faint/70">
                    {{ group.en }}
                  </span>
                </div>

                <ul class="mt-1.5" :class="group.wide ? 'sm:grid sm:grid-cols-2 sm:gap-x-6' : ''">
                  <li v-for="item in group.items" :key="`${group.key}-${item.label}`" class="shortcuts-row">
                    <span class="min-w-0 flex-1 truncate text-[12px] text-ink-soft">
                      {{ item.label }}
                    </span>
                    <span class="shortcuts-keys">
                      <template v-for="(combo, comboIndex) in item.combos" :key="comboIndex">
                        <span v-if="comboIndex" class="shortcuts-or">/</span>
                        <span class="shortcuts-combo">
                          <kbd v-for="(chip, chipIndex) in combo" :key="chipIndex" class="kbd-chip">
                            {{ chip }}
                          </kbd>
                        </span>
                      </template>
                    </span>
                  </li>
                </ul>
              </section>
            </div>
          </div>

          <div
            class="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-surface-2/40 px-5 py-3"
          >
            <span class="text-[10.5px] text-ink-faint">G 前缀键需在 1.2 秒内接续按下</span>
            <span class="flex items-center gap-1 text-[10.5px] text-ink-faint">
              按
              <kbd class="kbd-chip">?</kbd>
              或
              <kbd class="kbd-chip">Esc</kbd>
              关闭
            </span>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>
