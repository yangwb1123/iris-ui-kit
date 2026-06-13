// Tiny static file server for the built CMS (Vite output uses absolute
// `/assets/...` paths, so file:// won't work — we serve over loopback HTTP).
// Pure Node (no Electron) so it can be unit-smoke-tested headlessly.
const http = require('http')
const fs = require('fs')
const path = require('path')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
}

/**
 * Create an HTTP server that serves `distDir` with an SPA fallback to
 * index.html. Resolves to the chosen { server, port } once listening.
 */
function createStaticServer(distDir, { host = '127.0.0.1', port = 0 } = {}) {
  const root = path.resolve(distDir)
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    if (urlPath === '/') urlPath = '/index.html'
    // Resolve + contain within root (no path traversal).
    let filePath = path.normalize(path.join(root, urlPath))
    if (!filePath.startsWith(root)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }
    let stat = null
    try {
      stat = fs.statSync(filePath)
    } catch {
      /* not found below */
    }
    // SPA fallback: unknown route (no file / a directory) → index.html.
    if (!stat || stat.isDirectory()) filePath = path.join(root, 'index.html')
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404)
        res.end('Not found')
        return
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      })
      res.end(data)
    })
  })
  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(port, host, () => resolve({ server, port: server.address().port, host }))
  })
}

module.exports = { createStaticServer, MIME }
