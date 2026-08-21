import { For, Show, type Accessor, type JSX } from 'solid-js'
import { previewColumnsFromRows } from '@iris-ui-kit/core'
import type { UseI18nReturn } from '../../i18n'

type Translate = UseI18nReturn['t']
type Row = Record<string, unknown>

export interface ImportPreviewProps {
  rows: Accessor<readonly Row[] | null>
  t: Translate
  onConfirm: () => void
  onCancel: () => void
}

/** CSV import preview modal shared by the Solid table toolbar. */
export function ImportPreview(props: ImportPreviewProps): JSX.Element {
  const columns = (): string[] => previewColumnsFromRows(props.rows())
  return (
    <Show when={props.rows()}>
      {(rows) => (
        <div
          data-iris-import-preview-backdrop=""
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) props.onCancel()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--iris-backdrop, rgba(0, 0, 0, 0.5))',
            'z-index': 'var(--iris-z-modal, 1200)',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            padding: 'var(--iris-space-lg, 24px)',
          }}
        >
          <div
            data-iris-import-preview=""
            role="dialog"
            aria-modal="true"
            aria-label={props.t('table.importPreview.title')}
            style={{
              background: 'var(--iris-surface-floating, var(--iris-surface))',
              color: 'var(--iris-foreground)',
              border: '1px solid var(--iris-border)',
              'border-radius': 'var(--iris-radius-lg, 8px)',
              'box-shadow': 'var(--iris-shadow-xl)',
              padding: 'var(--iris-space-lg, 24px)',
              'max-width': '90vw',
              'max-height': '85vh',
              overflow: 'auto',
              display: 'flex',
              'flex-direction': 'column',
              gap: 'var(--iris-space-sm, 12px)',
              'font-size': 'var(--iris-font-size-md, 14px)',
            }}
          >
            <div style={{ 'font-weight': 600 }}>{props.t('table.importPreview.title')}</div>
            <Show when={columns().length > 0}>
              <table
                data-iris-import-preview-table=""
                style={{
                  'border-collapse': 'collapse',
                  'font-size': 'var(--iris-font-size-sm, 13px)',
                }}
              >
                <thead>
                  <tr>
                    <For each={columns()}>
                      {(column) => (
                        <th
                          data-iris-import-preview-header={column}
                          style={{
                            border: '1px solid var(--iris-border)',
                            padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                            background: 'var(--iris-surface)',
                            color: 'var(--iris-foreground)',
                            'text-align': 'start',
                            'font-weight': 600,
                            'white-space': 'nowrap',
                          }}
                        >
                          {column}
                        </th>
                      )}
                    </For>
                  </tr>
                </thead>
                <tbody>
                  <For each={rows().slice(0, 5)}>
                    {(row, rowIndex) => (
                      <tr>
                        <For each={columns()}>
                          {(column) => (
                            <td
                              data-iris-import-preview-cell={`${rowIndex()}:${column}`}
                              style={{
                                border: '1px solid var(--iris-border)',
                                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                                color: 'var(--iris-foreground)',
                                'white-space': 'nowrap',
                              }}
                            >
                              {String(row[column] ?? '')}
                            </td>
                          )}
                        </For>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Show>
            <Show when={rows().length > 5}>
              <div
                data-iris-import-preview-total=""
                style={{
                  color: 'var(--iris-muted)',
                  'font-size': 'var(--iris-font-size-xs, 12px)',
                }}
              >
                {props.t('table.total', { total: rows().length })}
              </div>
            </Show>
            <div
              style={{
                display: 'flex',
                'justify-content': 'flex-end',
                gap: 'var(--iris-space-xs, 8px)',
              }}
            >
              <button
                type="button"
                data-iris-import-preview-cancel=""
                onClick={props.onCancel}
                style={{
                  border: '1px solid var(--iris-border)',
                  cursor: 'pointer',
                  background: 'var(--iris-surface)',
                  color: 'var(--iris-foreground)',
                  'font-size': 'var(--iris-font-size-sm, 13px)',
                  padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                  'border-radius': 'var(--iris-radius-sm, 4px)',
                }}
              >
                {props.t('table.importPreview.cancel')}
              </button>
              <button
                type="button"
                data-iris-import-preview-confirm=""
                onClick={props.onConfirm}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--iris-primary)',
                  color: 'var(--iris-primary-foreground)',
                  'font-size': 'var(--iris-font-size-sm, 13px)',
                  padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                  'border-radius': 'var(--iris-radius-sm, 4px)',
                }}
              >
                {props.t('table.importPreview.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Show>
  )
}
