<script lang="ts">
  import {
    multiLineGeometry,
    chartTooltipLabel,
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
    nice = true,
    pointRadius = 3,
    ariaLabel = 'Multi-series line chart',
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
    nice?: boolean
    pointRadius?: number
    ariaLabel?: string
    ariaDescription?: string
    legendLabel?: string
    showLegend?: boolean
    onDatumFocus?: (item: ChartTooltipItem) => void
    class?: string
    style?: string
  } = $props()

  const geometry = $derived(
    multiLineGeometry(series, { width, height, padding: 12 }, { categories, direction, nice }),
  )
</script>

<figure
  data-iris-chart-container="multi-line"
  class={klass}
  dir={direction}
  style={`display:inline-flex;flex-direction:column;gap:var(--iris-gap-sm);margin:0;${style}`}
>
  <svg
    data-iris-chart="multi-line"
    role="group"
    aria-label={ariaLabel}
    {width}
    {height}
    viewBox={`0 0 ${width} ${height}`}
  >
    <title>{ariaLabel}</title>
    <desc>{ariaDescription ?? geometry.description}</desc>
    {#each geometry.series as item (item.id)}
      <g data-series-id={item.id}>
        {#if item.path}
          <path
            data-iris-chart-series-line
            d={item.path}
            fill="none"
            stroke={item.color}
            stroke-width={2}
            stroke-linejoin="round"
            stroke-linecap="round"
            aria-hidden="true"
          />
        {/if}
        {#each item.points as point (point.id)}
          {@const label = chartTooltipLabel(point.tooltip)}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex (SVG data points are intentionally keyboard-focusable) -->
          <circle
            data-iris-chart-datum
            data-category-index={point.categoryIndex}
            cx={point.x}
            cy={point.y}
            r={Math.max(1, pointRadius)}
            fill={point.color}
            stroke="var(--iris-chart-point-stroke)"
            stroke-width={1}
            role="img"
            tabindex={0}
            aria-label={label}
            onfocus={() => onDatumFocus?.(point.tooltip)}
          >
            <title>{label}</title>
          </circle>
        {/each}
      </g>
    {/each}
  </svg>
  {#if showLegend}
    <ChartLegend items={geometry.legend} label={legendLabel} />
  {/if}
</figure>
