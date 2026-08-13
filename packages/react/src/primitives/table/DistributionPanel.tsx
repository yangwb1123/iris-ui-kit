import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import { valueDistribution } from '@iris-ui-kit/core'

/** Values shown before the "其余 N 个" fold (vxe has no equivalent — batch AM). */
const DISTRIBUTION_TOP = 20

interface TableDistributionPanelProps<Row extends Record<string, unknown>> {
  open: boolean
  /**
   * Virtual anchor: the SAME fake cursor element the context menu used — the
   * panel lands exactly where the menu (and the right-click) was.
   */
  anchorRef: React.RefObject<HTMLElement | null>
  /** The clicked column's display title (header of the panel). */
  columnTitle: string
  /** Body rows the distribution is computed over (already query/filtered). */
  rows: readonly Row[]
  /** The column's value key — `dataIndex ?? key`, the getCellValue indirection. */
  valueKey: string
  onClose: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}

/**
 * Floating value-distribution panel (batch AM, iris 独有 — vxe has no
 * equivalent). Opens from the context menu's built-in `__iris_distribution`
 * item and rides the SAME virtual cursor anchor the menu used, so it appears
 * exactly where the user right-clicked. Built with the same building blocks
 * as `TableContextMenu` — `useFloating` + `useDismiss` + portal — with the
 * same dismissal set (Escape / outside pointer-down / any scroll).
 *
 * Content is computed here via the core `valueDistribution` material over the
 * passed `rows` (the table's `bodyData`): the top 20 entries by count, then a
 * muted "其余 N 个" fold when more distinct values exist. Values render in the
 * foreground, counts muted; every color is a `--iris-*` token.
 */
export function TableDistributionPanel<Row extends Record<string, unknown>>({
  open,
  anchorRef,
  columnTitle,
  rows,
  valueKey,
  onClose,
  t,
}: TableDistributionPanelProps<Row>): React.ReactElement | null {
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

  const entries = React.useMemo(() => valueDistribution(rows, valueKey), [rows, valueKey])

  if (!open) return null

  const top = entries.slice(0, DISTRIBUTION_TOP)
  const rest = entries.length - top.length

  const node = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t('table.distribution')}
      data-iris-distribution-panel=""
      data-iris-distribution-column={columnTitle}
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
        maxWidth: 280,
        maxHeight: 320,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-space-xxs, 4px)',
        fontSize: 'var(--iris-font-size-sm, 13px)',
      }}
    >
      <div
        data-iris-distribution-title=""
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
      {top.length === 0 ? (
        <div data-iris-distribution-empty="" style={{ color: 'var(--iris-muted)' }}>
          —
        </div>
      ) : (
        top.map((entry) => (
          <div
            key={entry.value}
            data-iris-distribution-row={entry.value}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 'var(--iris-space-sm, 12px)',
              padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
            }}
          >
            <span
              data-iris-distribution-value=""
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {entry.value}
            </span>
            <span data-iris-distribution-count="" style={{ color: 'var(--iris-muted)' }}>
              {entry.count}
            </span>
          </div>
        ))
      )}
      {rest > 0 ? (
        <div
          data-iris-distribution-others=""
          style={{
            color: 'var(--iris-muted)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
            borderTop: '1px solid var(--iris-border)',
          }}
        >
          {t('table.distribution.others', { count: rest })}
        </div>
      ) : null}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
