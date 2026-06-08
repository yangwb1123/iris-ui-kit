<script lang="ts">
  import {
    plotBox,
    dataDomain,
    niceDomain,
    seriesPoints,
    linePath,
    areaPath,
    type ChartDimensions,
  } from '../core'

  let {
    data,
    width = 320,
    height = 160,
    area = false,
    nice = true,
    ariaLabel = 'Line chart',
    class: klass = '',
    style = '',
  }: {
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
    style?: string
  } = $props()

  const box = $derived(plotBox({ width, height, padding: 8 } satisfies ChartDimensions))
  const raw = $derived(dataDomain(data))
  const domain = $derived(nice ? niceDomain(raw.min, raw.max) : raw)
  const points = $derived(seriesPoints(data, domain, box))
</script>

<svg
  data-iris-chart="line"
  role="img"
  aria-label={ariaLabel}
  {width}
  {height}
  viewBox={`0 0 ${width} ${height}`}
  class={klass}
  {style}
>
  {#if area}
    <path d={areaPath(points, box)} fill="var(--iris-chart-area)" stroke="none" />
  {/if}
  <path
    d={linePath(points)}
    fill="none"
    stroke="var(--iris-chart-line)"
    stroke-width={2}
    stroke-linejoin="round"
    stroke-linecap="round"
  />
</svg>
