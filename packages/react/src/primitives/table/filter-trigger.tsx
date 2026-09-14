import * as React from 'react'
import { IrisIcon } from '../icon'
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
      data-iris-filter-icon=""
      onClick={(event) => onOpen(event, column.key)}
      onKeyDown={(event) => event.stopPropagation()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
        width: 20,
        height: 20,
        border: '1px solid transparent',
        borderRadius: 'var(--iris-radius-sm, 4px)',
        background: active ? 'var(--iris-surface-selected, transparent)' : 'transparent',
        cursor: 'pointer',
        padding: 0,
        marginInlineStart: 'var(--iris-space-xxs, 4px)',
        color: active ? 'var(--iris-primary)' : 'var(--iris-muted)',
      }}
    >
      <IrisIcon name="filter" size={14} strokeWidth={1.75} />
    </button>
  )
}
