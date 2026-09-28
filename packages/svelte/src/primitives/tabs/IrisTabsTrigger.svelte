<script lang="ts">
  import type { Snippet } from 'svelte'
  import { getTabsContext } from './context'
  import { createSlotChildProps, type IrisSlotChildProps } from '../slot/slot'

  /** Spreadable attributes/handlers for an `asChild` consumer's element. */
  export interface TabsTriggerChildAttrs extends IrisSlotChildProps {
    onclick: (e: MouseEvent) => void
    onkeydown: (e: KeyboardEvent) => void
    role: 'tab'
    'aria-selected': 'true' | 'false'
    'aria-controls': string
    id: string
    tabindex: 0 | -1
    'data-iris-tabs-trigger': ''
    'data-value': string
    'data-state': 'active' | 'inactive'
    'data-orientation': 'horizontal' | 'vertical'
    'data-disabled': string | undefined
    disabled: true | undefined
    style: string
  }

  /**
   * Props forwarded to an `asChild` consumer's child snippet. The tab ARIA
   * contract (role, aria-selected, roving tabindex) travels with the attrs so
   * the consumer's own element becomes the tab.
   */
  export interface TabsTriggerChildProps {
    attrs: TabsTriggerChildAttrs
  }

  interface Props {
    value: string
    disabled?: boolean
    /** Render the single child as the tab control instead of a `<button>`. */
    asChild?: boolean
    style?: string
    /**
     * When `asChild`, the child snippet receives the trigger props to spread
     * onto its own element; otherwise it is the button's content.
     */
    children?: Snippet<[TabsTriggerChildProps]> | Snippet
    [key: string]: unknown
  }

  let { value, disabled = false, asChild = false, style, children, ...rest }: Props = $props()

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
    if (isDisabled) return
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
    `padding: 8px var(--iris-padding-md, 12px); font-size: var(--iris-font-size-md, 14px); font-weight: 500; font-family: inherit; cursor: ${isDisabled ? 'not-allowed' : 'pointer'}; opacity: ${isDisabled ? '0.5' : '1'}; border: none; outline: none; margin-bottom: ${ctx.orientation === 'horizontal' ? '-1px' : undefined}; transition: color 120ms ease, border-color 120ms ease; background: transparent; color: ${isActive ? 'var(--iris-primary)' : 'var(--iris-muted)'}; border-bottom: ${ctx.orientation === 'horizontal' ? `2px solid ${isActive ? 'var(--iris-primary)' : 'transparent'}` : 'none'}; border-inline-end: ${ctx.orientation === 'vertical' ? `2px solid ${isActive ? 'var(--iris-primary)' : 'transparent'}` : 'none'}; ${style ?? ''}`,
  )

  // Plain record of the tab contract; `createSlotChildProps` turns this into
  // the spreadable child contract (adding `merge` + the class/style/ref
  // attachment), so it must not be typed as `TabsTriggerChildAttrs` yet.
  const triggerAttrs = $derived<Record<string, unknown>>({
    ...rest,
    role: 'tab',
    'aria-selected': isActive ? 'true' : 'false',
    'aria-controls': `iris-tabs-content-${value}`,
    id: `iris-tabs-trigger-${value}`,
    tabindex: isActive ? 0 : -1,
    'data-iris-tabs-trigger': '',
    'data-value': value,
    'data-state': isActive ? 'active' : 'inactive',
    'data-orientation': ctx.orientation,
    'data-disabled': isDisabled ? '' : undefined,
    disabled: isDisabled || undefined,
    onclick: handleClick,
    onkeydown: handleKeyDown,
    style: baseStyle,
  })

  const childProps = $derived<TabsTriggerChildProps>({
    attrs: createSlotChildProps(triggerAttrs) as TabsTriggerChildAttrs,
  })
</script>

{#if asChild}
  {@render (children as Snippet<[TabsTriggerChildProps]>)?.(childProps)}
{:else}
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
    {@render (children as Snippet)?.()}
  </button>
{/if}
