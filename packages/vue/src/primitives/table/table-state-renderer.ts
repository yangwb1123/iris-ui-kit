import { h, type VNode, type VNodeChild } from 'vue'

export interface TableStateRendererContext {
  error: boolean
  loading: boolean
  rowCount: number
  stateRowStyle: Readonly<Record<string, string>>
  errorContent: VNodeChild
  loadingContent: VNodeChild
  emptyContent: VNodeChild
  retry?: () => void
  onRetry?: () => void
  retryLabel: string
}

/** Render the mutually exclusive error/loading/empty table states. */
export function renderTableStateRow(ctx: TableStateRendererContext): VNode | null {
  if (ctx.error) {
    return h('div', { role: 'row', 'data-iris-table-row': 'error', style: ctx.stateRowStyle }, [
      h(
        'span',
        { style: { marginInlineEnd: ctx.onRetry ? 'var(--iris-space-sm, 12px)' : '0px' } },
        ctx.errorContent ?? '',
      ),
      ctx.retry
        ? h(
            'button',
            {
              type: 'button',
              'data-iris-table-retry': '',
              onClick: ctx.retry,
              style: {
                border: '1px solid var(--iris-border)',
                background: 'var(--iris-surface)',
                color: 'var(--iris-foreground)',
                borderRadius: 'var(--iris-radius-sm, 4px)',
                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                fontSize: 'var(--iris-font-size-sm, 13px)',
                cursor: 'pointer',
              },
            },
            ctx.retryLabel,
          )
        : null,
    ])
  }
  if (ctx.loading) {
    return h(
      'div',
      {
        role: 'row',
        'aria-busy': 'true',
        'data-iris-table-row': 'loading',
        style: ctx.stateRowStyle,
      },
      ctx.loadingContent ?? '',
    )
  }
  if (ctx.rowCount === 0) {
    return h(
      'div',
      { role: 'row', 'data-iris-table-row': 'empty', style: ctx.stateRowStyle },
      ctx.emptyContent ?? '',
    )
  }
  return null
}
