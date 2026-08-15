import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import { summarizeColumn } from '@iris-ui-kit/core'

interface TableSummaryPanelProps<Row extends Record<string, unknown>> {
  open: boolean
  /**
   * Virtual anchor: the SAME fake cursor element the context menu used — the
   * panel lands exactly where the menu (and the right-click) was.
   */
  anchorRef: React.RefObject<HTMLElement | null>
  /** The clicked column's display title (header of the panel). */
  columnTitle: string
  /** Body rows the summary is computed over (already query/filtered). */
  rows: readonly Row[]
  /** The column's value key — `dataIndex ?? key`, the getCellValue indirection. */
  valueKey: string
  onClose: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}

/**
 * Floating natural-language summary panel (batch AW, iris 独有 — vxe has no
 * equivalent). Opens from the context menu's built-in `__iris-summary` item
 * and rides the SAME virtual cursor anchor the menu used, so it appears
 * exactly where the user right-clicked. Built with the same building blocks
 * as `TableDistributionPanel` — `useFloating` + `useDismiss` + portal — with
 * the same dismissal set (Escape / outside pointer-down / any scroll).
 *
 * Content is computed here via the core `summarizeColumn` material over the
 * clicked column's values in `rows` (the table's `bodyData`): one sentence
 * that says what the column IS — numeric columns get count/range/average/
 * missing, categorical ones their top-3 shares. The title header reuses the
 * distribution panel's chrome; the summary body is muted text. Every color is
 * a `--iris-*` token.
 */
export function TableSummaryPanel<Row extends Record<string, unknown>>({
  open,
  anchorRef,
  columnTitle,
  rows,
  valueKey,
  onClose,
  t,
}: TableSummaryPanelProps<Row>): React.ReactElement | null {
  const panelRef = React.useRef<HTMLDivElement | null>(null)

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

  const summary = React.useMemo(
    () =>
      summarizeColumn(
        rows.map((row) => row[valueKey]),
        columnTitle,
      ),
    [rows, valueKey, columnTitle],
  )

  if (!open) return null

  const node = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t('table.summary')}
      data-iris-summary-panel=""
      data-iris-summary-column={columnTitle}
      style={{
        ...floatingStyles,
        zIndex: 'var(--iris-z-popover, 1000)',
        background: 'var(--iris-surface-floating, var(--iris-surface))',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        boxShadow: 'var(--iris-shadow-lg)',
        padding: 'var(--iris-space-xxs, 4px)',
        minWidth: 180,
        maxWidth: 320,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-space-xxs, 4px)',
        fontSize: 'var(--iris-font-size-sm, 13px)',
      }}
    >
      <div
        data-iris-summary-title=""
        style={{
          padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {columnTitle}
      </div>
      <div
        data-iris-summary-text=""
        style={{
          color: 'var(--iris-muted)',
          padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
          lineHeight: 1.5,
        }}
      >
        {summary}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
