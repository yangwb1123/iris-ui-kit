import * as React from 'react'
import { createDashboard, type DashboardConfig, type DashboardWidget } from '../core'

export type { DashboardWidget, DashboardConfig, DashboardState, DashboardStore } from '../core'

export interface IrisDashboardProps {
  config: DashboardConfig
  className?: string
  style?: React.CSSProperties
}

/**
 * Render a CSS Grid dashboard from a declarative config (React). Each widget
 * is positioned using `grid-column` and `grid-row`. Widgets are draggable via
 * native HTML5 DnD: dragging a widget header stores the widget id; dropping
 * onto an invisible drop cell calls `store.moveWidget`. Themed via CSS vars.
 */
export function IrisDashboard({ config, className, style }: IrisDashboardProps) {
  // Create the store ONCE (it owns all state); reads config at construction only.
  const storeRef = React.useRef<ReturnType<typeof createDashboard> | null>(null)
  if (storeRef.current === null) {
    storeRef.current = createDashboard(config)
  }
  const store = storeRef.current

  const dashboardState = React.useSyncExternalStore(store.subscribe, store.getState, store.getState)

  // Track the dragged widget id in a ref — no re-render needed on dragstart/over.
  const dragWidgetId = React.useRef<string | null>(null)

  const { widgets, columns } = dashboardState
  const rows = Math.ceil(widgets.length / columns) + 1

  // Build invisible drop-cell grid overlay
  const dropCells: React.ReactNode[] = []
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= columns; c++) {
      const col = c
      const row = r
      dropCells.push(
        <div
          key={`cell-${r}-${c}`}
          data-iris-dashboard-cell={`${c}-${r}`}
          style={{
            gridColumn: `${col} / span 1`,
            gridRow: `${row} / span 1`,
            pointerEvents: 'all',
          }}
          onDragOver={(e) => {
            e.preventDefault()
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (dragWidgetId.current) {
              store.moveWidget(dragWidgetId.current, col, row)
            }
            dragWidgetId.current = null
          }}
        />,
      )
    }
  }

  return (
    <div
      data-iris-dashboard=""
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 'var(--iris-dashboard-gap, 16px)',
        position: 'relative',
        ...style,
      }}
    >
      {/* Invisible drop cells beneath widgets */}
      {dropCells}

      {/* Widgets positioned by grid-column / grid-row */}
      {widgets.map((widget: DashboardWidget) => (
        <div
          key={widget.id}
          data-iris-dashboard-widget={widget.id}
          style={{
            gridColumn: `${widget.col} / span ${widget.colSpan}`,
            gridRow: `${widget.row} / span ${widget.rowSpan}`,
            background: 'var(--iris-dashboard-widget-bg, #fff)',
            border: '1px solid var(--iris-color-border, #e5e7eb)',
            borderRadius: 'var(--iris-dashboard-widget-radius, 8px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Widget header with drag handle */}
          <div
            data-iris-dashboard-widget-header={widget.id}
            draggable
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              cursor: 'grab',
              borderBottom: '1px solid var(--iris-color-border, #e5e7eb)',
              fontWeight: 600,
              userSelect: 'none',
            }}
            onDragStart={(e) => {
              dragWidgetId.current = widget.id
              if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
            }}
            onDragEnd={() => {
              dragWidgetId.current = null
            }}
          >
            <span
              data-iris-dashboard-drag-handle=""
              aria-hidden="true"
              style={{ fontSize: '1rem', lineHeight: 1, color: 'var(--iris-color-muted, #9ca3af)' }}
            >
              ⠿
            </span>
            <span data-iris-dashboard-widget-title={widget.id}>{widget.title}</span>
          </div>

          {/* Widget content area */}
          <div
            data-iris-dashboard-widget-content={widget.id}
            style={{ flex: 1, padding: '12px' }}
          />
        </div>
      ))}
    </div>
  )
}
