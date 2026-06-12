import { createSignal, onCleanup, For, type JSX } from 'solid-js'
import { createDashboard, type DashboardConfig, type DashboardWidget } from '../core'

export type { DashboardWidget, DashboardConfig, DashboardState, DashboardStore } from '../core'

export interface IrisDashboardProps {
  config: DashboardConfig
  class?: string
  style?: JSX.CSSProperties
}

/**
 * Render a CSS Grid dashboard from a declarative config (SolidJS). Widgets are
 * positioned via `grid-column` / `grid-row`; dragging the widget header and
 * dropping onto a cell calls `store.moveWidget`. Themed via CSS vars.
 */
export function IrisDashboard(props: IrisDashboardProps) {
  // Create the store ONCE (props are read at construction only).
  const store = createDashboard(props.config)

  const [dashboardState, setDashboardState] = createSignal(store.getState())
  onCleanup(store.subscribe(setDashboardState))

  // Track dragged widget id in a plain variable — no reactive overhead.
  let dragWidgetId: string | null = null

  const rows = () => Math.ceil(dashboardState().widgets.length / dashboardState().columns) + 1

  // Build array of [row, col] pairs for drop cells
  const cellCoords = (): Array<[number, number]> => {
    const result: Array<[number, number]> = []
    for (let r = 1; r <= rows(); r++) {
      for (let c = 1; c <= dashboardState().columns; c++) {
        result.push([r, c])
      }
    }
    return result
  }

  return (
    <div
      data-iris-dashboard=""
      class={props.class}
      style={{
        display: 'grid',
        'grid-template-columns': `repeat(${dashboardState().columns}, 1fr)`,
        gap: 'var(--iris-dashboard-gap, 16px)',
        position: 'relative',
        ...props.style,
      }}
    >
      {/* Invisible drop cells */}
      <For each={cellCoords()}>
        {([r, c]) => (
          <div
            data-iris-dashboard-cell={`${c}-${r}`}
            style={{
              'grid-column': `${c} / span 1`,
              'grid-row': `${r} / span 1`,
              'pointer-events': 'all',
            }}
            onDragOver={(e) => {
              e.preventDefault()
              if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (dragWidgetId) {
                store.moveWidget(dragWidgetId, c, r)
              }
              dragWidgetId = null
            }}
          />
        )}
      </For>

      {/* Widgets */}
      <For each={dashboardState().widgets}>
        {(widget: DashboardWidget) => (
          <div
            data-iris-dashboard-widget={widget.id}
            style={{
              'grid-column': `${widget.col} / span ${widget.colSpan}`,
              'grid-row': `${widget.row} / span ${widget.rowSpan}`,
              background: 'var(--iris-dashboard-widget-bg, #fff)',
              border: '1px solid var(--iris-color-border, #e5e7eb)',
              'border-radius': 'var(--iris-dashboard-widget-radius, 8px)',
              display: 'flex',
              'flex-direction': 'column',
              overflow: 'hidden',
              position: 'relative',
              'z-index': '1',
            }}
          >
            {/* Widget header with drag handle */}
            <div
              data-iris-dashboard-widget-header={widget.id}
              draggable={true}
              style={{
                display: 'flex',
                'align-items': 'center',
                gap: '6px',
                padding: '8px 12px',
                cursor: 'grab',
                'border-bottom': '1px solid var(--iris-color-border, #e5e7eb)',
                'font-weight': '600',
                'user-select': 'none',
              }}
              onDragStart={(e) => {
                dragWidgetId = widget.id
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={() => {
                dragWidgetId = null
              }}
            >
              <span
                data-iris-dashboard-drag-handle=""
                aria-hidden="true"
                style={{
                  'font-size': '1rem',
                  'line-height': '1',
                  color: 'var(--iris-color-muted, #9ca3af)',
                }}
              >
                ⠿
              </span>
              <span data-iris-dashboard-widget-title={widget.id}>{widget.title}</span>
            </div>

            {/* Widget content area */}
            <div
              data-iris-dashboard-widget-content={widget.id}
              style={{ flex: '1', padding: '12px' }}
            />
          </div>
        )}
      </For>
    </div>
  )
}
