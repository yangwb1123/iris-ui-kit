<script lang="ts">
  import { mergeStyle } from '../../internal/style'

  type Axis = 'vertical' | 'horizontal' | 'both'

  interface Props {
    maxHeight?: number | string
    maxWidth?: number | string
    axis?: Axis
    style?: string
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { maxHeight, maxWidth, axis = 'vertical', style, children, ...rest }: Props = $props()

  const OVERFLOW: Record<Axis, string> = {
    vertical: 'overflow-y: auto; overflow-x: hidden;',
    horizontal: 'overflow-x: auto; overflow-y: hidden;',
    both: 'overflow: auto;',
  }

  function px(v: number | string | undefined): string {
    if (v === undefined) return ''
    return typeof v === 'number' ? `${v}px` : v
  }

  const baseStyle = $derived(
    [
      OVERFLOW[axis],
      maxHeight ? `max-height: ${px(maxHeight)};` : '',
      maxWidth ? `max-width: ${px(maxWidth)};` : '',
      'outline: none;',
    ]
      .filter(Boolean)
      .join(' '),
  )
</script>

<div
  {...rest}
  data-iris-scroll-area
  data-axis={axis}
  role="region"
  tabindex={0}
  style={mergeStyle(baseStyle, style)}
>
  {@render children?.()}
</div>
