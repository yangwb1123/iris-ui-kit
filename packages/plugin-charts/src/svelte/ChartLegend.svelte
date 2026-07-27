<script lang="ts">
  import type { ChartLegendItem } from '../core'

  let {
    items,
    label,
  }: {
    items: readonly ChartLegendItem[]
    label: string
  } = $props()
</script>

<ul
  data-iris-chart-legend
  aria-label={label}
  style="display:flex;flex-wrap:wrap;gap:var(--iris-gap-sm);margin:0;padding:0;color:var(--iris-chart-text);font-size:var(--iris-font-size-sm);list-style:none"
>
  {#each items as item (item.id)}
    <li style="display:inline-flex;align-items:center;gap:var(--iris-gap-sm)">
      <span
        aria-hidden="true"
        style={`inline-size:0.75em;block-size:0.75em;border-radius:var(--iris-radius-sm);background:${item.color}`}
      ></span>
      {item.label}
    </li>
  {/each}
</ul>
