import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import process from 'node:process'
import { fileURLToPath, URL, URLSearchParams } from 'node:url'
import { after, before, test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'

const { fetch } = globalThis
const appRoot = fileURLToPath(new URL('..', import.meta.url))
let appServer
let baseUrl = ''
let serverLog = ''

async function freePort() {
  return await new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Could not allocate a production test port.'))
        return
      }
      probe.close((error) => (error ? reject(error) : resolve(address.port)))
    })
  })
}

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // The production process is still starting.
    }
    await delay(100)
  }
  throw new Error(`SvelteKit production server did not start.\n${serverLog}`)
}

before(
  async () => {
    execFileSync('pnpm', ['build'], {
      cwd: appRoot,
      stdio: 'inherit',
      timeout: 180_000,
    })

    const port = await freePort()
    baseUrl = `http://127.0.0.1:${port}`
    appServer = spawn(process.execPath, ['build/index.js'], {
      cwd: appRoot,
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: String(port),
        ORIGIN: baseUrl,
        NODE_ENV: 'production',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    appServer.stdout?.on('data', (chunk) => {
      serverLog += String(chunk)
    })
    appServer.stderr?.on('data', (chunk) => {
      serverLog += String(chunk)
    })
    await waitForServer()
  },
  { timeout: 200_000 },
)

after(async () => {
  if (!appServer || appServer.exitCode !== null) return
  appServer.kill('SIGTERM')
  await Promise.race([once(appServer, 'exit'), delay(5_000)])
})

test('production file routes render the shared IA and server load data', async () => {
  const [home, data, feedback] = await Promise.all(
    ['/', '/data', '/feedback'].map(async (path) => {
      const response = await fetch(`${baseUrl}${path}`)
      return { response, html: await response.text() }
    }),
  )

  assert.equal(home.response.status, 200)
  assert.match(home.html, /data-hydration-demo="sveltekit"/)
  assert.match(home.html, /live badge/)
  assert.equal(data.response.status, 200)
  assert.match(data.html, /data-ssr-source="sveltekit-page-server-load"/)
  assert.match(data.html, /Ada Lovelace/)
  assert.equal(feedback.response.status, 200)
  assert.match(feedback.html, /<form[^>]+method="POST"/i)
  assert.match(feedback.html, /Send feedback/)
})

test('native form action validates input and renders error/success states', async () => {
  const headers = {
    accept: 'text/html,application/xhtml+xml',
    origin: baseUrl,
  }
  const invalid = await fetch(`${baseUrl}/feedback`, {
    method: 'POST',
    body: new URLSearchParams({ name: 'A', message: 'short' }),
    headers,
  })
  const invalidHtml = await invalid.text()
  assert.equal(invalid.status, 400)
  assert.match(invalidHtml, /Please check the form/)
  assert.match(invalidHtml, /Enter at least 2 characters/)

  const valid = await fetch(`${baseUrl}/feedback`, {
    method: 'POST',
    body: new URLSearchParams({ name: 'Ada', message: 'This is useful feedback.' }),
    headers,
  })
  const validHtml = await valid.text()
  assert.equal(valid.status, 200)
  assert.match(validHtml, /Feedback received/)
  assert.match(validHtml, /validated on the server/)
})
