// Electron preload — runs in an isolated context and exposes a minimal,
// framework-agnostic native API on `window.irisNative`. The renderer (any of
// the Iris CMS apps) registers it with the @iris-ui/core bridges:
//   setFileSaveHandler((file) => { window.irisNative.saveFile(file); return true })
//   setClipboardHandler((text) => { window.irisNative.writeClipboard(text); return true })
const { contextBridge, ipcRenderer } = require('electron')

// The main process appends `?fw=<framework>` when it points the window at a
// framework's server, so this stays accurate after live switching.
const fwFromUrl = new URLSearchParams(globalThis.location?.search || '').get('fw')

contextBridge.exposeInMainWorld('irisNative', {
  platform: 'electron',
  framework: fwFromUrl || process.env.IRIS_FW || 'react',
  /** Route a library file-save through the native Save dialog. */
  saveFile: (payload) => ipcRenderer.invoke('iris:save-file', payload),
  /** Route a library clipboard copy through the native clipboard. */
  writeClipboard: (text) => ipcRenderer.invoke('iris:write-clipboard', text),
})
