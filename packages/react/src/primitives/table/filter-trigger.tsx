import * as React from 'react'
import type { IrisTableColumn } from './types'

export interface TableFilterTriggerProps<Row extends Record<string, unknown>> {
  column: IrisTableColumn<Row>
  active: boolean
  expanded: boolean
  ariaLabel: string
  onOpen: (event: React.MouseEvent<HTMLButtonElement>, columnKey: string) => void
}

/** Small leaf-header filter trigger shared by flat and grouped headers. */
export function TableFilterTrigger<Row extends Record<string, unknown>>({
  column,
  active,
  expanded,
  ariaLabel,
  onOpen,
}: TableFilterTriggerProps<Row>): React.ReactElement | null {
  if (!column.filterable) return null
  return (
    <button
      type="button"
      data-iris-filter-trigger={column.key}
      aria-label={ariaLabel}
      aria-haspopup="true"
      aria-expanded={expanded ? 'true' : undefined}
      data-iris-filter-active={active ? 'true' : undefined}
      onClick={(event) => onOpen(event, column.key)}
      onKeyDown={(event) => event.stopPropagation()}
      style={{
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        padding: 0,
        marginInlineStart: 'var(--iris-space-xxs, 4px)',
        fontSize: 'var(--iris-font-size-xs, 12px)',
        lineHeight: 1,
        color: active ? 'var(--iris-primary)' : 'var(--iris-muted)',
      }}
    >
      ⏷
    </button>
  )
}
