import {
  defineComponent,
  h,
  onMounted,
  onScopeDispose,
  ref,
  Teleport,
  type PropType,
  type Ref,
  type VNode,
} from 'vue'
import { formatClock, type AuditLog, type AuditLogEntry } from '@iris-ui-kit/core'
import type { UseI18nReturn } from '../../i18n'

type Translate = UseI18nReturn['t']

/**
 * Light audit diff (batch EN, mirror react batch AT): compare the PREVIOUS
 * row list against the NEXT and resolve the FIRST changed row + FIRST changed
 * cell, so each row-list mutation commit records exactly ONE audit entry
 * (keeps the trail readable and the complexity budget flat).
 *
 * Simplifications (documented, react parity): the walk is index-based — a
 * reorder reads as a structural change at the first index whose keys differ;
 * a row that moved but kept its key reads as a change at its old slot; only
 * the first changed row/cell is kept, not a full cell-level patch. Structural
 * changes (rows added/removed at the index, or key-mismatched rows) carry
 * ONLY the rowKey (no column/old→new — the panel renders those as
 * partial-context rows); same-key rows walk the union of own enumerable
 * fields and record the first differing cell.
 */
export function auditDiff<Row extends Record<string, unknown>>(
  prev: readonly Row[],
  next: readonly Row[],
  resolveKey: (row: Row, index: number) => string | number,
):
  | { rowKey?: string | number; column?: string; oldValue?: unknown; newValue?: unknown }
  | undefined {
  const len = Math.max(prev.length, next.length)
  for (let i = 0; i < len; i += 1) {
    const a = prev[i]
    const b = next[i]
    if (a === b) continue
    if (!a || !b) return { rowKey: a ? resolveKey(a, i) : resolveKey(b!, i) }
    const ka = resolveKey(a, i)
    const kb = resolveKey(b, i)
    if (ka !== kb) {
      // Structural at this index: prefer the key from the side that shrank
      // (removed row) / grew (inserted row) — index-0 inserts report the
      // shifted occupant instead (documented simplification).
      return { rowKey: prev.length > next.length ? ka : kb }
    }
    // Same row — first differing cell across the union of fields.
    const fields = new Set<string>()
    Object.keys(a).forEach((f) => fields.add(f))
    Object.keys(b).forEach((f) => fields.add(f))
    for (const f of fields) {
      if (a[f] !== b[f]) {
        return { rowKey: ka, column: f, oldValue: a[f], newValue: b[f] }
      }
    }
  }
  return undefined
}

export interface AuditPanelSectionContext {
  /** Whether the floating panel is open (the toolbar trigger toggles it). */
  open: Readonly<Ref<boolean>>
  /** The core audit controller (bounded ring, newest-first). */
  audit: AuditLog
  /** Floating UI styles anchored below the toolbar trigger (bottom-end). */
  styles: Readonly<Ref<Record<string, string>>>
  /** Ref receiving the panel root element (for useFloating positioning). */
  panelRef: Ref<HTMLElement | null>
  /** Wipe the trail (the seq counter never resets — audit integrity). */
  onClear: () => void
  t: Translate
}

/**
 * Render the teleported floating audit-log panel (batch EN, iris 独有 — vxe
 * has no audit trail; DOM mirrors react's TableAuditPanel 1:1). The panel is
 * a small component with its OWN subscription to the core controller, so a
 * push/clear while it is open refreshes the entry list IN PLACE without
 * re-rendering the whole table (react useSyncExternalStore parity).
 */
export function renderAuditPanelSection(ctx: AuditPanelSectionContext): VNode | null {
  if (!ctx.open.value) return null
  return h(Teleport, { to: 'body' }, [
    h(TableAuditPanel, {
      audit: ctx.audit,
      styles: ctx.styles.value,
      panelRef: ctx.panelRef,
      onClear: ctx.onClear,
      t: ctx.t,
    }),
  ])
}

/**
 * Floating audit-log panel content (batch EN). Opens from the toolbar trigger
 * (`data-iris-audit-trigger`) and floats below it — the parent wires
 * `useFloating` (placement bottom-end, flip off / shift on) + `useDismiss`
 * (Esc / outside pointer-down, trigger excluded) + capture-scroll close.
 *
 * Content: newest-first entries (the controller's ring is already
 * newest-first) — each row renders `#seq` + `formatClock`-formatted local
 * time + the raw commit type + rowKey + column + a MUTED `old → new` when the
 * diff resolved a changed cell (row-level structural changes — remove /
 * loadData replace — carry only the rowKey, rendered as a partial-context
 * row). A clear button wipes the trail. The list is max-height + scroll so a
 * full ring stays navigable.
 */
const TableAuditPanel = defineComponent({
  name: 'TableAuditPanel',
  props: {
    audit: { type: Object as PropType<AuditLog>, required: true },
    styles: { type: Object as PropType<Record<string, string>>, required: true },
    panelRef: { type: Object as PropType<Ref<HTMLElement | null>>, required: true },
    onClear: { type: Function as PropType<() => void>, required: true },
    t: { type: Function as PropType<Translate>, required: true },
  },
  setup(props) {
    // Re-render on every push/clear: the controller emits + bumps version.
    // The subscription lives HERE (not in Table's setup) so the refresh stays
    // scoped to this component — the table never re-renders from its own
    // recorded audit traffic (react useSyncExternalStore parity).
    const entries = ref<readonly AuditLogEntry[]>(props.audit.list())
    let unsubscribe: (() => void) | null = null
    onMounted(() => {
      unsubscribe = props.audit.subscribe(() => {
        entries.value = props.audit.list()
      })
    })
    onScopeDispose(() => {
      unsubscribe?.()
      unsubscribe = null
    })
    return () => {
      const items = entries.value
      return h(
        'div',
        {
          ref: (el: unknown) => {
            props.panelRef.value = (el ?? null) as HTMLElement | null
          },
          role: 'dialog',
          'aria-label': props.t('table.audit'),
          'data-iris-audit-panel': '',
          style: {
            ...props.styles,
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
          },
        },
        [
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 'var(--iris-space-xs, 8px)' } },
            [
              h('span', { style: { fontWeight: 600, flex: 1 } }, props.t('table.audit')),
              items.length > 0
                ? h(
                    'button',
                    {
                      type: 'button',
                      'data-iris-audit-clear': '',
                      onClick: props.onClear,
                      style: {
                        border: '1px solid var(--iris-border)',
                        borderRadius: 'var(--iris-radius-sm, 4px)',
                        background: 'transparent',
                        color: 'var(--iris-muted)',
                        cursor: 'pointer',
                        padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                        fontSize: 'var(--iris-font-size-xs, 12px)',
                      },
                    },
                    props.t('table.audit.clear'),
                  )
                : null,
            ],
          ),
          items.length === 0
            ? h(
                'div',
                {
                  'data-iris-audit-empty': '',
                  style: {
                    color: 'var(--iris-muted)',
                    textAlign: 'center',
                    padding: 'var(--iris-space-sm, 12px)',
                  },
                },
                props.t('table.audit.empty'),
              )
            : h(
                'div',
                {
                  'data-iris-audit-entries': '',
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--iris-space-xxs, 4px)',
                    maxHeight: 240,
                    overflowY: 'auto',
                  },
                },
                items.map((e) =>
                  h(
                    'div',
                    {
                      key: e.seq,
                      'data-iris-audit-entry': '',
                      style: {
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 'var(--iris-space-xs, 8px)',
                        padding: 'var(--iris-space-xxs, 4px) 0',
                        borderBottom: '1px solid var(--iris-border-subtle, var(--iris-border))',
                        fontSize: 'var(--iris-font-size-xs, 12px)',
                      },
                    },
                    [
                      h(
                        'span',
                        {
                          'data-iris-audit-seq': '',
                          style: { color: 'var(--iris-muted)', minWidth: 30 },
                        },
                        `#${e.seq}`,
                      ),
                      h(
                        'span',
                        {
                          'data-iris-audit-time': '',
                          style: { color: 'var(--iris-muted)', minWidth: 64 },
                        },
                        formatClock(new Date(e.at)),
                      ),
                      h(
                        'span',
                        {
                          'data-iris-audit-type': '',
                          style: {
                            color: 'var(--iris-primary)',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                          },
                        },
                        e.type,
                      ),
                      h(
                        'span',
                        {
                          'data-iris-audit-rowkey': '',
                          style: { color: 'var(--iris-foreground)' },
                        },
                        e.rowKey !== undefined ? String(e.rowKey) : '—',
                      ),
                      e.column !== undefined
                        ? h(
                            'span',
                            {
                              'data-iris-audit-cell': '',
                              style: { color: 'var(--iris-muted)', flex: 1 },
                            },
                            [
                              e.column,
                              h(
                                'span',
                                {
                                  style: {
                                    display: 'inline-flex',
                                    gap: 'var(--iris-space-xxs, 4px)',
                                    marginInlineStart: 'var(--iris-space-xs, 8px)',
                                  },
                                },
                                [
                                  h(
                                    'span',
                                    { 'data-iris-audit-old': '' },
                                    String(e.oldValue ?? ''),
                                  ),
                                  h('span', { 'aria-hidden': 'true' }, '→'),
                                  h(
                                    'span',
                                    { 'data-iris-audit-new': '' },
                                    String(e.newValue ?? ''),
                                  ),
                                ],
                              ),
                            ],
                          )
                        : null,
                    ],
                  ),
                ),
              ),
        ],
      )
    }
  },
})
