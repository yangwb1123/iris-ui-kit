import { h, type VNode } from 'vue'
import { IrisIcon } from '../icon'
import type { IrisTableColumn } from './types'

export function renderTableFilterTrigger(options: {
  column: IrisTableColumn
  leaf: boolean
  active: boolean
  open: boolean
  label: string
  onOpen: (event: MouseEvent, key: string) => void
}): VNode | null {
  const { column, leaf, active, open, label, onOpen } = options
  if (!leaf || !column.filterable) return null
  return h(
    'button',
    {
      type: 'button',
      'data-iris-filter-trigger': column.key,
      'aria-label': label,
      'aria-haspopup': 'true',
      'aria-expanded': open ? 'true' : undefined,
      'data-iris-filter-active': active ? 'true' : undefined,
      'data-iris-filter-icon': '',
      onClick: (event: MouseEvent) => onOpen(event, column.key),
      onKeydown: (event: KeyboardEvent) => event.stopPropagation(),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
        width: '20px',
        height: '20px',
        border: '1px solid transparent',
        borderRadius: 'var(--iris-radius-sm, 4px)',
        background: active ? 'var(--iris-surface-selected, transparent)' : 'transparent',
        cursor: 'pointer',
        padding: '0',
        marginInlineStart: 'var(--iris-space-xxs, 4px)',
        color: active ? 'var(--iris-primary)' : 'var(--iris-muted)',
      },
    },
    h(IrisIcon, { name: 'filter', size: 14, strokeWidth: 1.75 }),
  )
}
