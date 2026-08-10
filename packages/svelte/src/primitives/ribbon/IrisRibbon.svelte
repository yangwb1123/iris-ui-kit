<script lang="ts">
  import { mergeStyle } from '../../internal/style'

  type RibbonPlacement = 'start' | 'end'

  let {
    text = '' as string | number,
    placement = 'end' as RibbonPlacement,
    color = undefined as string | undefined,
    style,
    children,
    ...rest
  } = $props()

  const sideStyle = $derived(
    placement === 'end'
      ? 'inset-inline-end: 0; border-start-start-radius: var(--iris-radius-sm, 4px); border-end-start-radius: var(--iris-radius-sm, 4px)'
      : 'inset-inline-start: 0; border-start-end-radius: var(--iris-radius-sm, 4px); border-end-end-radius: var(--iris-radius-sm, 4px)',
  )

  const bg = $derived(color ?? 'var(--iris-primary)')
</script>

<div
  {...rest}
  data-iris-ribbon
  data-placement={placement}
  style={mergeStyle('position: relative; display: inline-block', style)}
>
  {@render children?.()}
  <span
    data-iris-ribbon-badge
    style="position: absolute; inset-block-start: 8px; background: {bg}; color: var(--iris-primary-foreground, #fff); padding: var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px); font-size: var(--iris-font-size-xs, 12px); font-weight: 600; box-shadow: var(--iris-shadow-sm); white-space: nowrap; {sideStyle}"
  >
    {String(text)}
  </span>
</div>
