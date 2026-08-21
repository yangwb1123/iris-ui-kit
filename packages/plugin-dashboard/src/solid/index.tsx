import { createSignal, onCleanup, type JSX } from 'solid-js'
import { createDashboard, type DashboardConfig, type DashboardWidget } from '../core'
import { DashboardDragController } from './dashboard-drag'
import { DashboardGrid } from './dashboard-grid'

export {
  dashboardContentKey,
  type DashboardWidget,
  type DashboardConfig,
  type DashboardState,
  type DashboardStore,
} from '../core'

export interface IrisDashboardProps {
  config: DashboardConfig
  /**
   * Render a widget body from its safe `contentKey` (or safe widget id).
   * Framework content stays outside the serializable core schema.
   */
  renderWidget?: (contentKey: string, widget: DashboardWidget) => JSX.Element
  class?: string
  style?: JSX.CSSProperties
}

/**
 * Render a CSS Grid dashboard from a declarative config (SolidJS). Widgets are
 * positioned via `grid-column` / `grid-row`; dragging the widget header and
 * dropping onto a cell calls `store.moveWidget`. Themed via CSS vars.
 */
export function IrisDashboard(props: IrisDashboardProps): JSX.Element {
  // Create the store ONCE (props are read at construction only).
  const store = createDashboard(props.config)
  const [dashboardState, setDashboardState] = createSignal(store.getState())
  onCleanup(store.subscribe(setDashboardState))

  const drag = new DashboardDragController(store)
  onCleanup(drag.dispose)

  return (
    <DashboardGrid
      state={dashboardState}
      drag={drag}
      renderWidget={props.renderWidget}
      class={props.class}
      style={props.style}
    />
  )
}
