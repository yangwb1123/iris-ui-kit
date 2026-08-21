import { h, Teleport, type VNode } from 'vue'
import { previewColumnsFromRows } from '@iris-ui-kit/core'
import type { UseI18nReturn } from '../../i18n'

type Translate = UseI18nReturn['t']
type Row = Record<string, unknown>

export interface ImportPreviewSectionContext {
  rows: readonly Row[] | null
  t: Translate
  onConfirm: () => void
  onCancel: () => void
}

/** Render the CSV import preview as a body-teleported, dismissible modal. */
export function renderImportPreviewSection(ctx: ImportPreviewSectionContext): VNode | null {
  if (!ctx.rows) return null
  const columns = previewColumnsFromRows(ctx.rows)
  const cellStyle = {
    border: '1px solid var(--iris-border)',
    padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
    whiteSpace: 'nowrap',
  }
  const table = columns.length
    ? h(
        'table',
        {
          'data-iris-import-preview-table': '',
          style: { borderCollapse: 'collapse', fontSize: 'var(--iris-font-size-sm, 13px)' },
        },
        [
          h('thead', [
            h(
              'tr',
              columns.map((column) =>
                h(
                  'th',
                  {
                    key: column,
                    'data-iris-import-preview-header': column,
                    style: {
                      ...cellStyle,
                      background: 'var(--iris-surface)',
                      color: 'var(--iris-foreground)',
                      textAlign: 'start',
                      fontWeight: 600,
                    },
                  },
                  column,
                ),
              ),
            ),
          ]),
          h(
            'tbody',
            ctx.rows.slice(0, 5).map((row, rowIndex) =>
              h(
                'tr',
                { key: rowIndex },
                columns.map((column) =>
                  h(
                    'td',
                    {
                      key: column,
                      'data-iris-import-preview-cell': `${rowIndex}:${column}`,
                      style: { ...cellStyle, color: 'var(--iris-foreground)' },
                    },
                    String(row[column] ?? ''),
                  ),
                ),
              ),
            ),
          ),
        ],
      )
    : null
  const node = h(
    'div',
    {
      'data-iris-import-preview-backdrop': '',
      onPointerdown: (event: PointerEvent) => {
        if (event.target === event.currentTarget) ctx.onCancel()
      },
      style: {
        position: 'fixed',
        inset: 0,
        background: 'var(--iris-backdrop, rgba(0, 0, 0, 0.5))',
        zIndex: 'var(--iris-z-modal, 1200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--iris-space-lg, 24px)',
      },
    },
    [
      h(
        'div',
        {
          'data-iris-import-preview': '',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': ctx.t('table.importPreview.title'),
          style: {
            background: 'var(--iris-surface-floating, var(--iris-surface))',
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-lg, 8px)',
            boxShadow: 'var(--iris-shadow-xl)',
            padding: 'var(--iris-space-lg, 24px)',
            maxWidth: '90vw',
            maxHeight: '85vh',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--iris-space-sm, 12px)',
            fontSize: 'var(--iris-font-size-md, 14px)',
          },
        },
        [
          h('div', { style: { fontWeight: 600 } }, ctx.t('table.importPreview.title')),
          table,
          ctx.rows.length > 5
            ? h(
                'div',
                {
                  'data-iris-import-preview-total': '',
                  style: { color: 'var(--iris-muted)', fontSize: 'var(--iris-font-size-xs, 12px)' },
                },
                ctx.t('table.total', { total: ctx.rows.length }),
              )
            : null,
          h(
            'div',
            {
              style: {
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 'var(--iris-space-xs, 8px)',
              },
            },
            [
              h(
                'button',
                {
                  type: 'button',
                  'data-iris-import-preview-cancel': '',
                  onClick: ctx.onCancel,
                  style: {
                    border: '1px solid var(--iris-border)',
                    cursor: 'pointer',
                    background: 'var(--iris-surface)',
                    color: 'var(--iris-foreground)',
                    fontSize: 'var(--iris-font-size-sm, 13px)',
                    padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                    borderRadius: 'var(--iris-radius-sm, 4px)',
                  },
                },
                ctx.t('table.importPreview.cancel'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  'data-iris-import-preview-confirm': '',
                  onClick: ctx.onConfirm,
                  style: {
                    border: 'none',
                    cursor: 'pointer',
                    background: 'var(--iris-primary)',
                    color: 'var(--iris-primary-foreground)',
                    fontSize: 'var(--iris-font-size-sm, 13px)',
                    padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                    borderRadius: 'var(--iris-radius-sm, 4px)',
                  },
                },
                ctx.t('table.importPreview.confirm'),
              ),
            ],
          ),
        ],
      ),
    ],
  )
  return h(Teleport, { to: 'body' }, [node])
}
