import { h, type VNode } from 'vue'
import { resolveTableSortInfo } from '@iris-ui-kit/core'
import { IrisIcon } from '../icon'
import type { IrisTableColumn, IrisTableSortState } from './types'

export function renderTableSortIndicator(
  column: IrisTableColumn,
  options: {
    multiSort: boolean
    multiSortState: IrisTableSortState[]
    sort: IrisTableSortState | null
  },
): VNode | null {
  if (!column.sortable) return null
  const info = resolveTableSortInfo(column.key, options)
  const { isActive, direction } = info
  const active = isActive
  const color = active ? 'var(--iris-primary)' : 'var(--iris-muted)'
  return h(
    'span',
    {
      'aria-hidden': 'true',
      'data-iris-table-sort-indicator': '',
      'data-iris-table-sort-state': direction ?? 'none',
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
        width: '20px',
        height: '20px',
        marginInlineStart: 'var(--iris-space-xxs, 4px)',
        borderRadius: 'var(--iris-radius-sm, 4px)',
        color,
        background: active ? 'var(--iris-surface-selected, transparent)' : 'transparent',
      },
    },
    h(IrisIcon, {
      name: direction === 'desc' ? 'sort-desc' : 'sort-asc',
      size: 14,
      strokeWidth: 1.75,
      style: { opacity: active ? '1' : '0.5' },
    }),
  )
}
