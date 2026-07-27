<script lang="ts">
  import {
    multiBarGeometry,
    chartTooltipLabel,
    type BarLayout,
    type ChartDirection,
    type ChartSeries,
    type ChartTooltipItem,
  } from '../core'
  import ChartLegend from './ChartLegend.svelte'

  let {
    series,
    categories = [],
    width = 320,
    height = 180,
    direction = 'ltr',
    layout = 'stacked',
    nice = true,
    categoryGap = 0.2,
    seriesGap = 0.08,
    ariaLabel = 'Stacked bar chart',
    ariaDescription,
    legendLabel = 'Chart legend',
    showLegend = true,
    onDatumFocus,
    class: klass = '',
    style = '',
  }: {
    series: readonly ChartSeries[]
    categories?: readonly string[]
    width?: number
    height?: number
    direction?: ChartDirection
    layout?: BarLayout
    nice?: boolean
    categoryGap?: number
    seriesGap?: number
    ariaLabel?: string
    ariaDescription?: string
    legendLabel?: string
    showLegend?: boolean
    onDatumFocus?: (item: ChartTooltipItem) => void
    class?: string
    style?: string
  } = $props()

  const geometry = $derived(
    multiBarGeometry(
      series,
      { width, height, padding: 12 },
      { categories, direction, layout, nice, categoryGap, seriesGap },
    ),
  )
</script>

<figure
  data-iris-chart-container="stacked-bar"
  class={klass}
  dir={direction}
  style={`display:inline-flex;flex-direction:column;gap:var(--iris-gap-sm);margin:0;${style}`}
>
  <svg
    data-iris-chart="stacked-bar"
    data-layout={geometry.layout}
    role="group"
    aria-label={ariaLabel}
    {width}
    {height}
    viewBox={`0 0 ${width} ${height}`}
  >
    <title>{ariaLabel}</title>
    <desc>{ariaDescription ?? geometry.description}</desc>
    {#each geometry.rects as rect (`${rect.seriesId}:${rect.categoryIndex}`)}
      {@const label = chartTooltipLabel(rect.tooltip)}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (SVG data points are intentionally keyboard-focusable) -->
      <rect
        data-iris-chart-datum
        data-series-id={rect.seriesId}
        data-category-index={rect.categoryIndex}
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill={rect.color}
        role="img"
        tabindex={0}
        aria-label={label}
        onfocus={() => onDatumFocus?.(rect.tooltip)}
      >
        <title>{label}</title>
      </rect>
    {/each}
  </svg>
  {#if showLegend}
    <ChartLegend items={geometry.legend} label={legendLabel} />
  {/if}
</figure>
