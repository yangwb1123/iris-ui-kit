// Wire the @iris-ui/core native bridges to the Electron desktop shell when the
// app is running inside it (window.irisNative is injected by the shell's
// preload — see apps/desktop). In a plain browser `irisNative` is undefined and
// this is a no-op, so the web demo behaves exactly as before.
import { setFileSaveHandler, setClipboardHandler } from '@iris-ui/core'

interface IrisNative {
  platform: string
  framework: string
  saveFile: (file: { filename: string; content: string; mimeType: string }) => Promise<boolean>
  writeClipboard: (text: string) => Promise<boolean>
}

export function registerDesktopBridges(): void {
  const native = (globalThis as unknown as { irisNative?: IrisNative }).irisNative
  if (!native) return
  // Returning a truthy value tells the library the action was handled natively
  // (so it skips the browser <a download> / navigator.clipboard fallback).
  setFileSaveHandler((file) => {
    void native.saveFile(file)
    return true
  })
  setClipboardHandler((text) => {
    void native.writeClipboard(text)
    return true
  })
}
