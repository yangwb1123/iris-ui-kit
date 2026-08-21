import * as React from 'react'
import {
  multiLineGeometry,
  multiBarGeometry,
  donutGeometry,
  chartTooltipLabel,
  type ChartDirection,
  type ChartSeries,
  type ChartSlice,
  type ChartTooltipItem,
  type ChartLegendItem,
  type BarLayout,
} from '../core'

const chartFigureStyle: React.CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'column',
  gap: 'var(--iris-gap-sm)',
  margin: 0,
}

const chartLegendStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--iris-gap-sm)',
  margin: 0,
  padding: 0,
  color: 'var(--iris-chart-text)',
  fontSize: 'var(--iris-font-size-sm)',
  listStyle: 'none',
}

function ChartLegend({ items, label }: { items: readonly ChartLegendItem[]; label: string }) {
  return (
    <ul data-iris-chart-legend="" aria-label={label} style={chartLegendStyle}>
      {items.map((item) => (
        <li
          key={item.id}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--iris-gap-sm)' }}
        >
          <span
            aria-hidden="true"
            style={{
              inlineSize: '0.75em',
              blockSize: '0.75em',
              borderRadius: 'var(--iris-radius-sm)',
              background: item.color,
            }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

export interface MultiChartBaseProps {
  width?: number
  height?: number
  categories?: readonly string[]
  direction?: ChartDirection
  ariaLabel?: string
  ariaDescription?: string
  legendLabel?: string
  showLegend?: boolean
  className?: string
  style?: React.CSSProperties
  onDatumFocus?: (item: ChartTooltipItem) => void
}

export interface IrisMultiLineChartProps extends MultiChartBaseProps {
  series: readonly ChartSeries[]
  nice?: boolean
  pointRadius?: number
}

/** Accessible, token-themed multi-series line chart over shared core geometry. */
export function IrisMultiLineChart({
  series,
  width = 320,
  height = 180,
  categories = [],
  direction = 'ltr',
  nice = true,
  pointRadius = 3,
  ariaLabel = 'Multi-series line chart',
  ariaDescription,
  legendLabel = 'Chart legend',
  showLegend = true,
  className,
  style,
  onDatumFocus,
}: IrisMultiLineChartProps) {
  const geometry = multiLineGeometry(
    series,
    { width, height, padding: 12 },
    {
      categories,
      direction,
      nice,
    },
  )

  return (
    <figure
      data-iris-chart-container="multi-line"
      className={className}
      dir={direction}
      style={{ ...chartFigureStyle, ...style }}
    >
      <svg
        data-iris-chart="multi-line"
        role="group"
        aria-label={ariaLabel}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <title>{ariaLabel}</title>
        <desc>{ariaDescription ?? geometry.description}</desc>
        {geometry.series.map((item) => (
          <g key={item.id} data-series-id={item.id}>
            {item.path && (
              <path
                data-iris-chart-series-line=""
                d={item.path}
                fill="none"
                stroke={item.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                aria-hidden="true"
              />
            )}
            {item.points.map((point) => {
              const label = chartTooltipLabel(point.tooltip)
              return (
                <circle
                  key={point.id}
                  data-iris-chart-datum=""
                  data-category-index={point.categoryIndex}
                  cx={point.x}
                  cy={point.y}
                  r={Math.max(1, pointRadius)}
                  fill={point.color}
                  stroke="var(--iris-chart-point-stroke)"
                  strokeWidth={1}
                  role="img"
                  tabIndex={0}
                  aria-label={label}
                  onFocus={() => onDatumFocus?.(point.tooltip)}
                >
                  <title>{label}</title>
                </circle>
              )
            })}
          </g>
        ))}
      </svg>
      {showLegend && <ChartLegend items={geometry.legend} label={legendLabel} />}
    </figure>
  )
}

export interface IrisStackedBarChartProps extends MultiChartBaseProps {
  series: readonly ChartSeries[]
  /** Defaults to stacked; grouped uses the same component and core model. */
  layout?: BarLayout
  nice?: boolean
  categoryGap?: number
  seriesGap?: number
}

/** Accessible stacked/grouped bar chart with signed stacking and shared domain. */
export function IrisStackedBarChart({
  series,
  width = 320,
  height = 180,
  categories = [],
  direction = 'ltr',
  layout = 'stacked',
  nice = true,
  categoryGap = 0.2,
  seriesGap = 0.08,
  ariaLabel = 'Stacked bar chart',
  ariaDescription,
  legendLabel = 'Chart legend',
  showLegend = true,
  className,
  style,
  onDatumFocus,
}: IrisStackedBarChartProps) {
  const geometry = multiBarGeometry(
    series,
    { width, height, padding: 12 },
    {
      categories,
      direction,
      layout,
      nice,
      categoryGap,
      seriesGap,
    },
  )

  return (
    <figure
      data-iris-chart-container="stacked-bar"
      className={className}
      dir={direction}
      style={{ ...chartFigureStyle, ...style }}
    >
      <svg
        data-iris-chart="stacked-bar"
        data-layout={geometry.layout}
        role="group"
        aria-label={ariaLabel}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <title>{ariaLabel}</title>
        <desc>{ariaDescription ?? geometry.description}</desc>
        {geometry.rects.map((rect) => {
          const label = chartTooltipLabel(rect.tooltip)
          return (
            <rect
              key={`${rect.seriesId}:${rect.categoryIndex}`}
              data-iris-chart-datum=""
              data-series-id={rect.seriesId}
              data-category-index={rect.categoryIndex}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill={rect.color}
              role="img"
              tabIndex={0}
              aria-label={label}
              onFocus={() => onDatumFocus?.(rect.tooltip)}
            >
              <title>{label}</title>
            </rect>
          )
        })}
      </svg>
      {showLegend && <ChartLegend items={geometry.legend} label={legendLabel} />}
    </figure>
  )
}

export interface IrisDonutChartProps extends Omit<MultiChartBaseProps, 'categories' | 'direction'> {
  data: readonly ChartSlice[]
  innerRadiusRatio?: number
  startAngle?: number
}

/** Accessible donut (or pie at ratio 0) chart with focusable slice tooltips. */
export function IrisDonutChart({
  data,
  width = 220,
  height = 220,
  innerRadiusRatio = 0.6,
  startAngle,
  ariaLabel = 'Donut chart',
  ariaDescription,
  legendLabel = 'Chart legend',
  showLegend = true,
  className,
  style,
  onDatumFocus,
}: IrisDonutChartProps) {
  const geometry = donutGeometry(
    data,
    { width, height, padding: 8 },
    {
      innerRadiusRatio,
      ...(startAngle == null ? {} : { startAngle }),
    },
  )

  return (
    <figure
      data-iris-chart-container="donut"
      className={className}
      style={{ ...chartFigureStyle, ...style }}
    >
      <svg
        data-iris-chart="donut"
        role="group"
        aria-label={ariaLabel}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <title>{ariaLabel}</title>
        <desc>{ariaDescription ?? geometry.description}</desc>
        {geometry.arcs.map((arc) => {
          const label = chartTooltipLabel(arc.tooltip)
          return (
            <path
              key={arc.id}
              data-iris-chart-datum=""
              data-slice-id={arc.id}
              d={arc.path}
              fill={arc.color}
              role="img"
              tabIndex={0}
              aria-label={label}
              onFocus={() => onDatumFocus?.(arc.tooltip)}
            >
              <title>{label}</title>
            </path>
          )
        })}
      </svg>
      {showLegend && <ChartLegend items={geometry.legend} label={legendLabel} />}
    </figure>
  )
}
