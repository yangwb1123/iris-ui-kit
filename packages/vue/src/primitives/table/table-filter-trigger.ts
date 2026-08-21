import { h, type VNode } from 'vue'
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
      onClick: (event: MouseEvent) => onOpen(event, column.key),
      onKeydown: (event: KeyboardEvent) => event.stopPropagation(),
      style: {
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        padding: '0',
        marginInlineStart: 'var(--iris-space-xxs, 4px)',
        fontSize: 'var(--iris-font-size-xs, 12px)',
        lineHeight: '1',
        color: active ? 'var(--iris-primary)' : 'var(--iris-muted)',
      },
    },
    '⏷',
  )
}
