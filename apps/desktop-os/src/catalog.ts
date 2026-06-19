import * as React from 'react'
import {
  AboutView,
  FilesView,
  NotepadView,
  ShowcaseView,
  SettingsView,
  TaskManagerView,
  TerminalView,
} from './apps'
import { DataApp } from './appviews/Data'
import { CalculatorApp } from './appviews/Calculator'
import { PhotosApp } from './appviews/Photos'
import { AppStoreView } from './appviews/AppStore'

/**
 * App-aggregation manifest. The desktop is no longer a fixed set of React panes:
 * it's a catalog of "apps" of several KINDS, some built in, some installable into
 * the user profile. A manifest is the portable description the shell renders +
 * launches from.
 */
export interface AppManifest {
  id: string
  name: string
  /** Emoji glyph used as the icon (keeps the demo dependency-free). */
  icon: string
  /**
   * How the app runs:
   * - `component` — an in-process React view in its own managed window.
   * - `link`      — opens an external URL in a NEW BROWSER TAB (no window).
   * - `iframe`    — embeds an external URL inside a managed window via <iframe>.
   */
  kind: 'component' | 'link' | 'iframe'
  description?: string
  defaultSize?: { width: number; height: number }
  /** Built-in apps ship with the OS and can't be uninstalled. */
  builtin?: boolean
  /** Target URL for `link` / `iframe` kinds. */
  url?: string
  /** Renderer for `component` kind (the window body). */
  render?: () => React.ReactNode
}

/**
 * The full catalog: built-in component apps + installable link/iframe apps.
 * `builtin` apps always show; non-builtin entries are installed via the profile.
 */
export const CATALOG: AppManifest[] = [
  // ── Built-in component apps ────────────────────────────────────────────────
  {
    id: 'about',
    name: 'About',
    icon: 'ℹ️',
    kind: 'component',
    builtin: true,
    description: 'About this windowed desktop shell.',
    defaultSize: { width: 460, height: 360 },
    render: () => React.createElement(AboutView),
  },
  {
    id: 'appstore',
    name: 'App Store',
    icon: '🛍️',
    kind: 'component',
    builtin: true,
    description: 'Browse and install apps into your profile.',
    defaultSize: { width: 640, height: 480 },
    render: () => React.createElement(AppStoreView),
  },
  {
    id: 'files',
    name: 'Files',
    icon: '📁',
    kind: 'component',
    builtin: true,
    description: 'A simple file browser.',
    defaultSize: { width: 520, height: 400 },
    render: () => React.createElement(FilesView),
  },
  {
    id: 'notepad',
    name: 'Notepad',
    icon: '📝',
    kind: 'component',
    builtin: true,
    description: 'Jot notes; state lives in the window.',
    defaultSize: { width: 480, height: 360 },
    render: () => React.createElement(NotepadView),
  },
  {
    id: 'showcase',
    name: 'Iris Showcase',
    icon: '🎛️',
    kind: 'component',
    builtin: true,
    description: 'Real Iris components, OS-skinned.',
    defaultSize: { width: 460, height: 380 },
    render: () => React.createElement(ShowcaseView),
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: '⚙️',
    kind: 'component',
    builtin: true,
    description: 'Switch the desktop skin (persisted).',
    defaultSize: { width: 440, height: 420 },
    render: () => React.createElement(SettingsView),
  },
  {
    id: 'taskmgr',
    name: 'Task Manager',
    icon: '📈',
    kind: 'component',
    builtin: true,
    description: 'Live window-manager state.',
    defaultSize: { width: 420, height: 340 },
    render: () => React.createElement(TaskManagerView),
  },
  {
    id: 'data',
    name: 'Data',
    icon: '📊',
    kind: 'component',
    builtin: true,
    description: 'IrisTable in a managed window.',
    defaultSize: { width: 560, height: 420 },
    render: () => React.createElement(DataApp),
  },
  {
    id: 'calculator',
    name: 'Calculator',
    icon: '🧮',
    kind: 'component',
    builtin: true,
    description: 'A working calculator.',
    defaultSize: { width: 300, height: 440 },
    render: () => React.createElement(CalculatorApp),
  },
  {
    id: 'terminal',
    name: 'Terminal',
    icon: '⌨️',
    kind: 'component',
    builtin: true,
    description: 'A faux in-window shell.',
    defaultSize: { width: 520, height: 360 },
    // `CATALOG` is fully initialized by the time any window renders, so reading
    // app names here keeps the terminal's `apps` command live + avoids a cycle.
    render: () => React.createElement(TerminalView, { appNames: CATALOG.map((m) => m.name) }),
  },
  {
    id: 'photos',
    name: 'Photos',
    icon: '🖼️',
    kind: 'component',
    builtin: true,
    description: 'A small image gallery.',
    defaultSize: { width: 520, height: 420 },
    render: () => React.createElement(PhotosApp),
  },

  // ── Installable LINK apps (open in a new tab; no window) ────────────────────
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    kind: 'link',
    description: 'Open github.com in a new tab.',
    url: 'https://github.com',
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    icon: '📚',
    kind: 'link',
    description: 'Open wikipedia.org in a new tab.',
    url: 'https://wikipedia.org',
  },
  {
    id: 'hackernews',
    name: 'Hacker News',
    icon: '📰',
    kind: 'link',
    description: 'Open news.ycombinator.com in a new tab.',
    url: 'https://news.ycombinator.com',
  },

  // ── Installable IFRAME apps (embed in a window; may be blocked) ─────────────
  {
    id: 'maps',
    name: 'Maps',
    icon: '🗺️',
    kind: 'iframe',
    description: 'OpenStreetMap, embedded.',
    defaultSize: { width: 640, height: 480 },
    url: 'https://www.openstreetmap.org/export/embed.html?bbox=-0.2,51.4,0.0,51.6&layer=mapnik',
  },
  {
    id: 'example',
    name: 'Example',
    icon: '🌐',
    kind: 'iframe',
    description: 'example.com, embedded.',
    defaultSize: { width: 560, height: 420 },
    url: 'https://example.com',
  },
]

/** Look up a manifest by id. */
export const getManifest = (id: string): AppManifest | undefined => CATALOG.find((m) => m.id === id)

/** Built-in apps (always available, can't be uninstalled). */
export const BUILTIN_APPS: AppManifest[] = CATALOG.filter((m) => m.builtin)

/** Installable (non-builtin) catalog entries — the App Store list. */
export const INSTALLABLE_APPS: AppManifest[] = CATALOG.filter((m) => !m.builtin)
