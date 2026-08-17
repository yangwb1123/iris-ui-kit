import * as React from 'react'
import { createPortal } from 'react-dom'
import {
  formatClock,
  type AuditLog,
  type AuditLogEntry,
  type AuditLogType,
  type VersionHistory,
  type VersionHistoryEntry,
} from '@iris-ui-kit/core'

interface TableEditHistoryPanelProps<Row extends Record<string, unknown>> {
  open: boolean
  /** The version ring (batch BA), or null when the `versionHistory` prop is
   * off — fail-closed: an off layer contributes NOTHING to the timeline. */
  history: VersionHistory<Row> | null
  /** The audit ring (batch AT), or null when the `auditLog` prop is off —
   * fail-closed: an off layer contributes NOTHING to the timeline. */
  audit: AuditLog | null
  /** Restore the rows captured before a version's commit (Table replays the
   * normal write-back channel and closes the panel after). */
  onRestore: (index: number) => void
  onClose: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}

/** One row of the merged edit-history timeline. */
export type EditHistoryTimelineItem<Row> =
  | { kind: 'version'; at: number; type: AuditLogType; entry: VersionHistoryEntry<Row> }
  | { kind: 'audit'; at: number; type: AuditLogType; entry: AuditLogEntry }

/**
 * Merge the version ring and the audit ring into ONE timeline view, newest
 * first. Both rings are individually newest-first; a stable two-pointer merge
 * keeps that globally. Same-ms ties list the AUDIT entry first — the
 * deterministic record-order arbitration (per commit the rings are recorded
 * in the same order, so the tie-break never depends on wall-clock luck).
 */
export function mergeEditTimeline<Row>(
  versions: readonly VersionHistoryEntry<Row>[],
  audits: readonly AuditLogEntry[],
): EditHistoryTimelineItem<Row>[] {
  const out: EditHistoryTimelineItem<Row>[] = []
  let v = 0
  let a = 0
  while (v < versions.length || a < audits.length) {
    const version = versions[v]
    const audit = audits[a]
    if (version === undefined) {
      out.push({ kind: 'audit', at: audit!.at, type: audit!.type, entry: audit! })
      a += 1
      continue
    }
    if (audit === undefined) {
      out.push({ kind: 'version', at: version.at, type: version.type, entry: version })
      v += 1
      continue
    }
    if (audit.at >= version.at) {
      out.push({ kind: 'audit', at: audit.at, type: audit.type, entry: audit })
      a += 1
    } else {
      out.push({ kind: 'version', at: version.at, type: version.type, entry: version })
      v += 1
    }
  }
  return out
}

// Stable no-op bindings for a null controller (an off recording layer must
// not subscribe to anything — fail-closed).
const emptySubscribe = (): (() => void) => () => undefined
const emptySnapshot = (): number => 0

/**
 * Fixed right-side edit-history sidebar (batch DB, iris 独有 — vxe has no
 * edit history). Opened from the toolbar trigger (`data-iris-edit-sidebar-trigger`,
 * ⏳ after the version-history trigger) via a portal; `position: fixed` pins
 * it to the viewport's inline-end edge at 360px — no backdrop, non-modal
 * (the table stays interactive). Esc / outside pointer-down / any scroll
 * close it; the trigger is EXCLUDED from the outside-pointer-down close so a
 * press on it toggles instead of closing-then-reopening.
 *
 * Content: the version ring and the audit ring merged into ONE newest-first
 * timeline (see {@link mergeEditTimeline}). A version entry renders
 * `#index + formatClock + type` and is CLICKABLE — pressing it restores
 * those rows (replayed through the normal write-back channel, auditable and
 * undoable, without pushing a new version) and the Table closes the panel.
 * An audit entry renders `#seq + formatClock + type + rowKey + column +
 * muted old→new` (row-level ops carry only the rowKey, like the audit
 * panel). Propagation is fail-closed: `history: null` / `audit: null`
 * contribute nothing, so the timeline shows exactly what the `versionHistory`
 * / `auditLog` props admitted — neither layer on → the empty state (the
 * record layers are never implicitly enabled). The list is scrollable so a
 * full ring stays navigable.
 *
 * Reactivity: `useSyncExternalStore` on BOTH controllers (with stable
 * no-op bindings for null ones) — the panel re-renders on push/clear even
 * without the parent re-rendering, so a commit while it is open appends to
 * the timeline in place.
 */
export function TableEditHistoryPanel<Row extends Record<string, unknown>>({
  open,
  history,
  audit,
  onRestore,
  onClose,
  t,
}: TableEditHistoryPanelProps<Row>): React.ReactElement | null {
  // Re-render on every push/clear from EITHER ring (the controllers emit +
  // bump their version counters).
  const historyTick = React.useSyncExternalStore(
    history ? history.subscribe : emptySubscribe,
    history ? history.getVersion : emptySnapshot,
    history ? history.getVersion : emptySnapshot,
  )
  const auditTick = React.useSyncExternalStore(
    audit ? audit.subscribe : emptySubscribe,
    audit ? audit.getVersion : emptySnapshot,
    audit ? audit.getVersion : emptySnapshot,
  )
  void historyTick
  void auditTick
  const items = mergeEditTimeline(history ? history.list() : [], audit ? audit.list() : [])

  // Esc / outside pointer-down / any scroll close the panel.
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const onDown = (e: PointerEvent): void => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('[data-iris-edit-sidebar-panel], [data-iris-edit-sidebar-trigger]')) return
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
      role="dialog"
      aria-label={t('table.editSidebar')}
      data-iris-edit-sidebar-panel=""
      style={{
        position: 'fixed',
        insetInlineEnd: 0,
        top: 0,
        height: '100vh',
        width: 360,
        zIndex: 'var(--iris-z-popover, 1000)',
        background: 'var(--iris-surface-floating, var(--iris-surface))',
        color: 'var(--iris-foreground)',
        borderInlineStart: '1px solid var(--iris-border)',
        boxShadow: 'var(--iris-shadow-lg)',
        padding: 'var(--iris-space-sm, 12px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-space-xs, 8px)',
        fontSize: 'var(--iris-font-size-sm, 13px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--iris-space-xs, 8px)' }}>
        <span style={{ fontWeight: 600, flex: 1 }}>{t('table.editSidebar')}</span>
      </div>
      {items.length === 0 ? (
        <div
          data-iris-edit-sidebar-empty=""
          style={{
            color: 'var(--iris-muted)',
            textAlign: 'center',
            padding: 'var(--iris-space-sm, 12px)',
          }}
        >
          {t('table.editSidebar.empty')}
        </div>
      ) : (
        <div
          data-iris-edit-sidebar-entries=""
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--iris-space-xxs, 4px)',
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
          }}
        >
          {items.map((item) =>
            item.kind === 'version' ? (
              <button
                key={`v-${item.entry.index}`}
                type="button"
                data-iris-edit-sidebar-item=""
                data-iris-edit-sidebar-version=""
                onClick={() => onRestore(item.entry.index)}
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
                <span
                  data-iris-edit-sidebar-index=""
                  style={{ color: 'var(--iris-muted)', minWidth: 30 }}
                >
                  #{item.entry.index}
                </span>
                <span
                  data-iris-edit-sidebar-time=""
                  style={{ color: 'var(--iris-muted)', minWidth: 64 }}
                >
                  {formatClock(new Date(item.at))}
                </span>
                <span
                  data-iris-edit-sidebar-type=""
                  style={{
                    color: 'var(--iris-primary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  {item.type}
                </span>
              </button>
            ) : (
              <div
                key={`a-${item.entry.seq}`}
                data-iris-edit-sidebar-item=""
                data-iris-edit-sidebar-audit=""
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 'var(--iris-space-xs, 8px)',
                  padding: 'var(--iris-space-xxs, 4px) 0',
                  borderBottom: '1px solid var(--iris-border-subtle, var(--iris-border))',
                  fontSize: 'var(--iris-font-size-xs, 12px)',
                }}
              >
                <span
                  data-iris-edit-sidebar-seq=""
                  style={{ color: 'var(--iris-muted)', minWidth: 30 }}
                >
                  #{item.entry.seq}
                </span>
                <span
                  data-iris-edit-sidebar-time=""
                  style={{ color: 'var(--iris-muted)', minWidth: 64 }}
                >
                  {formatClock(new Date(item.at))}
                </span>
                <span
                  data-iris-edit-sidebar-type=""
                  style={{
                    color: 'var(--iris-primary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  {item.type}
                </span>
                <span data-iris-edit-sidebar-rowkey="" style={{ color: 'var(--iris-foreground)' }}>
                  {item.entry.rowKey !== undefined ? String(item.entry.rowKey) : '—'}
                </span>
                {item.entry.column !== undefined ? (
                  <span
                    data-iris-edit-sidebar-cell=""
                    style={{ color: 'var(--iris-muted)', flex: 1 }}
                  >
                    {item.entry.column}
                    <span
                      style={{
                        display: 'inline-flex',
                        gap: 'var(--iris-space-xxs, 4px)',
                        marginInlineStart: 'var(--iris-space-xs, 8px)',
                      }}
                    >
                      <span data-iris-edit-sidebar-old="">{String(item.entry.oldValue ?? '')}</span>
                      <span aria-hidden="true">→</span>
                      <span data-iris-edit-sidebar-new="">{String(item.entry.newValue ?? '')}</span>
                    </span>
                  </span>
                ) : null}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
