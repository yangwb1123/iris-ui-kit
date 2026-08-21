import * as React from 'react'
import type { CellEdit } from '@iris-ui-kit/core'
import { useStore } from '../../useStore'
import { applyCellMask } from './exportCsv'
import type { IrisTableColumn } from './types'
import { CHAR_COUNT_STYLE, EDIT_PREVIEW_STYLE } from './styles'

interface EditorSurfaceProps<Row extends Record<string, unknown>> {
  /** The edit session driving this editor (cell mode: the singleton; row
   *  mode: that column's own session). */
  session: CellEdit
  col: IrisTableColumn<Row>
  /** Shared draft coercion, including formula/value resolution, owned by the table. */
  coerceDraft: (row: Row, col: IrisTableColumn<Row>, draft: unknown) => unknown
  /** aria-describedby id of the validation error message. */
  errorId: string
  /** validConfig.showMessage !== false — skip only the message element. */
  showError: boolean
  /** Callback ref so the parent can focus the editor (stable per column). */
  registerRef: (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null) => void
  onTab: (e: React.KeyboardEvent, dir: 1 | -1) => void
  onCommit: () => void
  onCancel: () => void
  /** Row edit mode: bumped to (re)focus this editor; cell mode focuses via
   *  the singleton editingTarget effect instead (always 0 here). */
  focusToken: number
  /** Row edit mode: fired when the session goes idle (committed) so the
   *  parent can close just this column's editor. */
  onSessionIdle?: () => void
  /** Per-column native datalist options (batch AM, iris 独有): a map of
   *  column key → suggestion strings, computed by the parent over the body
   *  data so this surface stays free of it. Only the text editor consumes it. */
  suggestOptions?: ReadonlyMap<string, string[]>
  /** Batch CC (iris 独有): auto-height textarea editor — grows with content
   *  (1 row start, 6-row cap), sized via scrollHeight on input. Off by
   *  default (fail-closed; batch I's rows=3 stays). */
  editAutoHeight?: boolean
  /** Batch CG (iris 独有): show a live character count in the cell's
   *  bottom-right corner — `String(draft).length`, recomputed per keystroke
   *  via the existing session-store subscription (zero new state). */
  charCount?: boolean
  /** Batch CQ (iris 独有): show a live preview of the formatter-applied
   *  draft below the editor — a muted small line (`data-iris-edit-preview`),
   *  recomputed per keystroke via the session-store subscription (zero new
   *  state). Only renders for columns with a `formatter`. */
  editPreview?: boolean
  /** The row being edited — the formatter's second argument, so a
   *  row-aware formatter sees the same row the committed cell display feeds
   *  it. */
  row: Row
  /** i18n translator (the parent's useI18n instance — same `t` the table uses). */
  t: (key: string, params?: Record<string, string | number>) => string
}

/**
 * Shared inline-editor surface for cell AND row edit modes (batch K).
 * Subscribes to the session's core store so draft/error changes re-render
 * just the editor; the three editor branches (text/number input, select,
 * textarea) are the pre-batch-K UI, just parameterized by the session. Enter
 * commits THAT column (per-cell commit), Escape cancels (the whole row in
 * row mode), blur commits the column, Tab moves between editable columns.
 */
export function EditorSurface<Row extends Record<string, unknown>>({
  session,
  col,
  coerceDraft,
  errorId,
  showError,
  registerRef,
  onTab,
  onCommit,
  onCancel,
  focusToken,
  onSessionIdle,
  suggestOptions,
  editAutoHeight,
  charCount,
  editPreview,
  row,
  t,
}: EditorSurfaceProps<Row>): React.ReactElement {
  const state = useStore(session.store)
  const ref = React.useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null)
  React.useEffect(() => {
    if (focusToken > 0) ref.current?.focus()
  }, [focusToken])
  // A committed session goes idle (editing cleared) — close this column's
  // editor (row mode keeps the rest of the row's editors open).
  React.useEffect(() => {
    if (state.editing === null) onSessionIdle?.()
  }, [state.editing, onSessionIdle])
  // Batch CC: on open, size the auto-height textarea from its pre-filled
  // draft (scrollHeight) — multi-line values arrive already sized; growth /
  // shrink while typing is handled by onInput below (no setState, no
  // re-render loop — the surface re-renders per keystroke anyway via the
  // session store, but the inline height is written straight to the DOM).
  React.useEffect(() => {
    if (!editAutoHeight) return
    const el = ref.current
    if (!el || el.tagName !== 'TEXTAREA') return
    applyEditorAutoHeight(el as HTMLTextAreaElement)
  }, [editAutoHeight])
  const setRef = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null): void => {
    ref.current = el
    registerRef(el)
  }
  // Const bindings let TS keep the select/options narrowing inside the nested
  // JSX callbacks (a mutable `col` would lose it). A select editor with no
  // editOptions falls back to the text input.
  const isSelectEditor = col.editor === 'select' && col.editOptions !== undefined
  const selectOptions = isSelectEditor ? col.editOptions : undefined
  const draft = String(state.draft ?? '')
  const error = state.error
  // Batch AM: a text editor with suggestions renders a native <datalist>
  // (`data-iris-edit-suggest`) linked via `list`; the id comes from useId (the
  // repo's SSR-stable pattern). Only while editing — the surface mounts per session.
  const suggestId = React.useId()
  const suggestList = suggestOptions?.get(col.key)
  // Text editor only: the shared text/number input is the only branch that
  // consumes the datalist — select (with options) and textarea ignore it.
  const showSuggest =
    col.editor !== 'number' &&
    !(isSelectEditor && selectOptions !== undefined) &&
    col.editor !== 'textarea' &&
    suggestList !== undefined &&
    suggestList.length > 0
  return (
    <>
      {isSelectEditor && selectOptions ? (
        // vxe edit-render select parity (batch H): a native <select> commits
        // the option's TYPED value (numbers stay numbers). Value matches
        // options by String(value); when the current draft matches NO option,
        // a synthetic option preserves it so a plain blur never silently
        // replaces the cell value with the first option.
        <select
          ref={setRef}
          value={draft}
          data-iris-table-editor=""
          data-iris-table-editor-select=""
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error && showError ? errorId : undefined}
          onChange={(e) => {
            const opt = selectOptions.find((o) => String(o.value) === e.target.value)
            session.setDraft(opt ? opt.value : e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              onTab(e, e.shiftKey ? -1 : 1)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              onCommit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
          }}
          onBlur={() => onCommit()}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            border: `1px solid ${error ? 'var(--iris-danger)' : 'var(--iris-primary)'}`,
            borderRadius: 'var(--iris-radius-sm, 4px)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
            font: 'inherit',
            background: 'var(--iris-background)',
            color: 'var(--iris-foreground)',
            outline: 'none',
          }}
        >
          {!selectOptions.some((o) => String(o.value) === draft) ? (
            <option value={draft}>{draft}</option>
          ) : null}
          {selectOptions.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      ) : col.editor === 'textarea' ? (
        // vxe edit-render textarea parity (batch I): Enter commits, Shift+Enter
        // inserts a newline, Escape cancels — same commit/aria surface.
        // Batch CC: editAutoHeight starts at 1 row and grows with content
        // (6-row cap) via scrollHeight measured on input.
        <textarea
          ref={setRef}
          rows={editAutoHeight ? 1 : 3}
          value={draft}
          data-iris-table-editor=""
          data-iris-table-editor-textarea=""
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error && showError ? errorId : undefined}
          onChange={(e) => session.setDraft(e.target.value)}
          onInput={(e) => {
            if (editAutoHeight) applyEditorAutoHeight(e.currentTarget)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              onTab(e, e.shiftKey ? -1 : 1)
            } else if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onCommit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
          }}
          onBlur={() => onCommit()}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            border: `1px solid ${error ? 'var(--iris-danger)' : 'var(--iris-primary)'}`,
            borderRadius: 'var(--iris-radius-sm, 4px)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
            font: 'inherit',
            background: 'var(--iris-background)',
            color: 'var(--iris-foreground)',
            outline: 'none',
            resize: 'none',
          }}
        />
      ) : (
        <input
          ref={setRef}
          type={col.editor === 'number' ? 'number' : 'text'}
          value={draft}
          data-iris-table-editor=""
          list={showSuggest ? suggestId : undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error && showError ? errorId : undefined}
          onChange={(e) => session.setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              onTab(e, e.shiftKey ? -1 : 1)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              onCommit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
          }}
          onBlur={() => onCommit()}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            border: `1px solid ${error ? 'var(--iris-danger)' : 'var(--iris-primary)'}`,
            borderRadius: 'var(--iris-radius-sm, 4px)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
            font: 'inherit',
            background: 'var(--iris-background)',
            color: 'var(--iris-foreground)',
            outline: 'none',
          }}
        />
      )}
      {/* Batch AM: native suggestions for the text editor — a datalist with the
      column's distinct values (or the explicit array form), id-linked to the
      input's `list`. Rendered next to the input (datalists are invisible). */}
      {showSuggest ? (
        <datalist id={suggestId} data-iris-edit-suggest="">
          {suggestList.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      ) : null}
      {/* Batch CQ (iris 独有 — vxe has no equivalent): live preview of the
      formatter-applied draft — the draft coerced like the commit path (the
      SHARED coerceEditDraft, so the preview can never drift from the commit
      coercion), then the same mask → formatter display chain as the
      committed cell (batch AY contract), so the preview is byte-faithful to
      what the cell will show. Recomputed per keystroke through the
      session-store subscription above (zero new state); only columns with a
      formatter render it (fail-closed). Rendered in-flow BEFORE the
      validation error (same slot family) — the editing cell wraps while
      editing and this line's flexBasis 100% stacks it UNDER the editor. */}
      {editPreview && col.formatter ? (
        <div data-iris-edit-preview="" style={EDIT_PREVIEW_STYLE}>
          {col.formatter(applyCellMask(coerceDraft(row, col, draft), col), row)}
        </div>
      ) : null}
      {/* validConfig.showMessage=false: validation still blocks the commit and
      aria-invalid stays — only the message element is skipped (vxe ValidConfig
      parity). */}
      {error && showError ? (
        <div
          id={errorId}
          role="alert"
          data-iris-table-editor-error=""
          style={{
            marginTop: 'var(--iris-space-xxs, 4px)',
            fontSize: 'var(--iris-font-size-xs, 12px)',
            color: 'var(--iris-danger)',
            // Batch CQ review fix: full flex line like the preview — stacks
            // UNDER the editor (the editing cell wraps while editing).
            flexBasis: '100%',
            minWidth: 0,
          }}
        >
          {error}
        </div>
      ) : null}
      {/* Batch CG (iris 独有): live character count at the cell's bottom-right
      corner — String(draft).length recomputed per keystroke through the
      session-store subscription above (zero new state). The host cell gains
      position: relative from charCountCellStyle so the chip anchors to the
      cell box; pointer-transparent so typing is never intercepted. */}
      {charCount ? (
        <span data-iris-char-count="" data-iris-char-count-edit="" style={CHAR_COUNT_STYLE}>
          {t('table.charCount', { count: String(draft.length) })}
        </span>
      ) : null}
    </>
  )
}

/** Batch CC (iris 独有): the auto-height textarea editor grows with content,
 *  capped at this many rows (spec: max 6). */
const EDITOR_AUTO_MAX_ROWS = 6
/** Batch CC: line-height fallback when getComputedStyle reports 'normal' /
 *  an empty string (jsdom has no layout) or an absurd unitless value. */
const EDITOR_AUTO_FALLBACK_LINE_HEIGHT = 16

/**
 * Batch CC (iris 独有): pure size mapping for the auto-height textarea — from
 * the measured scrollHeight (and the session's line height) to the inline
 * `height` / `maxHeight` / `overflowY` trio. `height` grows with content
 * (floor = one line, cap = EDITOR_AUTO_MAX_ROWS lines) so shrinking content
 * shrinks the editor too; `overflowY` is `auto` only when content STRICTLY
 * exceeds the cap — exactly 6 rows has no scrollbar. Exported for unit tests
 * (the math lives here, not in jsdom's zero-layout DOM).
 */
export function autoHeightSize(
  scrollHeight: number,
  lineHeight: number,
): { height: number; maxHeight: number; overflowY: 'auto' | 'hidden' } {
  const maxHeight = EDITOR_AUTO_MAX_ROWS * lineHeight
  return {
    height: Math.max(lineHeight, Math.min(scrollHeight, maxHeight)),
    maxHeight,
    overflowY: scrollHeight > maxHeight ? 'auto' : 'hidden',
  }
}

/** Batch CC: the editor's line height, measured once per session (module-level
 *  cache — the surface re-measures nothing per keystroke). */
let editorAutoLineHeight: number | null = null

/** Batch CC: read + cache the textarea's line height; 'normal'/empty/absurd
 *  values (jsdom) fall back to EDITOR_AUTO_FALLBACK_LINE_HEIGHT. */
function measureEditorLineHeight(el: HTMLTextAreaElement): number {
  if (editorAutoLineHeight !== null) return editorAutoLineHeight
  let lh = EDITOR_AUTO_FALLBACK_LINE_HEIGHT
  if (typeof window !== 'undefined') {
    const cs = window.getComputedStyle(el).lineHeight
    const parsed = cs && cs !== 'normal' ? Number.parseFloat(cs) : NaN
    if (Number.isFinite(parsed) && parsed >= 8) lh = parsed
  }
  editorAutoLineHeight = lh
  return lh
}

/** Batch CC: measure + apply the auto-height trio (height/maxHeight/overflowY)
 *  to a textarea editor from its current scrollHeight. */
function applyEditorAutoHeight(el: HTMLTextAreaElement): void {
  const size = autoHeightSize(el.scrollHeight, measureEditorLineHeight(el))
  el.style.height = `${size.height}px`
  el.style.maxHeight = `${size.maxHeight}px`
  el.style.overflowY = size.overflowY
}
