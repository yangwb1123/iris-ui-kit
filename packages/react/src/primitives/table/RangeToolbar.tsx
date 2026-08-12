import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'

interface RangeToolbarProps {
  open: boolean
  /**
   * Virtual anchor: a ref whose `current` is a fake element exposing
   * `getBoundingClientRect()` at the FIRST SELECTED CELL's live rect.
   * Populated by the table whenever the range changes.
   */
  anchorRef: React.RefObject<HTMLElement | null>
  onCopy: () => void
  onExport: () => void
  /** The 清除 button — clears the range CELLS (the selection stays). */
  onClear: () => void
  /** Dismissal (Escape / outside pointer-down) — clears the RANGE itself,
   * which hides the bar (its visibility derives from the range store). */
  onDismiss: () => void
  t: (key: string) => string
}

const BAR_BUTTON_STYLE: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--iris-foreground)',
  font: 'inherit',
  fontSize: 'var(--iris-font-size-sm, 13px)',
  padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
  borderRadius: 'var(--iris-radius-sm, 4px)',
  whiteSpace: 'nowrap',
}

/**
 * Floating action bar for the active cell range (batch AH, iris 独有). Same
 * building blocks as the right-click menu — `useFloating` + `useDismiss` +
 * portal — with two deliberate divergences from ContextMenu:
 * 1. anchored to the FIRST SELECTED CELL's rect (placement top, flip/shift
 *    ON) instead of the cursor;
 * 2. `autoUpdate` keeps it glued to the cell on scroll/resize instead of
 *    closing.
 * Dismissal = clearing the range: Escape / outside pointer-down run through
 * `useDismiss` → `onClear` (the table's `clearRange`), which makes the bar
 * disappear because its visibility derives from the range store. No close
 * button (the spec fiat — the bar only exists while a range exists).
 */
export function RangeToolbar({
  open,
  anchorRef,
  onCopy,
  onExport,
  onClear,
  onDismiss,
  t,
}: RangeToolbarProps): React.ReactElement | null {
  const barRef = React.useRef<HTMLDivElement | null>(null)

  const { floatingStyles } = useFloating({
    anchor: anchorRef,
    floating: barRef,
    open,
    placement: 'top',
    flip: true,
    shift: true,
    offset: 4,
  })

  useDismiss({
    enabled: open,
    exclude: [barRef],
    onDismiss,
  })

  if (!open) return null

  const node = (
    <div
      ref={barRef}
      role="toolbar"
      data-iris-table-range-toolbar=""
      aria-label={t('table.range.copy')}
      style={{
        ...floatingStyles,
        zIndex: 'var(--iris-z-popover, 1000)',
        display: 'flex',
        alignItems: 'center',
        background: 'var(--iris-surface-floating, var(--iris-surface))',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        boxShadow: 'var(--iris-shadow-lg)',
        padding: 'var(--iris-space-xxs, 4px)',
        gap: 'var(--iris-space-xxs, 4px)',
      }}
    >
      <button type="button" data-iris-table-range-copy="" onClick={onCopy} style={BAR_BUTTON_STYLE}>
        {t('table.range.copy')}
      </button>
      <button
        type="button"
        data-iris-table-range-export=""
        onClick={onExport}
        style={BAR_BUTTON_STYLE}
      >
        {t('table.range.export')}
      </button>
      <button
        type="button"
        data-iris-table-range-clear=""
        onClick={onClear}
        style={BAR_BUTTON_STYLE}
      >
        {t('table.range.clear')}
      </button>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
