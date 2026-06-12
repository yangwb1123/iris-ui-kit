import {
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  shallowRef,
  type PropType,
  type VNode,
} from 'vue'
import { createDashboard, type DashboardConfig, type DashboardWidget } from '../core'

export type { DashboardWidget, DashboardConfig, DashboardState, DashboardStore } from '../core'

/**
 * Render a CSS Grid dashboard from a declarative config (Vue, render-function
 * authored to match the `@iris-ui/vue` convention). Widgets are positioned via
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
  setup(props) {
    const store = createDashboard(props.config)
    const dashboardState = shallowRef(store.getState())
    let unsub = () => {}
    onMounted(() => {
      unsub = store.subscribe((s) => {
        dashboardState.value = s
      })
    })
    onUnmounted(() => unsub())

    // Track dragged widget id without reactive overhead.
    let dragWidgetId: string | null = null

    return () => {
      const { widgets, columns } = dashboardState.value
      const rows = Math.ceil(widgets.length / columns) + 1

      // Build invisible drop cells
      const dropCells: VNode[] = []
      for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= columns; c++) {
          const col = c
          const row = r
          dropCells.push(
            h('div', {
              key: `cell-${r}-${c}`,
              'data-iris-dashboard-cell': `${col}-${row}`,
              style: {
                gridColumn: `${col} / span 1`,
                gridRow: `${row} / span 1`,
                pointerEvents: 'all',
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
              gap: '6px',
              padding: '8px 12px',
              cursor: 'grab',
              borderBottom: '1px solid var(--iris-color-border, #e5e7eb)',
              fontWeight: 600,
              userSelect: 'none',
            },
            onDragstart: (e: DragEvent) => {
              dragWidgetId = widget.id
              if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
            },
            onDragend: () => {
              dragWidgetId = null
            },
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
                  color: 'var(--iris-color-muted, #9ca3af)',
                },
              },
              '⠿',
            ),
            h('span', { 'data-iris-dashboard-widget-title': widget.id }, widget.title),
          ],
        )

        const content = h('div', {
          'data-iris-dashboard-widget-content': widget.id,
          style: { flex: '1', padding: '12px' },
        })

        return h(
          'div',
          {
            key: widget.id,
            'data-iris-dashboard-widget': widget.id,
            style: {
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
            gap: 'var(--iris-dashboard-gap, 16px)',
            position: 'relative',
            ...props.style,
          },
        },
        [...dropCells, ...widgetNodes],
      )
    }
  },
})
