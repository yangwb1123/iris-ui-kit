// Headless smoke test for the desktop shell's static server (no display / no
// Electron needed). Verifies that, for each framework whose CMS is built, the
// server serves index.html, resolves the hashed JS/CSS assets it references,
// and SPA-falls-back unknown routes to index.html.
const http = require('http')
const fs = require('fs')
const path = require('path')
const { createStaticServer } = require('./server')

const DIST_BY_FW = {
  react: '../cms-react/dist',
  vue: '../cms/dist',
  solid: '../cms-solid/dist',
  svelte: '../cms-svelte/dist',
}

function get(port, urlPath) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path: urlPath }, (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () =>
          resolve({ status: res.statusCode, body, type: res.headers['content-type'] }),
        )
      })
      .on('error', reject)
  })
}

async function checkFramework(fw, distRel) {
  const distDir = path.resolve(__dirname, distRel)
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    return { fw, skipped: true, reason: 'not built' }
  }
  const { server, port } = await createStaticServer(distDir)
  try {
    const index = await get(port, '/')
    if (index.status !== 200) throw new Error(`index.html status ${index.status}`)
    if (!/<div id="root"|<div id="app"|<body/.test(index.body))
      throw new Error('index.html has no mount point')

    // Pull the first hashed asset the page references and confirm it serves 200.
    const asset = (index.body.match(/(?:src|href)="(\/assets\/[^"]+)"/) || [])[1]
    if (asset) {
      const a = await get(port, asset)
      if (a.status !== 200) throw new Error(`asset ${asset} status ${a.status}`)
    }
    // SPA fallback: an unknown deep route should still return index.html (200).
    const spa = await get(port, '/some/unknown/route')
    if (spa.status !== 200) throw new Error(`SPA fallback status ${spa.status}`)
    return { fw, ok: true, asset: asset || '(none)' }
  } finally {
    server.close()
  }
}

;(async () => {
  const results = []
  for (const [fw, rel] of Object.entries(DIST_BY_FW)) {
    try {
      results.push(await checkFramework(fw, rel))
    } catch (err) {
      results.push({ fw, ok: false, error: err.message })
    }
  }
  let failed = 0
  for (const r of results) {
    if (r.skipped) console.log(`  - ${r.fw.padEnd(7)} SKIP (${r.reason})`)
    else if (r.ok)
      console.log(`  ✓ ${r.fw.padEnd(7)} served index + asset ${r.asset} + SPA fallback`)
    else {
      failed++
      console.log(`  ✗ ${r.fw.padEnd(7)} ${r.error}`)
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} framework(s) failed the desktop static-server smoke test`)
    process.exit(1)
  }
  console.log('\nDesktop shell static-server smoke test passed.')
})()
