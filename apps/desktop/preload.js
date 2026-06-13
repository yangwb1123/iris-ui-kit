// Electron preload — runs in an isolated context and exposes a minimal,
// framework-agnostic native API on `window.irisNative`. The renderer (any of
// the Iris CMS apps) registers it with the @iris-ui/core bridges:
//   setFileSaveHandler((file) => { window.irisNative.saveFile(file); return true })
//   setClipboardHandler((text) => { window.irisNative.writeClipboard(text); return true })
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('irisNative', {
  platform: 'electron',
  framework: process.env.IRIS_FW || 'react',
  /** Route a library file-save through the native Save dialog. */
  saveFile: (payload) => ipcRenderer.invoke('iris:save-file', payload),
  /** Route a library clipboard copy through the native clipboard. */
  writeClipboard: (text) => ipcRenderer.invoke('iris:write-clipboard', text),
})
