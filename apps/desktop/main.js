// Electron main process — a single desktop shell that can host ANY of the four
// Iris UI CMS demos (React / Vue / Solid / Svelte), selected via `IRIS_FW`.
// It serves the chosen framework's built `dist/` over loopback HTTP and wires
// the @iris-ui/core native bridges (file-save + clipboard) to real OS APIs.
const { app, BrowserWindow, ipcMain, dialog, clipboard, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const { createStaticServer } = require('./server')

const FW = process.env.IRIS_FW || 'react'
const DIST_BY_FW = {
  react: '../cms-react/dist',
  vue: '../cms/dist',
  solid: '../cms-solid/dist',
  svelte: '../cms-svelte/dist',
}
const distDir = path.resolve(__dirname, DIST_BY_FW[FW] || DIST_BY_FW.react)

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

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    title: `Iris CMS — ${FW} (Electron desktop shell)`,
    backgroundColor: '#0b0b10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.loadURL(`http://127.0.0.1:${port}/`)
  return win
}

app.whenReady().then(async () => {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    // Fail loud + early with a clear remedy rather than a blank window.
    console.error(
      `[iris-desktop] No build found at ${distDir}. Build the CMS first, e.g.:\n` +
        `  pnpm turbo run build --filter=cms-${FW === 'vue' ? '' : FW}`.replace(
          'cms-',
          FW === 'vue' ? 'cms' : 'cms-',
        ),
    )
    app.quit()
    return
  }
  const { port } = await createStaticServer(distDir)
  Menu.setApplicationMenu(null)
  createWindow(port)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(port)
  })
})

app.on('window-all-closed', () => app.quit())
