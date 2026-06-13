// Headless end-to-end self-test: launch the real Electron shell (hidden window,
// under xvfb), load the chosen framework's CMS over the static server, and via
// the renderer verify (a) the app mounted real Iris UI nodes and (b) the native
// API (window.irisNative, from preload) is present. Prints a SELFTEST_RESULT
// JSON line and exits 0/1. Run: IRIS_FW=react xvfb-run -a electron selftest.js
const { app, BrowserWindow } = require('electron')
const path = require('path')
const { createStaticServer } = require('./server')

const FW = process.env.IRIS_FW || 'react'
const DIST_BY_FW = {
  react: '../cms-react/dist',
  vue: '../cms/dist',
  solid: '../cms-solid/dist',
  svelte: '../cms-svelte/dist',
}
const distDir = path.resolve(__dirname, DIST_BY_FW[FW] || DIST_BY_FW.react)

let done = false
function finish(ok, detail, server, win) {
  if (done) return
  done = true
  console.log('SELFTEST_RESULT ' + JSON.stringify({ fw: FW, ok, ...detail }))
  try {
    if (server) server.close()
  } catch {}
  try {
    if (win) win.destroy()
  } catch {}
  app.exit(ok ? 0 : 1)
}

app.whenReady().then(async () => {
  const { server, port } = await createStaticServer(distDir)
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 840,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.webContents.on('did-fail-load', (_e, code, desc) =>
    finish(false, { failLoad: desc, code }, server, win),
  )
  win.webContents.on('did-finish-load', async () => {
    try {
      await new Promise((r) => setTimeout(r, 1000)) // let the framework mount
      const res = await win.webContents.executeJavaScript(`(() => {
        const mount = document.querySelector('#root, #app');
        const mounted = !!(mount && mount.children.length > 0);
        const hasNative = typeof window.irisNative === 'object' && !!window.irisNative
          && typeof window.irisNative.saveFile === 'function'
          && typeof window.irisNative.writeClipboard === 'function';
        const irisNodes = document.querySelectorAll(
          '[data-iris-admin-layout],[data-iris-admin-shell],[class*="iris"],[data-iris-table],[role="navigation"]'
        ).length;
        return { mounted, hasNative, title: document.title, irisNodes };
      })()`)
      finish(Boolean(res.mounted && res.hasNative && res.irisNodes > 0), res, server, win)
    } catch (e) {
      finish(false, { error: String(e) }, server, win)
    }
  })

  win.loadURL(`http://127.0.0.1:${port}/`)
})

setTimeout(() => finish(false, { timeout: true }), 25000)
