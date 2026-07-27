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
  throw new Error(`Nuxt production server did not start.\n${serverLog}`)
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
    appServer = spawn(process.execPath, ['.output/server/index.mjs'], {
      cwd: appRoot,
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: String(port),
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

test('production file routes render the shared IA and SSR data', async () => {
  const [home, data, feedback] = await Promise.all(
    ['/', '/data', '/feedback'].map(async (path) => {
      const response = await fetch(`${baseUrl}${path}`)
      return { response, html: await response.text() }
    }),
  )

  assert.equal(home.response.status, 200)
  assert.match(home.html, /data-hydration-demo="nuxt"/)
  assert.match(home.html, /live badge/)
  assert.equal(data.response.status, 200)
  assert.match(data.html, /data-ssr-source="nuxt-use-async-data"/)
  assert.match(data.html, /Ada Lovelace/)
  assert.equal(feedback.response.status, 200)
  assert.match(feedback.html, /action="\/api\/feedback"/)
  assert.match(feedback.html, /Send feedback/)
})

test('production feedback API validates JSON submissions', async () => {
  const invalid = await fetch(`${baseUrl}/api/feedback`, {
    method: 'POST',
    body: new URLSearchParams({ name: 'A', message: 'short' }),
    headers: { accept: 'application/json' },
  })
  assert.equal(invalid.status, 422)
  assert.deepEqual(await invalid.json(), {
    ok: false,
    message: 'Name and message are required.',
    errors: {
      name: 'Enter at least 2 characters.',
      message: 'Enter at least 10 characters.',
    },
  })

  const valid = await fetch(`${baseUrl}/api/feedback`, {
    method: 'POST',
    body: new URLSearchParams({ name: 'Ada', message: 'This is useful feedback.' }),
    headers: { accept: 'application/json' },
  })
  assert.equal(valid.status, 200)
  assert.equal((await valid.json()).ok, true)
})

test('native form POST progressively falls back to rendered status pages', async () => {
  const response = await fetch(`${baseUrl}/api/feedback`, {
    method: 'POST',
    body: new URLSearchParams({ name: 'Ada', message: 'This is useful feedback.' }),
    headers: { accept: 'text/html' },
  })
  const html = await response.text()

  assert.equal(response.status, 200)
  assert.equal(response.redirected, true)
  assert.match(response.url, /\/feedback\?status=success$/)
  assert.match(html, /Feedback received/)
})
