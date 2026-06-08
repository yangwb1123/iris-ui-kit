<script lang="ts">
  import type { Snippet } from 'svelte'

  export type IrisGridColumns = number | 'auto-fit' | 'auto-fill' | string

  function resolveColumns(columns: IrisGridColumns, minColWidth: string): string {
    if (typeof columns === 'number') return `repeat(${columns}, minmax(0, 1fr))`
    if (columns === 'auto-fit') return `repeat(auto-fit, minmax(${minColWidth}, 1fr))`
    if (columns === 'auto-fill') return `repeat(auto-fill, minmax(${minColWidth}, 1fr))`
    return columns
  }

  function toCssSpacing(spacing: string | number): string {
    if (typeof spacing === 'number') return `${spacing}px`
    if (spacing === 'sm' || spacing === 'md' || spacing === 'lg') return `var(--iris-gap-${spacing})`
    return spacing
  }

  interface Props {
    columns?: IrisGridColumns
    minColWidth?: string
    rowGap?: string | number
    columnGap?: string | number
    gap?: string | number
    inline?: boolean
    style?: string
    class?: string
    children?: Snippet
  }

  let {
    columns = 'auto-fit',
    minColWidth = '200px',
    rowGap,
    columnGap,
    gap = 'md',
    inline = false,
    style,
    class: className,
    children,
    ...rest
  }: Props = $props()

  const colTemplate = $derived(resolveColumns(columns, minColWidth))
  const rg = $derived(rowGap !== undefined ? toCssSpacing(rowGap) : toCssSpacing(gap))
  const cg = $derived(columnGap !== undefined ? toCssSpacing(columnGap) : toCssSpacing(gap))
</script>

<div
  data-iris-grid
  data-iris-grid-columns={String(columns)}
  style:display={inline ? 'inline-grid' : 'grid'}
  style:grid-template-columns={colTemplate}
  style:row-gap={rg}
  style:column-gap={cg}
  style={style}
  class={className}
  {...rest}
>
  {@render children?.()}
</div>
