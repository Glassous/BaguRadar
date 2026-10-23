// 搜索微服务请求层：默认走同域 /api/search（1Panel 反向代理到 127.0.0.1:8787）。
// 本地开发由 vite.config.js 的 proxy 转发，也可以直接用 VITE_SEARCH_API_BASE 指向完整地址。

const RAW_BASE = import.meta.env.VITE_SEARCH_API_BASE || '/api/search'
const DEFAULT_TIMEOUT = 8000

export const SEARCH_BASE = String(RAW_BASE).replace(/\/+$/, '')

export class SearchError extends Error {
  constructor(message, { status = 0, aborted = false } = {}) {
    super(message)
    this.name = 'SearchError'
    this.status = status
    this.aborted = aborted
  }
}

function normalizeSegment(segment) {
  if (!segment || typeof segment.text !== 'string') return null
  return { text: segment.text, hit: Boolean(segment.hit) }
}

function normalizeResult(item) {
  if (!item || typeof item.route !== 'string') return null
  return {
    route: item.route,
    title: item.title || item.route,
    chapter: item.chapter || '',
    section: item.section || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    anchor: typeof item.anchor === 'string' ? item.anchor : '',
    hits: Number(item.hits) || 0,
    snippet: Array.isArray(item.snippet)
      ? item.snippet.map(normalizeSegment).filter(Boolean)
      : [],
    more: {
      before: Boolean(item.more?.before),
      after: Boolean(item.more?.after),
    },
  }
}

/**
 * 调用 /api/search 检索。
 * @param {string} query
 * @param {{ limit?: number, signal?: AbortSignal, timeout?: number }} options
 */
export async function searchArticles(query, { limit = 12, signal, timeout = DEFAULT_TIMEOUT } = {}) {
  const term = String(query ?? '').trim()
  if (!term) return { q: '', total: 0, took: 0, results: [] }

  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  const timer = window.setTimeout(() => controller.abort(), timeout)

  try {
    const url = `${SEARCH_BASE}?q=${encodeURIComponent(term)}&limit=${limit}`
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new SearchError(`搜索服务返回 HTTP ${response.status}`, { status: response.status })
    }

    const data = await response.json()
    const results = Array.isArray(data?.results) ? data.results.map(normalizeResult).filter(Boolean) : []

    return {
      q: typeof data?.q === 'string' ? data.q : term,
      total: Number(data?.total) || results.length,
      took: Number(data?.took) || 0,
      results,
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      if (signal?.aborted) throw new SearchError('请求已取消', { aborted: true })
      throw new SearchError('搜索超时，请稍后重试')
    }
    if (error instanceof SearchError) throw error
    console.error('[BaguRadar] 搜索请求失败', error)
    throw new SearchError('搜索服务暂不可用')
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
