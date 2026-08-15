import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { type AuditLog, type PerfSample, type PerfStats } from '@iris-ui-kit/core'

interface TablePerfPanelProps {
  open: boolean
  /** Anchor: the toolbar perf trigger button (a real DOM node). */
  anchorRef: React.RefObject<HTMLElement | null>
  /** The core perf controller (latest-snapshot). */
  perf: PerfStats
  /** The core audit controller — null when the `auditLog` prop is off
   * (changes row shows a muted `—`). */
  audit: AuditLog | null
  onClose: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}

function StatRow({
  label,
  children,
  muted = false,
  attr,
}: {
  label: string
  children: React.ReactNode
  muted?: boolean
  attr: string
}): React.ReactElement {
  return (
    <div
      data-iris-perf-row=""
      {...{ [attr]: '' }}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 'var(--iris-space-sm, 12px)',
        padding: 'var(--iris-space-xxs, 4px) 0',
        borderBottom: '1px solid var(--iris-border-subtle, var(--iris-border))',
        fontSize: 'var(--iris-font-size-xs, 12px)',
      }}
    >
      <span style={{ color: 'var(--iris-muted)' }}>{label}</span>
      <span
        data-iris-perf-value=""
        style={{
          color: muted ? 'var(--iris-muted)' : 'var(--iris-foreground)',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {children}
      </span>
    </div>
  )
}

/**
 * Floating performance panel (batch BL, iris 独有 — vxe has no perf stats).
 * Opens from the toolbar trigger (`data-iris-perf-trigger`, ⚡ after the
 * history trigger) and floats below it (`useFloating` + portal, like
 * `TableAuditPanel`), closing on Escape / outside pointer-down / any scroll.
 *
 * Content: the LAST render-commit sample (core `createPerfStats` latest-
 * snapshot controller) — 4 stat rows: render duration (render + layout
 * phase, excludes paint — documented), row count, leaf-column count and
 * the audit-trail depth. Reactivity: DUAL `useSyncExternalStore`
 * subscriptions (perf + audit controllers' `subscribe`/`getVersion`
 * pairs) — the panel re-renders when a new sample lands AND when the
 * audit trail changes (e.g. `tableRef.clearAuditLog()` — a handle call
 * that never re-renders the table), so the changes count stays live in
 * place. `auditLog` off → the audit controller is null and the changes
 * row renders a muted `—`. A no-sample empty state covers the pre-first-
 * commit window (defensive — the table pushes at mount when enabled).
 */
export function TablePerfPanel({
  open,
  anchorRef,
  perf,
  audit,
  onClose,
  t,
}: TablePerfPanelProps): React.ReactElement | null {
  const panelRef = React.useRef<HTMLDivElement | null>(null)

  const { floatingStyles } = useFloating({
    anchor: anchorRef,
    floating: panelRef,
    open,
    placement: 'bottom-end',
    flip: false,
    shift: true,
  })

  // Dual subscription: re-render on new samples (perf) and on audit
  // push/clear (the version primitives are the uSES snapshots — stable).
  const perfVersion = React.useSyncExternalStore(perf.subscribe, perf.getVersion, perf.getVersion)
  void perfVersion
  const auditVersion = React.useSyncExternalStore(
    audit ? audit.subscribe : noopSubscribe,
    audit ? audit.getVersion : zeroVersion,
    audit ? audit.getVersion : zeroVersion,
  )
  void auditVersion
  const sample: PerfSample | null = perf.latest()

  // Esc / outside pointer-down / any scroll close the panel.
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const onDown = (e: PointerEvent): void => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('[data-iris-perf-panel], [data-iris-perf-trigger]')) return
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
      aria-label={t('table.perf')}
      data-iris-perf-panel=""
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
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-space-xs, 8px)',
        fontSize: 'var(--iris-font-size-sm, 13px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--iris-space-xs, 8px)' }}>
        <span style={{ fontWeight: 600, flex: 1 }}>⚡ {t('table.perf')}</span>
      </div>
      {sample === null ? (
        <div
          data-iris-perf-empty=""
          style={{
            color: 'var(--iris-muted)',
            textAlign: 'center',
            padding: 'var(--iris-space-sm, 12px)',
          }}
        >
          {t('table.perf.empty')}
        </div>
      ) : (
        <div
          data-iris-perf-stats=""
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--iris-space-xxs, 4px)',
          }}
        >
          <StatRow attr="data-iris-perf-duration" label={t('table.perf.duration')}>
            {sample.durationMs.toFixed(1)} ms
          </StatRow>
          <StatRow attr="data-iris-perf-rows" label={t('table.perf.rows')}>
            {sample.rows}
          </StatRow>
          <StatRow attr="data-iris-perf-columns" label={t('table.perf.columns')}>
            {sample.columns}
          </StatRow>
          <StatRow
            attr="data-iris-perf-changes"
            label={t('table.perf.changes')}
            muted={audit === null}
          >
            {audit === null ? '—' : audit.depth}
          </StatRow>
        </div>
      )}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}

function noopSubscribe(): () => void {
  return () => {}
}

function zeroVersion(): number {
  return 0
}
