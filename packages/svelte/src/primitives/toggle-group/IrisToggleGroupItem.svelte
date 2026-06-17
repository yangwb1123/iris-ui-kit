<script lang="ts">
  import { getToggleGroupContext } from './context'

  interface Props {
    value: string
    disabled?: boolean
    style?: string
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { value, disabled = false, style, children, ...rest }: Props = $props()

  const ctx = getToggleGroupContext()

  let elRef = $state<HTMLElement | undefined>(undefined)

  $effect(() => {
    ctx.registerItem(value, () => elRef ?? null)
    return () => ctx.unregisterItem(value)
  })

  const isActive = $derived(ctx.isActive(value))
  const isDisabled = $derived(disabled || ctx.disabled)
  const isSingle = $derived(ctx.type === 'single')

  const SIZE_PADDING: Record<'sm' | 'md' | 'lg', string> = {
    sm: '4px 10px',
    md: '6px 14px',
    lg: '8px 18px',
  }
  const SIZE_FONT: Record<'sm' | 'md' | 'lg', string> = {
    sm: '12px',
    md: '13px',
    lg: '14px',
  }

  function handleClick() {
    if (isDisabled) return
    ctx.toggle(value)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (isDisabled) return
    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault()
        ctx.toggle(value)
        break
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        ctx.moveFocus(value, 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
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
</script>

<button
  bind:this={elRef}
  type="button"
  {...rest}
  role={isSingle ? 'radio' : undefined}
  aria-checked={isSingle ? (isActive ? 'true' : 'false') : undefined}
  aria-pressed={isSingle ? undefined : isActive ? 'true' : 'false'}
  aria-disabled={isDisabled ? 'true' : undefined}
  disabled={isDisabled || undefined}
  tabindex={isActive ? 0 : -1}
  data-iris-toggle-group-item
  data-state={isActive ? 'on' : 'off'}
  onclick={handleClick}
  onkeydown={handleKeyDown}
  style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: {SIZE_PADDING[
    ctx.size
  ]}; font-size: {SIZE_FONT[
    ctx.size
  ]}; font-family: inherit; font-weight: 500; line-height: 1; background: {isActive
    ? 'var(--iris-primary)'
    : 'transparent'}; color: {isActive
    ? 'var(--iris-primary-foreground, #fff)'
    : 'var(--iris-foreground)'}; border: none; cursor: {isDisabled
    ? 'not-allowed'
    : 'pointer'}; opacity: {isDisabled
    ? '0.5'
    : '1'}; transition: background-color 120ms ease, color 120ms ease; {style ?? ''}"
>
  {@render children?.()}
</button>
