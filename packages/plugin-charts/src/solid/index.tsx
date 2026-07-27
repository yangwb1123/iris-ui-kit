import { Show, For, createMemo, type JSX } from 'solid-js'
import {
  plotBox,
  dataDomain,
  niceDomain,
  seriesPoints,
  linePath,
  areaPath,
  barRects,
  multiLineGeometry,
  multiBarGeometry,
  donutGeometry,
  chartTooltipLabel,
  type ChartDimensions,
  type ChartDirection,
  type ChartSeries,
  type ChartSlice,
  type ChartTooltipItem,
  type ChartLegendItem,
  type BarLayout,
} from '../core'

export type {
  ChartDirection,
  ChartSeries,
  ChartSlice,
  ChartTooltipItem,
  ChartLegendItem,
  BarLayout,
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

const chartFigureStyle: JSX.CSSProperties = {
  display: 'inline-flex',
  'flex-direction': 'column',
  gap: 'var(--iris-gap-sm)',
  margin: '0',
}

const chartLegendStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-wrap': 'wrap',
  gap: 'var(--iris-gap-sm)',
  margin: '0',
  padding: '0',
  color: 'var(--iris-chart-text)',
  'font-size': 'var(--iris-font-size-sm)',
  'list-style': 'none',
}

function ChartLegend(props: { items: readonly ChartLegendItem[]; label: string }) {
  return (
    <ul data-iris-chart-legend="" aria-label={props.label} style={chartLegendStyle}>
      <For each={props.items as ChartLegendItem[]}>
        {(item) => (
          <li
            style={{
              display: 'inline-flex',
              'align-items': 'center',
              gap: 'var(--iris-gap-sm)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                'inline-size': '0.75em',
                'block-size': '0.75em',
                'border-radius': 'var(--iris-radius-sm)',
                background: item.color,
              }}
            />
            {item.label}
          </li>
        )}
      </For>
    </ul>
  )
}

interface MultiChartBaseProps {
  width?: number
  height?: number
  categories?: readonly string[]
  direction?: ChartDirection
  ariaLabel?: string
  ariaDescription?: string
  legendLabel?: string
  showLegend?: boolean
  class?: string
  style?: JSX.CSSProperties
  onDatumFocus?: (item: ChartTooltipItem) => void
}

export interface IrisMultiLineChartProps extends MultiChartBaseProps {
  series: readonly ChartSeries[]
  nice?: boolean
  pointRadius?: number
}

/** Accessible, token-themed multi-series line chart over shared core geometry. */
export function IrisMultiLineChart(props: IrisMultiLineChartProps) {
  const width = () => props.width ?? 320
  const height = () => props.height ?? 180
  const direction = () => props.direction ?? 'ltr'
  const geometry = createMemo(() =>
    multiLineGeometry(
      props.series,
      { width: width(), height: height(), padding: 12 },
      {
        categories: props.categories ?? [],
        direction: direction(),
        nice: props.nice ?? true,
      },
    ),
  )

  return (
    <figure
      data-iris-chart-container="multi-line"
      class={props.class}
      dir={direction()}
      style={{ ...chartFigureStyle, ...props.style }}
    >
      <svg
        data-iris-chart="multi-line"
        role="group"
        aria-label={props.ariaLabel ?? 'Multi-series line chart'}
        width={width()}
        height={height()}
        viewBox={`0 0 ${width()} ${height()}`}
      >
        <title>{props.ariaLabel ?? 'Multi-series line chart'}</title>
        <desc>{props.ariaDescription ?? geometry().description}</desc>
        <For each={geometry().series}>
          {(item) => (
            <g data-series-id={item.id}>
              <Show when={item.path}>
                <path
                  data-iris-chart-series-line=""
                  d={item.path}
                  fill="none"
                  stroke={item.color}
                  stroke-width={2}
                  stroke-linejoin="round"
                  stroke-linecap="round"
                  aria-hidden="true"
                />
              </Show>
              <For each={item.points}>
                {(point) => {
                  const label = () => chartTooltipLabel(point.tooltip)
                  return (
                    <circle
                      data-iris-chart-datum=""
                      data-category-index={point.categoryIndex}
                      cx={point.x}
                      cy={point.y}
                      r={Math.max(1, props.pointRadius ?? 3)}
                      fill={point.color}
                      stroke="var(--iris-chart-point-stroke)"
                      stroke-width={1}
                      role="img"
                      tabIndex={0}
                      aria-label={label()}
                      onFocus={() => props.onDatumFocus?.(point.tooltip)}
                    >
                      <title>{label()}</title>
                    </circle>
                  )
                }}
              </For>
            </g>
          )}
        </For>
      </svg>
      <Show when={props.showLegend ?? true}>
        <ChartLegend items={geometry().legend} label={props.legendLabel ?? 'Chart legend'} />
      </Show>
    </figure>
  )
}

export interface IrisStackedBarChartProps extends MultiChartBaseProps {
  series: readonly ChartSeries[]
  layout?: BarLayout
  nice?: boolean
  categoryGap?: number
  seriesGap?: number
}

/** Accessible stacked/grouped bar chart with signed stacking and shared domain. */
export function IrisStackedBarChart(props: IrisStackedBarChartProps) {
  const width = () => props.width ?? 320
  const height = () => props.height ?? 180
  const direction = () => props.direction ?? 'ltr'
  const geometry = createMemo(() =>
    multiBarGeometry(
      props.series,
      { width: width(), height: height(), padding: 12 },
      {
        categories: props.categories ?? [],
        direction: direction(),
        layout: props.layout ?? 'stacked',
        nice: props.nice ?? true,
        categoryGap: props.categoryGap ?? 0.2,
        seriesGap: props.seriesGap ?? 0.08,
      },
    ),
  )

  return (
    <figure
      data-iris-chart-container="stacked-bar"
      class={props.class}
      dir={direction()}
      style={{ ...chartFigureStyle, ...props.style }}
    >
      <svg
        data-iris-chart="stacked-bar"
        data-layout={geometry().layout}
        role="group"
        aria-label={props.ariaLabel ?? 'Stacked bar chart'}
        width={width()}
        height={height()}
        viewBox={`0 0 ${width()} ${height()}`}
      >
        <title>{props.ariaLabel ?? 'Stacked bar chart'}</title>
        <desc>{props.ariaDescription ?? geometry().description}</desc>
        <For each={geometry().rects}>
          {(rect) => {
            const label = () => chartTooltipLabel(rect.tooltip)
            return (
              <rect
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
                aria-label={label()}
                onFocus={() => props.onDatumFocus?.(rect.tooltip)}
              >
                <title>{label()}</title>
              </rect>
            )
          }}
        </For>
      </svg>
      <Show when={props.showLegend ?? true}>
        <ChartLegend items={geometry().legend} label={props.legendLabel ?? 'Chart legend'} />
      </Show>
    </figure>
  )
}

export interface IrisDonutChartProps extends Omit<MultiChartBaseProps, 'categories' | 'direction'> {
  data: readonly ChartSlice[]
  innerRadiusRatio?: number
  startAngle?: number
}

/** Accessible donut (or pie at ratio 0) chart with focusable slice tooltips. */
export function IrisDonutChart(props: IrisDonutChartProps) {
  const width = () => props.width ?? 220
  const height = () => props.height ?? 220
  const geometry = createMemo(() =>
    donutGeometry(
      props.data,
      { width: width(), height: height(), padding: 8 },
      {
        innerRadiusRatio: props.innerRadiusRatio ?? 0.6,
        ...(props.startAngle == null ? {} : { startAngle: props.startAngle }),
      },
    ),
  )

  return (
    <figure
      data-iris-chart-container="donut"
      class={props.class}
      style={{ ...chartFigureStyle, ...props.style }}
    >
      <svg
        data-iris-chart="donut"
        role="group"
        aria-label={props.ariaLabel ?? 'Donut chart'}
        width={width()}
        height={height()}
        viewBox={`0 0 ${width()} ${height()}`}
      >
        <title>{props.ariaLabel ?? 'Donut chart'}</title>
        <desc>{props.ariaDescription ?? geometry().description}</desc>
        <For each={geometry().arcs}>
          {(arc) => {
            const label = () => chartTooltipLabel(arc.tooltip)
            return (
              <path
                data-iris-chart-datum=""
                data-slice-id={arc.id}
                d={arc.path}
                fill={arc.color}
                role="img"
                tabIndex={0}
                aria-label={label()}
                onFocus={() => props.onDatumFocus?.(arc.tooltip)}
              >
                <title>{label()}</title>
              </path>
            )
          }}
        </For>
      </svg>
      <Show when={props.showLegend ?? true}>
        <ChartLegend items={geometry().legend} label={props.legendLabel ?? 'Chart legend'} />
      </Show>
    </figure>
  )
}
