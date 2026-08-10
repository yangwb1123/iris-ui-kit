import {
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  shallowRef,
  type PropType,
  type VNode,
} from 'vue'
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
 * Render a CSS Grid dashboard from a declarative config (Vue, render-function
 * authored to match the `@iris-ui-kit/vue` convention). Widgets are positioned via
 * `grid-column` / `grid-row`; dragging the widget header calls `store.moveWidget`
 * on drop. Themed via CSS vars.
 */
export const IrisDashboard = defineComponent({
  name: 'IrisDashboard',
  props: {
    config: { type: Object as PropType<DashboardConfig>, required: true },
    class: { type: String, default: undefined },
    style: { type: Object as PropType<Record<string, string>>, default: undefined },
  },
  setup(props, { slots }) {
    const store = createDashboard(props.config)
    const dashboardState = shallowRef(store.getState())

    // Touch/pen reorder via the shared core controller (cell id is `${col}-${row}`).
    const sortable = createSortable()
    const sortableState = shallowRef(sortable.getState())

    let unsub = () => {}
    let unsubSortable = () => {}
    onMounted(() => {
      unsub = store.subscribe((s) => {
        dashboardState.value = s
      })
      unsubSortable = sortable.subscribe((s) => {
        sortableState.value = s
      })
    })
    onUnmounted(() => {
      unsub()
      unsubSortable()
    })

    // Track dragged widget id without reactive overhead.
    let dragWidgetId: string | null = null

    // Drop-cell rects, measured ONCE when a drag actually starts (not per move).
    // A plain closure variable — rects never drive rendering, so no reactivity.
    let dragRects: SortableRect[] = []

    const commitMove = (widgetId: string, cellId: string): void => {
      const [c, r] = cellId.split('-').map(Number)
      if (Number.isFinite(c) && Number.isFinite(r)) store.moveWidget(widgetId, c!, r!)
    }

    const onHeaderPointerDown = (widgetId: string) => (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return // desktop mouse → native HTML5 DnD
      try {
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      } catch {
        /* ignore */
      }
      // Record a pending press — no store write, so a tap never re-renders.
      sortable.press(widgetId, e.clientX, e.clientY)
    }
    const onHeaderPointerMove = (widgetId: string) => (e: PointerEvent) => {
      if (sortable.tryStart(e.clientX, e.clientY)) {
        const root = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-iris-dashboard]')
        dragRects = collectRects(root, 'data-iris-dashboard-cell')
      }
      if (!sortable.isActive(widgetId)) return
      sortable.moveOver({ x: e.clientX, y: e.clientY }, dragRects)
    }
    const onHeaderPointerUp = (widgetId: string) => () => {
      if (!sortable.isActive(widgetId)) {
        sortable.cancel() // clear a pending tap (idle → no re-render)
        return
      }
      const { activeId, overId } = sortable.end()
      if (activeId && overId) commitMove(activeId, overId)
    }
    const onHeaderPointerCancel = (_widgetId: string) => () => {
      sortable.cancel() // cancel is idle-safe now (no isActive guard needed)
    }

    return () => {
      const { widgets, columns } = dashboardState.value
      const rows = Math.ceil(widgets.length / columns) + 1

      // Build invisible drop cells
      const dropCells: VNode[] = []
      for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= columns; c++) {
          const col = c
          const row = r
          const cellId = `${col}-${row}`
          const ss = sortableState.value
          dropCells.push(
            h('div', {
              key: `cell-${r}-${c}`,
              'data-iris-dashboard-cell': cellId,
              style: {
                gridColumn: `${col} / span 1`,
                gridRow: `${row} / span 1`,
                pointerEvents: 'all',
                // Live drop highlight for the touch/pen pointer path.
                outline:
                  ss.activeId && ss.overId === cellId
                    ? '2px dashed var(--iris-primary, #6366f1)'
                    : undefined,
                outlineOffset: '-2px',
              },
              onDragover: (e: DragEvent) => {
                e.preventDefault()
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
              },
              onDrop: (e: DragEvent) => {
                e.preventDefault()
                if (dragWidgetId) {
                  store.moveWidget(dragWidgetId, col, row)
                }
                dragWidgetId = null
              },
            }),
          )
        }
      }

      // Build widget nodes
      const widgetNodes: VNode[] = widgets.map((widget: DashboardWidget) => {
        const header = h(
          'div',
          {
            'data-iris-dashboard-widget-header': widget.id,
            draggable: true,
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--iris-space-xs, 8px)',
              padding: '8px 12px',
              cursor: 'grab',
              borderBottom: '1px solid var(--iris-border, #e2e8f0)',
              fontWeight: 600,
              userSelect: 'none',
              // Let the pointer path own touch gestures on the drag handle.
              touchAction: 'none',
            },
            onDragstart: (e: DragEvent) => {
              dragWidgetId = widget.id
              if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
            },
            onDragend: () => {
              dragWidgetId = null
            },
            onPointerdown: onHeaderPointerDown(widget.id),
            onPointermove: onHeaderPointerMove(widget.id),
            onPointerup: onHeaderPointerUp(widget.id),
            onPointercancel: onHeaderPointerCancel(widget.id),
          },
          [
            h(
              'span',
              {
                'data-iris-dashboard-drag-handle': '',
                'aria-hidden': 'true',
                style: {
                  fontSize: '1rem',
                  lineHeight: '1',
                  color: 'var(--iris-muted, #64748b)',
                },
              },
              '⠿',
            ),
            h('span', { 'data-iris-dashboard-widget-title': widget.id }, widget.title),
          ],
        )

        const contentKey = dashboardContentKey(widget)
        const renderContent = contentKey ? (slots[contentKey] ?? slots.default) : undefined
        const content = h(
          'div',
          {
            'data-iris-dashboard-widget-content': widget.id,
            'data-content-key': contentKey,
            style: { flex: '1', padding: '12px' },
          },
          renderContent?.({ widget, contentKey }),
        )

        return h(
          'div',
          {
            key: widget.id,
            'data-iris-dashboard-widget': widget.id,
            style: {
              gridColumn: `${widget.col} / span ${widget.colSpan}`,
              gridRow: `${widget.row} / span ${widget.rowSpan}`,
              background: 'var(--iris-dashboard-widget-bg, var(--iris-surface, #f8fafc))',
              border: '1px solid var(--iris-border, #e2e8f0)',
              borderRadius: 'var(--iris-dashboard-widget-radius, 6px)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
              zIndex: 1,
            },
          },
          [header, content],
        )
      })

      return h(
        'div',
        {
          'data-iris-dashboard': '',
          class: props.class,
          style: {
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 'var(--iris-dashboard-gap, var(--iris-space-md, 16px))',
            position: 'relative',
            ...props.style,
          },
        },
        [...dropCells, ...widgetNodes],
      )
    }
  },
})
