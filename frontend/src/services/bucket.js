// 线上对象存储桶根（文件结构与仓库内 BaguRadarFiles/ 保持一致）。
// 本地调试想改回仓库内的 BaguRadarFiles/，在 .env.local 里覆盖为 VITE_BUCKET_BASE_URL=/bucket。
const DEFAULT_BUCKET_BASE = 'https://baguradarfiles.vodyanitsa.top'

const RAW_BASE = import.meta.env.VITE_BUCKET_BASE_URL || DEFAULT_BUCKET_BASE

export const BUCKET_BASE = RAW_BASE.replace(/\/+$/, '')

const ARTICLE_CACHE_LIMIT = 24

const articleCache = new Map()
let manifestPromise = null

export class BucketError extends Error {
  constructor(message, { status = 0, path = '' } = {}) {
    super(message)
    this.name = 'BucketError'
    this.status = status
    this.path = path
  }
}

export function joinBucketUrl(path) {
  const clean = String(path || '')
    .replace(/^\/+/, '')
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return clean ? `${BUCKET_BASE}/${clean}` : BUCKET_BASE
}

export async function fetchText(path, { timeout = 15000 } = {}) {
  const url = joinBucketUrl(path)
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'text/plain, application/json, */*' },
    })
    if (!response.ok) {
      throw new BucketError(`无法加载 ${path}（HTTP ${response.status}）`, {
        status: response.status,
        path,
      })
    }
    return await response.text()
  } catch (error) {
    if (error instanceof BucketError) throw error
    if (error?.name === 'AbortError') {
      throw new BucketError(`加载 ${path} 超时，请检查桶地址或网络`, { path })
    }
    console.error('[BaguRadar] 桶请求失败', url, error)
    throw new BucketError(`网络异常，无法访问桶文件 ${path}`, { path })
  } finally {
    window.clearTimeout(timer)
  }
}

export function loadManifest({ force = false } = {}) {
  if (force || !manifestPromise) {
    manifestPromise = fetchText('manifest.json')
      .then((text) => {
        const data = JSON.parse(text)
        if (!data || !Array.isArray(data.tree)) {
          throw new BucketError('manifest.json 格式不正确：缺少 tree 数组', {
            path: 'manifest.json',
          })
        }
        return data
      })
      .catch((error) => {
        manifestPromise = null
        if (error instanceof SyntaxError) {
          throw new BucketError('manifest.json 解析失败，请检查 JSON 语法', {
            path: 'manifest.json',
          })
        }
        throw error
      })
  }
  return manifestPromise
}

export async function loadArticle(path, { force = false } = {}) {
  if (!force && articleCache.has(path)) {
    const cached = articleCache.get(path)
    articleCache.delete(path)
    articleCache.set(path, cached)
    return cached
  }

  const text = await fetchText(path)
  articleCache.set(path, text)
  if (articleCache.size > ARTICLE_CACHE_LIMIT) {
    const oldest = articleCache.keys().next().value
    articleCache.delete(oldest)
  }
  return text
}
