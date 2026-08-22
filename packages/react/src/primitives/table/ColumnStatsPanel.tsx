import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import type { IrisTableColumnStat } from './types'

/** Top-N most-accessed columns the panel shows (batch EB, iris 独有). */
export const COLUMN_STATS_TOP = 5

interface TableColumnStatsPanelProps {
  open: boolean
  /** Anchor: the toolbar column-stats trigger button (a real DOM node). */
  anchorRef: React.RefObject<HTMLElement | null>
  /**
   * The top-N snapshot — ALREADY sorted total desc / key asc and sliced to
   * `COLUMN_STATS_TOP` by the table (the same reduction `getColumnStats`
   * exposes). Passive prop: the panel renders whatever it receives and owns
   * zero subscriptions or state — the table's re-render on every bump IS the
   * live refresh (documented fiat: no observer, no interval).
   */
  stats: ReadonlyArray<IrisTableColumnStat>
  onClose: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}

/**
 * Floating column-access-stats panel (batch EB, iris 独有 — vxe has no column
 * access counter). Opens from the toolbar `▦` trigger
 * (`data-iris-column-stats-trigger`) and floats below it (the AuditPanel
 * mold — `useFloating` + portal), showing the top `COLUMN_STATS_TOP` leaf
 * columns by total activity, each row = rank + column key + clicks + edits
 * (+ total). Closing follows the chart/audit precedent: Escape / outside
 * pointer-down (the trigger itself excluded) / any scroll.
 *
 * DELIBERATELY passive: no `useSyncExternalStore`, no interval — the parent
 * passes the snapshot as a prop, so a bump that re-renders the table hands
 * the panel a fresh view for free. Empty state renders when the snapshot is
 * empty (off or idle — fail-closed, zero rows).
 */
export function TableColumnStatsPanel({
  open,
  anchorRef,
  stats,
  onClose,
  t,
}: TableColumnStatsPanelProps): React.ReactElement | null {
  const panelRef = React.useRef<HTMLDivElement | null>(null)

  const { floatingStyles } = useFloating({
    anchor: anchorRef,
    floating: panelRef,
    open,
    placement: 'bottom-end',
    flip: false,
    shift: true,
  })

  // Esc / outside pointer-down / any scroll close the panel.
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const onDown = (e: PointerEvent): void => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('[data-iris-column-stats-panel], [data-iris-column-stats-trigger]')) return
      onCloseRef.current()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    const onScroll = (): void => onCloseRef.current()
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  if (!open) return null

  const node = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t('table.columnStats')}
      data-iris-column-stats-panel=""
      style={{
        ...floatingStyles,
        zIndex: 'var(--iris-z-popover, 1000)',
        background: 'var(--iris-surface-floating, var(--iris-surface))',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        boxShadow: 'var(--iris-shadow-lg)',
        padding: 'var(--iris-space-sm, 12px)',
        minWidth: 220,
        maxWidth: 300,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-space-xs, 8px)',
        fontSize: 'var(--iris-font-size-sm, 13px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--iris-space-xs, 8px)' }}>
        <span style={{ fontWeight: 600, flex: 1 }}>{t('table.columnStats')}</span>
      </div>
      {stats.length === 0 ? (
        <div
          data-iris-column-stats-empty=""
          style={{
            color: 'var(--iris-muted)',
            textAlign: 'center',
            padding: 'var(--iris-space-sm, 12px)',
          }}
        >
          {t('table.columnStats.empty')}
        </div>
      ) : (
        <div
          data-iris-column-stats-rows=""
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--iris-space-xxs, 4px)',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {stats.map((s, i) => (
            <div
              key={s.key}
              data-iris-column-stats-row=""
              data-iris-column-stats-rank={String(i + 1)}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 1fr auto',
                alignItems: 'baseline',
                gap: 'var(--iris-space-xs, 8px)',
                padding: 'var(--iris-space-xxs, 4px) 0',
                borderBottom: '1px solid var(--iris-border-subtle, var(--iris-border))',
                fontSize: 'var(--iris-font-size-xs, 12px)',
              }}
            >
              <span data-iris-column-stats-rank="" style={{ color: 'var(--iris-muted)' }}>
                {i + 1}
              </span>
              <span data-iris-column-stats-key="" style={{ color: 'var(--iris-foreground)' }}>
                {s.key}
              </span>
              <span
                data-iris-column-stats-counts=""
                style={{ color: 'var(--iris-muted)', whiteSpace: 'nowrap' }}
              >
                {t('table.columnStats.clicks', { count: String(s.clicks) })} ·{' '}
                {t('table.columnStats.edits', { count: String(s.edits) })} · {s.total}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
