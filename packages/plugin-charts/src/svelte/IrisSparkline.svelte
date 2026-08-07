<script lang="ts">
  import { plotBox, dataDomain, seriesPoints, linePath, type ChartDimensions } from '../core'

  let {
    data,
    width = 96,
    height = 24,
    ariaLabel = 'Sparkline',
    class: klass = '',
    style = '',
  }: {
    data: number[]
    width?: number
    height?: number
    ariaLabel?: string
    class?: string
    style?: string
  } = $props()

  const box = $derived(plotBox({ width, height, padding: 4 } satisfies ChartDimensions))
  const domain = $derived(dataDomain(data))
  const points = $derived(seriesPoints(data, domain, box))
</script>

<svg
  data-iris-chart="sparkline"
  role="img"
  aria-label={ariaLabel}
  {width}
  {height}
  viewBox={`0 0 ${width} ${height}`}
  class={klass}
  style={`display:inline-block;vertical-align:middle;${style}`}
>
  <path
    d={linePath(points)}
    fill="none"
    stroke="var(--iris-chart-line)"
    stroke-width={1.5}
    stroke-linejoin="round"
    stroke-linecap="round"
  />
</svg>
