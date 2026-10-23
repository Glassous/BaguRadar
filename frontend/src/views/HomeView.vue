<script setup>
import { computed, defineAsyncComponent, defineComponent, h, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import { ArrowRight, Bookmark, LayoutGrid, Radar, Sparkles, X } from '@lucide/vue'
import BrandMark from '../components/BrandMark.vue'
import StatePanel from '../components/StatePanel.vue'
import { resolveTargets, ZONES } from '../components/knowledge-radar/chapterConfig'
import { useCatalog } from '../composables/useCatalog'
import { useMapView } from '../composables/useMapView'
import { useReadingPosition } from '../composables/useReadingPosition'

gsap.registerPlugin(Flip)

// 只插值尺寸类属性：Tailwind v4 的半透明色是 color-mix(in oklab, …)，
// 交给 GSAP 插值会写出非法的 oklab 分量（a/b 被塞成 255），浏览器渲染成黄红色 → 闪烁
const OPEN_PROPS = 'fontSize,borderRadius'
const CLOSE_PROPS = 'fontSize,borderRadius'
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 切换视图时的占位骨架：与 kr-shell 同高，避免加载完成后页面跳动
const RadarSkeleton = defineComponent({
  name: 'RadarSkeleton',
  render() {
    return h(
      'div',
      {
        class:
          'flex h-[520px] w-full items-center justify-center rounded-2xl border border-line bg-surface-2/40 sm:h-[600px] xl:h-[720px]',
      },
      [
        h(
          'span',
          { class: 'font-mono text-[11px] tracking-[0.24em] text-ink-faint' },
          'INITIALIZING RADAR NETWORK',
        ),
      ],
    )
  },
})

// 3D 知识雷达按需加载：只有真正渲染雷达视图时才拉取 three 相关代码
const KnowledgeRadar = defineAsyncComponent({
  loader: () => import('../components/knowledge-radar/KnowledgeRadar.vue'),
  delay: 160,
  timeout: 30000,
  loadingComponent: RadarSkeleton,
})

// 视图模式来自本地保存的偏好：首次访问时检测设备定一次初始值并落盘，
// 之后刷新不再重复检测，用户在设置里的改动也一并持久保存。
const { viewMode, supports3d, setView, markUnsupported } = useMapView()

const radarRef = ref(null)
const radarError = ref('')

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

// 知识地图下方的外部站点入口：图标取自远程图床，加载失败时自动退回首字色块
const ICON_BASE = 'https://publicfiles.glassous.top/%E5%9B%BE%E6%A0%87'
const externalLinks = [
  {
    name: '值班室',
    href: 'https://bagu.imicola.com/',
    icon: `${ICON_BASE}/%E5%80%BC%E7%8F%AD%E5%AE%A4.png`,
  },
  {
    name: '卡码笔记',
    href: 'https://notes.kamacoder.com/',
    icon: `${ICON_BASE}/%E5%8D%A1%E7%A0%81%E7%AC%94%E8%AE%B0.jpg`,
  },
  {
    name: '小林coding',
    href: 'https://www.xiaolincoding.com/',
    icon: `${ICON_BASE}/%E5%B0%8F%E6%9E%97coding.webp`,
  },
]

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

// 3D 目标的屏幕投影锚点：点击 3D 目标时在这里种一张“虚拟卡片”，
// 复用与列表卡片完全一致的 Flip 展开动画。
const flipAnchor = ref(null)
const anchorRef = ref(null)
const fromRadar = ref(false)

const anchorStyle = computed(() => {
  const anchor = flipAnchor.value
  if (!anchor) return {}
  return {
    left: `${anchor.x}px`,
    top: `${anchor.y}px`,
    width: `${anchor.w || 268}px`,
    height: `${anchor.h || 124}px`,
  }
})

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

// 章节所属雷达区域：弹窗皮肤用它做顶部色带与右上光斑，和 3D 场景里的标签呼应
const activeZone = computed(() => {
  const chapter = activeChapter.value
  if (!chapter) return ZONES.peak
  const target = resolveTargets(chapters.value).find((item) => item.id === chapter.id)
  return ZONES[target?.zone] || ZONES.peak
})

async function openChapter(chapter, source) {
  if (activeChapter.value) return

  const cardEl = source instanceof Element ? source : source?.currentTarget
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
      // 区域色带 / 光斑淡入，避免落位瞬间整块颜色"啪"地弹出来像闪烁
      gsap.to(extras, { autoAlpha: 1, duration: reduceMotion ? 0 : 0.24, ease: 'power1.out' })
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
  const cardEl =
    lastCardEl && lastCardEl.isConnected
      ? lastCardEl
      : document.querySelector(`[data-chapter-card="${chapter.id}"]`)

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
        if (fromRadar.value) {
          fromRadar.value = false
          flipAnchor.value = null
          lastCardEl = null
          radarRef.value?.clearRadarSelection?.()
        } else {
          lastCardEl?.focus({ preventScroll: true })
        }
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

function switchView(mode) {
  if (mode === viewMode.value) return
  if (mode === '3d') {
    // 没有 WebGL 的设备直接回绝，绝不下载 three
    if (!supports3d.value) {
      radarError.value = '当前设备不支持 WebGL'
      return
    }
    radarError.value = ''
  }
  setView(mode)
  if (mode === 'list' && !activeChapter.value) {
    flipAnchor.value = null
    fromRadar.value = false
  }
}

async function openChapterFromRadar(id) {
  if (activeChapter.value) return
  const chapter = chapters.value.find((item) => item.id === id)
  if (!chapter) return

  const point = radarRef.value?.projectChapter(id)
  if (!point || !point.visible) {
    openChapterFromRadarFallback(chapter)
    return
  }

  // 起点直接取标签卡片自身的矩形：弹窗就从用户点的那张卡片长大
  const labelRect = point.labelRect
  flipAnchor.value = labelRect
    ? {
        x: Math.round(labelRect.x),
        y: Math.round(labelRect.y),
        w: Math.round(labelRect.width),
        h: Math.round(labelRect.height),
        chapter,
      }
    : {
        x: Math.round(point.x - 134),
        y: Math.round(point.y - 82),
        w: 268,
        h: 124,
        chapter,
      }
  fromRadar.value = true
  await nextTick()
  if (!anchorRef.value) return
  openChapter(chapter, anchorRef.value)
}

// 目标被地形/相机遮挡时，退化到面板中心展开
async function openChapterFromRadarFallback(chapter) {
  const shell = document.querySelector('.kr-shell')
  const rect = shell?.getBoundingClientRect()
  flipAnchor.value = {
    x: Math.round((rect?.left || 0) + (rect?.width || 640) / 2 - 134),
    y: Math.round((rect?.top || 0) + (rect?.height || 480) / 2 - 80),
    w: 268,
    h: 124,
    chapter,
  }
  fromRadar.value = true
  await nextTick()
  if (!anchorRef.value) return
  openChapter(chapter, anchorRef.value)
}

function handleRadarSelect(id) {
  openChapterFromRadar(id)
}

function handleRadarUnsupported(message) {
  radarError.value = message || 'WebGL 不可用'
  // 能力缺失随偏好一起落盘，下次启动直接进列表，不再白跑一次 3D 初始化
  markUnsupported()
}

onMounted(async () => {
  // 视图模式已在 setup 阶段按能力选好，这里不再重新判定（否则首帧会误挂载 3D 组件）
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
            v-tooltip="resumeTarget ? `上次读到《${resumeTarget.title}》` : ''"
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

    <section id="knowledge-map" class="mt-10 scroll-mt-8 lg:mt-14">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-[10px] font-medium uppercase tracking-[0.24em] text-ink-faint">Knowledge Map</p>
          <h2 class="mt-2 text-[22px] font-semibold tracking-tight text-ink">知识地图</h2>
          <p v-if="viewMode === '3d'" class="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">
            16 个章节已布防地形 · 4 类雷达持续扫描 · 点击标签卡片进入
          </p>
          <p v-else-if="!supports3d" class="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">
            当前设备不支持 3D 雷达（{{ radarError || 'WebGL 不可用' }}），已使用列表视图
          </p>
          <p v-else-if="radarError" class="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">
            3D 雷达启动失败（{{ radarError }}），已切换到列表视图
          </p>
          <p v-else class="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">
            {{ chapters.length }} 个章节 · 点击卡片展开小节 · 按 01 → {{ chapters.length }} 顺序通读
          </p>
        </div>

        <div
          class="inline-flex shrink-0 items-center gap-1 rounded-xl border border-line bg-surface-2/60 p-1"
          role="tablist"
          aria-label="知识地图视图切换"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="viewMode === '3d'"
            :disabled="!supports3d"
            v-tooltip="
              !supports3d
                ? '当前设备不支持 WebGL，3D 雷达不可用'
                : '启动 3D 雷达（首次启动时才加载）'
            "
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            :class="viewMode === '3d' ? 'bg-surface text-ink shadow-soft' : 'text-ink-faint hover:text-ink'"
            @click="switchView('3d')"
          >
            <Radar :size="12" />
            雷达视图
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="viewMode === 'list'"
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-colors"
            :class="viewMode === 'list' ? 'bg-surface text-ink shadow-soft' : 'text-ink-faint hover:text-ink'"
            @click="switchView('list')"
          >
            <LayoutGrid :size="12" />
            列表视图
          </button>
        </div>
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

      <div v-else class="mt-6">
        <KnowledgeRadar
          v-if="viewMode === '3d' && supports3d"
          ref="radarRef"
          :chapters="chapters"
          @select="handleRadarSelect"
          @unsupported="handleRadarUnsupported"
        />

        <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
      </div>
    </section>

    <section class="mt-8 flex flex-wrap items-center gap-x-2.5 gap-y-2.5" aria-label="相关站点">
      <p class="mr-1 text-[10.5px] font-medium uppercase tracking-[0.24em] text-ink-faint">Links</p>

      <a
        v-for="link in externalLinks"
        :key="link.name"
        :href="link.href"
        target="_blank"
        rel="noreferrer"
        class="group inline-flex items-center gap-2.5 rounded-xl border border-line bg-canvas/50 py-2 pl-2 pr-3.5 transition-all duration-200 hover:-translate-y-px hover:border-primary/40 hover:bg-surface-2/60"
      >
        <span
          class="relative inline-flex size-[24px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-line bg-surface-2 text-[11px] font-semibold text-ink-faint"
        >
          {{ link.name.slice(0, 1) }}
          <img
            :src="link.icon"
            alt=""
            loading="lazy"
            referrerpolicy="no-referrer"
            class="absolute inset-0 size-full object-cover"
            @error="$event.target.remove()"
          />
        </span>
        <span
          class="text-[13px] font-medium text-ink-soft transition-colors group-hover:text-primary-ink"
        >
          {{ link.name }}
        </span>
      </a>
    </section>

    <Teleport to="body">
      <!-- 3D 目标投影锚点：尺寸与标签卡片一致，Flip 才能像普通模式一样从标签位置展开 -->
      <div
        v-if="flipAnchor"
        ref="anchorRef"
        :style="anchorStyle"
        :data-flip-id="`chapter-card-${flipAnchor.chapter.id}`"
        :class="activeChapter ? 'invisible' : ''"
        class="pointer-events-none fixed z-40 overflow-hidden rounded-[4px_8px_8px_4px] border-l-2 border-primary/60 bg-[#041918]/92 p-1 shadow-2xl backdrop-blur-sm"
        aria-hidden="true"
      >
        <div class="flex items-center justify-between font-mono text-[7px] tracking-[0.14em] text-[#5eead4]/80">
          <span>CH.{{ String(flipAnchor.chapter.id).slice(0, 2) }}</span>
          <span>{{ flipAnchor.chapter.docCount }} 篇</span>
        </div>
        <h3
          data-flip-part="title"
          :data-flip-id="`chapter-title-${flipAnchor.chapter.id}`"
          class="text-[10px] font-semibold leading-tight tracking-tight text-[#d8fff7]"
        >
          {{ flipAnchor.chapter.title }}
        </h3>
        <p
          data-flip-part="desc"
          :data-flip-id="`chapter-desc-${flipAnchor.chapter.id}`"
          class="line-clamp-2 text-[7.5px] leading-tight text-[#8fd8cf]/80"
        >
          {{ flipAnchor.chapter.description }}
        </p>
      </div>

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
          data-overlay="chapter-detail"
          aria-labelledby="chapter-detail-title"
          tabindex="-1"
          :data-flip-id="`chapter-card-${activeChapter.id}`"
          class="relative flex max-h-[min(82dvh,660px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[24px] border border-line bg-surface/95 shadow-lift outline-none backdrop-blur-xl"
        >
          <!-- 新皮肤：顶部一条区域色细线，与 3D 场景里的雷达标语汇 -->
          <span
            data-detail-extra
            aria-hidden="true"
            class="pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px] opacity-70"
            :style="{
              background: `linear-gradient(90deg, ${activeZone.color}, color-mix(in srgb, ${activeZone.color} 30%, transparent) 58%, transparent)`,
            }"
          />

          <div class="relative px-6 pb-5 pt-6 sm:px-8 sm:pt-7">
            <button
              type="button"
              data-detail-extra
              class="absolute right-4 top-4 z-10 inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink sm:right-5 sm:top-5"
              aria-label="关闭章节详情"
              @click="closeChapter"
            >
              <X :size="16" />
            </button>

            <div data-detail-extra class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/70 px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-ink-faint"
              >
                <span class="size-1.5 rounded-full" :style="{ background: activeZone.color }" />
                CH.{{ String(activeChapterIndex).padStart(2, '0') }}
              </span>
              <span class="font-mono text-[10px] tracking-[0.12em] text-ink-faint">
                {{ activeZone.en }}
              </span>
              <span class="text-[10px] text-ink-faint">
                · {{ activeChapter.sections.length }} 个小节 · {{ activeChapter.docCount }} 篇
              </span>
            </div>

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
                class="group flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas/40 px-3.5 py-2.5 transition-all duration-200 hover:-translate-y-px hover:border-primary/40 hover:bg-surface-2/60 hover:shadow-soft"
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
            class="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-surface-2/40 px-6 py-4 sm:px-8"
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
