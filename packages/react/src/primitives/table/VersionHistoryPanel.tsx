import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { formatClock, type VersionHistory } from '@iris-ui-kit/core'

interface TableVersionHistoryPanelProps<Row extends Record<string, unknown>> {
  open: boolean
  /** Anchor: the toolbar history trigger button (a real DOM node). */
  anchorRef: React.RefObject<HTMLElement | null>
  /** The core version controller (bounded ring, newest-first). */
  history: VersionHistory<Row>
  /** Restore the rows captured before the commit with `index` (Table closes the panel after). */
  onRestore: (index: number) => void
  onClose: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}

/**
 * Floating version-history panel (batch BA, iris 独有 — vxe has no version
 * history). Opens from the toolbar trigger (`data-iris-history-trigger`) and
 * floats below it (`useFloating` + portal, like `TableAuditPanel`), closing
 * on Escape / outside pointer-down / any scroll.
 *
 * Content: newest-first versions (the controller's ring is already newest-
 * first) — each entry renders `#index` + `formatClock`-formatted local time +
 * the commit type label, and is CLICKABLE: pressing it restores those rows
 * (the rows themselves are intentionally not rendered — restore replaces the
 * whole row list, so the entry is the state, not a preview). An empty state
 * covers the pre-first-commit ring; deliberately NO clear button (a restore
 * is the wipe — documented). The list is max-height + scroll so a full ring
 * stays navigable. Reactivity: `useSyncExternalStore` on the controller's
 * `subscribe`/`getVersion` pair — the panel re-renders on push/clear even
 * without the parent re-rendering.
 *
 * Dismissal wiring follows the audit panel precedent: the toolbar trigger is
 * EXCLUDED from the outside-pointer-down close (so a press on it toggles
 * instead of closing-then-reopening).
 */
export function TableVersionHistoryPanel<Row extends Record<string, unknown>>({
  open,
  anchorRef,
  history,
  onRestore,
  onClose,
  t,
}: TableVersionHistoryPanelProps<Row>): React.ReactElement | null {
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
  const version = React.useSyncExternalStore(
    history.subscribe,
    history.getVersion,
    history.getVersion,
  )
  void version
  const entries = history.list()

  // Esc / outside pointer-down / any scroll close the panel.
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const onDown = (e: PointerEvent): void => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('[data-iris-history-panel], [data-iris-history-trigger]')) return
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
      aria-label={t('table.history')}
      data-iris-history-panel=""
      style={{
        ...floatingStyles,
        zIndex: 'var(--iris-z-popover, 1000)',
        background: 'var(--iris-surface-floating, var(--iris-surface))',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        boxShadow: 'var(--iris-shadow-lg)',
        padding: 'var(--iris-space-sm, 12px)',
        minWidth: 240,
        maxWidth: 320,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-space-xs, 8px)',
        fontSize: 'var(--iris-font-size-sm, 13px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--iris-space-xs, 8px)' }}>
        <span style={{ fontWeight: 600, flex: 1 }}>{t('table.history')}</span>
      </div>
      {entries.length === 0 ? (
        <div
          data-iris-history-empty=""
          style={{
            color: 'var(--iris-muted)',
            textAlign: 'center',
            padding: 'var(--iris-space-sm, 12px)',
          }}
        >
          {t('table.history.empty')}
        </div>
      ) : (
        <div
          data-iris-history-entries=""
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--iris-space-xxs, 4px)',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {entries.map((e) => (
            <button
              key={e.index}
              type="button"
              data-iris-history-entry=""
              onClick={() => onRestore(e.index)}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 'var(--iris-space-xs, 8px)',
                padding: 'var(--iris-space-xxs, 4px) 0',
                border: 'none',
                borderBottom: '1px solid var(--iris-border-subtle, var(--iris-border))',
                background: 'transparent',
                color: 'var(--iris-foreground)',
                cursor: 'pointer',
                fontSize: 'var(--iris-font-size-xs, 12px)',
                textAlign: 'start',
              }}
            >
              <span data-iris-history-index="" style={{ color: 'var(--iris-muted)', minWidth: 30 }}>
                #{e.index}
              </span>
              <span data-iris-history-time="" style={{ color: 'var(--iris-muted)', minWidth: 64 }}>
                {formatClock(new Date(e.at))}
              </span>
              <span
                data-iris-history-type=""
                style={{
                  color: 'var(--iris-primary)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {e.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
