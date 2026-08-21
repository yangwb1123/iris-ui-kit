import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'

/** Shared style for the annotate panel action buttons (token-only, batch BB). */
const ANNOTATE_ACTION_STYLE: React.CSSProperties = {
  border: '1px solid var(--iris-border)',
  borderRadius: 'var(--iris-radius-sm, 4px)',
  background: 'var(--iris-surface)',
  color: 'var(--iris-foreground)',
  cursor: 'pointer',
  padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
  fontSize: 'var(--iris-font-size-sm, 13px)',
  fontFamily: 'inherit',
}

/**
 * Floating annotation editor (batch BB, iris 独有 — vxe has no note
 * editing). Opens from the context menu's built-in `__iris-annotate` /
 * `__iris-annotate-edit` items and rides the SAME virtual cursor anchor the
 * menu used, so it appears exactly where the user right-clicked. Built with
 * the same building blocks as `TableContextMenu` — `useFloating` +
 * `useDismiss` + portal — with the same dismissal set (Escape / outside
 * pointer-down / any scroll).
 *
 * The textarea is seeded from `annotations[cellKey]` (`current`); 保存 with
 * empty text removes the key, non-empty sets it — both routed to the table's
 * `onAnnotationsChange` channel via `onSave`/`onRemove`. 删除 renders only
 * when a note exists. Without `onAnnotationsChange` the buttons are inert
 * (documented — the table never calls them). Every color is a `--iris-*`
 * token.
 */
export function TableAnnotatePanel({
  open,
  anchorRef,
  cellKey,
  current,
  onSave,
  onRemove,
  onClose,
  t,
}: {
  open: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  cellKey: string
  current: string | undefined
  onSave: (text: string) => void
  onRemove: () => void
  onClose: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}): React.ReactElement | null {
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const [text, setText] = React.useState(current ?? '')

  const { floatingStyles } = useFloating({
    anchor: anchorRef,
    floating: panelRef,
    open,
    placement: 'bottom-start',
    flip: false,
    shift: false,
  })

  useDismiss({
    enabled: open,
    exclude: [panelRef],
    onDismiss: onClose,
  })

  // Scroll anywhere closes the panel (capture phase — nested scrollers count).
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const onScroll = (): void => onCloseRef.current()
    document.addEventListener('scroll', onScroll, true)
    return () => document.removeEventListener('scroll', onScroll, true)
  }, [open])

  if (!open) return null

  const node = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={current ? t('table.annotate.edit') : t('table.annotate')}
      data-iris-annotate-panel=""
      data-iris-annotate-cell={cellKey}
      style={{
        ...floatingStyles,
        zIndex: 'var(--iris-z-popover, 1000)',
        background: 'var(--iris-surface-floating, var(--iris-surface))',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        boxShadow: 'var(--iris-shadow-lg)',
        padding: 'var(--iris-space-xs, 8px)',
        minWidth: 220,
        maxWidth: 320,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-space-xs, 8px)',
        fontSize: 'var(--iris-font-size-sm, 13px)',
      }}
    >
      <textarea
        data-iris-annotate-input=""
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        aria-label={current ? t('table.annotate.edit') : t('table.annotate')}
        style={{
          background: 'var(--iris-surface)',
          color: 'var(--iris-foreground)',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-sm, 4px)',
          padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
          font: 'inherit',
          resize: 'vertical',
          minHeight: 64,
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--iris-space-xs, 8px)',
        }}
      >
        {current ? (
          <button
            type="button"
            data-iris-annotate-remove=""
            onClick={onRemove}
            style={{ ...ANNOTATE_ACTION_STYLE, color: 'var(--iris-danger)' }}
          >
            {t('table.annotate.remove')}
          </button>
        ) : null}
        <button
          type="button"
          data-iris-annotate-save=""
          onClick={() => onSave(text)}
          style={ANNOTATE_ACTION_STYLE}
        >
          {t('table.annotate.save')}
        </button>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}

/**
 * Floating note preview (batch BM, iris 独有 — vxe has no cell-note concept,
 * and its tooltip can only show the cell value). Hovering a noted cell with
 * `notePopover` replaces the native `title` on that cell with this popover:
 * a pure-display tooltip (`role="tooltip"`, pointer-events none so it never
 * steals hover) anchored to the cell's badge corner via the same virtual
 * anchor pattern as `TableContextMenu` — useFloating (placement top, offset
 * 8, flip/shift on) + useDismiss (Escape / outside pointer-down) + capture
 * scroll close + portal. Content-only: no i18n (the note text is user data).
 *
 * No sequence token (unlike the panels): the popover holds no internal state
 * to re-seed, and cell-to-cell hover moves close-then-reopen through
 * mouseleave/mouseenter (the popover is pointer-events none, so the pointer
 * physically leaves the old cell before entering the new one) — autoUpdate
 * re-runs on the fresh mount.
 */
export function TableNotePopover({
  open,
  anchorRef,
  cellKey,
  text,
  onClose,
}: {
  open: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  cellKey: string
  text: string
  onClose: () => void
}): React.ReactElement | null {
  const panelRef = React.useRef<HTMLDivElement | null>(null)

  const { floatingStyles } = useFloating({
    anchor: anchorRef,
    floating: panelRef,
    open,
    placement: 'top',
    offset: 8,
    flip: true,
    shift: true,
  })

  useDismiss({
    enabled: open,
    exclude: [panelRef],
    onDismiss: onClose,
  })

  // Scroll anywhere closes the popover (capture phase — nested scrollers count).
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const onScroll = (): void => onCloseRef.current()
    document.addEventListener('scroll', onScroll, true)
    return () => document.removeEventListener('scroll', onScroll, true)
  }, [open])

  if (!open) return null

  const node = (
    <div
      ref={panelRef}
      role="tooltip"
      data-iris-note-popover=""
      data-iris-note-cell={cellKey}
      style={{
        ...floatingStyles,
        zIndex: 'var(--iris-z-popover, 1000)',
        background: 'var(--iris-surface-floating, var(--iris-surface))',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        boxShadow: 'var(--iris-shadow-lg)',
        padding: 'var(--iris-space-xs, 8px)',
        maxWidth: 280,
        whiteSpace: 'pre-wrap',
        pointerEvents: 'none',
        fontSize: 'var(--iris-font-size-sm, 13px)',
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
