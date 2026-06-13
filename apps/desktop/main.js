// Electron main process — a single desktop shell that hosts ALL FOUR Iris UI
// CMS demos (React / Vue / Solid / Svelte) in one window, switchable live via
// the "Framework" menu or Cmd/Ctrl+1–4. Each framework's built `dist/` is served
// on its own loopback port (Vite emits absolute `/assets/…` paths, so each must
// be served at its own root); switching just re-points the window. The
// @iris-ui/core native bridges (file-save + clipboard) are wired to real OS APIs.
const { app, BrowserWindow, ipcMain, dialog, clipboard, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const { createStaticServer } = require('./server')

const FRAMEWORKS = [
  { fw: 'react', label: 'React', dist: '../cms-react/dist' },
  { fw: 'vue', label: 'Vue', dist: '../cms/dist' },
  { fw: 'solid', label: 'Solid', dist: '../cms-solid/dist' },
  { fw: 'svelte', label: 'Svelte', dist: '../cms-svelte/dist' },
]

// ── Native bridges (the whole point of the demo) ─────────────────────────────
// The library calls these via window.irisNative (see preload.js); here they hit
// real OS dialogs/clipboard instead of the browser's <a download> / navigator.
ipcMain.handle('iris:save-file', async (_event, payload) => {
  const win = BrowserWindow.getFocusedWindow()
  const { canceled, filePath } = await dialog.showSaveDialog(win ?? undefined, {
    defaultPath: payload && payload.filename ? payload.filename : 'export.txt',
  })
  if (canceled || !filePath) return false
  fs.writeFileSync(filePath, (payload && payload.content) || '', 'utf8')
  return true
})
ipcMain.handle('iris:write-clipboard', (_event, text) => {
  clipboard.writeText(String(text ?? ''))
  return true
})

const ports = {} // fw -> port (only for frameworks whose CMS is built)
let win = null

function titleFor(fw) {
  const f = FRAMEWORKS.find((x) => x.fw === fw)
  return `Iris CMS — ${f ? f.label : fw}  ·  Electron desktop shell (⌘/Ctrl+1–4 to switch framework)`
}

function loadFramework(fw) {
  if (!win || !ports[fw]) return
  win.setTitle(titleFor(fw))
  win.loadURL(`http://127.0.0.1:${ports[fw]}/?fw=${fw}`)
  buildMenu(fw)
}

function buildMenu(currentFw) {
  const fwItems = FRAMEWORKS.filter((f) => ports[f.fw]).map((f, i) => ({
    label: f.label,
    type: 'radio',
    checked: f.fw === currentFw,
    accelerator: `CmdOrCtrl+${i + 1}`,
    click: () => loadFramework(f.fw),
  }))
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { label: 'Framework', submenu: fwItems },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      { role: 'windowMenu' },
    ]),
  )
}

function createWindow(initialFw) {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    title: titleFor(initialFw),
    backgroundColor: '#0b0b10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  buildMenu(initialFw)
  win.loadURL(`http://127.0.0.1:${ports[initialFw]}/?fw=${initialFw}`)
  win.on('closed', () => {
    win = null
  })
}

app.whenReady().then(async () => {
  // Start one static server per BUILT framework (skip any not yet built).
  for (const f of FRAMEWORKS) {
    const distDir = path.resolve(__dirname, f.dist)
    if (!fs.existsSync(path.join(distDir, 'index.html'))) continue
    const { port } = await createStaticServer(distDir)
    ports[f.fw] = port
  }

  const built = FRAMEWORKS.filter((f) => ports[f.fw])
  if (built.length === 0) {
    console.error(
      '[iris-desktop] No CMS builds found. Build them first:\n' +
        '  pnpm turbo run build --filter=cms --filter=cms-react --filter=cms-solid --filter=cms-svelte',
    )
    app.quit()
    return
  }

  // Initial framework: IRIS_FW if it's built, else the first built one.
  const initial = ports[process.env.IRIS_FW] ? process.env.IRIS_FW : built[0].fw
  createWindow(initial)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(initial)
  })
})

app.on('window-all-closed', () => app.quit())
