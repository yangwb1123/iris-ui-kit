import { Show, For, type JSX } from 'solid-js'
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
  class?: string
  style?: JSX.CSSProperties
}

/** Line (or area) chart rendered as plain themed SVG over the core geometry. */
export function IrisLineChart(props: IrisLineChartProps) {
  const width = () => props.width ?? 320
  const height = () => props.height ?? 160
  const nice = () => props.nice ?? true

  const box = () => {
    const dim: ChartDimensions = { width: width(), height: height(), padding: 8 }
    return plotBox(dim)
  }
  const points = () => {
    const raw = dataDomain(props.data)
    const domain = nice() ? niceDomain(raw.min, raw.max) : raw
    return seriesPoints(props.data, domain, box())
  }

  return (
    <svg
      data-iris-chart="line"
      role="img"
      aria-label={props.ariaLabel ?? 'Line chart'}
      width={width()}
      height={height()}
      viewBox={`0 0 ${width()} ${height()}`}
      class={props.class}
      style={props.style}
    >
      <Show when={props.area ?? false}>
        <path d={areaPath(points(), box())} fill="var(--iris-chart-area)" stroke="none" />
      </Show>
      <path
        d={linePath(points())}
        fill="none"
        stroke="var(--iris-chart-line)"
        stroke-width={2}
        stroke-linejoin="round"
        stroke-linecap="round"
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
  class?: string
  style?: JSX.CSSProperties
}

/** Vertical bar chart rendered as themed SVG over the core geometry. */
export function IrisBarChart(props: IrisBarChartProps) {
  const width = () => props.width ?? 320
  const height = () => props.height ?? 160
  const nice = () => props.nice ?? true
  const gap = () => props.gap ?? 0.2

  const rects = () => {
    const box = plotBox({ width: width(), height: height(), padding: 8 })
    const raw = dataDomain(props.data)
    const domain = nice() ? niceDomain(Math.min(0, raw.min), raw.max) : raw
    return barRects(props.data, domain, box, gap())
  }

  return (
    <svg
      data-iris-chart="bar"
      role="img"
      aria-label={props.ariaLabel ?? 'Bar chart'}
      width={width()}
      height={height()}
      viewBox={`0 0 ${width()} ${height()}`}
      class={props.class}
      style={props.style}
    >
      <For each={rects()}>
        {(r) => (
          <rect x={r.x} y={r.y} width={r.width} height={r.height} fill="var(--iris-chart-bar)" />
        )}
      </For>
    </svg>
  )
}

export interface IrisSparklineProps {
  data: number[]
  width?: number
  height?: number
  ariaLabel?: string
  class?: string
  style?: JSX.CSSProperties
}

/** Compact, axis-less inline trend line (for tables / stat cards). */
export function IrisSparkline(props: IrisSparklineProps) {
  const width = () => props.width ?? 96
  const height = () => props.height ?? 24

  const points = () => {
    const box = plotBox({ width: width(), height: height(), padding: 2 })
    const domain = dataDomain(props.data)
    return seriesPoints(props.data, domain, box)
  }

  return (
    <svg
      data-iris-chart="sparkline"
      role="img"
      aria-label={props.ariaLabel ?? 'Sparkline'}
      width={width()}
      height={height()}
      viewBox={`0 0 ${width()} ${height()}`}
      class={props.class}
      style={{ display: 'inline-block', 'vertical-align': 'middle', ...props.style }}
    >
      <path
        d={linePath(points())}
        fill="none"
        stroke="var(--iris-chart-line)"
        stroke-width={1.5}
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </svg>
  )
}
