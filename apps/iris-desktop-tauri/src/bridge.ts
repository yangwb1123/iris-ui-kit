/**
 * Tauri native bridge for Iris Desktop OS.
 *
 * Provides typed access to native file system, notifications, and clipboard
 * when running inside a Tauri WebView. Falls back gracefully in browser mode
 * (returns null/noop for unsupported operations).
 *
 * Frontend code should import from this module instead of calling @tauri-apps/api
 * directly, so it works identically in Tauri and browser dev environments.
 */

import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../detect'

/** Check if running inside a Tauri WebView. */
export function isNative(): boolean {
  return isTauri()
}

// ── File system ────────────────────────────────────────────────────────────

/** Open a native file picker and return the selected path, or null if cancelled. */
export async function pickFile(): Promise<string | null> {
  if (!isNative()) return null
  return invoke< string | null>('pick_file')
}

/** Read a text file from disk by path. */
export async function readTextFile(path: string): Promise<string> {
  return invoke<string>('read_text_file', { path })
}

/** Write text content to a file by path. */
export async function writeTextFile(path: string, content: string): Promise<void> {
  return invoke<void>('write_text_file', { path, content })
}

/** Get the app data directory path. */
export async function getAppDataDir(): Promise<string> {
  return invoke<string>('app_data_dir')
}

// ── Notifications ──────────────────────────────────────────────────────────

import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'

/** Send a native OS notification. No-op in browser mode. */
export async function notify(title: string, body?: string): Promise<void> {
  if (!isNative()) return
  let granted = await isPermissionGranted()
  if (!granted) {
    const permission = await requestPermission()
    granted = permission === 'granted'
  }
  if (granted) {
    sendNotification({ title, body })
  }
}

// ── Clipboard ──────────────────────────────────────────────────────────────

import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager'

/** Read text from the system clipboard. */
export async function readClipboard(): Promise<string> {
  if (!isNative()) return ''
  return readText()
}

/** Write text to the system clipboard. */
export async function writeClipboard(text: string): Promise<void> {
  if (!isNative()) return
  await writeText(text)
}
