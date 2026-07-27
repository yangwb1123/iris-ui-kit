<script lang="ts">
  import { donutGeometry, chartTooltipLabel, type ChartSlice, type ChartTooltipItem } from '../core'
  import ChartLegend from './ChartLegend.svelte'

  let {
    data,
    width = 220,
    height = 220,
    innerRadiusRatio = 0.6,
    startAngle,
    ariaLabel = 'Donut chart',
    ariaDescription,
    legendLabel = 'Chart legend',
    showLegend = true,
    onDatumFocus,
    class: klass = '',
    style = '',
  }: {
    data: readonly ChartSlice[]
    width?: number
    height?: number
    innerRadiusRatio?: number
    startAngle?: number
    ariaLabel?: string
    ariaDescription?: string
    legendLabel?: string
    showLegend?: boolean
    onDatumFocus?: (item: ChartTooltipItem) => void
    class?: string
    style?: string
  } = $props()

  const geometry = $derived(
    donutGeometry(
      data,
      { width, height, padding: 8 },
      {
        innerRadiusRatio,
        ...(startAngle == null ? {} : { startAngle }),
      },
    ),
  )
</script>

<figure
  data-iris-chart-container="donut"
  class={klass}
  style={`display:inline-flex;flex-direction:column;gap:var(--iris-gap-sm);margin:0;${style}`}
>
  <svg
    data-iris-chart="donut"
    role="group"
    aria-label={ariaLabel}
    {width}
    {height}
    viewBox={`0 0 ${width} ${height}`}
  >
    <title>{ariaLabel}</title>
    <desc>{ariaDescription ?? geometry.description}</desc>
    {#each geometry.arcs as arc (arc.id)}
      {@const label = chartTooltipLabel(arc.tooltip)}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (SVG data points are intentionally keyboard-focusable) -->
      <path
        data-iris-chart-datum
        data-slice-id={arc.id}
        d={arc.path}
        fill={arc.color}
        role="img"
        tabindex={0}
        aria-label={label}
        onfocus={() => onDatumFocus?.(arc.tooltip)}
      >
        <title>{label}</title>
      </path>
    {/each}
  </svg>
  {#if showLegend}
    <ChartLegend items={geometry.legend} label={legendLabel} />
  {/if}
</figure>
