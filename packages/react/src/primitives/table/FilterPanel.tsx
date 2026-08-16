import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import { IrisCheckbox } from '../checkbox/Checkbox'
import type { RecentFilterEntry } from '@iris-ui-kit/core'
import type { IrisTableColumn, IrisTableFilterOption } from './types'

interface TableFilterPanelProps<Row extends Record<string, unknown>> {
  open: boolean
  /**
   * The header trigger button — a REAL DOM node, so it doubles as the floating
   * anchor directly (no virtual anchor needed, unlike the context menu).
   */
  anchorRef: React.RefObject<HTMLButtonElement | null>
  columnKey: string
  options: IrisTableFilterOption[]
  /** Checked values when the panel opened (seeded once; draft semantics). */
  initialChecked: string[]
  /** Confirm writes the draft (and closes). */
  onApply: (columnKey: string, values: string[]) => void
  /** Clear applies an empty set immediately (and closes). */
  onClear: (columnKey: string) => void
  onClose: () => void
  t: (key: string) => string
  /**
   * Recent filter entries (batch CB, iris 独有) — a snapshot taken at open
   * (the panel remounts per open via `key={filterPanelSeq}`, so no live
   * subscription is needed). Rendered above the options; empty hides the
   * section entirely (byte-identical panel when `recentFilters` is off).
   */
  recent: readonly RecentFilterEntry[]
  /** Clicking a recent entry applies it immediately (across columns) and closes. */
  onApplyRecent: (entry: RecentFilterEntry) => void
  /** Display columns — resolves each recent entry's label (title + option labels). */
  columns: readonly IrisTableColumn<Row>[]
}

/** Resolve a recent entry's display label: `列标题: 选项label, …`; unknown
 * column → raw values joined (fail-inert — the entry still applies). */
function recentLabel<Row extends Record<string, unknown>>(
  entry: RecentFilterEntry,
  columns: readonly IrisTableColumn<Row>[],
): string {
  const col = columns.find((c) => c.key === entry.key)
  if (!col) return entry.values.join(', ')
  const title = col.title ?? entry.key
  const labels = entry.values.map((v) => {
    const opt = col.filterOptions?.find((o) => o.value === v)
    return opt ? opt.label : v
  })
  return `${title}: ${labels.join(', ')}`
}

/**
 * Header filter panel for `IrisTable` (vxe-grid filterConfig parity, batch I).
 * Self-drawn with the same building blocks `IrisMenuContent` uses —
 * `useFloating` + `useDismiss` — because it floats below the header trigger
 * button rather than being owned by a trigger-primitive.
 *
 * Positioning: anchored to the real trigger button (`placement: bottom-start`).
 * Dismissal: Escape, outside pointer-down (useDismiss), and any scroll
 * (capture-phase document listener — nested scrollers count too). Rendered
 * through a portal to `document.body` so the table's `overflow` clipping never
 * cuts it.
 *
 * Draft semantics: checking options edits a local draft; 确认 (confirm) writes
 * it through `onApply`, 清除 (clear) writes an empty set through `onClear`
 * immediately, and any dismissal discards the draft.
 *
 * Recent filters (batch CB, iris 独有): when the table's `recentFilters` is
 * on, the panel renders the recent entries above the options (muted title +
 * one button per entry, `data-iris-filter-recent={i}`). Clicking an entry
 * applies it through `onApplyRecent` — possibly across columns — and closes.
 */
export function TableFilterPanel<Row extends Record<string, unknown>>({
  open,
  anchorRef,
  columnKey,
  options,
  initialChecked,
  onApply,
  onClear,
  onClose,
  t,
  recent,
  onApplyRecent,
  columns,
}: TableFilterPanelProps<Row>): React.ReactElement | null {
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const [checked, setChecked] = React.useState<string[]>(initialChecked)

  const { floatingStyles } = useFloating({
    anchor: anchorRef,
    floating: panelRef,
    open,
    placement: 'bottom-start',
  })

  useDismiss({
    enabled: open,
    exclude: [panelRef, anchorRef],
    onDismiss: onClose,
  })

  // Scroll anywhere closes the panel. Capture phase so scrolling inside any
  // nested scroll container (or the table itself) also counts.
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const onScroll = (): void => onCloseRef.current()
    document.addEventListener('scroll', onScroll, true)
    return () => document.removeEventListener('scroll', onScroll, true)
  }, [open])

  const toggle = (value: string): void => {
    setChecked((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  if (!open) return null

  const node = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t('table.filter')}
      data-iris-table-filter-panel=""
      data-iris-table-filter-column={columnKey}
      style={{
        ...floatingStyles,
        zIndex: 'var(--iris-z-popover, 1000)',
        background: 'var(--iris-surface-floating, var(--iris-surface))',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        boxShadow: 'var(--iris-shadow-lg)',
        padding: 'var(--iris-space-sm, 12px)',
        minWidth: 180,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-space-xxs, 4px)',
      }}
    >
      {recent.length > 0 ? (
        <>
          <div
            data-iris-filter-recent-title=""
            style={{
              color: 'var(--iris-muted)',
              fontSize: 'var(--iris-font-size-xs, 11px)',
              marginTop: 'var(--iris-space-xxs, 4px)',
            }}
          >
            {t('table.recentFilters')}
          </div>
          {recent.map((entry, i) => (
            <button
              key={`${entry.key}:${i}`}
              type="button"
              data-iris-filter-recent={i}
              onClick={() => onApplyRecent(entry)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--iris-foreground)',
                cursor: 'pointer',
                font: 'inherit',
                fontSize: 'var(--iris-font-size-sm, 13px)',
                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                borderRadius: 'var(--iris-radius-sm, 4px)',
                textAlign: 'left',
              }}
            >
              {recentLabel(entry, columns)}
            </button>
          ))}
          <div
            style={{
              borderTop: '1px solid var(--iris-border)',
              margin: 'var(--iris-space-xxs, 4px) 0',
            }}
          />
        </>
      ) : null}
      {options.map((opt) => (
        <div
          key={opt.value}
          data-iris-filter-option={opt.value}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <IrisCheckbox
            checked={checked.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            size="sm"
          >
            {opt.label}
          </IrisCheckbox>
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--iris-space-xs, 8px)',
          marginTop: 'var(--iris-space-xs, 8px)',
        }}
      >
        <button
          type="button"
          data-iris-filter-clear=""
          onClick={() => {
            onClear(columnKey)
            onClose()
          }}
          style={{
            border: '1px solid var(--iris-border)',
            background: 'transparent',
            color: 'var(--iris-foreground)',
            cursor: 'pointer',
            font: 'inherit',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
            borderRadius: 'var(--iris-radius-sm, 4px)',
          }}
        >
          {t('table.filterClear')}
        </button>
        <button
          type="button"
          data-iris-filter-confirm=""
          onClick={() => {
            onApply(columnKey, checked)
            onClose()
          }}
          style={{
            border: '1px solid var(--iris-primary)',
            background: 'var(--iris-primary)',
            color: 'var(--iris-primary-foreground, #fff)',
            cursor: 'pointer',
            font: 'inherit',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
            borderRadius: 'var(--iris-radius-sm, 4px)',
          }}
        >
          {t('table.filterConfirm')}
        </button>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
