import { h, type VNode } from 'vue'
import { resolveTableSortInfo } from '@iris-ui-kit/core'
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
  const color = isActive ? 'var(--iris-primary)' : 'var(--iris-muted)'
  return h(
    'span',
    {
      'aria-hidden': 'true',
      style: {
        display: 'inline-flex',
        flexDirection: 'column',
        marginInlineStart: 'var(--iris-space-xxs, 4px)',
        lineHeight: '0.6',
        fontSize: 'var(--iris-font-size-xs, 12px)',
        color,
      },
    },
    [
      h('span', { style: { opacity: direction === 'asc' ? '1' : '0.45' } }, '▲'),
      h('span', { style: { opacity: direction === 'desc' ? '1' : '0.45' } }, '▼'),
    ],
  )
}
