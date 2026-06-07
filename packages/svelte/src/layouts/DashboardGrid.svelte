<script lang="ts">
  import { styleToString, mergeStyle, asLen } from '../internal/style'
  import type { IrisDashboardGridProps } from './types'

  let { columns = 12, gap = 16, minColWidth, style, children, ...rest }: IrisDashboardGridProps =
    $props()

  const cols = $derived(
    minColWidth ? `repeat(auto-fill, minmax(${asLen(minColWidth)}, 1fr))` : `repeat(${columns}, 1fr)`,
  )
  const base = $derived(
    styleToString({
      display: 'grid',
      gap: asLen(gap),
      'grid-template-columns': cols,
      width: '100%',
    }),
  )
</script>

<div {...rest} data-iris-dashboard-grid style={mergeStyle(base, style)}>
  {@render children?.()}
</div>
