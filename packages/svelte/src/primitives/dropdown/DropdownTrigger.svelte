<script lang="ts">
  import type { Snippet } from 'svelte'
  import { getDropdownContext } from './context'
  import type { IrisDropdownTriggerProps } from './types'
  import { createSlotChildProps, type IrisSlotChildProps } from '../slot/slot'

  let {
    asChild = false,
    onclick,
    onkeydown,
    children,
    ...rest
  }: IrisDropdownTriggerProps = $props()
  const ctx = getDropdownContext('IrisDropdownTrigger')

  function setTriggerRef(node: HTMLElement) {
    ctx.setTrigger(node)
    return { destroy: () => ctx.setTrigger(undefined) }
  }

  function handleClick(e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
    onclick?.(e)
    if (e.defaultPrevented) return
    ctx.setOpen(!ctx.open)
  }

  // ArrowDown/Enter/Space open the menu (which focuses its first item), matching
  // the Vue trigger + the WAI-ARIA menu-button pattern.
  function handleKeyDown(e: KeyboardEvent): void {
    onkeydown?.(e as KeyboardEvent & { currentTarget: EventTarget & HTMLButtonElement })
    if (e.defaultPrevented) return
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      ctx.setOpen(true)
    }
  }

  const childProps = $derived(
    createSlotChildProps(
      {
        ...rest,
        'aria-haspopup': 'menu',
        'aria-expanded': ctx.open,
        'aria-controls': ctx.contentId,
        'data-state': ctx.open ? 'open' : 'closed',
        onclick: handleClick,
        onkeydown: handleKeyDown,
      },
      setTriggerRef,
    ),
  )
</script>

{#if asChild}
  {@render (children as Snippet<[IrisSlotChildProps]>)?.(childProps)}
{:else}
  <button
    type="button"
    {...rest}
    use:setTriggerRef
    aria-haspopup="menu"
    aria-expanded={ctx.open}
    aria-controls={ctx.contentId}
    data-state={ctx.open ? 'open' : 'closed'}
    onclick={handleClick}
    onkeydown={handleKeyDown}
  >
    {@render (children as Snippet)?.()}
  </button>
{/if}
