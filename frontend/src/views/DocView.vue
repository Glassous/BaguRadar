<script setup>
import { inject, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ArticleToc from '../components/ArticleToc.vue'
import ArticleView from '../components/ArticleView.vue'
import StatePanel from '../components/StatePanel.vue'
import { useCatalog } from '../composables/useCatalog'
import { useReadingPosition } from '../composables/useReadingPosition'
import { loadArticle } from '../services/bucket'
import { parseFrontmatter } from '../utils/frontmatter'
import { ensureHighlighter, renderMarkdown } from '../utils/markdown'

const SAVE_DELAY = 240
const MIN_OFFSET = 24

const route = useRoute()
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

async function load() {
  const token = ++requestToken
  // 离开当前文章前先落一次位置，滚动容器随后会被重置到顶部
  persistScroll()
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
  }
}

onBeforeUnmount(() => {
  window.clearTimeout(saveTimer)
  finishRestore()
  persistScroll()
  untrackScroll()
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
