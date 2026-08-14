import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { buildChartData } from '@iris-ui-kit/core'
import { IrisSelect } from '../select/Select'
import type { IrisTableColumn } from './types'

/** Values charted before the muted "共 N 行" fold (mirrors DISTRIBUTION_TOP). */
const CHART_TOP = 20
/** Mini-chart SVG geometry in viewBox units — the panel owns all pixel math
 * (core `buildChartData` returns raw values + domain only, never SVG
 * strings). */
const CHART_W = 300
const CHART_H = 120
const CHART_PAD = 8

/** x of the i-th point (0-based) over `count` points. */
function chartX(i: number, count: number): number {
  if (count <= 1) return CHART_W / 2
  return CHART_PAD + (i / (count - 1)) * (CHART_W - 2 * CHART_PAD)
}

/** y of value `v` within the padded [min, max] domain (never a zero span). */
function chartY(v: number, min: number, max: number): number {
  const span = max - min
  return CHART_H - CHART_PAD - ((v - min) / span) * (CHART_H - 2 * CHART_PAD)
}

/** Bar baseline: the zero line when the domain spans it, else the plot edge
 * nearest zero — negative bars hang below the baseline. */
function chartBaseline(min: number, max: number): number {
  if (min >= 0) return CHART_H - CHART_PAD
  if (max <= 0) return CHART_PAD
  return chartY(0, min, max)
}

/** Contiguous runs of finite points → polyline segments (a null point breaks
 * the line; each run renders its own polyline). */
function chartSegments(
  points: ReadonlyArray<number | null>,
  min: number,
  max: number,
): Array<Array<[number, number]>> {
  const segments: Array<Array<[number, number]>> = []
  let current: Array<[number, number]> | null = null
  points.forEach((p, i) => {
    if (p === null) {
      current = null
      return
    }
    if (current === null) {
      current = []
      segments.push(current)
    }
    current.push([chartX(i, points.length), chartY(p, min, max)])
  })
  return segments
}

interface TableChartPanelProps<Row extends Record<string, unknown>> {
  open: boolean
  /** Anchor: the toolbar chart trigger button (a real DOM node). */
  anchorRef: React.RefObject<HTMLElement | null>
  /** Rows charted — the table's CURRENT filtered rows. */
  rows: readonly Row[]
  /** Numeric leaf columns (table-side detection via getCellValue / summary). */
  columns: ReadonlyArray<IrisTableColumn<Row>>
  onClose: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}

/**
 * Floating mini-chart panel (batch AR, iris 独有 — vxe has no equivalent; its
 * closest analog is a hand-built sparkline that never sees the table's
 * filtered view). Opens from the toolbar trigger (`data-iris-chart-trigger`)
 * and floats below it (`useFloating` + portal, like `TableDistributionPanel`),
 * closing on Escape / outside pointer-down / any scroll.
 *
 * Content: an `IrisSelect` over the NUMERIC leaf columns (the two existing
 * signals — a row whose `getCellValue` is a number, or a `summary: 'sum'`
 * column — resolved table-side where `getCellValue` lives) plus a bar/line
 * kind toggle (`table.chart.bar` / `table.chart.line`). The SVG (viewBox
 * 0 0 300 120) is STRUCTURED JSX ONLY — no SVG strings, no
 * `dangerouslySetInnerHTML`: core `buildChartData` over the first 20 values
 * yields `{ points, min, max }`, and this component maps values to pixels —
 * bars (fill `var(--iris-primary)`, width computed from the slot), line
 * polylines (nulls break the line) + circles. Value labels are omitted by
 * design (a mini chart); a muted "共 N 行" note (`table.total`) appears when
 * rows were truncated.
 *
 * Dismissal wiring follows the batch-edit panel precedent (Table.tsx:5025):
 * the column select's listbox is PORTALED to `<body>`, so a press on an
 * option must select instead of closing the panel — the window-bubble
 * listener excludes `[data-iris-select-option]`.
 */
export function TableChartPanel<Row extends Record<string, unknown>>({
  open,
  anchorRef,
  rows,
  columns,
  onClose,
  t,
}: TableChartPanelProps<Row>): React.ReactElement | null {
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const [colKey, setColKey] = React.useState('')
  const [kind, setKind] = React.useState<'bar' | 'line'>('bar')

  const { floatingStyles } = useFloating({
    anchor: anchorRef,
    floating: panelRef,
    open,
    placement: 'bottom-end',
    flip: false,
    shift: true,
  })

  // Esc / outside pointer-down / any scroll close the panel. Option presses
  // inside the select's PORTALED listbox are excluded — they must select.
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const onDown = (e: PointerEvent): void => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('[data-iris-chart-panel], [data-iris-select-option]')) return
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

  // Column value indirection: `dataIndex ?? key` — the same getCellValue
  // indirection the table uses everywhere. Falls back to the first numeric
  // column when the stored key is stale (columns changed under the panel).
  const valueKeyOf = (col: IrisTableColumn<Row>): string => (col.dataIndex ?? col.key) as string
  const selectedKey = columns.some((c) => valueKeyOf(c) === colKey)
    ? colKey
    : columns.length > 0
      ? valueKeyOf(columns[0]!)
      : ''
  const chart = React.useMemo(
    () => (selectedKey ? buildChartData(rows, selectedKey) : { points: [], min: 0, max: 1 }),
    [rows, selectedKey],
  )
  const visible = chart.points.slice(0, CHART_TOP)
  const baseline = chartBaseline(chart.min, chart.max)
  const segments = chartSegments(visible, chart.min, chart.max)

  if (!open) return null

  const node = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t('table.chart')}
      data-iris-chart-panel=""
      style={{
        ...floatingStyles,
        zIndex: 'var(--iris-z-popover, 1000)',
        background: 'var(--iris-surface-floating, var(--iris-surface))',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        boxShadow: 'var(--iris-shadow-lg)',
        padding: 'var(--iris-space-sm, 12px)',
        minWidth: 260,
        maxWidth: 320,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-space-xs, 8px)',
        fontSize: 'var(--iris-font-size-sm, 13px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--iris-space-xs, 8px)' }}>
        <IrisSelect
          items={columns.map((c) => ({ value: valueKeyOf(c), label: c.title ?? c.key }))}
          value={selectedKey}
          onValueChange={(v) => setColKey(String(v ?? ''))}
          size="sm"
          style={{ flex: 1, minWidth: 0 }}
          aria-label={t('table.chart')}
        />
        <div style={{ display: 'flex', gap: 'var(--iris-space-xxs, 4px)' }}>
          <button
            type="button"
            data-iris-chart-kind-bar=""
            aria-pressed={kind === 'bar'}
            onClick={() => setKind('bar')}
            style={{
              border: '1px solid var(--iris-border)',
              borderRadius: 'var(--iris-radius-sm, 4px)',
              background:
                kind === 'bar'
                  ? 'var(--iris-surface-selected, var(--iris-surface-hover))'
                  : 'transparent',
              color: 'var(--iris-foreground)',
              cursor: 'pointer',
              padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
              fontSize: 'var(--iris-font-size-xs, 12px)',
            }}
          >
            {t('table.chart.bar')}
          </button>
          <button
            type="button"
            data-iris-chart-kind-line=""
            aria-pressed={kind === 'line'}
            onClick={() => setKind('line')}
            style={{
              border: '1px solid var(--iris-border)',
              borderRadius: 'var(--iris-radius-sm, 4px)',
              background:
                kind === 'line'
                  ? 'var(--iris-surface-selected, var(--iris-surface-hover))'
                  : 'transparent',
              color: 'var(--iris-foreground)',
              cursor: 'pointer',
              padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
              fontSize: 'var(--iris-font-size-xs, 12px)',
            }}
          >
            {t('table.chart.line')}
          </button>
        </div>
      </div>
      {selectedKey === '' ? (
        <div
          data-iris-chart-empty=""
          style={{
            color: 'var(--iris-muted)',
            textAlign: 'center',
            padding: 'var(--iris-space-sm, 12px)',
          }}
        >
          —
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          width="100%"
          height="100%"
          role="img"
          aria-label={`${t('table.chart')} — ${columns.find((c) => valueKeyOf(c) === selectedKey)?.title ?? selectedKey}`}
          data-iris-chart-svg=""
          style={{ width: '100%', height: 120, display: 'block' }}
        >
          {kind === 'bar' ? (
            visible.map((p, i) => {
              if (p === null) return null
              const slot = (CHART_W - 2 * CHART_PAD) / Math.max(visible.length, 1)
              const width = Math.max(2, slot * 0.6)
              const y = chartY(p, chart.min, chart.max)
              return (
                <rect
                  key={i}
                  x={chartX(i, visible.length) - width / 2}
                  y={Math.min(y, baseline)}
                  width={width}
                  height={Math.abs(y - baseline)}
                  fill="var(--iris-primary)"
                  data-iris-chart-bar={i}
                />
              )
            })
          ) : (
            <>
              {segments.map((seg, s) => (
                <polyline
                  key={s}
                  points={seg.map(([x, y]) => `${x},${y}`).join(' ')}
                  fill="none"
                  stroke="var(--iris-primary)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  data-iris-chart-polyline=""
                />
              ))}
              {visible.map((p, i) => {
                if (p === null) return null
                return (
                  <circle
                    key={i}
                    cx={chartX(i, visible.length)}
                    cy={chartY(p, chart.min, chart.max)}
                    r={3}
                    fill="var(--iris-surface)"
                    stroke="var(--iris-primary)"
                    strokeWidth={1.5}
                    data-iris-chart-dot={i}
                  />
                )
              })}
            </>
          )}
        </svg>
      )}
      {rows.length > CHART_TOP ? (
        <div
          data-iris-chart-truncated=""
          style={{
            color: 'var(--iris-muted)',
            fontSize: 'var(--iris-font-size-xs, 12px)',
            textAlign: 'right',
          }}
        >
          {t('table.total', { total: rows.length })}
        </div>
      ) : null}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
