<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import { ArrowRight, Bookmark, Radar, Sparkles, X } from '@lucide/vue'
import BrandMark from '../components/BrandMark.vue'
import StatePanel from '../components/StatePanel.vue'
import { useCatalog } from '../composables/useCatalog'
import { useReadingPosition } from '../composables/useReadingPosition'

gsap.registerPlugin(Flip)

const OPEN_PROPS = 'fontSize,borderRadius,color,backgroundColor'
const CLOSE_PROPS = 'fontSize,borderRadius,color'
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const route = useRoute()
const { state, site, stats, chapters, ensureCatalog, getDocByRoute } = useCatalog()
const { lastPosition, clearReadingPosition } = useReadingPosition()

const shown = reactive({ chapters: 0, sections: 0, docs: 0 })

function countUp(key, target) {
  const duration = 720
  const start = performance.now()
  const step = (now) => {
    const progress = Math.min(1, (now - start) / duration)
    shown[key] = Math.round(target * (1 - (1 - progress) ** 3))
    if (progress < 1) window.requestAnimationFrame(step)
  }
  window.requestAnimationFrame(step)
}

watch(
  () => stats.value,
  (value) => {
    countUp('chapters', value.chapters)
    countUp('sections', value.sections)
    countUp('docs', value.docs)
  },
  { immediate: true },
)

const totalLabel = computed(() =>
  stats.value.updatedAt ? `最近更新 ${stats.value.updatedAt}` : '内容持续同步中',
)

// 上次阅读记录：文章仍在目录里才算有效，否则回落成“开始阅读”
const resumeTarget = computed(() => {
  const saved = lastPosition.value
  if (!saved) return null
  // 依赖目录数据，目录加载完成后重新校验
  if (!state.docs.length) return null
  const doc = getDocByRoute(saved.route)
  if (!doc) return null
  return { route: doc.route, title: doc.title || saved.title }
})

const startLink = computed(() => {
  if (resumeTarget.value) return `/doc/${resumeTarget.value.route}?resume=1`
  return chapters.value.length ? `/doc/${chapters.value[0].firstRoute}` : ''
})

watch(
  () => state.loaded,
  (loaded) => {
    if (!loaded || !lastPosition.value) return
    if (!getDocByRoute(lastPosition.value.route)) clearReadingPosition()
  },
  { immediate: true },
)

const highlightChips = computed(() => [
  { label: '基础', detail: 'OS / 网络 / 算法' },
  { label: '框架', detail: 'Spring / Vue / Kafka' },
  { label: '进阶', detail: '分布式 / K8s / LLM' },
  { label: '面试', detail: '场景题 / 项目复盘' },
])

const activeChapter = ref(null)
const overlayRef = ref(null)
const scrimRef = ref(null)
const panelRef = ref(null)
const panelTitleRef = ref(null)
const panelDescRef = ref(null)

let lastCardEl = null
let activeFlip = null
let closing = false

const activeChapterIndex = computed(() => {
  if (!activeChapter.value) return 0
  return chapters.value.findIndex((chapter) => chapter.id === activeChapter.value.id) + 1
})

const activeSections = computed(() => {
  const chapter = activeChapter.value
  if (!chapter) return []
  return chapter.sections.map((section) => {
    const firstDoc = state.docs.find(
      (doc) => doc.chapter?.id === chapter.id && doc.section?.id === section.id,
    )
    return { ...section, route: firstDoc?.route || '' }
  })
})

async function openChapter(chapter, event) {
  if (activeChapter.value) return

  const cardEl = event.currentTarget
  const titleEl = cardEl?.querySelector('[data-flip-part="title"]')
  const descEl = cardEl?.querySelector('[data-flip-part="desc"]')
  if (!cardEl || !titleEl || !descEl) return

  activeFlip?.kill()
  lastCardEl = cardEl

  // 先量取卡片、标题、副标题的当前位置，再挂载大卡片
  const flipState = Flip.getState([cardEl, titleEl, descEl], { props: OPEN_PROPS })

  activeChapter.value = chapter
  await nextTick()

  const panel = panelRef.value
  const panelTitle = panelTitleRef.value
  const panelDesc = panelDescRef.value
  if (!panel || !panelTitle || !panelDesc) return

  const extras = panel.querySelectorAll('[data-detail-extra]')
  // 内部组件不参与动画：先隐藏，等共享元素落位后直接显示
  gsap.set(extras, { autoAlpha: 0 })
  gsap.set([panelTitle, panelDesc], { overflow: 'hidden' })

  gsap.set(overlayRef.value, { autoAlpha: 1 })
  gsap.to(scrimRef.value, {
    autoAlpha: 1,
    duration: reduceMotion ? 0 : 0.2,
    ease: 'power2.out',
  })

  activeFlip = Flip.from(flipState, {
    targets: [panel, panelTitle, panelDesc],
    duration: reduceMotion ? 0 : 0.42,
    ease: 'power3.inOut',
    nested: true,
    absolute: true,
    props: OPEN_PROPS,
    onComplete: () => {
      gsap.set([panelTitle, panelDesc], { clearProps: 'overflow' })
      gsap.set(extras, { autoAlpha: 1 })
      activeFlip = null
    },
  })

  panel.focus({ preventScroll: true })
}

function closeChapter() {
  if (!activeChapter.value || closing) return
  closing = true

  const chapter = activeChapter.value
  const panel = panelRef.value
  const panelTitle = panelTitleRef.value
  const panelDesc = panelDescRef.value
  const cardEl = document.querySelector(`[data-chapter-card="${chapter.id}"]`)

  // 打断展开动画：先停在当前位置，再从这里反向回位，避免两段 FLIP 同时写同一批属性
  if (activeFlip) {
    activeFlip.kill()
    activeFlip = null
  }

  if (!panel || !panelTitle || !panelDesc || !cardEl) {
    activeChapter.value = null
    closing = false
    return
  }

  // 让面板飞回原卡片槽位；真实卡片全程保持在文档流里，网格不会重排
  const targetState = captureRestingState(cardEl)

  gsap.set(panel.querySelectorAll('[data-detail-extra]'), { autoAlpha: 0 })
  gsap.to(scrimRef.value, {
    autoAlpha: 0,
    duration: reduceMotion ? 0 : 0.24,
    ease: 'power1.out',
  })

  activeFlip = Flip.to(targetState, {
    targets: [panel, panelTitle, panelDesc],
    duration: reduceMotion ? 0 : 0.36,
    ease: 'power3.inOut',
    nested: true,
    absolute: true,
    props: CLOSE_PROPS,
    onComplete: () => {
      activeFlip = null
      closing = false
      activeChapter.value = null
      nextTick(() => {
        gsap.set(overlayRef.value, { autoAlpha: 0 })
        lastCardEl?.focus({ preventScroll: true })
      })
    },
  })
}

// 用离屏克隆量取原卡片槽位的目标状态：状态里不包含真实卡片，
// Flip 就不会在回落时把网格项设为 display:none/absolute，后续卡片不再抖动
function captureRestingState(cardEl) {
  const rect = cardEl.getBoundingClientRect()
  const clone = cardEl.cloneNode(true)
  clone.setAttribute('aria-hidden', 'true')
  clone.style.cssText = [
    'position: fixed',
    `left: ${rect.left}px`,
    `top: ${rect.top}px`,
    `width: ${rect.width}px`,
    `height: ${rect.height}px`,
    'margin: 0',
    'pointer-events: none',
    'visibility: hidden',
    'z-index: -1',
  ].join(';')

  document.body.appendChild(clone)
  const cloneTitle = clone.querySelector('[data-flip-part="title"]')
  const cloneDesc = clone.querySelector('[data-flip-part="desc"]')
  const state = Flip.getState([clone, cloneTitle, cloneDesc].filter(Boolean), { props: CLOSE_PROPS })
  clone.remove()
  return state
}

function handleKeydown(event) {
  if (event.key === 'Escape') closeChapter()
}

watch(activeChapter, (value) => {
  if (value) window.addEventListener('keydown', handleKeydown)
  else window.removeEventListener('keydown', handleKeydown)
})

function scrollToFocus() {
  const focus = route.query.focus
  if (!focus) return
  // focus=map 供桌面快捷方式直接落到知识地图
  const isMap = focus === 'map'
  const element = document.getElementById(isMap ? 'knowledge-map' : `chapter-${focus}`)
  if (!element) return
  window.setTimeout(
    () => element.scrollIntoView({ behavior: 'smooth', block: isMap ? 'start' : 'center' }),
    120,
  )
}

function scrollToMap() {
  document.getElementById('knowledge-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(async () => {
  document.title = `${site.value.title} · ${site.value.subtitle}`
  // 详情层常驻挂载但初始不可见，保证打开时首帧就已处在 Flip 的起始位置
  gsap.set([overlayRef.value, scrimRef.value], { autoAlpha: 0 })
  await ensureCatalog()
  await nextTick()
  scrollToFocus()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  activeFlip?.kill()
  gsap.killTweensOf([overlayRef.value, scrimRef.value])
  if (panelTitleRef.value) gsap.killTweensOf(panelTitleRef.value)
  if (panelDescRef.value) gsap.killTweensOf(panelDescRef.value)
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1280px] px-4 pb-6 pt-6 sm:px-6 lg:pt-16">
    <section class="grid items-center gap-10 lg:grid-cols-[1.12fr_0.88fr]">
      <div class="rise-in">
        <span
          class="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary-soft/70 px-2.5 py-1 text-[10.5px] font-medium tracking-wide text-primary-ink"
        >
          <Sparkles :size="11" />
          系统梳理 · 面试速查
        </span>

        <h1 class="mt-5 text-[30px] font-semibold leading-[1.24] tracking-tight text-ink sm:text-[42px] sm:leading-[1.15] lg:text-[50px]">
          把散落的
          <span class="text-gradient">计算机八股文</span>
          <br />
          收进一张知识雷达
        </h1>

        <p class="mt-5 max-w-[54ch] text-[14px] leading-[1.9] text-ink-soft">
          把计算机八股文按章节整理成一张随时可查的知识雷达。
        </p>

        <div class="mt-7 flex flex-wrap items-center gap-3">
          <RouterLink
            v-if="startLink"
            :to="startLink"
            :title="resumeTarget ? `上次读到《${resumeTarget.title}》` : undefined"
            class="group inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-white shadow-soft transition-all duration-200 hover:bg-primary-ink hover:shadow-lg"
          >
            {{ resumeTarget ? '继续上次位置' : '开始阅读' }}
            <ArrowRight :size="15" class="transition-transform duration-200 group-hover:translate-x-0.5" />
          </RouterLink>
          <button
            type="button"
            class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface/60 px-4 py-2.5 text-[13px] font-medium text-ink-soft transition-colors duration-200 hover:border-primary/40 hover:text-primary-ink"
            @click="scrollToMap"
          >
            <Radar :size="15" />
            浏览知识地图
          </button>
        </div>

        <p v-if="resumeTarget" class="mt-2.5 flex items-center gap-1.5 text-[10.5px] text-ink-faint">
          <Bookmark :size="11" class="shrink-0 text-primary/70" />
          <span class="truncate">上次读到《{{ resumeTarget.title }}》</span>
        </p>

        <dl class="mt-10 flex items-end gap-7 border-t border-line pt-6">
          <div>
            <dt class="text-[10.5px] tracking-wide text-ink-faint">章节</dt>
            <dd class="font-mono text-[26px] font-semibold tabular-nums text-ink">
              {{ String(shown.chapters).padStart(2, '0') }}
            </dd>
          </div>
          <div>
            <dt class="text-[10.5px] tracking-wide text-ink-faint">小节</dt>
            <dd class="font-mono text-[26px] font-semibold tabular-nums text-ink">
              {{ String(shown.sections).padStart(2, '0') }}
            </dd>
          </div>
          <div>
            <dt class="text-[10.5px] tracking-wide text-ink-faint">文章</dt>
            <dd class="font-mono text-[26px] font-semibold tabular-nums text-primary-ink">
              {{ String(shown.docs).padStart(2, '0') }}
            </dd>
          </div>
          <div class="ml-auto hidden pb-1 text-right text-[10.5px] leading-relaxed text-ink-faint sm:block">
            {{ totalLabel }}
          </div>
        </dl>
      </div>

      <div class="relative mx-auto hidden aspect-square w-full max-w-[360px] lg:block">
        <div class="absolute inset-0 rounded-full border border-line bg-surface/40 backdrop-blur-[1px]" />
        <div class="absolute inset-[13%] rounded-full border border-line/80" />
        <div class="absolute inset-[28%] rounded-full border border-line/70" />
        <div class="absolute inset-[43%] rounded-full border border-primary/25 bg-primary-soft/30" />
        <div class="absolute inset-6 text-primary/50">
          <BrandMark :size="312" animated />
        </div>
        <div class="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_18px_var(--c-primary)]" />

        <div
          v-for="(chip, index) in highlightChips"
          :key="chip.label"
          class="absolute rounded-lg border border-line bg-surface/90 px-2.5 py-1.5 shadow-soft backdrop-blur"
          :class="[
            index === 0 ? 'left-0 top-[12%]' : '',
            index === 1 ? 'right-0 top-[30%]' : '',
            index === 2 ? 'bottom-[22%] left-[4%]' : '',
            index === 3 ? 'bottom-[8%] right-[6%]' : '',
          ]"
        >
          <p class="text-[10.5px] font-semibold text-ink">{{ chip.label }}</p>
          <p class="mt-0.5 text-[9.5px] text-ink-faint">{{ chip.detail }}</p>
        </div>
      </div>
    </section>

    <section id="knowledge-map" class="mt-16 scroll-mt-8 lg:mt-24">
      <div>
        <p class="text-[10px] font-medium uppercase tracking-[0.24em] text-ink-faint">Knowledge Map</p>
        <h2 class="mt-2 text-[22px] font-semibold tracking-tight text-ink">知识地图</h2>
      </div>

      <div v-if="state.loading && !chapters.length" class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="item in 6"
          :key="item"
          class="h-[172px] animate-pulse rounded-2xl border border-line bg-surface-2/60"
        />
      </div>

      <StatePanel
        v-else-if="state.error"
        variant="error"
        class="mt-6"
        title="目录加载失败"
        :message="state.error"
        action-label="重新加载"
        @retry="ensureCatalog(true)"
      />

      <div v-else class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <button
          v-for="(chapter, index) in chapters"
          :id="`chapter-${chapter.id}`"
          :key="chapter.id"
          type="button"
          aria-haspopup="dialog"
          :data-chapter-card="chapter.id"
          :data-flip-id="`chapter-card-${chapter.id}`"
          :class="{ invisible: activeChapter?.id === chapter.id }"
          class="card-lift group relative flex w-full cursor-pointer scroll-mt-8 flex-col overflow-hidden rounded-2xl border border-line bg-card p-5 text-left"
          @click="openChapter(chapter, $event)"
        >
          <div
            class="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-primary/5 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
          />
          <div class="flex items-center justify-between">
            <span class="font-mono text-[10.5px] tracking-[0.16em] text-ink-faint">
              CH.{{ String(index + 1).padStart(2, '0') }}
            </span>
            <span class="font-mono text-[10px] text-ink-faint/80">{{ chapter.docCount }} 篇</span>
          </div>

          <h3
            data-flip-part="title"
            :data-flip-id="`chapter-title-${chapter.id}`"
            class="mt-2.5 text-[16.5px] font-semibold tracking-tight text-ink"
          >
            {{ chapter.title }}
          </h3>
          <p
            data-flip-part="desc"
            :data-flip-id="`chapter-desc-${chapter.id}`"
            class="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-ink-faint"
          >
            {{ chapter.description }}
          </p>

          <div class="mt-3.5 flex flex-wrap gap-1.5">
            <span
              v-for="section in chapter.sections.slice(0, 3)"
              :key="section.id"
              class="rounded border border-line bg-canvas/60 px-1.5 py-0.5 text-[10px] text-ink-soft"
            >
              {{ section.title }}
            </span>
            <span v-if="chapter.sections.length > 3" class="px-1 py-0.5 text-[10px] text-ink-faint">
              +{{ chapter.sections.length - 3 }}
            </span>
          </div>

          <div class="mt-auto flex items-center justify-between pt-5 text-[10.5px] text-ink-faint">
            <span>{{ chapter.sections.length }} 个小节</span>
            <span class="inline-flex items-center gap-1 text-primary-ink">
              查看小节
              <ArrowRight :size="12" class="transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </div>
        </button>
      </div>
    </section>

    <Teleport to="body">
      <div
        ref="overlayRef"
        class="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 sm:px-6"
        :class="activeChapter ? 'pointer-events-auto' : 'pointer-events-none'"
      >
        <div
          ref="scrimRef"
          class="absolute inset-0 bg-black/45 backdrop-blur-[3px]"
          aria-hidden="true"
          @click="closeChapter"
        />

        <div
          v-if="activeChapter"
          ref="panelRef"
          role="dialog"
          aria-labelledby="chapter-detail-title"
          tabindex="-1"
          :data-flip-id="`chapter-card-${activeChapter.id}`"
          class="relative flex max-h-[min(82dvh,660px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[24px] border border-line bg-surface shadow-2xl outline-none"
        >
          <div class="relative px-6 pb-5 pt-6 sm:px-8 sm:pt-7">
            <button
              type="button"
              data-detail-extra
              class="absolute right-4 top-4 inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink sm:right-5 sm:top-5"
              aria-label="关闭章节详情"
              @click="closeChapter"
            >
              <X :size="16" />
            </button>

            <p data-detail-extra class="font-mono text-[10px] tracking-[0.18em] text-ink-faint">
              CH.{{ String(activeChapterIndex).padStart(2, '0') }} · {{ activeChapter.sections.length }}
              个小节 · {{ activeChapter.docCount }} 篇
            </p>

            <h2
              id="chapter-detail-title"
              ref="panelTitleRef"
              :data-flip-id="`chapter-title-${activeChapter.id}`"
              class="mt-3 pr-8 text-[22px] font-semibold leading-tight tracking-tight text-ink sm:text-[26px]"
            >
              {{ activeChapter.title }}
            </h2>

            <p
              ref="panelDescRef"
              :data-flip-id="`chapter-desc-${activeChapter.id}`"
              class="mt-2.5 max-w-[62ch] text-[12.5px] leading-relaxed text-ink-soft"
            >
              {{ activeChapter.description }}
            </p>
          </div>

          <div class="scroll-area min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 sm:px-8">
            <p data-detail-extra class="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-faint">
              子章节
            </p>

            <div v-if="activeSections.length" class="mt-3 grid gap-2 sm:grid-cols-2">
              <RouterLink
                v-for="(section, index) in activeSections"
                :key="section.id"
                data-detail-extra
                :to="`/doc/${section.route || activeChapter.firstRoute}`"
                class="group flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas/40 px-3.5 py-2.5 transition-colors hover:border-primary/40 hover:bg-surface-2/60"
              >
                <span class="flex min-w-0 items-center gap-2">
                  <span class="font-mono text-[10px] text-ink-faint">
                    {{ String(index + 1).padStart(2, '0') }}
                  </span>
                  <span class="truncate text-[12.5px] font-medium text-ink">{{ section.title }}</span>
                </span>
                <span class="shrink-0 text-[10px] text-ink-faint">{{ section.docCount }} 篇</span>
              </RouterLink>
            </div>

            <p v-else data-detail-extra class="mt-3 text-[12px] text-ink-faint">本章暂无小节。</p>
          </div>

          <div
            data-detail-extra
            class="flex shrink-0 items-center justify-between gap-3 border-t border-line px-6 py-4 sm:px-8"
          >
            <span class="text-[10.5px] text-ink-faint">共 {{ activeChapter.docCount }} 篇文章</span>
            <RouterLink
              :to="`/doc/${activeChapter.firstRoute}`"
              class="group inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[12px] font-medium text-white shadow-soft transition-colors hover:bg-primary-ink"
            >
              进入本章
              <ArrowRight :size="13" class="transition-transform duration-200 group-hover:translate-x-0.5" />
            </RouterLink>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
