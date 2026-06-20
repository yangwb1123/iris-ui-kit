import { type JSX } from 'solid-js'
import { AboutApp, FilesApp, NotepadApp, ShowcaseApp } from './apps'
import { AppStoreApp } from './AppStore'
import { AssistantApp } from './Assistant'
import { AgentToolsApp } from './AgentTools'

/**
 * App-aggregation manifest. The desktop is no longer a fixed set of Solid panes:
 * it's a CATALOG of "apps" of several KINDS, some built in, some installable into
 * the user profile (`@iris-ui/core/profile`). A manifest is the portable
 * description the shell renders + launches from — the same model the React demo
 * uses, here on Solid.
 */
export interface AppManifest {
  id: string
  name: string
  /** Emoji glyph used as the icon (keeps the demo dependency-free). */
  icon: string
  /**
   * How the app runs:
   * - `component` — an in-process Solid view in its own managed window.
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
  render?: () => JSX.Element
  /** User-added web apps (aggregated by URL) carry this flag; they're removable. */
  custom?: boolean
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
    defaultSize: { width: 480, height: 400 },
    render: () => AboutApp(),
  },
  {
    id: 'appstore',
    name: 'App Store',
    icon: '🛍️',
    kind: 'component',
    builtin: true,
    description: 'Browse and install apps into your profile.',
    defaultSize: { width: 640, height: 520 },
    render: () => AppStoreApp(),
  },
  {
    id: 'assistant',
    name: 'Assistant',
    icon: '🤖',
    kind: 'component',
    builtin: true,
    description:
      'Drive the desktop in natural language (command-registry agent, optional Claude planner).',
    defaultSize: { width: 460, height: 480 },
    render: () => AssistantApp(),
  },
  {
    id: 'agenttools',
    name: 'Agent Tools',
    icon: '🛠️',
    kind: 'component',
    builtin: true,
    description: 'The MCP tools an external agent sees — invokable via runMcpTool.',
    defaultSize: { width: 480, height: 460 },
    render: () => AgentToolsApp(),
  },
  {
    id: 'files',
    name: 'Files',
    icon: '📁',
    kind: 'component',
    builtin: true,
    description: 'A simple file browser.',
    defaultSize: { width: 520, height: 400 },
    render: () => FilesApp(),
  },
  {
    id: 'notepad',
    name: 'Notepad',
    icon: '📝',
    kind: 'component',
    builtin: true,
    description: 'Jot notes; state lives in the window.',
    defaultSize: { width: 480, height: 360 },
    render: () => NotepadApp(),
  },
  {
    id: 'showcase',
    name: 'Iris Showcase',
    icon: '🎛️',
    kind: 'component',
    builtin: true,
    description: 'Real Iris components, OS-skinned.',
    defaultSize: { width: 460, height: 380 },
    render: () => ShowcaseApp(),
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
]

/**
 * Runtime registry of USER-ADDED web-app manifests. These live in the user
 * profile (the `customApps` pref) rather than the static {@link CATALOG}, but
 * the shell still resolves them through {@link getManifest} — every component
 * that renders a window / icon / taskbar entry looks an app up by id, so custom
 * apps must be discoverable the same way. The profile is the source of truth;
 * the shell mirrors it here (see `registerCustomApps`) so synchronous lookups
 * work without threading the profile through every component.
 */
const customRegistry = new Map<string, AppManifest>()

/** Mirror the profile's custom apps into the lookup registry (shell calls this). */
export function registerCustomApps(apps: AppManifest[]): void {
  customRegistry.clear()
  for (const app of apps) customRegistry.set(app.id, app)
}

/** Look up a manifest by id (static catalog first, then user-added apps). */
export const getManifest = (id: string): AppManifest | undefined =>
  CATALOG.find((m) => m.id === id) ?? customRegistry.get(id)

/** Built-in apps (always available, can't be uninstalled). */
export const BUILTIN_APPS: AppManifest[] = CATALOG.filter((m) => m.builtin)

/** Installable (non-builtin) catalog entries — the App Store list. */
export const INSTALLABLE_APPS: AppManifest[] = CATALOG.filter((m) => !m.builtin)
