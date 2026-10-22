import fs from 'node:fs'
import path from 'node:path'

const MIME_TYPES = {
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function contentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

function sendError(res, status, message, target) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify({ error: message, target }))
}

/**
 * 把本地桶目录映射到指定 URL 前缀，模拟对象存储的静态文件访问。
 * 仅作用于 dev / preview，生产环境由 VITE_BUCKET_BASE_URL 指向真实存储桶。
 */
export default function bucketStatic({ root, prefix = '/bucket' }) {
  const bucketRoot = path.resolve(root)

  const middleware = (req, res, next) => {
    const rawUrl = (req.url || '').split('?')[0].split('#')[0]
    let pathname = rawUrl
    try {
      pathname = decodeURIComponent(rawUrl)
    } catch {
      sendError(res, 400, 'Bad Request', rawUrl)
      return
    }

    if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
      next()
      return
    }

    let relative = pathname.slice(prefix.length).replace(/^\/+/, '')
    if (!relative || relative.endsWith('/')) relative += 'manifest.json'

    const filePath = path.resolve(bucketRoot, relative)
    if (filePath !== bucketRoot && !filePath.startsWith(`${bucketRoot}${path.sep}`)) {
      sendError(res, 403, 'Forbidden', relative)
      return
    }

    fs.stat(filePath, (statError, stat) => {
      if (statError || !stat.isFile()) {
        sendError(res, 404, 'Not Found', relative)
        return
      }
      res.statusCode = 200
      res.setHeader('Content-Type', contentType(filePath))
      res.setHeader('Cache-Control', 'no-cache')
      fs.createReadStream(filePath)
        .on('error', () => sendError(res, 500, 'Read Error', relative))
        .pipe(res)
    })
  }

  return {
    name: 'baguradar-bucket-static',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
