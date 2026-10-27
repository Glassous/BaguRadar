<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { ListTree, X } from '@lucide/vue'
import { dismissOverlay, useBackClose } from '../composables/useBackClose'
import { useShortcuts } from '../composables/useShortcuts'
import { useSingleHand } from '../composables/useSingleHand'

const props = defineProps({
  toc: { type: Array, default: () => [] },
  // list：竖排目录（宽屏侧栏、折叠面板）；fab：右下角悬浮的章节选择（窄屏 / 竖屏）
  variant: { type: String, default: 'list' },
})

const isFab = computed(() => props.variant === 'fab')

// 单手模式：底部按钮组要按"当前页面有没有章节按钮"决定是否上移让位
const { setTocFabVisible } = useSingleHand()

const activeId = ref('')
const rootRef = ref(null)
const navRef = ref(null)
const shellRef = ref(null)
const panelRef = ref(null)
const listRef = ref(null)
const triggerRef = ref(null)
const cardOpen = ref(false)

// 悬浮入口只出现在右侧竖排目录 / 折叠面板都放不下的窄屏与竖屏，与 CSS 断点保持一致
const FAB_QUERY = '(min-width: 1024px) and (orientation: landscape)'
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

const COLLAPSED_SIZE = 48
const CARD_RADIUS = 17

// 临界阻尼弹簧：起步加速、末端平滑收住，全程不过冲，
// 既有弹簧的手感，又不会像 elastic / back 那样弹一下。
const SPRING_EASE = (() => {
  const k = 6.5
  const at = (t) => 1 - (1 + k * t) * Math.exp(-k * t)
  const total = at(1)
  return (progress) => at(progress) / total
})()

let observer = null
let lockUntil = 0
let scrollContainer = null
let fabMedia = null

useBackClose('toc-fab', cardOpen)

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

function goTo(id) {
  const element = document.getElementById(id)
  if (!element) return
  activeId.value = id
  lockUntil = Date.now() + 900
  element.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/* ---------- 右下角悬浮章节选择 ----------
   按钮和卡片是同一个元素：收起态是 48px 的圆按钮，展开态是整张大卡片，
   尺寸 / 圆角在两个状态之间补间，内容只是被它裁切出来。 */

// 动画时长统一收口：系统开启“减少动态效果”时退化为瞬时切换
function time(value) {
  return reducedMotion.matches ? 0 : value
}

function shellParts() {
  return [shellRef.value, panelRef.value, triggerRef.value].filter(Boolean)
}

// 卡片按条目滚动到当前章节，打开卡片时不会看到一段和正文错位的旧位置
function revealActiveInCard() {
  const list = listRef.value
  if (!list) return
  const item = list.querySelector('[data-fab-item][data-active="true"]')
  if (!item) return
  const max = list.scrollHeight - list.clientHeight
  if (max <= 0) return
  const top = item.offsetTop - list.clientHeight / 2 + item.offsetHeight / 2
  list.scrollTop = Math.max(0, Math.min(max, top))
}

async function expand() {
  const shell = shellRef.value
  const panel = panelRef.value
  const trigger = triggerRef.value
  if (!shell || !panel) return

  // 量取起点：正常是 48px 圆按钮，也可能是被打断的收起动画的中间值
  const fromWidth = shell.offsetWidth || COLLAPSED_SIZE
  const fromHeight = shell.offsetHeight || COLLAPSED_SIZE
  const fromRadius = parseFloat(getComputedStyle(shell).borderRadius) || COLLAPSED_SIZE / 2

  await nextTick()
  // 此时展开态 CSS 已生效但还没绘制：先量出目标尺寸，再倒回起点补间，屏幕上不会闪出完整卡片
  gsap.set(shell, { clearProps: 'width,height,borderRadius' })
  const toWidth = shell.offsetWidth
  const toHeight = shell.offsetHeight
  gsap.killTweensOf(shellParts())

  gsap.set(shell, { width: fromWidth, height: fromHeight, borderRadius: fromRadius })
  gsap.set(panel, { autoAlpha: 1 })

  const items = panel.querySelectorAll('[data-fab-item]')
  gsap.killTweensOf(items)

  // 同一个元素从圆形按钮长成大卡片，唯一的动画曲线就是这条弹簧
  gsap.to(shell, {
    width: toWidth,
    height: toHeight,
    borderRadius: CARD_RADIUS,
    duration: time(0.42),
    ease: SPRING_EASE,
    onComplete: () => gsap.set(shell, { clearProps: 'width,height,borderRadius' }),
  })
  // 图标让位：只做淡出，不跟着拉伸
  gsap.to(trigger, { autoAlpha: 0, duration: time(0.09), ease: 'power1.out' })
  if (items.length) {
    gsap.fromTo(
      items,
      { autoAlpha: 0, y: 8 },
      {
        autoAlpha: 1,
        y: 0,
        duration: time(0.24),
        ease: 'power2.out',
        stagger: time(0.014),
        delay: time(0.06),
      },
    )
  }

  revealActiveInCard()
  panel.focus?.({ preventScroll: true })
}

function collapse() {
  const shell = shellRef.value
  const panel = panelRef.value
  const trigger = triggerRef.value
  if (!shell || !panel) return

  // 在 Vue 换回收起态 CSS 之前锁住当前尺寸，卡片不会先“啪”地缩回 48px
  const startWidth = shell.offsetWidth
  const startHeight = shell.offsetHeight
  gsap.killTweensOf(shellParts())
  gsap.set(shell, { width: startWidth, height: startHeight, borderRadius: CARD_RADIUS })

  gsap.to(shell, {
    width: COLLAPSED_SIZE,
    height: COLLAPSED_SIZE,
    borderRadius: COLLAPSED_SIZE / 2,
    duration: time(0.34),
    ease: SPRING_EASE,
    onComplete: () => {
      gsap.set(shell, { clearProps: 'width,height,borderRadius' })
      gsap.set(panel, { autoAlpha: 0 })
    },
  })
  // 内容先淡出，等卡片收到按钮大小时图标再露出来
  gsap.to(panel, { autoAlpha: 0, duration: time(0.12), delay: time(0.13) })
  gsap.to(trigger, { autoAlpha: 1, duration: time(0.12), delay: time(0.2) })
}

// 开合都由 cardOpen 驱动：点击、外部遮罩、Esc、系统返回键最后都归到同一个动画
watch(cardOpen, (open) => {
  if (!isFab.value) return
  if (open) void expand()
  else collapse()
})

function openCard() {
  cardOpen.value = true
}

function closeCard({ restoreFocus = true } = {}) {
  if (!cardOpen.value) return
  cardOpen.value = false
  if (restoreFocus) triggerRef.value?.focus?.({ preventScroll: true })
}

function toggleCard() {
  if (cardOpen.value) closeCard()
  else openCard()
}

function pickSection(id) {
  // 条目跳转不会离开当前路由，先摘掉浮层的历史记录，关闭时不会触发返回
  dismissOverlay('toc-fab')
  closeCard({ restoreFocus: false })
  goTo(id)
}

useShortcuts(
  'toc-fab',
  { Escape: () => closeCard() },
  { priority: 12, active: () => isFab.value && cardOpen.value },
)

// 视口转成横屏桌面布局后入口被 CSS 隐藏，卡片不能留在原地
function handleFabMediaChange(event) {
  if (event.matches) closeCard({ restoreFocus: false })
}

onMounted(() => {
  attachScroll()
  if (!isFab.value) return
  setTocFabVisible(true)
  fabMedia = window.matchMedia(FAB_QUERY)
  fabMedia.addEventListener('change', handleFabMediaChange)
})

onBeforeUnmount(() => {
  disconnect()
  detachScroll()
  fabMedia?.removeEventListener('change', handleFabMediaChange)
  dismissOverlay('toc-fab')
  gsap.killTweensOf(shellParts())
  // 章节按钮随页面卸载后，底部按钮组要回到贴底位置
  if (isFab.value) setTocFabVisible(false)
})
</script>

<template>
  <div v-if="toc.length" ref="rootRef" :class="isFab ? 'toc-fab-root' : ''" :data-open="cardOpen">
    <template v-if="isFab">
      <div class="toc-fab__scrim" aria-hidden="true" @click="closeCard()" />

      <div ref="shellRef" class="toc-fab">
        <button
          ref="triggerRef"
          type="button"
          class="toc-fab__trigger"
          :aria-expanded="cardOpen"
          aria-controls="toc-fab-panel"
          aria-label="展开章节选择"
          @click="toggleCard"
        >
          <ListTree :size="20" aria-hidden="true" />
        </button>

        <section
          id="toc-fab-panel"
          ref="panelRef"
          class="toc-fab__panel"
          role="dialog"
          aria-label="章节选择"
          tabindex="-1"
        >
          <header class="toc-fab__head">
            <p class="toc-fab__eyebrow">On this page</p>
            <div class="toc-fab__heading">
              <p class="toc-fab__title">章节选择</p>
              <span class="toc-fab__count">{{ toc.length }} 节</span>
            </div>
            <button
              type="button"
              class="toc-fab__close"
              aria-label="关闭章节选择"
              @click="closeCard()"
            >
              <X :size="14" aria-hidden="true" />
            </button>
          </header>

          <nav ref="listRef" class="toc-fab__list" aria-label="本文目录">
            <button
              v-for="(item, index) in toc"
              :key="item.id"
              type="button"
              data-fab-item
              class="toc-fab__item"
              :data-level="item.level"
              :data-active="activeId === item.id ? 'true' : 'false'"
              @click="pickSection(item.id)"
            >
              <span class="toc-fab__index">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="toc-fab__label">{{ item.text }}</span>
            </button>
          </nav>
        </section>
      </div>
    </template>

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
