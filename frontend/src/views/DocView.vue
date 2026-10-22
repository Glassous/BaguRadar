<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ArticleToc from '../components/ArticleToc.vue'
import ArticleView from '../components/ArticleView.vue'
import StatePanel from '../components/StatePanel.vue'
import { useCatalog } from '../composables/useCatalog'
import { loadArticle } from '../services/bucket'
import { parseFrontmatter } from '../utils/frontmatter'
import { ensureHighlighter, renderMarkdown } from '../utils/markdown'

const route = useRoute()
const { state, ensureCatalog, getDocByRoute, getNeighbors } = useCatalog()

const doc = ref(null)
const html = ref('')
const toc = ref([])
const prev = ref(null)
const next = ref(null)
const loading = ref(true)
const error = ref('')
const missing = ref(false)

let requestToken = 0

function routePath() {
  const value = route.params.pathMatch
  return (Array.isArray(value) ? value.join('/') : value || '').replace(/\.md$/i, '')
}

async function load() {
  const token = ++requestToken
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

  const result = renderMarkdown(parsed.content)
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
}

watch(() => route.fullPath, load, { immediate: true })
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1240px] gap-10 px-4 pb-[calc(6rem+var(--safe-bottom))] pt-8 sm:px-6 lg:pt-14 xl:px-8">
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
