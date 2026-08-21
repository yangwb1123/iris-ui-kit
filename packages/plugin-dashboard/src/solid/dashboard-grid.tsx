import { For, type Accessor, type JSX } from 'solid-js'
import type { DashboardState, DashboardWidget } from '../core'
import { dashboardContentKey } from '../core'
import { DashboardDragController } from './dashboard-drag'

interface DashboardGridProps {
  state: Accessor<DashboardState>
  drag: DashboardDragController
  renderWidget?: (contentKey: string, widget: DashboardWidget) => JSX.Element
  class?: string
  style?: JSX.CSSProperties
}

const DashboardDropCell = (props: {
  row: number
  column: number
  drag: DashboardDragController
}): JSX.Element => (
  <div
    data-iris-dashboard-cell={`${props.column}-${props.row}`}
    style={{
      'grid-column': `${props.column} / span 1`,
      'grid-row': `${props.row} / span 1`,
      'pointer-events': 'all',
      outline:
        props.drag.sortableState().activeId &&
        props.drag.sortableState().overId === `${props.column}-${props.row}`
          ? '2px dashed var(--iris-primary, #6366f1)'
          : undefined,
      'outline-offset': '-2px',
    }}
    onDragOver={(event) => {
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    }}
    onDrop={(event) => props.drag.onDrop(event, props.column, props.row)}
  />
)

const DashboardWidgetView = (props: {
  widget: DashboardWidget
  drag: DashboardDragController
  renderWidget?: (contentKey: string, widget: DashboardWidget) => JSX.Element
}): JSX.Element => {
  const contentKey = dashboardContentKey(props.widget)
  return (
    <div
      data-iris-dashboard-widget={props.widget.id}
      style={{
        'grid-column': `${props.widget.col} / span ${props.widget.colSpan}`,
        'grid-row': `${props.widget.row} / span ${props.widget.rowSpan}`,
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
      <div
        data-iris-dashboard-widget-header={props.widget.id}
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
          'touch-action': 'none',
        }}
        onDragStart={(event) => props.drag.onDragStart(props.widget.id, event)}
        onDragEnd={props.drag.onDragEnd}
        onPointerDown={(event) => props.drag.onHeaderPointerDown(props.widget.id, event)}
        onPointerMove={(event) => props.drag.onHeaderPointerMove(props.widget.id, event)}
        onPointerUp={() => props.drag.onHeaderPointerUp(props.widget.id)}
        onPointerCancel={props.drag.onHeaderPointerCancel}
      >
        <span
          data-iris-dashboard-drag-handle=""
          aria-hidden="true"
          style={{ 'font-size': '1rem', 'line-height': '1', color: 'var(--iris-muted, #64748b)' }}
        >
          ⠿
        </span>
        <span data-iris-dashboard-widget-title={props.widget.id}>{props.widget.title}</span>
      </div>
      <div
        data-iris-dashboard-widget-content={props.widget.id}
        data-content-key={contentKey}
        style={{ flex: '1', padding: '12px' }}
      >
        {contentKey ? props.renderWidget?.(contentKey, props.widget) : undefined}
      </div>
    </div>
  )
}

export const DashboardGrid = (props: DashboardGridProps): JSX.Element => {
  const rows = () => Math.ceil(props.state().widgets.length / props.state().columns) + 1
  const cellCoords = (): Array<[number, number]> => {
    const result: Array<[number, number]> = []
    for (let row = 1; row <= rows(); row += 1) {
      for (let column = 1; column <= props.state().columns; column += 1) {
        result.push([row, column])
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
        'grid-template-columns': `repeat(${props.state().columns}, 1fr)`,
        gap: 'var(--iris-dashboard-gap, var(--iris-space-md, 16px))',
        position: 'relative',
        ...props.style,
      }}
    >
      <For each={cellCoords()}>
        {([row, column]) => <DashboardDropCell row={row} column={column} drag={props.drag} />}
      </For>
      <For each={props.state().widgets}>
        {(widget) => (
          <DashboardWidgetView
            widget={widget}
            drag={props.drag}
            renderWidget={props.renderWidget}
          />
        )}
      </For>
    </div>
  )
}
