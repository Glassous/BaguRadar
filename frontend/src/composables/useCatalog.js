import { computed, readonly, reactive, ref } from 'vue'
import { loadManifest } from '@/services/bucket'

const state = reactive({
  manifest: null,
  tree: [],
  docs: [],
  loading: false,
  loaded: false,
  error: '',
})

let inflight = null
let docByRoute = new Map()
const chapterList = ref([])

function toRoutePath(path) {
  return String(path || '')
    .replace(/^\/+/, '')
    .replace(/\.md$/i, '')
}

function normalizeRoute(value) {
  const raw = Array.isArray(value) ? value.join('/') : String(value || '')
  return decodeURIComponent(raw).replace(/^\/+/, '').replace(/\.md$/i, '')
}

function buildIndex(tree) {
  const docs = []
  const chapterList = []

  const walk = (nodes, trail) => {
    for (const node of nodes) {
      if (!node || !node.type) continue
      if (node.type === 'dir') {
        const nextTrail = [...trail, { id: node.id, title: node.title }]
        if (trail.length === 0) {
          chapterList.push({
            id: node.id,
            title: node.title,
            description: node.description || '',
            sections: [],
            docCount: 0,
            firstRoute: '',
          })
        }
        if (trail.length === 1 && chapterList.length) {
          const chapter = chapterList[chapterList.length - 1]
          chapter.sections.push({ id: node.id, title: node.title, docCount: 0 })
        }
        walk(node.children || [], nextTrail)
        continue
      }

      if (node.type !== 'doc' || !node.path) continue

      const chapter = trail[0] || { id: '', title: '' }
      const section = trail[1] || null
      const route = toRoutePath(node.id || node.path)
      const doc = {
        id: route,
        route,
        path: node.path,
        title: node.title || route,
        description: node.description || '',
        tags: Array.isArray(node.tags) ? node.tags : [],
        chapter,
        section,
      }
      docs.push(doc)

      const card = chapterList.find((item) => item.id === chapter.id)
      if (card) {
        card.docCount += 1
        if (!card.firstRoute) card.firstRoute = route
        const sectionCard = card.sections.find((item) => item.id === section?.id)
        if (sectionCard) sectionCard.docCount += 1
      }
    }
  }

  walk(tree, [])
  return { docs, chapters: chapterList }
}

async function ensureCatalog(force = false) {
  if (state.loaded && !force) return state
  if (inflight) return inflight

  state.loading = true
  state.error = ''

  inflight = (async () => {
    try {
      const manifest = await loadManifest({ force })
      const index = buildIndex(manifest.tree)
      state.manifest = manifest
      state.tree = manifest.tree
      state.docs = index.docs
      chapterList.value = index.chapters
      docByRoute = new Map(index.docs.map((doc) => [doc.route, doc]))
      state.loaded = true
    } catch (error) {
      console.error('[BaguRadar] 目录加载失败', error)
      state.error = error?.message || '目录加载失败'
      state.loaded = false
    } finally {
      state.loading = false
      inflight = null
    }
    return state
  })()

  return inflight
}

function getDocByRoute(value) {
  return docByRoute.get(normalizeRoute(value)) || null
}

function getNeighbors(route) {
  const current = typeof route === 'string' ? getDocByRoute(route) : route
  if (!current) return { prev: null, next: null }
  const index = state.docs.findIndex((doc) => doc.route === current.route)
  if (index === -1) return { prev: null, next: null }
  return {
    prev: index > 0 ? state.docs[index - 1] : null,
    next: index < state.docs.length - 1 ? state.docs[index + 1] : null,
  }
}

const stats = computed(() => ({
  chapters: chapterList.value.length,
  sections: chapterList.value.reduce((total, chapter) => total + chapter.sections.length, 0),
  docs: state.docs.length,
  updatedAt: state.manifest?.site?.updatedAt || '',
}))

const site = computed(() => state.manifest?.site || { title: 'BaguRadar', subtitle: '计算机八股文知识库' })

export function useCatalog() {
  return {
    state: readonly(state),
    site,
    stats,
    chapters: chapterList,
    ensureCatalog,
    getDocByRoute,
    getNeighbors,
  }
}
