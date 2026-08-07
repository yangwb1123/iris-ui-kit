import { createSignal, onCleanup, For, type JSX } from 'solid-js'
import { createSortable, type SortableRect } from '@iris-ui-kit/core'
import {
  createDashboard,
  dashboardContentKey,
  type DashboardConfig,
  type DashboardWidget,
} from '../core'

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
 * Render a CSS Grid dashboard from a declarative config (SolidJS). Widgets are
 * positioned via `grid-column` / `grid-row`; dragging the widget header and
 * dropping onto a cell calls `store.moveWidget`. Themed via CSS vars.
 */
export function IrisDashboard(props: IrisDashboardProps) {
  // Create the store ONCE (props are read at construction only).
  const store = createDashboard(props.config)

  const [dashboardState, setDashboardState] = createSignal(store.getState())
  onCleanup(store.subscribe(setDashboardState))

  // Touch/pen reorder via the shared core controller (cell id is `${col}-${row}`).
  const sortable = createSortable()
  const [sortableState, setSortableState] = createSignal(sortable.getState())
  onCleanup(sortable.subscribe(setSortableState))

  // Track dragged widget id in a plain variable — no reactive overhead.
  let dragWidgetId: string | null = null

  // Drop-cell rects, measured ONCE when a drag actually starts (not per move).
  // A plain variable — rects never drive rendering, so no signal needed.
  let dragRects: SortableRect[] = []

  const commitMove = (widgetId: string, cellId: string): void => {
    const [c, r] = cellId.split('-').map(Number)
    if (Number.isFinite(c) && Number.isFinite(r)) store.moveWidget(widgetId, c!, r!)
  }

  const onHeaderPointerDown = (widgetId: string, e: PointerEvent): void => {
    if (e.pointerType === 'mouse') return // desktop mouse → native HTML5 DnD
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
    // Record a pending press — no store write, so a tap never re-renders.
    sortable.press(widgetId, e.clientX, e.clientY)
  }
  const onHeaderPointerMove = (widgetId: string, e: PointerEvent): void => {
    if (sortable.tryStart(e.clientX, e.clientY)) {
      const root = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-iris-dashboard]')
      dragRects = collectRects(root, 'data-iris-dashboard-cell')
    }
    if (!sortable.isActive(widgetId)) return
    sortable.moveOver({ x: e.clientX, y: e.clientY }, dragRects)
  }
  const onHeaderPointerUp = (widgetId: string): void => {
    if (!sortable.isActive(widgetId)) {
      sortable.cancel() // clear a pending tap (idle → no re-render)
      return
    }
    const { activeId, overId } = sortable.end()
    if (activeId && overId) commitMove(activeId, overId)
  }
  const onHeaderPointerCancel = (): void => {
    sortable.cancel() // cancel is idle-safe now (no isActive guard needed)
  }

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
        gap: 'var(--iris-dashboard-gap, var(--iris-space-md, 16px))',
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
              // Live drop highlight for the touch/pen pointer path.
              outline:
                sortableState().activeId && sortableState().overId === `${c}-${r}`
                  ? '2px dashed var(--iris-primary, #6366f1)'
                  : undefined,
              'outline-offset': '-2px',
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
        {(widget: DashboardWidget) => {
          const contentKey = dashboardContentKey(widget)
          return (
            <div
              data-iris-dashboard-widget={widget.id}
              style={{
                'grid-column': `${widget.col} / span ${widget.colSpan}`,
                'grid-row': `${widget.row} / span ${widget.rowSpan}`,
                background: 'var(--iris-dashboard-widget-bg, var(--iris-surface, #f8fafc))',
                border: '1px solid var(--iris-border, #e2e8f0)',
                'border-radius': 'var(--iris-dashboard-widget-radius, 6px)',
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
                  gap: 'var(--iris-space-xs, 8px)',
                  padding: '8px 12px',
                  cursor: 'grab',
                  'border-bottom': '1px solid var(--iris-border, #e2e8f0)',
                  'font-weight': '600',
                  'user-select': 'none',
                  // Let the pointer path own touch gestures on the drag handle.
                  'touch-action': 'none',
                }}
                onDragStart={(e) => {
                  dragWidgetId = widget.id
                  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => {
                  dragWidgetId = null
                }}
                onPointerDown={(e) => onHeaderPointerDown(widget.id, e)}
                onPointerMove={(e) => onHeaderPointerMove(widget.id, e)}
                onPointerUp={() => onHeaderPointerUp(widget.id)}
                onPointerCancel={() => onHeaderPointerCancel()}
              >
                <span
                  data-iris-dashboard-drag-handle=""
                  aria-hidden="true"
                  style={{
                    'font-size': '1rem',
                    'line-height': '1',
                    color: 'var(--iris-muted, #64748b)',
                  }}
                >
                  ⠿
                </span>
                <span data-iris-dashboard-widget-title={widget.id}>{widget.title}</span>
              </div>

              {/* Widget content area */}
              <div
                data-iris-dashboard-widget-content={widget.id}
                data-content-key={contentKey}
                style={{ flex: '1', padding: '12px' }}
              >
                {contentKey ? props.renderWidget?.(contentKey, widget) : undefined}
              </div>
            </div>
          )
        }}
      </For>
    </div>
  )
}
