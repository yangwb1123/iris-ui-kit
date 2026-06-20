import { type JSX } from 'solid-js'
import { AboutApp, FilesApp, NotepadApp, ShowcaseApp } from './apps'
import { AppStoreApp } from './AppStore'
import { AssistantApp } from './Assistant'
import { AgentToolsApp } from './AgentTools'
import { SettingsApp } from './Settings'
import { TaskManagerApp } from './TaskManager'
import { DataApp } from './Data'
import { CalculatorApp } from './Calculator'
import { TerminalView } from './Terminal'
import { PhotosApp } from './Photos'

/**
 * Capabilities an app may request. The desktop surfaces these as a transparent
 * permission contract (App Store badges) the user grants/revokes per app
 * (Settings → Privacy & permissions). Enforcement is advisory for this demo —
 * the explicit, user-visible model is the point.
 *
 * - `storage`       — read/write data into the user profile.
 * - `clipboard`     — read/write the system clipboard.
 * - `notifications` — post desktop notifications.
 * - `network`       — make external network requests / embed remote content.
 * - `agent`         — drive the in-app AI agent on the user's behalf.
 */
export type Permission = 'storage' | 'clipboard' | 'notifications' | 'network' | 'agent'

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
   * - `remote`    — a micro-frontend ESM module fetched + mounted at RUNTIME from
   *                 `url` (module-federation; see {@link loadRemoteApp}).
   */
  kind: 'component' | 'link' | 'iframe' | 'remote'
  description?: string
  defaultSize?: { width: number; height: number }
  /** Built-in apps ship with the OS and can't be uninstalled. */
  builtin?: boolean
  /** Target URL for `link` / `iframe` / `remote` kinds. */
  url?: string
  /** Renderer for `component` kind (the window body). */
  render?: () => JSX.Element
  /** Capabilities the app requests; surfaced + granted per app. */
  permissions?: Permission[]
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
    permissions: ['storage', 'network', 'notifications'],
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
    permissions: ['agent'],
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
    permissions: ['agent'],
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
    permissions: ['storage'],
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
    permissions: ['storage', 'clipboard'],
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
    permissions: ['agent'],
    render: () => ShowcaseApp(),
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: '⚙️',
    kind: 'component',
    builtin: true,
    description: 'Pick the desktop accent color (persisted).',
    defaultSize: { width: 440, height: 420 },
    permissions: ['storage'],
    render: () => SettingsApp(),
  },
  {
    id: 'taskmgr',
    name: 'Task Manager',
    icon: '📈',
    kind: 'component',
    builtin: true,
    description: 'Live window-manager state.',
    defaultSize: { width: 420, height: 340 },
    render: () => TaskManagerApp(),
  },
  {
    id: 'data',
    name: 'Data',
    icon: '📊',
    kind: 'component',
    builtin: true,
    description: 'IrisTable in a managed window.',
    defaultSize: { width: 560, height: 420 },
    permissions: ['storage', 'network'],
    render: () => DataApp(),
  },
  {
    id: 'calculator',
    name: 'Calculator',
    icon: '🧮',
    kind: 'component',
    builtin: true,
    description: 'A working calculator.',
    defaultSize: { width: 300, height: 440 },
    render: () => CalculatorApp(),
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
    render: () => TerminalView({ appNames: CATALOG.map((m) => m.name) }),
    permissions: ['agent', 'clipboard'],
  },
  {
    id: 'photos',
    name: 'Photos',
    icon: '🖼️',
    kind: 'component',
    builtin: true,
    description: 'A small image gallery.',
    defaultSize: { width: 520, height: 420 },
    permissions: ['storage'],
    render: () => PhotosApp(),
  },

  // ── Installable LINK apps (open in a new tab; no window) ────────────────────
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    kind: 'link',
    description: 'Open github.com in a new tab.',
    url: 'https://github.com',
    permissions: ['network'],
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    icon: '📚',
    kind: 'link',
    description: 'Open wikipedia.org in a new tab.',
    url: 'https://wikipedia.org',
    permissions: ['network'],
  },
  {
    id: 'hackernews',
    name: 'Hacker News',
    icon: '📰',
    kind: 'link',
    description: 'Open news.ycombinator.com in a new tab.',
    url: 'https://news.ycombinator.com',
    permissions: ['network'],
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
    permissions: ['network'],
  },
  {
    id: 'example',
    name: 'Example',
    icon: '🌐',
    kind: 'iframe',
    description: 'example.com, embedded.',
    defaultSize: { width: 560, height: 420 },
    url: 'https://example.com',
    permissions: ['network'],
  },

  // ── Installable REMOTE apps (ESM modules mounted at runtime from a URL) ──────
  {
    id: 'remoteclock',
    name: 'Remote Clock',
    icon: '🛰️',
    kind: 'remote',
    description: 'A micro-frontend loaded at runtime from a URL.',
    defaultSize: { width: 360, height: 320 },
    url: '/remote-apps/clock.mjs',
    permissions: ['network'],
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
