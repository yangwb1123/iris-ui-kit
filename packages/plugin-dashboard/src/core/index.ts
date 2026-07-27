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
  /** Grid column start (1-indexed) */
  col: number
  /** Grid row start (1-indexed) */
  row: number
  /** Width in grid columns (default 1) */
  colSpan: number
  /** Height in grid rows (default 1) */
  rowSpan: number
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
  '--iris-dashboard-gap': 'var(--iris-space-md, 16px)',
  '--iris-dashboard-widget-bg': 'var(--iris-color-surface, #fff)',
  '--iris-dashboard-widget-radius': 'var(--iris-radius-md, 8px)',
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
