import { Show, For, createMemo, type Accessor, type JSX } from 'solid-js'
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
  type ChartArc,
  type ChartBarRect,
  type ChartDataPoint,
  type DonutGeometry,
  type MultiBarGeometry,
  type MultiLineGeometry,
  type ProjectedChartSeries,
} from '../core'

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

function LinePoint(props: {
  point: ChartDataPoint
  radius: number
  onDatumFocus?: (item: ChartTooltipItem) => void
}): JSX.Element {
  const label = () => chartTooltipLabel(props.point.tooltip)
  return (
    <circle
      data-iris-chart-datum=""
      data-category-index={props.point.categoryIndex}
      cx={props.point.x}
      cy={props.point.y}
      r={props.radius}
      fill={props.point.color}
      stroke="var(--iris-chart-point-stroke)"
      stroke-width={1}
      role="img"
      tabIndex={0}
      aria-label={label()}
      onFocus={() => props.onDatumFocus?.(props.point.tooltip)}
    >
      <title>{label()}</title>
    </circle>
  )
}

function LineSeries(props: {
  series: ProjectedChartSeries
  radius: number
  onDatumFocus?: (item: ChartTooltipItem) => void
}): JSX.Element {
  return (
    <g data-series-id={props.series.id}>
      <Show when={props.series.path}>
        <path
          data-iris-chart-series-line=""
          d={props.series.path}
          fill="none"
          stroke={props.series.color}
          stroke-width={2}
          stroke-linejoin="round"
          stroke-linecap="round"
          aria-hidden="true"
        />
      </Show>
      <For each={props.series.points}>
        {(point) => (
          <LinePoint point={point} radius={props.radius} onDatumFocus={props.onDatumFocus} />
        )}
      </For>
    </g>
  )
}

function MultiLineSvg(props: {
  geometry: Accessor<MultiLineGeometry>
  width: Accessor<number>
  height: Accessor<number>
  label: string
  description: Accessor<string>
  radius: number
  onDatumFocus?: (item: ChartTooltipItem) => void
}): JSX.Element {
  return (
    <svg
      data-iris-chart="multi-line"
      role="group"
      aria-label={props.label}
      width={props.width()}
      height={props.height()}
      viewBox={`0 0 ${props.width()} ${props.height()}`}
    >
      <title>{props.label}</title>
      <desc>{props.description()}</desc>
      <For each={props.geometry().series}>
        {(series) => (
          <LineSeries series={series} radius={props.radius} onDatumFocus={props.onDatumFocus} />
        )}
      </For>
    </svg>
  )
}

function BarRectView(props: {
  rect: ChartBarRect
  onDatumFocus?: (item: ChartTooltipItem) => void
}): JSX.Element {
  const label = () => chartTooltipLabel(props.rect.tooltip)
  return (
    <rect
      data-iris-chart-datum=""
      data-series-id={props.rect.seriesId}
      data-category-index={props.rect.categoryIndex}
      x={props.rect.x}
      y={props.rect.y}
      width={props.rect.width}
      height={props.rect.height}
      fill={props.rect.color}
      role="img"
      tabIndex={0}
      aria-label={label()}
      onFocus={() => props.onDatumFocus?.(props.rect.tooltip)}
    >
      <title>{label()}</title>
    </rect>
  )
}

function MultiBarSvg(props: {
  geometry: Accessor<MultiBarGeometry>
  width: Accessor<number>
  height: Accessor<number>
  label: string
  description: Accessor<string>
  onDatumFocus?: (item: ChartTooltipItem) => void
}): JSX.Element {
  return (
    <svg
      data-iris-chart="stacked-bar"
      data-layout={props.geometry().layout}
      role="group"
      aria-label={props.label}
      width={props.width()}
      height={props.height()}
      viewBox={`0 0 ${props.width()} ${props.height()}`}
    >
      <title>{props.label}</title>
      <desc>{props.description()}</desc>
      <For each={props.geometry().rects}>
        {(rect) => <BarRectView rect={rect} onDatumFocus={props.onDatumFocus} />}
      </For>
    </svg>
  )
}

function DonutArcView(props: {
  arc: ChartArc
  onDatumFocus?: (item: ChartTooltipItem) => void
}): JSX.Element {
  const label = () => chartTooltipLabel(props.arc.tooltip)
  return (
    <path
      data-iris-chart-datum=""
      data-slice-id={props.arc.id}
      d={props.arc.path}
      fill={props.arc.color}
      role="img"
      tabIndex={0}
      aria-label={label()}
      onFocus={() => props.onDatumFocus?.(props.arc.tooltip)}
    >
      <title>{label()}</title>
    </path>
  )
}

function DonutSvg(props: {
  geometry: Accessor<DonutGeometry>
  width: Accessor<number>
  height: Accessor<number>
  label: string
  description: Accessor<string>
  onDatumFocus?: (item: ChartTooltipItem) => void
}): JSX.Element {
  return (
    <svg
      data-iris-chart="donut"
      role="group"
      aria-label={props.label}
      width={props.width()}
      height={props.height()}
      viewBox={`0 0 ${props.width()} ${props.height()}`}
    >
      <title>{props.label}</title>
      <desc>{props.description()}</desc>
      <For each={props.geometry().arcs}>
        {(arc) => <DonutArcView arc={arc} onDatumFocus={props.onDatumFocus} />}
      </For>
    </svg>
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
      <MultiLineSvg
        geometry={geometry}
        width={width}
        height={height}
        label={props.ariaLabel ?? 'Multi-series line chart'}
        description={() => props.ariaDescription ?? geometry().description}
        radius={Math.max(1, props.pointRadius ?? 3)}
        onDatumFocus={props.onDatumFocus}
      />
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
      <MultiBarSvg
        geometry={geometry}
        width={width}
        height={height}
        label={props.ariaLabel ?? 'Stacked bar chart'}
        description={() => props.ariaDescription ?? geometry().description}
        onDatumFocus={props.onDatumFocus}
      />
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
      <DonutSvg
        geometry={geometry}
        width={width}
        height={height}
        label={props.ariaLabel ?? 'Donut chart'}
        description={() => props.ariaDescription ?? geometry().description}
        onDatumFocus={props.onDatumFocus}
      />
      <Show when={props.showLegend ?? true}>
        <ChartLegend items={geometry().legend} label={props.legendLabel ?? 'Chart legend'} />
      </Show>
    </figure>
  )
}
