import { createStore, createPlugin } from '@iris-ui-kit/core'

/**
 * `@iris-ui-kit/plugin-dashboard` — render a CSS Grid dashboard where widgets
 * occupy configurable grid cells and can be repositioned via native HTML5
 * drag-and-drop. This `core` entry is framework-agnostic: it owns all state
 * and mutations (moveWidget, addWidget, removeWidget) via a subscribable store.
 * The four thin renderers draw from it.
 */

export interface DashboardWidget {
  id: string
  title: string
  /**
   * Framework-neutral identifier for this widget's rendered body. It contains
   * data only — React nodes, Vue slots, Solid render functions, and Svelte
   * snippets stay in their adapter boundary. Omit to use a safe `id`.
   */
  contentKey?: string
  /** Grid column start (1-indexed) */
  col: number
  /** Grid row start (1-indexed) */
  row: number
  /** Width in grid columns (default 1) */
  colSpan: number
  /** Height in grid rows (default 1) */
  rowSpan: number
}

const SAFE_CONTENT_KEY = /^[A-Za-z][A-Za-z0-9_-]*$/

/**
 * Resolve the cross-framework content key for a widget. Unsafe identifiers are
 * ignored so they can never become dynamic slot/snippet/property names.
 */
export function dashboardContentKey(widget: DashboardWidget): string | undefined {
  const key = widget.contentKey ?? widget.id
  return SAFE_CONTENT_KEY.test(key) ? key : undefined
}

export interface DashboardConfig {
  widgets: DashboardWidget[]
  /** Number of grid columns (default 3) */
  columns?: number
  onMove?: (widgetId: string, newCol: number, newRow: number) => void
}

export interface DashboardState {
  widgets: DashboardWidget[]
  columns: number
}

export interface DashboardStore {
  getState(): DashboardState
  subscribe(cb: (s: DashboardState) => void): () => void
  /** Move widget to the given 1-indexed grid position. No-op if widget not found. */
  moveWidget(id: string, col: number, row: number): void
  /** Add a widget. No-op if a widget with the same id already exists. */
  addWidget(widget: DashboardWidget): void
  /** Remove the widget with `id`. No-op if not found. */
  removeWidget(id: string): void
}

/** Create a live dashboard store from a config. Deep-copies the initial widgets. */
export function createDashboard(config: DashboardConfig): DashboardStore {
  const cloneWidgets = (ws: DashboardWidget[]): DashboardWidget[] => ws.map((w) => ({ ...w }))

  const store = createStore<DashboardState>({
    widgets: cloneWidgets(config.widgets),
    columns: config.columns ?? 3,
  })

  const moveWidget = (id: string, col: number, row: number): void => {
    const { widgets } = store.getState()
    const idx = widgets.findIndex((w) => w.id === id)
    if (idx === -1) return

    const current = widgets[idx]!
    if (current.col === col && current.row === row) return

    const newWidgets = cloneWidgets(widgets)
    newWidgets[idx] = { ...current, col, row }
    store.setState({ ...store.getState(), widgets: newWidgets })
    config.onMove?.(id, col, row)
  }

  const addWidget = (widget: DashboardWidget): void => {
    const { widgets } = store.getState()
    if (widgets.some((w) => w.id === widget.id)) return
    const newWidgets = [...cloneWidgets(widgets), { ...widget }]
    store.setState({ ...store.getState(), widgets: newWidgets })
  }

  const removeWidget = (id: string): void => {
    const { widgets } = store.getState()
    const idx = widgets.findIndex((w) => w.id === id)
    if (idx === -1) return
    const newWidgets = cloneWidgets(widgets)
    newWidgets.splice(idx, 1)
    store.setState({ ...store.getState(), widgets: newWidgets })
  }

  return {
    getState: store.getState.bind(store),
    subscribe: store.subscribe.bind(store),
    moveWidget,
    addWidget,
    removeWidget,
  }
}

/** CSS custom properties the dashboard reads; overridable by the host theme. */
export const dashboardTokens: Record<string, string> = {
  '--iris-dashboard-gap': 'var(--iris-gap-md)',
  '--iris-dashboard-widget-bg': 'var(--iris-surface)',
  '--iris-dashboard-widget-radius': 'var(--iris-radius-md)',
}

/**
 * The dashboard plugin. Pass to `<IrisProvider plugins={[dashboardPlugin]}>`.
 * Registers the dashboard theme tokens.
 */
export const dashboardPlugin = createPlugin({
  name: 'dashboard',
  install(registry) {
    registry.registerTokens(dashboardTokens)
  },
})
