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

  // A scroll container must be keyboard-focusable even when it has no
  // focusable descendants. Svelte classifies `role=region` as non-interactive,
  // so express the focus behavior as an action while retaining the correct
  // region semantics and the existing DOM contract.
  function focusableScrollRegion(node: HTMLElement): { destroy: () => void } {
    node.tabIndex = 0
    return {
      destroy: () => node.removeAttribute('tabindex'),
    }
  }
</script>

<div
  {...rest}
  use:focusableScrollRegion
  role="region"
  data-iris-scroll-area
  data-axis={axis}
  style={mergeStyle(baseStyle, style)}
>
  {@render children?.()}
</div>
