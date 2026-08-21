import { h, type Ref, type VNode } from 'vue'
import type { IrisTableColumn } from './types'

export interface TableRowEditSession {
  draft: string
  error: string | null
}

export interface TableEditorRenderContext {
  rowEditorRefs: Map<string, HTMLInputElement | null>
  editorInputRef: Ref<HTMLInputElement | null>
  editingDraft: Ref<string>
  editError: Readonly<Ref<string | null>>
  commitEdit: (row: Record<string, unknown>, col: IrisTableColumn, index: number) => void
  cancelEdit: () => void
  commitRowSession: (
    key: string | number,
    col: IrisTableColumn,
    index: number,
    editCellId: string,
  ) => void
  cancelRowEdit: () => void
  editPreview: boolean
  previewValue: (row: Record<string, unknown>, col: IrisTableColumn, draft: string) => unknown
}

export const editorInputStyle = (error: string | null): Record<string, string> => ({
  width: '100%',
  border: `1px solid ${error ? 'var(--iris-danger)' : 'var(--iris-primary)'}`,
  borderRadius: 'var(--iris-radius-sm)',
  padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
  font: 'inherit',
  background: 'var(--iris-background)',
  color: 'var(--iris-foreground)',
  outline: 'none',
  boxShadow: '0 0 0 3px color-mix(in srgb, var(--iris-primary) 18%, transparent)',
})

export function editorErrorVNode(editCellId: string, error: string): VNode {
  return h(
    'div',
    {
      id: `${editCellId}-error`,
      role: 'alert',
      'data-iris-table-editor-error': '',
      style: {
        marginTop: 'var(--iris-space-xxs, 4px)',
        fontSize: 'var(--iris-font-size-xs, 12px)',
        color: 'var(--iris-danger)',
      },
    },
    error,
  )
}

const editPreviewStyle: Record<string, string> = {
  flexBasis: '100%',
  minWidth: '0',
  marginTop: 'var(--iris-space-xxs, 4px)',
  fontSize: 'var(--iris-font-size-xs, 12px)',
  color: 'var(--iris-muted)',
}

function previewVNode(
  ctx: TableEditorRenderContext,
  row: Record<string, unknown>,
  col: IrisTableColumn,
  draft: string,
): VNode | null {
  if (!ctx.editPreview || !col.formatter) return null
  return h(
    'div',
    { 'data-iris-edit-preview': '', style: editPreviewStyle },
    ctx.previewValue(row, col, draft) as string,
  )
}

/** Render one row-mode editor from the session map. */
export function renderRowSessionContent(
  ctx: TableEditorRenderContext,
  row: Record<string, unknown>,
  col: IrisTableColumn,
  index: number,
  key: string | number,
  editCellId: string,
  session: TableRowEditSession,
): VNode | VNode[] {
  const error = session.error
  const input = h('input', {
    ref: (el: unknown) => {
      ctx.rowEditorRefs.set(col.key, (el ?? null) as HTMLInputElement | null)
    },
    type: col.editor === 'number' ? 'number' : 'text',
    value: session.draft,
    'data-iris-table-editor': '',
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? `${editCellId}-error` : undefined,
    onInput: (e: Event) => {
      session.draft = (e.target as HTMLInputElement).value
    },
    onKeydown: (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        ctx.commitRowSession(key, col, index, editCellId)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        ctx.cancelRowEdit()
      }
    },
    onBlur: () => ctx.commitRowSession(key, col, index, editCellId),
    onClick: (e: MouseEvent) => e.stopPropagation(),
    onDblclick: (e: MouseEvent) => e.stopPropagation(),
    style: editorInputStyle(error),
  })
  const preview = previewVNode(ctx, row, col, session.draft)
  const children = [input, preview, error ? editorErrorVNode(editCellId, error) : null].filter(
    (node): node is VNode => node !== null,
  )
  return children.length === 1 ? children[0]! : children
}

/** Render the singleton cell-mode editor. */
export function renderCellEditContent(
  ctx: TableEditorRenderContext,
  row: Record<string, unknown>,
  col: IrisTableColumn,
  index: number,
  editCellId: string,
): VNode | VNode[] {
  const error = ctx.editError.value
  const input = h('input', {
    ref: (el: unknown) => {
      ctx.editorInputRef.value = (el ?? null) as HTMLInputElement | null
    },
    type: col.editor === 'number' ? 'number' : 'text',
    value: ctx.editingDraft.value,
    'data-iris-table-editor': '',
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? `${editCellId}-error` : undefined,
    onInput: (e: Event) => {
      ctx.editingDraft.value = (e.target as HTMLInputElement).value
    },
    onKeydown: (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        ctx.commitEdit(row, col, index)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        ctx.cancelEdit()
      }
    },
    onBlur: () => ctx.commitEdit(row, col, index),
    onClick: (e: MouseEvent) => e.stopPropagation(),
    onDblclick: (e: MouseEvent) => e.stopPropagation(),
    style: editorInputStyle(error),
  })
  const preview = previewVNode(ctx, row, col, ctx.editingDraft.value)
  const children = [input, preview, error ? editorErrorVNode(editCellId, error) : null].filter(
    (node): node is VNode => node !== null,
  )
  return children.length === 1 ? children[0]! : children
}
