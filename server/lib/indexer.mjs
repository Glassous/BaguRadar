// 内容索引：把服务器上的内容镜像（manifest.json + docs/**/*.md）扫描成只读内存快照。
// 重建在后台完成并原子替换，重建期间旧快照继续对外服务；进程无需重启。

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { extractPlainText, parseFrontmatter } from './markdown-text.mjs'
import { normalizeText, searchSnapshot } from './search.mjs'

const REBUILD_DELAY = 400
const POLL_INTERVAL = 30000

function createEmptySnapshot(error = '') {
  return {
    docs: [],
    builtAt: '',
    tookMs: 0,
    fileCount: 0,
    bytes: 0,
    error,
    fingerprint: '',
  }
}

function toPosix(value) {
  return String(value).split(path.sep).join('/')
}

function normalizeRelPath(value) {
  return toPosix(String(value || ''))
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
}

function routeOfPath(relativePath) {
  return normalizeRelPath(relativePath).replace(/\.md$/i, '')
}

async function listMarkdown(dir, root, output = []) {
  let entries
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true })
  } catch {
    return output
  }

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await listMarkdown(absolute, root, output)
      continue
    }
    if (!entry.isFile() || !/\.md$/i.test(entry.name)) continue
    const stat = await fsp.stat(absolute).catch(() => null)
    if (!stat) continue
    output.push({
      absolute,
      relative: normalizeRelPath(path.relative(root, absolute)),
      mtimeMs: stat.mtimeMs,
      size: stat.size,
    })
  }

  return output
}

function manifestIndex(manifest) {
  const byPath = new Map()
  if (!manifest || !Array.isArray(manifest.tree)) return byPath

  const walk = (nodes, trail) => {
    for (const node of nodes || []) {
      if (!node || !node.type) continue
      if (node.type === 'dir') {
        walk(node.children || [], [...trail, { id: node.id, title: node.title }])
        continue
      }
      if (node.type !== 'doc') continue

      const filePath = normalizeRelPath(node.path || `${node.id}.md`)
      byPath.set(filePath, {
        route: routeOfPath(node.id || node.path),
        title: node.title || '',
        description: node.description || '',
        tags: Array.isArray(node.tags) ? node.tags.filter(Boolean) : [],
        chapter: trail[0]?.title || '',
        section: trail[1]?.title || '',
      })
    }
  }

  walk(manifest.tree, [])
  return byPath
}

async function readManifest(root) {
  try {
    const raw = await fsp.readFile(path.join(root, 'manifest.json'), 'utf8')
    return JSON.parse(raw.replace(/^\uFEFF/, ''))
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.error('[BaguRadar] manifest.json 解析失败，将退化为按文件路径索引', error)
    }
    return null
  }
}

function joinTags(tags) {
  return tags.length ? tags.join(' ') : ''
}

async function buildDocument(entry, meta) {
  const raw = await fsp.readFile(entry.absolute, 'utf8')
  const { meta: frontmatter, content } = parseFrontmatter(raw)
  const { text, headings } = extractPlainText(content)

  const title =
    (typeof frontmatter.title === 'string' && frontmatter.title.trim()) ||
    meta.title ||
    routeOfPath(entry.relative).split('/').pop() ||
    entry.relative
  const description =
    (typeof frontmatter.description === 'string' && frontmatter.description.trim()) ||
    meta.description ||
    ''
  const tags =
    (Array.isArray(frontmatter.tags) && frontmatter.tags.length ? frontmatter.tags : meta.tags) || []

  return {
    route: meta.route || routeOfPath(entry.relative),
    file: entry.relative,
    title,
    description,
    tags,
    chapter: meta.chapter || '',
    section: meta.section || '',
    plain: text,
    norm: normalizeText(text),
    headings,
    normTitle: normalizeText(title),
    normDescription: normalizeText(description),
    normTags: normalizeText(joinTags(tags)),
    normHeadings: normalizeText(headings.map((item) => item.text).join(' ')),
  }
}

async function buildSnapshot(root) {
  const started = performance.now()
  const manifest = await readManifest(root)
  const byPath = manifestIndex(manifest)
  const files = await listMarkdown(root, root)

  const docs = []
  let bytes = 0
  for (const entry of files) {
    bytes += entry.size
    try {
      docs.push(await buildDocument(entry, byPath.get(entry.relative) || {}))
    } catch (error) {
      console.error(`[BaguRadar] 文章索引失败：${entry.relative}`, error)
    }
  }

  const manifestStamp = await fsp
    .stat(path.join(root, 'manifest.json'))
    .then((stat) => `${Math.round(stat.mtimeMs)}:${stat.size}`)
    .catch(() => 'missing')

  const fingerprint = `${manifestStamp}#${files
    .map((entry) => `${entry.relative}:${Math.round(entry.mtimeMs)}:${entry.size}`)
    .sort()
    .join('|')}`

  return {
    snapshot: {
      docs,
      builtAt: new Date().toISOString(),
      tookMs: Math.round(performance.now() - started),
      fileCount: docs.length,
      bytes,
      error: docs.length ? '' : `内容目录为空或不存在：${root}`,
      fingerprint,
    },
    manifest,
  }
}

/**
 * @param {{ contentDir: string, log?: Console, rebuildDelay?: number, pollInterval?: number }} options
 */
export function createIndexer({
  contentDir,
  log = console,
  rebuildDelay = REBUILD_DELAY,
  pollInterval = POLL_INTERVAL,
} = {}) {
  const root = path.resolve(contentDir || '')
  let snapshot = createEmptySnapshot()
  let building = null
  let pending = false
  let rebuildTimer = null
  let pollTimer = null
  let watcher = null
  let closed = false

  async function rebuild(reason = 'manual') {
    if (closed) return snapshot
    if (building) {
      pending = true
      return building
    }

    building = (async () => {
      try {
        const { snapshot: next } = await buildSnapshot(root)
        snapshot = next
        log.log(
          `[BaguRadar] 搜索索引就绪（${reason}）：${next.fileCount} 篇 / ${(
            next.bytes / 1024
          ).toFixed(0)} KB / 耗时 ${next.tookMs} ms`,
        )
        return next
      } catch (error) {
        snapshot = createEmptySnapshot(error?.message || '索引构建失败')
        log.error('[BaguRadar] 搜索索引构建失败', error)
        return snapshot
      }
    })()

    try {
      await building
    } finally {
      building = null
      if (pending && !closed) {
        pending = false
        scheduleRebuild('queued')
      }
    }

    return snapshot
  }

  function scheduleRebuild(reason) {
    if (closed) return
    if (rebuildTimer) clearTimeout(rebuildTimer)
    rebuildTimer = setTimeout(() => {
      rebuildTimer = null
      void rebuild(reason)
    }, rebuildDelay)
  }

  async function poll() {
    if (closed || building) return
    try {
      const stats = await fsp.stat(path.join(root, 'docs'))
      if (!stats.isDirectory()) return
    } catch {
      return
    }

    let manifestStamp = ''
    try {
      const stat = await fsp.stat(path.join(root, 'manifest.json'))
      manifestStamp = `${Math.round(stat.mtimeMs)}:${stat.size}`
    } catch {
      manifestStamp = 'missing'
    }

    const files = await listMarkdown(root, root)
    const fingerprint = files
      .map((entry) => `${entry.relative}:${Math.round(entry.mtimeMs)}:${entry.size}`)
      .sort()
      .join('|')

    if (`${manifestStamp}#${fingerprint}` !== snapshot.fingerprint) {
      scheduleRebuild('poll')
    }
  }

  function startWatching() {
    try {
      watcher = fs.watch(root, { recursive: true }, (_event, filename) => {
        const name = filename ? toPosix(String(filename)) : ''
        if (!name || /\.md$/i.test(name) || name === 'manifest.json') {
          scheduleRebuild('watch')
        }
      })
      watcher.on('error', (error) => {
        log.error('[BaguRadar] 目录监听失败，已退化为定时轮询', error)
        watcher?.close()
        watcher = null
      })
    } catch (error) {
      log.error('[BaguRadar] 当前环境不支持递归监听，已退化为定时轮询', error)
    }

    pollTimer = setInterval(() => {
      void poll()
    }, pollInterval)
    pollTimer.unref?.()
  }

  return {
    root,
    /** 启动：先建索引，成功与否都开始监听（目录可能稍后才出现） */
    async start() {
      await rebuild('startup')
      startWatching()
      return snapshot
    },
    rebuild,
    search(query, options) {
      return searchSnapshot(snapshot, query, options)
    },
    health() {
      return {
        ok: !snapshot.error,
        docs: snapshot.docs.length,
        builtAt: snapshot.builtAt,
        tookMs: snapshot.tookMs,
        error: snapshot.error || undefined,
      }
    },
    stats() {
      return {
        docs: snapshot.docs.length,
        bytes: snapshot.bytes,
        builtAt: snapshot.builtAt,
        tookMs: snapshot.tookMs,
      }
    },
    close() {
      closed = true
      if (rebuildTimer) clearTimeout(rebuildTimer)
      if (pollTimer) clearInterval(pollTimer)
      rebuildTimer = null
      pollTimer = null
      watcher?.close()
      watcher = null
    },
  }
}
