import type { JSX } from 'solid-js'
import { IrisIcon } from '../icon'
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
      data-iris-filter-icon=""
      onClick={props.onOpen}
      onKeyDown={(event) => event.stopPropagation()}
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        'justify-content': 'center',
        flex: '0 0 auto',
        width: '20px',
        height: '20px',
        border: '1px solid transparent',
        'border-radius': 'var(--iris-radius-sm, 4px)',
        background: props.active ? 'var(--iris-surface-selected, transparent)' : 'transparent',
        cursor: 'pointer',
        padding: '0',
        'margin-inline-start': 'var(--iris-space-xxs, 4px)',
        color: props.active ? 'var(--iris-primary)' : 'var(--iris-muted)',
      }}
    >
      <IrisIcon name="filter" size={14} strokeWidth={1.75} />
    </button>
  )
}
