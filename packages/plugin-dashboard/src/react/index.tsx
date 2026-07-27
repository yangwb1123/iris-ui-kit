import * as React from 'react'
import { createSortable, type SortableRect } from '@iris-ui-kit/core'
import { createDashboard, type DashboardConfig, type DashboardWidget } from '../core'

export type { DashboardWidget, DashboardConfig, DashboardState, DashboardStore } from '../core'

export interface IrisDashboardProps {
  config: DashboardConfig
  className?: string
  style?: React.CSSProperties
}

/** Collect drop-target rects (id + client rect) for every `[attr]` under `root`. */
function collectRects(root: HTMLElement | null, attr: string): SortableRect[] {
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(`[${attr}]`)).map((el) => {
    const r = el.getBoundingClientRect()
    return {
      id: el.getAttribute(attr)!,
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
    }
  })
}

/**
 * Render a CSS Grid dashboard from a declarative config (React). Each widget
 * is positioned using `grid-column` and `grid-row`.
 *
 * Two coexisting drag paths: desktop **mouse** uses native HTML5 DnD (drag a
 * widget header, drop onto an invisible cell → `store.moveWidget`); **touch /
 * pen** uses the pointer-based `createSortable` controller, since native HTML5
 * DnD never fires on touch. The pointer path is gated on `pointerType !== 'mouse'`
 * so the mouse flow — and its tests — are unchanged.
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

  // Touch/pen reorder via the shared core controller (cell id is `${col}-${row}`).
  const sortable = React.useRef(createSortable()).current
  const sortableState = React.useSyncExternalStore(
    sortable.subscribe,
    sortable.getState,
    sortable.getState,
  )

  // Drop-cell rects, measured ONCE when a drag actually starts (not per move).
  const dragRects = React.useRef<SortableRect[]>([])

  const commitMove = (widgetId: string, cellId: string): void => {
    const [c, r] = cellId.split('-').map(Number)
    if (Number.isFinite(c) && Number.isFinite(r)) store.moveWidget(widgetId, c!, r!)
  }

  const onHeaderPointerDown = (widgetId: string) => (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse') return // desktop mouse → native HTML5 DnD
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
    // Record a pending press — no store write, so a tap never re-renders.
    sortable.press(widgetId, e.clientX, e.clientY)
  }
  const onHeaderPointerMove = (widgetId: string) => (e: React.PointerEvent<HTMLElement>) => {
    if (sortable.tryStart(e.clientX, e.clientY)) {
      const root = e.currentTarget.closest<HTMLElement>('[data-iris-dashboard]')
      dragRects.current = collectRects(root, 'data-iris-dashboard-cell')
    }
    if (!sortable.isActive(widgetId)) return
    sortable.moveOver({ x: e.clientX, y: e.clientY }, dragRects.current)
  }
  const onHeaderPointerUp = (widgetId: string) => () => {
    if (!sortable.isActive(widgetId)) {
      sortable.cancel() // clear a pending tap (idle → no re-render)
      return
    }
    const { activeId, overId } = sortable.end()
    if (activeId && overId) commitMove(activeId, overId)
  }

  const { widgets, columns } = dashboardState
  const rows = Math.ceil(widgets.length / columns) + 1

  // Build invisible drop-cell grid overlay
  const dropCells: React.ReactNode[] = []
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= columns; c++) {
      const col = c
      const row = r
      const cellId = `${c}-${r}`
      dropCells.push(
        <div
          key={`cell-${r}-${c}`}
          data-iris-dashboard-cell={cellId}
          style={{
            gridColumn: `${col} / span 1`,
            gridRow: `${row} / span 1`,
            pointerEvents: 'all',
            // Live drop highlight for the touch/pen pointer path.
            outline:
              sortableState.activeId && sortableState.overId === cellId
                ? '2px dashed var(--iris-color-primary, #2563eb)'
                : undefined,
            outlineOffset: -2,
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
              // Let the pointer path own touch gestures on the drag handle.
              touchAction: 'none',
            }}
            onDragStart={(e) => {
              dragWidgetId.current = widget.id
              if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
            }}
            onDragEnd={() => {
              dragWidgetId.current = null
            }}
            onPointerDown={onHeaderPointerDown(widget.id)}
            onPointerMove={onHeaderPointerMove(widget.id)}
            onPointerUp={onHeaderPointerUp(widget.id)}
            onPointerCancel={() => sortable.cancel()}
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
