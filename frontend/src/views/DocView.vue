<script setup>
import { inject, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ArticleToc from '../components/ArticleToc.vue'
import ArticleView from '../components/ArticleView.vue'
import StatePanel from '../components/StatePanel.vue'
import { useCatalog } from '../composables/useCatalog'
import { useReadingPosition } from '../composables/useReadingPosition'
import { useShortcuts } from '../composables/useShortcuts'
import { useToast } from '../composables/useToast'
import { loadArticle } from '../services/bucket'
import { copyText } from '../utils/clipboard'
import { parseFrontmatter } from '../utils/frontmatter'
import { ensureHighlighter, renderMarkdown } from '../utils/markdown'
import { clearSearchHit, locateSearchHit } from '../utils/searchHit'

const SAVE_DELAY = 240
const MIN_OFFSET = 24
// 单键滚动的幅度与标题定位的偏移：45% 大致是一屏的可阅读行数
const SCROLL_RATIO = 0.45
const SECTION_OFFSET = 72

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const { state, ensureCatalog, getDocByRoute, getNeighbors } = useCatalog()
const { lastPosition, saveReadingPosition } = useReadingPosition()
// 正文滚动发生在外层的 main 容器上，由 App 注入，缺失时回退到类名查找
const scrollRoot = inject('appScrollEl', null)

const doc = ref(null)
const html = ref('')
const toc = ref([])
const prev = ref(null)
const next = ref(null)
const loading = ref(true)
const error = ref('')
const missing = ref(false)

let requestToken = 0
let saveTimer = 0
let settleTimer = 0
let observedEl = null
let restoring = false

function scrollContainer() {
  return scrollRoot?.value || document.querySelector('.app-scroll')
}

function readScroll() {
  const el = scrollContainer()
  if (!el) return null
  const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight)
  return {
    el,
    maxScroll,
    scrollTop: Math.max(0, el.scrollTop),
    progress: maxScroll > 0 ? Math.min(1, Math.max(0, el.scrollTop / maxScroll)) : 0,
  }
}

function persistScroll() {
  const current = doc.value
  const metrics = readScroll()
  if (!current || !metrics) return
  // 停在文章开头不算“读到哪儿”，避免覆盖掉有效记录
  if (metrics.scrollTop < MIN_OFFSET) return

  saveReadingPosition({
    route: current.route,
    title: current.title,
    scrollTop: metrics.scrollTop,
    progress: metrics.progress,
    maxScroll: metrics.maxScroll,
  })
}

// 用户一旦自己滚动/按键，就放弃回位校正，避免和阅读手势抢滚动位置
function finishRestore() {
  if (!restoring) return
  restoring = false
  window.clearTimeout(settleTimer)
  window.removeEventListener('wheel', finishRestore)
  window.removeEventListener('touchstart', finishRestore)
  window.removeEventListener('keydown', finishRestore)
}

function handleScroll() {
  if (restoring) return
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(persistScroll, SAVE_DELAY)
}

function trackScroll() {
  const el = scrollContainer()
  if (!el || observedEl === el) return
  observedEl?.removeEventListener('scroll', handleScroll)
  observedEl = el
  el.addEventListener('scroll', handleScroll, { passive: true })
}

function untrackScroll() {
  observedEl?.removeEventListener('scroll', handleScroll)
  observedEl = null
}

// 页面高度基本没变时按像素回位更精确，变化较大（换窗口尺寸）则按比例回位
function resolveRestoreTop(saved, maxScroll) {
  const changed = !saved.maxScroll || Math.abs(maxScroll - saved.maxScroll) > saved.maxScroll * 0.15
  if (changed) return saved.progress * maxScroll
  return Math.min(saved.scrollTop, maxScroll)
}

async function restoreScroll(saved) {
  const el = scrollContainer()
  if (!el) return

  restoring = true
  window.addEventListener('wheel', finishRestore, { passive: true })
  window.addEventListener('touchstart', finishRestore, { passive: true })
  window.addEventListener('keydown', finishRestore)

  await nextTick()
  await new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
  if (!restoring) return

  const apply = () => {
    const metrics = readScroll()
    if (!metrics) return
    const top = resolveRestoreTop(saved, metrics.maxScroll)
    metrics.el.scrollTop = Math.max(0, Math.min(metrics.maxScroll, top))
  }

  apply()
  // 字体、公式、代码高亮落位后会改变可滚动高度，稍后再校正一次
  settleTimer = window.setTimeout(() => {
    if (!restoring) return
    apply()
    finishRestore()
  }, 180)
}

function routePath() {
  const value = route.params.pathMatch
  return (Array.isArray(value) ? value.join('/') : value || '').replace(/\.md$/i, '')
}

function queryString(value) {
  return Array.isArray(value) ? value[0] || '' : String(value || '')
}

// 搜索结果跳转：等文章渲染完成后滚动到命中位置并高亮 2 秒
async function applySearchHit(token) {
  const term = queryString(route.query.q)
  if (!term) return

  await nextTick()
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (token !== requestToken) return
      locateSearchHit({
        root: document.querySelector('.article-body'),
        query: term,
        anchor: queryString(route.query.a),
      })
    })
  })
}

async function load() {
  const token = ++requestToken
  // 离开当前文章前先落一次位置，滚动容器随后会被重置到顶部
  persistScroll()
  clearSearchHit()
  loading.value = true
  error.value = ''
  missing.value = false
  doc.value = null
  html.value = ''
  toc.value = []
  prev.value = null
  next.value = null

  await ensureCatalog()
  if (token !== requestToken) return

  if (state.error) {
    error.value = state.error
    loading.value = false
    return
  }

  const target = getDocByRoute(routePath())
  if (!target) {
    missing.value = true
    loading.value = false
    document.title = '文章不存在 · BaguRadar'
    return
  }

  const raw = await loadArticle(target.path).catch((loadError) => {
    console.error('[BaguRadar] 文章加载失败', loadError)
    if (token === requestToken) {
      error.value = loadError?.message || '文章加载失败'
      loading.value = false
    }
    return null
  })

  if (!raw || token !== requestToken) return

  const parsed = parseFrontmatter(raw)
  await ensureHighlighter()
  if (token !== requestToken) return

  const result = renderMarkdown(parsed.content, {
    docDir: target.path.split('/').slice(0, -1).join('/'),
  })
  const merged = {
    ...target,
    title: parsed.meta.title || target.title,
    description: parsed.meta.description || target.description,
    tags: Array.isArray(parsed.meta.tags) && parsed.meta.tags.length ? parsed.meta.tags : target.tags,
  }

  const neighbors = getNeighbors(target.route)
  doc.value = merged
  html.value = result.html
  toc.value = result.toc
  prev.value = neighbors.prev
  next.value = neighbors.next
  document.title = `${merged.title} · BaguRadar`
  loading.value = false
  trackScroll()

  // 只有从“继续上次位置”进入时才跳回上次位置，普通打开仍从文章开头看起
  const saved = lastPosition.value
  if (route.query.resume && saved && saved.route === merged.route) {
    restoreScroll(saved)
  } else {
    void applySearchHit(token)
  }
}

function scrollByRatio(ratio) {
  const el = scrollContainer()
  if (!el) return
  el.scrollBy({ top: Math.round(el.clientHeight * ratio), behavior: 'smooth' })
}

// 整屏翻页留 12% 重叠，跨页时还能看到上一页最后一行的上下文
function pageBy(direction) {
  const el = scrollContainer()
  if (!el) return
  el.scrollBy({ top: Math.round(el.clientHeight * 0.88) * direction, behavior: 'smooth' })
}

function jumpSection(direction) {
  const body = document.querySelector('.article-body')
  if (!body) return
  const headings = Array.from(body.querySelectorAll('h2[id], h3[id], h4[id]'))
  if (!headings.length) return

  const el = scrollContainer()
  const anchorTop = (el?.getBoundingClientRect().top || 0) + SECTION_OFFSET
  // 当前位置 = 已经越过容器顶部偏移的最后一个标题
  let current = -1
  headings.forEach((heading, index) => {
    if (heading.getBoundingClientRect().top <= anchorTop) current = index
  })

  const target = headings[Math.min(headings.length - 1, Math.max(0, current + direction))]
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function goNeighbor(direction) {
  const target = direction === 'next' ? next.value : prev.value
  if (!target) return
  router.push(`/doc/${target.route}`)
}

function scrollToEdge(edge) {
  const el = scrollContainer()
  if (!el) return
  el.scrollTo({ top: edge === 'bottom' ? el.scrollHeight : 0, behavior: 'smooth' })
}

function visibleCodeBlock() {
  const blocks = Array.from(document.querySelectorAll('.article-body .code-block pre'))
  if (!blocks.length) return null

  let picked = null
  let pickedArea = 0
  for (const block of blocks) {
    const rect = block.getBoundingClientRect()
    const visible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
    if (visible > pickedArea) {
      pickedArea = visible
      picked = block
    }
  }
  // 只擦到一点边的不算“视口内代码块”，避免复制出半屏之外的代码
  return pickedArea >= 48 ? picked : null
}

async function copyPageLink() {
  try {
    await copyText(window.location.href)
    showToast('链接已复制')
  } catch (error) {
    console.error('[BaguRadar] 复制链接失败', error)
    showToast('复制失败')
  }
}

async function copyVisibleCode() {
  const block = visibleCodeBlock()
  if (!block) {
    showToast('当前视口没有代码块')
    return
  }

  const code = block.innerText || ''
  if (!code.trim()) {
    showToast('当前代码块为空')
    return
  }

  try {
    await copyText(code)
    showToast('代码已复制')
  } catch (error) {
    console.error('[BaguRadar] 复制代码失败', error)
    showToast('复制失败')
  }
}

// 阅读层：文章真正加载完成后才生效，加载态下按键不应触达滚动逻辑
useShortcuts(
  'doc-reading',
  {
    j: () => scrollByRatio(SCROLL_RATIO),
    k: () => scrollByRatio(-SCROLL_RATIO),
    space: () => pageBy(1),
    'shift+space': () => pageBy(-1),
    h: () => jumpSection(-1),
    l: () => jumpSection(1),
    p: () => goNeighbor('prev'),
    n: () => goNeighbor('next'),
    'g g': () => scrollToEdge('top'),
    G: () => scrollToEdge('bottom'),
    c: () => copyPageLink(),
    C: () => copyVisibleCode(),
  },
  { priority: 5, active: () => !loading.value && !missing.value && Boolean(doc.value) },
)

onBeforeUnmount(() => {
  window.clearTimeout(saveTimer)
  finishRestore()
  persistScroll()
  untrackScroll()
  clearSearchHit()
})

watch(() => route.fullPath, load, { immediate: true })
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1240px] gap-10 px-4 pb-6 pt-8 sm:px-6 lg:pt-14 xl:px-8">
    <div class="min-w-0 flex-1">
      <div v-if="loading" class="mx-auto w-full max-w-[860px]">
        <StatePanel variant="loading" :lines="12" />
      </div>

      <StatePanel
        v-else-if="error"
        variant="error"
        title="文章加载失败"
        :message="error"
        action-label="重新加载"
        @retry="load"
      />

      <StatePanel
        v-else-if="missing"
        variant="notfound"
        title="文章不存在"
        message="没有找到这篇文章，可能链接已经失效，或者内容已被移动到其他章节。"
      >
        <RouterLink
          to="/"
          class="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-primary/45 hover:text-primary-ink"
        >
          返回首页
        </RouterLink>
      </StatePanel>

      <ArticleView
        v-else-if="doc"
        :key="doc.route"
        class="rise-in"
        :doc="doc"
        :html="html"
        :toc="toc"
        :prev="prev"
        :next="next"
      />
    </div>

    <aside v-if="!loading && !error && doc" class="hidden w-[218px] shrink-0 xl:block">
      <div class="sticky top-6 pb-6">
        <ArticleToc :toc="toc" />
      </div>
    </aside>
  </div>
</template>
