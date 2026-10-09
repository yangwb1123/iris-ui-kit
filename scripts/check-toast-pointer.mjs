import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import process from 'node:process'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'packages/svelte/package.json'))
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href)
const pluginDirectory = join(root, 'packages/svelte/node_modules/@sveltejs/vite-plugin-svelte')
const pluginManifest = JSON.parse(readFileSync(join(pluginDirectory, 'package.json'), 'utf8'))
const { svelte } = await import(
  pathToFileURL(join(pluginDirectory, pluginManifest.exports['.'].import.default)).href
)
const frameworks = ['vue', 'react', 'solid', 'svelte']
const boot = `
  const expose = api => {
    window.toastProbe = { push: options => api.push({ duration: 0, ...options }), actions: 0 };
    window.pointerTrace = [];
    for (const kind of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture']) {
      document.addEventListener(kind, event => {
        const detail = { kind, pointerId: event.pointerId, isPrimary: event.isPrimary, button: event.button,
          x: event.clientX, y: event.clientY, tag: event.target.tagName, toast: !!event.target.hasAttribute?.('data-iris-toast') };
        if (kind === 'pointerdown') window.lastDown = detail;
        window.pointerTrace.push(detail); if (window.pointerTrace.length > 128) window.pointerTrace.shift();
      }, true);
    }
  };
`
const sources = {
  vue: `import { createApp, h } from 'vue';
    import { IrisProvider, IrisToastViewport, useToast } from '@iris-ui-kit/vue';
    ${boot} expose(useToast());
    createApp({ render: () => h(IrisProvider, null, { default: () => h(IrisToastViewport) }) }).mount('#app');`,
  react: `import { createElement as h } from 'react'; import { createRoot } from 'react-dom/client';
    import { IrisProvider, IrisToastViewport, useToast } from '@iris-ui-kit/react';
    ${boot} function Harness() { expose(useToast()); return h(IrisProvider, null, h(IrisToastViewport)); }
    createRoot(document.getElementById('app')).render(h(Harness));`,
  solid: `import { createComponent } from 'solid-js'; import { render } from 'solid-js/web';
    import { IrisProvider, IrisToastViewport, useToast } from '@iris-ui-kit/solid';
    ${boot} expose(useToast());
    render(() => createComponent(IrisProvider, { get children() { return createComponent(IrisToastViewport, {}); } }), document.getElementById('app'));`,
  svelte: `import { mount } from 'svelte'; import Harness from 'virtual:toast-harness.svelte';
    mount(Harness, { target: document.getElementById('app') });`,
}
const harness = `<script>
  import { onMount } from 'svelte';
  import { IrisProvider, IrisToastViewport, useToast } from '@iris-ui-kit/svelte';
  ${boot} const api = useToast(); onMount(() => expose(api));
</script><IrisProvider><IrisToastViewport /></IrisProvider>`

function fixturePlugin() {
  return {
    name: 'toast-pointer-fixture',
    resolveId(id) {
      if (id === 'virtual:toast-harness.svelte') return join(temporary, 'ToastHarness.svelte')
      if (id === '/__toast/svelte.js') return join(temporary, 'svelte.js')
      if (id.startsWith('/__toast/') && frameworks.includes(id.slice(9, -3))) return '\0' + id
    },
    load(id) {
      if (id.startsWith('\0/__toast/')) return sources[id.slice(10, -3)]
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/probe?')) return next()
        const fw = new URL(req.url, 'http://localhost').searchParams.get('framework')
        if (!frameworks.includes(fw)) {
          res.statusCode = 400
          res.end('Invalid framework')
          return
        }
        res.setHeader('Content-Type', 'text/html')
        res.end(
          `<!doctype html><html><body><div id="app"></div><script type="module" src="/__toast/${fw}.js"></script></body></html>`,
        )
      })
    },
  }
}

async function push(page, title, action = false) {
  await page.evaluate(
    ({ title, action }) =>
      window.toastProbe.push({
        title,
        ...(action
          ? { action: { label: 'Native action', onClick: () => window.toastProbe.actions++ } }
          : {}),
      }),
    { title, action },
  )
  const toast = page.locator('[data-iris-toast]').filter({ hasText: title })
  await toast.waitFor({ state: 'visible' })
  const box = await toast.boundingBox()
  assert.ok(
    box.x >= -0.5 && box.x + box.width <= page.viewportSize().width + 0.5,
    'Toast must fit the viewport without a host CSS reset',
  )
  return toast
}

async function drag(page, toast, delta) {
  const box = await toast.locator(':scope > div').first().boundingBox()
  assert.ok(box)
  // Ordinary content, not an RTL dismiss/action button or an off-screen edge.
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + delta, y, { steps: 5 })
  return { x, y }
}

async function checkGestures(page) {
  let toast = await push(page, 'Native close')
  await toast.getByRole('button', { name: 'Dismiss', exact: true }).click()
  await toast.waitFor({ state: 'detached' })
  assert.equal(await page.evaluate(() => window.lastDown.tag), 'BUTTON')
  toast = await push(page, 'Native action', true)
  await toast.getByRole('button', { name: 'Native action' }).click()
  await toast.waitFor({ state: 'detached' })
  assert.equal(await page.evaluate(() => window.toastProbe.actions), 1)
  for (const delta of [140, -140]) {
    toast = await push(page, 'Native swipe ' + delta)
    await drag(page, toast, delta)
    await page.mouse.up()
    await toast.waitFor({ state: 'detached' })
  }
  toast = await push(page, 'Small swipe')
  await drag(page, toast, 30)
  await page.mouse.up()
  assert.equal(await toast.count(), 1)
  await toast.getByRole('button', { name: 'Dismiss', exact: true }).click()
  toast = await push(page, 'Lost capture')
  await drag(page, toast, 140)
  await toast.evaluate((node) => node.releasePointerCapture(window.lastDown.pointerId))
  await page.mouse.move(10, 10)
  await page.mouse.up()
  await page.waitForFunction(() => !document.querySelector('[data-iris-toast]').style.transform)
  assert.equal(await toast.count(), 1)
  await toast.getByRole('button', { name: 'Dismiss', exact: true }).click()
  await page.evaluate(() =>
    window.toastProbe.push({ id: 'replacement', title: 'Before replacement' }),
  )
  toast = page.locator('[data-iris-toast]').filter({ hasText: 'Before replacement' })
  await toast.waitFor({ state: 'visible' })
  await drag(page, toast, 140)
  await page.evaluate(() =>
    window.toastProbe.push({ id: 'replacement', title: 'After replacement' }),
  )
  await page.mouse.up()
  toast = page.locator('[data-iris-toast]').filter({ hasText: 'After replacement' })
  await toast.waitFor({ state: 'visible' })
  await page.waitForFunction(() => !document.querySelector('[data-iris-toast]').style.transform)
  await toast.getByRole('button', { name: 'Dismiss', exact: true }).click()
  return 7
}

async function checkTouch(page) {
  const session = await page.context().newCDPSession(page)
  try {
    const toast = await push(page, 'Touch cancel')
    const box = await toast.locator(':scope > div').first().boundingBox()
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...point, x: point.x + 140 }],
    })
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
    await page.waitForFunction(() => !document.querySelector('[data-iris-toast]').style.transform)
    assert.equal(await toast.count(), 1)
    await toast.getByRole('button', { name: 'Dismiss', exact: true }).click()
    const multi = await push(page, 'Secondary pointer')
    const body = await multi.locator(':scope > div').first().boundingBox()
    const primary = { x: body.x + body.width / 2, y: body.y + body.height / 2, id: 1 }
    const secondary = { ...primary, x: primary.x - 30, id: 2 }
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [primary] })
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [primary, secondary],
    })
    await page.waitForFunction(() => window.lastDown.isPrimary === false)
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [primary, { ...secondary, x: secondary.x + 140 }],
    })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [primary] })
    assert.equal(await multi.count(), 1, 'A foreign release must not dismiss the primary owner')
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    assert.equal(await multi.count(), 1)
    await multi.getByRole('button', { name: 'Dismiss', exact: true }).click()
    return 2
  } finally {
    await session.detach()
  }
}

const temporary = mkdtempSync(join(tmpdir(), 'iris-toast-pointer-'))
writeFileSync(join(temporary, 'ToastHarness.svelte'), harness)
writeFileSync(join(temporary, 'svelte.js'), sources.svelte)
let server, browser
const results = [],
  pageErrors = [],
  unexpectedRequests = []
let pageErrorCount = 0,
  unexpectedRequestCount = 0
function recordDiagnostic(list, value) {
  if (list.length < 128) list.push(String(value).slice(0, 4096))
}
let timedOut = false
const deadline = setTimeout(() => {
  timedOut = true
  // Close only the browser and transport created by this gate; finally also cleans them.
  void browser?.close()
  void server?.close()
}, 240_000)
try {
  const alias = Object.fromEntries(
    ['core', 'tokens', 'theme', 'skins', 'icons', ...frameworks].map((name) => [
      '@iris-ui-kit/' + name,
      join(root, 'packages', name, 'dist/index.js'),
    ]),
  )
  server = await createServer({
    root,
    configFile: false,
    cacheDir: join(temporary, 'vite'),
    resolve: {
      conditions: ['browser', 'module', 'development'],
      dedupe: ['svelte'],
      alias: [
        ...Object.entries(alias).map(([find, replacement]) => ({
          find: new RegExp('^' + find + '$'),
          replacement,
        })),
        {
          find: /^react$/,
          replacement: createRequire(join(root, 'packages/react/package.json')).resolve('react'),
        },
        {
          find: /^react-dom\/client$/,
          replacement: createRequire(join(root, 'packages/react/package.json')).resolve(
            'react-dom/client',
          ),
        },
        {
          find: /^solid-js$/,
          replacement: join(root, 'packages/solid/node_modules/solid-js/dist/solid.js'),
        },
        {
          find: /^solid-js\/web$/,
          replacement: join(root, 'packages/solid/node_modules/solid-js/web/dist/web.js'),
        },
        {
          find: /^solid-js\/store$/,
          replacement: join(root, 'packages/solid/node_modules/solid-js/store/dist/store.js'),
        },
      ],
    },
    plugins: [fixturePlugin(), svelte({ configFile: false, hot: false })],
    server: { host: '127.0.0.1', port: 0, strictPort: true, fs: { allow: [root, temporary] } },
    logLevel: 'error',
  })
  await server.listen()
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port
  browser = await chromium.launch({ headless: true, channel: 'chromium' })
  for (const framework of frameworks)
    for (const width of [320, 1280])
      for (const font of [14, 28])
        for (const direction of ['ltr', 'rtl']) {
          const context = await browser.newContext({
            viewport: { width, height: 800 },
            hasTouch: true,
          })
          await context.route('**/*', (route) => {
            if (
              route
                .request()
                .url()
                .startsWith(origin + '/')
            )
              return route.continue()
            unexpectedRequestCount++
            recordDiagnostic(unexpectedRequests, route.request().url())
            return route.abort()
          })
          const page = await context.newPage()
          page.setDefaultTimeout(10_000)
          page.on('pageerror', (error) => {
            pageErrorCount++
            recordDiagnostic(pageErrors, error)
          })
          try {
            await page.goto(origin + '/probe?framework=' + framework)
            await page.waitForFunction(
              () => !!window.toastProbe && !!document.querySelector('[data-iris-toast-viewport]'),
            )
            await page.evaluate(
              ({ font, direction }) => {
                document.documentElement.dir = direction
                document.documentElement.style.setProperty('--iris-font-size-md', font + 'px')
              },
              { font, direction },
            )
            const checks = (await checkGestures(page)) + (await checkTouch(page))
            results.push({ framework, width, font, direction, checks })
          } catch (error) {
            console.error(
              JSON.stringify({
                result: 'failed',
                framework,
                width,
                font,
                direction,
                completed: results,
                state: await page
                  .evaluate(() => ({
                    lastDown: window.lastDown,
                    trace: window.pointerTrace,
                    toasts: [...document.querySelectorAll('[data-iris-toast]')]
                      .slice(0, 16)
                      .map((node) => ({
                        text: node.textContent?.slice(0, 4096),
                        style: node.getAttribute('style')?.slice(0, 4096),
                        box: node.getBoundingClientRect().toJSON(),
                      })),
                  }))
                  .catch((diagnosticError) => ({
                    unavailable: String(diagnosticError).slice(0, 4096),
                  })),
                pageErrorCount,
                unexpectedRequestCount,
                pageErrors,
                unexpectedRequests,
              }),
            )
            throw error
          } finally {
            await context.close()
          }
        }
  assert.equal(timedOut, false, 'Toast browser gate exceeded 240s')
  assert.equal(results.length, 32, 'Every declared framework/layout profile must execute')
  assert.ok(
    results.every((result) => result.checks === 9),
    'Every gesture check must execute',
  )
  assert.equal(pageErrorCount, 0)
  assert.equal(unexpectedRequestCount, 0)
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(unexpectedRequests, [])
  console.log(
    JSON.stringify({
      result: 'passed',
      surface: 'candidate built packages; native browser input, not npm or hardware acceptance',
      results,
      pageErrors,
      unexpectedRequests,
    }),
  )
} finally {
  clearTimeout(deadline)
  await browser?.close()
  await server?.close()
  rmSync(temporary, { recursive: true, force: true })
}
