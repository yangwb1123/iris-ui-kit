import * as React from 'react'
import {
  plotBox,
  dataDomain,
  niceDomain,
  seriesPoints,
  linePath,
  areaPath,
  barRects,
  type ChartDimensions,
} from '../core'

export interface IrisLineChartProps {
  /** The numeric series to plot. */
  data: number[]
  width?: number
  height?: number
  /** Fill the area under the line. Default false. */
  area?: boolean
  /** Round the Y domain to nice bounds. Default true. */
  nice?: boolean
  /** Accessible description of the chart. */
  ariaLabel?: string
  className?: string
  style?: React.CSSProperties
}

/** Line (or area) chart rendered as plain themed SVG over the core geometry. */
export function IrisLineChart({
  data,
  width = 320,
  height = 160,
  area = false,
  nice = true,
  ariaLabel = 'Line chart',
  className,
  style,
}: IrisLineChartProps) {
  const dim: ChartDimensions = { width, height, padding: 8 }
  const box = plotBox(dim)
  const raw = dataDomain(data)
  const domain = nice ? niceDomain(raw.min, raw.max) : raw
  const points = seriesPoints(data, domain, box)

  return (
    <svg
      data-iris-chart="line"
      role="img"
      aria-label={ariaLabel}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={style}
    >
      {area && <path d={areaPath(points, box)} fill="var(--iris-chart-area)" stroke="none" />}
      <path
        d={linePath(points)}
        fill="none"
        stroke="var(--iris-chart-line)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export interface IrisBarChartProps {
  data: number[]
  width?: number
  height?: number
  nice?: boolean
  /** Fractional gap between bars (0..1). Default 0.2. */
  gap?: number
  ariaLabel?: string
  className?: string
  style?: React.CSSProperties
}

/** Vertical bar chart rendered as themed SVG over the core geometry. */
export function IrisBarChart({
  data,
  width = 320,
  height = 160,
  nice = true,
  gap = 0.2,
  ariaLabel = 'Bar chart',
  className,
  style,
}: IrisBarChartProps) {
  const box = plotBox({ width, height, padding: 8 })
  const raw = dataDomain(data)
  const domain = nice ? niceDomain(Math.min(0, raw.min), raw.max) : raw
  const rects = barRects(data, domain, box, gap)

  return (
    <svg
      data-iris-chart="bar"
      role="img"
      aria-label={ariaLabel}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={style}
    >
      {rects.map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          fill="var(--iris-chart-bar)"
        />
      ))}
    </svg>
  )
}

export interface IrisSparklineProps {
  data: number[]
  width?: number
  height?: number
  ariaLabel?: string
  className?: string
  style?: React.CSSProperties
}

/** Compact, axis-less inline trend line (for tables / stat cards). */
export function IrisSparkline({
  data,
  width = 96,
  height = 24,
  ariaLabel = 'Sparkline',
  className,
  style,
}: IrisSparklineProps) {
  const box = plotBox({ width, height, padding: 2 })
  const domain = dataDomain(data)
  const points = seriesPoints(data, domain, box)

  return (
    <svg
      data-iris-chart="sparkline"
      role="img"
      aria-label={ariaLabel}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      <path
        d={linePath(points)}
        fill="none"
        stroke="var(--iris-chart-line)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
