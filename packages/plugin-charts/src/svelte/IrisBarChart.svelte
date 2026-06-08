<script lang="ts">
  import { plotBox, dataDomain, niceDomain, barRects, type ChartDimensions } from '../core'

  let {
    data,
    width = 320,
    height = 160,
    nice = true,
    gap = 0.2,
    ariaLabel = 'Bar chart',
    class: klass = '',
    style = '',
  }: {
    data: number[]
    width?: number
    height?: number
    nice?: boolean
    /** Fractional gap between bars (0..1). Default 0.2. */
    gap?: number
    ariaLabel?: string
    class?: string
    style?: string
  } = $props()

  const box = $derived(plotBox({ width, height, padding: 8 } satisfies ChartDimensions))
  const raw = $derived(dataDomain(data))
  const domain = $derived(nice ? niceDomain(Math.min(0, raw.min), raw.max) : raw)
  const rects = $derived(barRects(data, domain, box, gap))
</script>

<svg
  data-iris-chart="bar"
  role="img"
  aria-label={ariaLabel}
  {width}
  {height}
  viewBox={`0 0 ${width} ${height}`}
  class={klass}
  {style}
>
  {#each rects as r}
    <rect x={r.x} y={r.y} width={r.width} height={r.height} fill="var(--iris-chart-bar)" />
  {/each}
</svg>
