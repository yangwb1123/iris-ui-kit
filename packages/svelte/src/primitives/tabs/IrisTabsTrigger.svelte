<script lang="ts">
  import { getTabsContext } from './context'

  interface Props {
    value: string
    disabled?: boolean
    style?: string
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { value, disabled = false, style, children, ...rest }: Props = $props()

  const ctx = getTabsContext()

  const isDisabled = $derived(disabled || ctx.disabled)
  const isActive = $derived(ctx.value === value)

  $effect(() => {
    ctx.registerTrigger(value, () => isDisabled)
    return () => ctx.unregisterTrigger(value)
  })

  function handleClick(e: MouseEvent) {
    if (e.defaultPrevented || isDisabled) return
    ctx.setValue(value)
  }

  function handleKeyDown(e: KeyboardEvent) {
    const horizontal = ctx.orientation === 'horizontal'
    switch (e.key) {
      case horizontal ? 'ArrowRight' : 'ArrowDown':
        e.preventDefault()
        ctx.moveFocus(value, 1)
        break
      case horizontal ? 'ArrowLeft' : 'ArrowUp':
        e.preventDefault()
        ctx.moveFocus(value, -1)
        break
      case 'Home':
        e.preventDefault()
        ctx.moveFocus(value, 'home')
        break
      case 'End':
        e.preventDefault()
        ctx.moveFocus(value, 'end')
        break
    }
  }

  const baseStyle = $derived(
    `padding: 8px var(--iris-padding-md, 12px); font-size: 14px; font-weight: 500; font-family: inherit; cursor: ${isDisabled ? 'not-allowed' : 'pointer'}; opacity: ${isDisabled ? '0.5' : '1'}; border: none; outline: none; margin-bottom: ${ctx.orientation === 'horizontal' ? '-1px' : undefined}; transition: color 120ms ease, border-color 120ms ease; background: transparent; color: ${isActive ? 'var(--iris-primary)' : 'var(--iris-muted)'}; border-bottom: ${ctx.orientation === 'horizontal' ? `2px solid ${isActive ? 'var(--iris-primary)' : 'transparent'}` : 'none'}; border-inline-end: ${ctx.orientation === 'vertical' ? `2px solid ${isActive ? 'var(--iris-primary)' : 'transparent'}` : 'none'}; ${style ?? ''}`,
  )
</script>

<button
  type="button"
  {...rest}
  role="tab"
  aria-selected={isActive ? 'true' : 'false'}
  aria-controls="iris-tabs-content-{value}"
  id="iris-tabs-trigger-{value}"
  tabindex={isActive ? 0 : -1}
  data-iris-tabs-trigger
  data-value={value}
  data-state={isActive ? 'active' : 'inactive'}
  data-orientation={ctx.orientation}
  data-disabled={isDisabled ? '' : undefined}
  disabled={isDisabled || undefined}
  onclick={handleClick}
  onkeydown={handleKeyDown}
  style={baseStyle}
>
  {@render children?.()}
</button>
