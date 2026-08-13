import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import type { RangeColumnStats } from '@iris-ui-kit/core'
import {
  RANGE_STATS_HEADER_STYLE,
  RANGE_STATS_LABEL_STYLE,
  RANGE_STATS_PANEL_STYLE,
  RANGE_STATS_ROW_DIVIDER_STYLE,
  RANGE_STATS_VALUE_STYLE,
} from './styles'

/** One column's stats row for the floating panel (batch AJ, iris 独有): the
 * column's VALUE key (`dataIndex ?? key` — the same indirection getCellValue
 * uses), its display title, and the core-computed stats. */
export interface RangeStatsEntry {
  key: string
  title: string
  stats: RangeColumnStats
}

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
  /** Stats panel open. Hoisted to the table: the bar remounts on every range
   * change, so the open state must survive remounts for the panel to stay
   * open while its stats recompute for the new range. */
  statsOpen: boolean
  /** Toggle the stats panel (统计 button). */
  onToggleStats: () => void
  /** Per-column stats for the CURRENT range, in range column order. Null when
   * no range is active (the bar itself only renders with a range anyway). */
  stats: RangeStatsEntry[] | null
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

/** A numeric stat renders its value; a null (no numeric data) renders an
 * em dash so the panel never shows a misleading 0/NaN. */
function formatStat(value: number | null): string {
  return value === null ? '—' : String(value)
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
 * `useDismiss` → `onDismiss` (the table's `clearRange`), which makes the bar
 * disappear because its visibility derives from the range store. No close
 * button (the spec fiat — the bar only exists while a range exists).
 * Batch AJ adds the 统计 toggle: a mini per-column stats panel (count/sum/
 * avg/min/max) rendered INSIDE the bar container, absolutely BELOW it. It
 * rides the bar's existing useDismiss, so outside click / Escape (which clear
 * the range) close it too; the table resets `statsOpen` on dismiss.
 */
export function RangeToolbar({
  open,
  anchorRef,
  onCopy,
  onExport,
  onClear,
  onDismiss,
  t,
  statsOpen,
  onToggleStats,
  stats,
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
      aria-label={t('table.range.toolbar')}
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
      <button
        type="button"
        data-iris-range-stats=""
        onClick={onToggleStats}
        aria-expanded={statsOpen && stats != null && stats.length > 0}
        style={BAR_BUTTON_STYLE}
      >
        {t('table.range.stats')}
      </button>
      {statsOpen && stats && stats.length > 0 ? (
        <div
          data-iris-range-stats-panel=""
          role="table"
          aria-label={t('table.range.stats')}
          style={RANGE_STATS_PANEL_STYLE}
        >
          <div role="row" style={RANGE_STATS_HEADER_STYLE}>
            <div role="columnheader" style={RANGE_STATS_LABEL_STYLE}>
              {t('table.range.statsColumn')}
            </div>
            <div role="columnheader" style={RANGE_STATS_VALUE_STYLE}>
              {t('table.range.statsCount')}
            </div>
            <div role="columnheader" style={RANGE_STATS_VALUE_STYLE}>
              {t('table.range.statsSum')}
            </div>
            <div role="columnheader" style={RANGE_STATS_VALUE_STYLE}>
              {t('table.range.statsAvg')}
            </div>
            <div role="columnheader" style={RANGE_STATS_VALUE_STYLE}>
              {t('table.range.statsMin')}
            </div>
            <div role="columnheader" style={RANGE_STATS_VALUE_STYLE}>
              {t('table.range.statsMax')}
            </div>
          </div>
          {stats.map((entry) => (
            <div role="row" key={entry.key} style={RANGE_STATS_ROW_DIVIDER_STYLE}>
              <div role="cell" style={RANGE_STATS_LABEL_STYLE}>
                {entry.title}
              </div>
              <div role="cell" style={RANGE_STATS_VALUE_STYLE}>
                {entry.stats.count}
              </div>
              <div role="cell" style={RANGE_STATS_VALUE_STYLE}>
                {formatStat(entry.stats.sum)}
              </div>
              <div role="cell" style={RANGE_STATS_VALUE_STYLE}>
                {formatStat(entry.stats.avg)}
              </div>
              <div role="cell" style={RANGE_STATS_VALUE_STYLE}>
                {formatStat(entry.stats.min)}
              </div>
              <div role="cell" style={RANGE_STATS_VALUE_STYLE}>
                {formatStat(entry.stats.max)}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
