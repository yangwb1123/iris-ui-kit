<script lang="ts">
  import type { Snippet } from 'svelte'
  import { getMenuContext } from './context'
  import { createSlotChildProps, type IrisSlotChildProps } from '../slot/slot'

  /** Spreadable attributes/handlers for an `asChild` consumer's element. */
  export interface MenuTriggerChildAttrs extends IrisSlotChildProps {
    onclick: (e: MouseEvent) => void
    onkeydown: (e: KeyboardEvent) => void
    'aria-haspopup': 'menu'
    'aria-expanded': boolean
    'aria-controls': string
    'data-state': 'open' | 'closed'
  }

  /**
   * Props forwarded to an `asChild` consumer's child snippet. Spread
   * `{...props.attrs}` onto the element, and attach `use:props.ref` so the menu
   * can anchor to the real trigger node. Mirrors the React/Vue/Solid adapters.
   */
  export interface MenuTriggerChildProps {
    attrs: MenuTriggerChildAttrs
    ref: (node: HTMLElement) => { destroy: () => void }
  }

  interface Props {
    /** Render the single child as the trigger instead of a wrapper `<button>`. */
    asChild?: boolean
    onclick?: (e: MouseEvent) => void
    onkeydown?: (e: KeyboardEvent) => void
    /**
     * When `asChild`, the child snippet receives the trigger props to spread
     * onto its own element; otherwise it is the button's content.
     */
    children?: Snippet<[MenuTriggerChildProps]> | Snippet
    [key: string]: unknown
  }

  let { asChild = false, onclick, onkeydown, children, ...rest }: Props = $props()
  const ctx = getMenuContext('IrisMenuTrigger')

  function setTriggerRef(node: HTMLElement): { destroy: () => void } {
    ctx.setTrigger(node)
    return { destroy: () => ctx.setTrigger(undefined) }
  }

  function handleClick(e: MouseEvent): void {
    onclick?.(e)
    if (e.defaultPrevented) return
    ctx.setOpen(!ctx.open)
  }

  // Keyboard open: ArrowDown/Enter/Space open the menu (which then focuses
  // its first item). Matches the Vue/React/Solid triggers.
  function handleKeyDown(e: KeyboardEvent): void {
    onkeydown?.(e)
    if (e.defaultPrevented) return
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      ctx.setOpen(true)
    }
  }

  const childProps = $derived<MenuTriggerChildProps>({
    attrs: createSlotChildProps(
      {
        ...rest,
        onclick: handleClick,
        onkeydown: handleKeyDown,
        'aria-haspopup': 'menu',
        'aria-expanded': ctx.open,
        'aria-controls': ctx.contentId,
        'data-state': ctx.open ? 'open' : 'closed',
      },
      setTriggerRef,
    ) as MenuTriggerChildAttrs,
    ref: setTriggerRef,
  })
</script>

{#if asChild}
  {@render (children as Snippet<[MenuTriggerChildProps]>)?.(childProps)}
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
