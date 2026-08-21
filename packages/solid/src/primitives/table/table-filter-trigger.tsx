import type { JSX } from 'solid-js'
import type { IrisTableColumn } from './types'

export function TableFilterTrigger<Row extends Record<string, unknown>>(props: {
  column: IrisTableColumn<Row>
  leaf: boolean
  active: boolean
  open: boolean
  label: string
  onOpen: (event: MouseEvent) => void
}): JSX.Element {
  if (!props.leaf || !props.column.filterable) return <></>
  return (
    <button
      type="button"
      data-iris-filter-trigger={props.column.key}
      aria-label={props.label}
      aria-haspopup="true"
      aria-expanded={props.open ? 'true' : undefined}
      data-iris-filter-active={props.active ? 'true' : undefined}
      onClick={props.onOpen}
      onKeyDown={(event) => event.stopPropagation()}
      style={{
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        padding: '0',
        'margin-inline-start': 'var(--iris-space-xxs, 4px)',
        'font-size': 'var(--iris-font-size-xs, 12px)',
        'line-height': '1',
        color: props.active ? 'var(--iris-primary)' : 'var(--iris-muted)',
      }}
    >
      ⏷
    </button>
  )
}
