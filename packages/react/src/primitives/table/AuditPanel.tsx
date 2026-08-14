import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { formatClock, type AuditLog } from '@iris-ui-kit/core'

interface TableAuditPanelProps {
  open: boolean
  /** Anchor: the toolbar audit trigger button (a real DOM node). */
  anchorRef: React.RefObject<HTMLElement | null>
  /** The core audit controller (bounded ring, newest-first). */
  audit: AuditLog
  /** Wipe the trail (the seq counter never resets — audit integrity). */
  onClear: () => void
  onClose: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}

/**
 * Floating audit-log panel (batch AT, iris 独有 — vxe has no audit trail).
 * Opens from the toolbar trigger (`data-iris-audit-trigger`) and floats
 * below it (`useFloating` + portal, like `TableChartPanel`), closing on
 * Escape / outside pointer-down / any scroll.
 *
 * Content: newest-first entries (the controller's ring is already newest-
 * first) — each row renders `#seq` + `formatClock`-formatted local time +
 * the raw commit type + rowKey + column + a MUTED `old → new` when the diff
 * resolved a changed cell (row-level structural changes — insert/remove —
 * carry only the rowKey, rendered as a partial-context row). A clear button
 * wipes the trail. The list is max-height + scroll so a full ring stays
 * navigable. Reactivity: `useSyncExternalStore` on the controller's
 * `subscribe`/`getVersion` pair — the panel re-renders on push/clear even
 * without the parent re-rendering.
 *
 * Dismissal wiring follows the chart panel precedent: the toolbar trigger is
 * EXCLUDED from the outside-pointer-down close (so a press on it toggles
 * instead of closing-then-reopening).
 */
export function TableAuditPanel({
  open,
  anchorRef,
  audit,
  onClear,
  onClose,
  t,
}: TableAuditPanelProps): React.ReactElement | null {
  const panelRef = React.useRef<HTMLDivElement | null>(null)

  const { floatingStyles } = useFloating({
    anchor: anchorRef,
    floating: panelRef,
    open,
    placement: 'bottom-end',
    flip: false,
    shift: true,
  })

  // Re-render on every push/clear (the controller emits + bumps version).
  const version = React.useSyncExternalStore(audit.subscribe, audit.getVersion, audit.getVersion)
  void version
  const entries = audit.list()

  // Esc / outside pointer-down / any scroll close the panel.
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const onDown = (e: PointerEvent): void => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('[data-iris-audit-panel], [data-iris-audit-trigger]')) return
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
      aria-label={t('table.audit')}
      data-iris-audit-panel=""
      style={{
        ...floatingStyles,
        zIndex: 'var(--iris-z-popover, 1000)',
        background: 'var(--iris-surface-floating, var(--iris-surface))',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        boxShadow: 'var(--iris-shadow-lg)',
        padding: 'var(--iris-space-sm, 12px)',
        minWidth: 280,
        maxWidth: 360,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-space-xs, 8px)',
        fontSize: 'var(--iris-font-size-sm, 13px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--iris-space-xs, 8px)' }}>
        <span style={{ fontWeight: 600, flex: 1 }}>{t('table.audit')}</span>
        {entries.length > 0 ? (
          <button
            type="button"
            data-iris-audit-clear=""
            onClick={onClear}
            style={{
              border: '1px solid var(--iris-border)',
              borderRadius: 'var(--iris-radius-sm, 4px)',
              background: 'transparent',
              color: 'var(--iris-muted)',
              cursor: 'pointer',
              padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
              fontSize: 'var(--iris-font-size-xs, 12px)',
            }}
          >
            {t('table.audit.clear')}
          </button>
        ) : null}
      </div>
      {entries.length === 0 ? (
        <div
          data-iris-audit-empty=""
          style={{
            color: 'var(--iris-muted)',
            textAlign: 'center',
            padding: 'var(--iris-space-sm, 12px)',
          }}
        >
          {t('table.audit.empty')}
        </div>
      ) : (
        <div
          data-iris-audit-entries=""
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--iris-space-xxs, 4px)',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {entries.map((e) => (
            <div
              key={e.seq}
              data-iris-audit-entry=""
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 'var(--iris-space-xs, 8px)',
                padding: 'var(--iris-space-xxs, 4px) 0',
                borderBottom: '1px solid var(--iris-border-subtle, var(--iris-border))',
                fontSize: 'var(--iris-font-size-xs, 12px)',
              }}
            >
              <span data-iris-audit-seq="" style={{ color: 'var(--iris-muted)', minWidth: 30 }}>
                #{e.seq}
              </span>
              <span data-iris-audit-time="" style={{ color: 'var(--iris-muted)', minWidth: 64 }}>
                {formatClock(new Date(e.at))}
              </span>
              <span
                data-iris-audit-type=""
                style={{
                  color: 'var(--iris-primary)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {e.type}
              </span>
              <span data-iris-audit-rowkey="" style={{ color: 'var(--iris-foreground)' }}>
                {e.rowKey !== undefined ? String(e.rowKey) : '—'}
              </span>
              {e.column !== undefined ? (
                <span data-iris-audit-cell="" style={{ color: 'var(--iris-muted)', flex: 1 }}>
                  {e.column}
                  <span
                    style={{
                      display: 'inline-flex',
                      gap: 'var(--iris-space-xxs, 4px)',
                      marginInlineStart: 'var(--iris-space-xs, 8px)',
                    }}
                  >
                    <span data-iris-audit-old="">{String(e.oldValue ?? '')}</span>
                    <span aria-hidden="true">→</span>
                    <span data-iris-audit-new="">{String(e.newValue ?? '')}</span>
                  </span>
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
