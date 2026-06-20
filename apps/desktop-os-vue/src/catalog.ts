/**
 * App-aggregation manifest catalog (Vue). The desktop is no longer a fixed set of
 * Vue panes: it's a catalog of "apps" of several KINDS, some built in, some
 * installable into the user profile. A manifest is the portable description the
 * shell renders + launches from — the Vue twin of the React demo's `catalog.ts`.
 *
 * Where React names a `render: () => <View/>`, Vue names a `component` (a
 * `markRaw`'d component object the managed window renders inside its body).
 */
import { defineComponent, h, markRaw, type Component } from 'vue'
import About from './appviews/About.vue'
import Assistant from './appviews/Assistant.vue'
import AgentTools from './appviews/AgentTools.vue'
import Notepad from './appviews/Notepad.vue'
import Files from './appviews/Files.vue'
import Showcase from './appviews/Showcase.vue'
import TaskManager from './appviews/TaskManager.vue'
import AppStore from './appviews/AppStore.vue'
import Settings from './appviews/Settings.vue'
import Data from './appviews/Data.vue'
import Calculator from './appviews/Calculator.vue'
import Photos from './appviews/Photos.vue'
import Terminal from './appviews/Terminal.vue'

/**
 * Capabilities an app may request. The desktop surfaces these as a transparent
 * permission contract (App Store badges) the user grants/revokes per app
 * (Settings → Privacy & permissions). Enforcement is advisory for this demo —
 * the explicit, user-visible model is the point. The Vue twin of the React
 * demo's `Permission`.
 *
 * - `storage`       — read/write data into the user profile.
 * - `clipboard`     — read/write the system clipboard.
 * - `notifications` — post desktop notifications.
 * - `network`       — make external network requests / embed remote content.
 * - `agent`         — drive the in-app AI agent on the user's behalf.
 */
export type Permission = 'storage' | 'clipboard' | 'notifications' | 'network' | 'agent'

/**
 * App-aggregation manifest. Mirrors the React `AppManifest` shape, including the
 * permissions model.
 */
export interface AppManifest {
  id: string
  name: string
  /** Emoji glyph used as the icon (keeps the demo dependency-free). */
  icon: string
  /**
   * How the app runs:
   * - `component` — an in-process Vue view in its own managed window.
   * - `link`      — opens an external URL in a NEW BROWSER TAB (no window).
   * - `iframe`    — embeds an external URL inside a managed window via <iframe>.
   * - `remote`    — a micro-frontend ESM module fetched + evaluated AT RUNTIME
   *                 from `url`, mounted into a managed window (module federation).
   */
  kind: 'component' | 'link' | 'iframe' | 'remote'
  description?: string
  defaultSize?: { width: number; height: number }
  /** Built-in apps ship with the OS and can't be uninstalled. */
  builtin?: boolean
  /** Target URL for `link` / `iframe` / `remote` kinds. */
  url?: string
  /** Renderer component for `component` kind (the window body). */
  component?: Component
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
    defaultSize: { width: 480, height: 380 },
    component: markRaw(About),
  },
  {
    id: 'appstore',
    name: 'App Store',
    icon: '🛍️',
    kind: 'component',
    builtin: true,
    description: 'Browse and install apps into your profile.',
    defaultSize: { width: 640, height: 500 },
    permissions: ['storage', 'network'],
    component: markRaw(AppStore),
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
    component: markRaw(Assistant),
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
    component: markRaw(AgentTools),
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
    component: markRaw(Files),
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
    component: markRaw(Notepad),
  },
  {
    id: 'showcase',
    name: 'Iris Showcase',
    icon: '🎛️',
    kind: 'component',
    builtin: true,
    description: 'Real Iris components, OS-skinned.',
    defaultSize: { width: 460, height: 400 },
    permissions: ['agent'],
    component: markRaw(Showcase),
  },
  {
    id: 'taskmgr',
    name: 'Task Manager',
    icon: '📈',
    kind: 'component',
    builtin: true,
    description: 'Live window-manager state.',
    defaultSize: { width: 420, height: 340 },
    component: markRaw(TaskManager),
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: '⚙️',
    kind: 'component',
    builtin: true,
    description: 'Pick an accent color (persisted to your profile).',
    defaultSize: { width: 440, height: 420 },
    permissions: ['storage'],
    component: markRaw(Settings),
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
    component: markRaw(Data),
  },
  {
    id: 'calculator',
    name: 'Calculator',
    icon: '🧮',
    kind: 'component',
    builtin: true,
    description: 'A working calculator.',
    defaultSize: { width: 300, height: 440 },
    component: markRaw(Calculator),
  },
  {
    id: 'terminal',
    name: 'Terminal',
    icon: '⌨️',
    kind: 'component',
    builtin: true,
    description: 'A faux in-window shell.',
    defaultSize: { width: 520, height: 360 },
    // The Terminal view takes a live `appNames` list. WindowBody renders
    // `component` apps with no props, so wrap it to inject the names (read at
    // render time — CATALOG is fully initialized by then, avoiding a cycle).
    component: markRaw(
      defineComponent({
        name: 'TerminalApp',
        render: () => h(Terminal, { appNames: CATALOG.map((m) => m.name) }),
      }),
    ),
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
    component: markRaw(Photos),
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

  // ── Installable REMOTE apps (micro-frontends loaded at runtime) ─────────────
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
 * the shell mirrors it here (see {@link registerCustomApps}) so synchronous
 * lookups work without threading the profile through every component.
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
