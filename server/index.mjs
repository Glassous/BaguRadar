#!/usr/bin/env node
// BaguRadar 全文搜索微服务：零依赖、只读内存索引。
// 默认只监听回环地址，由 1Panel 站点把 /api 反向代理过来。

import http from 'node:http'
import path from 'node:path'
import { createIndexer } from './lib/indexer.mjs'

const HOST = process.env.SEARCH_HOST || '127.0.0.1'
const PORT = Number(process.env.SEARCH_PORT || 8787)
const CONTENT_DIR = path.resolve(
  process.env.SEARCH_CONTENT_DIR || path.join(process.cwd(), '..', 'BaguRadarFiles'),
)
const ADMIN_TOKEN = process.env.SEARCH_ADMIN_TOKEN || ''
const CORS_ORIGIN = process.env.SEARCH_CORS_ORIGIN || ''
const MAX_BODY = 4096

const indexer = createIndexer({ contentDir: CONTENT_DIR })

function applyCors(req, res) {
  if (!CORS_ORIGIN) return
  const origin = req.headers.origin
  if (CORS_ORIGIN === '*' || origin === CORS_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN === '*' ? '*' : origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token')
    res.setHeader('Access-Control-Max-Age', '86400')
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

function isLoopback(req) {
  const address = req.socket.remoteAddress || ''
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function clampLimit(value) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return 12
  return Math.max(1, Math.min(30, parsed))
}

async function handleSearch(url, res) {
  const query = url.searchParams.get('q') || ''
  const limit = clampLimit(url.searchParams.get('limit'))
  if (!query.trim()) {
    sendJson(res, 400, { error: '缺少查询词参数 q' })
    return
  }

  const result = indexer.search(query, { limit })
  sendJson(res, 200, result)
}

async function handleReindex(req, res) {
  if (!isLoopback(req)) {
    sendJson(res, 403, { error: '仅允许本机调用' })
    return
  }
  if (ADMIN_TOKEN) {
    const token = req.headers['x-admin-token'] || ''
    if (token !== ADMIN_TOKEN) {
      sendJson(res, 401, { error: '令牌校验失败' })
      return
    }
  }

  await readBody(req).catch(() => '')
  const snapshot = await indexer.rebuild('api')
  sendJson(res, 200, { ok: !snapshot.error, ...indexer.stats(), error: snapshot.error || undefined })
}

const server = http.createServer((req, res) => {
  applyCors(req, res)

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  let url
  try {
    url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  } catch {
    sendJson(res, 400, { error: '非法请求地址' })
    return
  }

  const pathname = url.pathname.replace(/\/+$/, '') || '/'

  const route = async () => {
    if (req.method === 'GET' && (pathname === '/api/health' || pathname === '/health')) {
      sendJson(res, 200, { ...indexer.health(), contentDir: indexer.root })
      return
    }
    if (req.method === 'GET' && (pathname === '/api/search' || pathname === '/search')) {
      await handleSearch(url, res)
      return
    }
    if (req.method === 'POST' && (pathname === '/api/reindex' || pathname === '/reindex')) {
      await handleReindex(req, res)
      return
    }
    sendJson(res, 404, { error: '接口不存在' })
  }

  route().catch((error) => {
    console.error('[BaguRadar] 搜索接口异常', error)
    if (!res.headersSent) sendJson(res, 500, { error: '搜索服务内部错误' })
    else res.end()
  })
})

server.on('clientError', (error, socket) => {
  if (!socket.writable) return
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
  console.error('[BaguRadar] 客户端请求错误', error?.message || error)
})

let shuttingDown = false
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[BaguRadar] 收到 ${signal}，正在关闭搜索服务`)
  indexer.close()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('uncaughtException', (error) => {
  console.error('[BaguRadar] 未捕获异常', error)
})
process.on('unhandledRejection', (error) => {
  console.error('[BaguRadar] 未处理的 Promise 拒绝', error)
})

await indexer.start()

server.listen(PORT, HOST, () => {
  console.log(`[BaguRadar] 搜索服务已启动：http://${HOST}:${PORT}`)
  console.log(`[BaguRadar] 内容目录：${CONTENT_DIR}`)
})
