import { Show, type Accessor, type JSX } from 'solid-js'
import type { RowCellSession } from './table-row-edit'
import type { IrisTableColumn } from './types'

const previewStyle: JSX.CSSProperties = {
  'flex-basis': '100%',
  'min-width': '0',
  'margin-top': 'var(--iris-space-xxs, 4px)',
  'font-size': 'var(--iris-font-size-xs, 12px)',
  color: 'var(--iris-muted)',
}

const errorStyle: JSX.CSSProperties = {
  'margin-top': '2px',
  'font-size': 'var(--iris-font-size-xs, 12px)',
  color: 'var(--iris-danger)',
}

const editorInputStyle = (invalid: boolean): JSX.CSSProperties => ({
  width: '100%',
  border: `1px solid ${invalid ? 'var(--iris-danger)' : 'var(--iris-primary)'}`,
  'border-radius': 'var(--iris-radius-sm)',
  padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
  font: 'inherit',
  background: 'var(--iris-background)',
  color: 'var(--iris-foreground)',
  outline: 'none',
})

interface TableCellEditorContentProps<Row extends Record<string, unknown>> {
  row: Row
  column: IrisTableColumn<Row>
  rowIndex: number
  cellId: string
  editingDraft: Accessor<string>
  editError: Accessor<string | null>
  setCellDraft: (value: string) => void
  commitEdit: (row: Row, column: IrisTableColumn<Row>, rowIndex: number) => void
  cancelEdit: () => void
  editPreview?: boolean
  editPreviewText: (row: Row, column: IrisTableColumn<Row>, draft: string) => string
}

export function TableCellEditorContent<Row extends Record<string, unknown>>(
  props: TableCellEditorContentProps<Row>,
): JSX.Element {
  return (
    <>
      <input
        type={props.column.editor === 'number' ? 'number' : 'text'}
        value={props.editingDraft()}
        data-iris-table-editor=""
        aria-invalid={props.editError() ? 'true' : undefined}
        aria-describedby={props.editError() ? `${props.cellId}-error` : undefined}
        onInput={(e) => props.setCellDraft((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            props.commitEdit(props.row, props.column, props.rowIndex)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            props.cancelEdit()
          }
        }}
        onBlur={() => props.commitEdit(props.row, props.column, props.rowIndex)}
        onClick={(e) => e.stopPropagation()}
        style={editorInputStyle(Boolean(props.editError()))}
      />
      <Show when={props.editPreview && props.column.formatter}>
        <div data-iris-edit-preview="" style={previewStyle}>
          {props.editPreviewText(props.row, props.column, props.editingDraft())}
        </div>
      </Show>
      <Show when={props.editError()}>
        <div
          id={`${props.cellId}-error`}
          role="alert"
          data-iris-table-editor-error=""
          style={errorStyle}
        >
          {props.editError()}
        </div>
      </Show>
    </>
  )
}

interface TableRowSessionEditorContentProps<Row extends Record<string, unknown>> {
  row: Row
  rowKey: string | number
  column: IrisTableColumn<Row>
  cellId: string
  session: RowCellSession<Row>
  rowEditorRefs: Map<string, HTMLInputElement>
  commitRowSession: (session: RowCellSession<Row>, row: Row, key: string | number) => boolean
  cancelRowEdit: (expected?: RowCellSession<Row>) => void
  handleRowTab: (
    row: Row,
    column: IrisTableColumn<Row>,
    session: RowCellSession<Row>,
    key: string | number,
    dir: 1 | -1,
  ) => void
  editPreview?: boolean
  editPreviewText: (row: Row, column: IrisTableColumn<Row>, draft: string) => string
}

export function TableRowSessionEditorContent<Row extends Record<string, unknown>>(
  props: TableRowSessionEditorContentProps<Row>,
): JSX.Element {
  return (
    <>
      <input
        ref={(el) => {
          if (el) props.rowEditorRefs.set(props.column.key, el)
          else props.rowEditorRefs.delete(props.column.key)
        }}
        type={props.column.editor === 'number' ? 'number' : 'text'}
        value={props.session.draft()}
        data-iris-table-editor=""
        aria-invalid={props.session.error() ? 'true' : undefined}
        aria-describedby={props.session.error() ? `${props.cellId}-error` : undefined}
        onInput={(e) => props.session.setDraft((e.currentTarget as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            props.commitRowSession(props.session, props.row, props.rowKey)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            props.cancelRowEdit(props.session)
          } else if (e.key === 'Tab') {
            e.preventDefault()
            props.handleRowTab(
              props.row,
              props.column,
              props.session,
              props.rowKey,
              e.shiftKey ? -1 : 1,
            )
          }
        }}
        onBlur={() => props.commitRowSession(props.session, props.row, props.rowKey)}
        onClick={(e) => e.stopPropagation()}
        style={editorInputStyle(Boolean(props.session.error()))}
      />
      <Show when={props.editPreview && props.column.formatter}>
        <div data-iris-edit-preview="" style={previewStyle}>
          {props.editPreviewText(props.row, props.column, props.session.draft())}
        </div>
      </Show>
      <Show when={props.session.error()}>
        <div
          id={`${props.cellId}-error`}
          role="alert"
          data-iris-table-editor-error=""
          style={errorStyle}
        >
          {props.session.error()}
        </div>
      </Show>
    </>
  )
}
