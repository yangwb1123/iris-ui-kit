// Headless end-to-end self-test of the LIVE framework switcher: start one static
// server per built framework, open a single hidden Electron window, then cycle
// it through every framework (exactly what the Framework menu / Cmd+1–4 does)
// and verify each one mounts real Iris UI nodes, exposes window.irisNative
// (from preload), and reports the correct framework identity via `?fw=`.
// Run: xvfb-run -a electron selftest.js   (prints SELFTEST_RESULT lines; exit 0/1)
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')
const { createStaticServer } = require('./server')

const FRAMEWORKS = [
  { fw: 'react', dist: '../cms-react/dist' },
  { fw: 'vue', dist: '../cms/dist' },
  { fw: 'solid', dist: '../cms-solid/dist' },
  { fw: 'svelte', dist: '../cms-svelte/dist' },
]

function load(win, url) {
  return new Promise((resolve, reject) => {
    const ok = () => {
      cleanup()
      resolve()
    }
    const fail = (_e, code, desc) => {
      cleanup()
      reject(new Error(`did-fail-load ${code} ${desc}`))
    }
    const cleanup = () => {
      win.webContents.off('did-finish-load', ok)
      win.webContents.off('did-fail-load', fail)
    }
    win.webContents.once('did-finish-load', ok)
    win.webContents.once('did-fail-load', fail)
    win.loadURL(url)
  })
}

app.whenReady().then(async () => {
  const ports = {}
  for (const f of FRAMEWORKS) {
    const distDir = path.resolve(__dirname, f.dist)
    if (fs.existsSync(path.join(distDir, 'index.html'))) {
      ports[f.fw] = (await createStaticServer(distDir)).port
    }
  }

  const win = new BrowserWindow({
    show: false,
    width: 1320,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  let failed = 0
  for (const f of FRAMEWORKS) {
    if (!ports[f.fw]) {
      console.log(`SELFTEST_RESULT ${JSON.stringify({ fw: f.fw, skipped: true })}`)
      continue
    }
    try {
      await load(win, `http://127.0.0.1:${ports[f.fw]}/?fw=${f.fw}`)
      await new Promise((r) => setTimeout(r, 900)) // let the framework mount
      const res = await win.webContents.executeJavaScript(`(() => {
        const mount = document.querySelector('#root, #app');
        const mounted = !!(mount && mount.children.length > 0);
        const n = window.irisNative;
        const hasNative = !!n && typeof n.saveFile === 'function' && typeof n.writeClipboard === 'function';
        const irisNodes = document.querySelectorAll(
          '[data-iris-admin-layout],[data-iris-admin-shell],[class*="iris"],[data-iris-table],[role="navigation"]'
        ).length;
        return { mounted, hasNative, fwReported: n && n.framework, irisNodes };
      })()`)
      const ok = Boolean(
        res.mounted && res.hasNative && res.irisNodes > 0 && res.fwReported === f.fw,
      )
      if (!ok) failed++
      console.log(`SELFTEST_RESULT ${JSON.stringify({ fw: f.fw, ok, ...res })}`)
    } catch (e) {
      failed++
      console.log(`SELFTEST_RESULT ${JSON.stringify({ fw: f.fw, ok: false, error: String(e) })}`)
    }
  }

  win.destroy()
  app.exit(failed > 0 ? 1 : 0)
})

setTimeout(() => {
  console.log('SELFTEST_RESULT ' + JSON.stringify({ ok: false, timeout: true }))
  app.exit(1)
}, 60000)
