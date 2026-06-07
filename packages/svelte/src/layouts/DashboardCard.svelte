<script lang="ts">
  import { styleToString, mergeStyle } from '../internal/style'
  import type { IrisDashboardCardProps } from './types'

  let { colSpan = 1, rowSpan = 1, surface = true, style, children, ...rest }: IrisDashboardCardProps =
    $props()

  const base = $derived(
    styleToString({
      'grid-column': colSpan === 'full' ? '1 / -1' : `span ${colSpan}`,
      'grid-row': rowSpan > 1 ? `span ${rowSpan}` : undefined,
      background: surface ? 'var(--iris-surface)' : 'transparent',
      border: surface ? '1px solid var(--iris-border)' : 'none',
      'border-radius': 'var(--iris-radius-md, 6px)',
      padding: surface ? 'var(--iris-padding-lg, 20px)' : 0,
      'min-width': 0,
    }),
  )
</script>

<div {...rest} data-iris-dashboard-card style={mergeStyle(base, style)}>
  {@render children?.()}
</div>
