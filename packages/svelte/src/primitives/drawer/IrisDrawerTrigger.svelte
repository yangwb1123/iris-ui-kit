<script lang="ts">
  import type { Snippet } from 'svelte'
  import { getDrawerContext } from './context'
  import { createSlotChildProps, type IrisSlotChildProps } from '../slot/slot'

  /** Spreadable attributes/handlers for an `asChild` consumer's element. */
  export interface DrawerTriggerChildAttrs extends IrisSlotChildProps {
    onclick: (e: MouseEvent) => void
    'aria-haspopup': 'dialog'
    'aria-expanded': boolean
    'aria-controls': string
    'data-state': 'open' | 'closed'
  }

  /**
   * Props forwarded to an `asChild` consumer's child snippet. Spread
   * `{...props.attrs}` onto the element; for a raw element, attach
   * `use:props.ref` to keep focus-restoration working.
   */
  export interface DrawerTriggerChildProps {
    attrs: DrawerTriggerChildAttrs
    ref: (node: HTMLElement) => { destroy: () => void }
  }

  interface Props {
    /** Render the single child as the trigger instead of a wrapper `<button>`. */
    asChild?: boolean
    onclick?: (e: MouseEvent) => void
    children?: Snippet<[DrawerTriggerChildProps]> | Snippet
    [key: string]: unknown
  }

  let { asChild = false, onclick, children, ...rest }: Props = $props()
  const ctx = getDrawerContext('IrisDrawerTrigger')

  function setTriggerRef(node: HTMLElement): { destroy: () => void } {
    ctx.setTrigger(node)
    return { destroy: () => ctx.setTrigger(undefined) }
  }

  function handleClick(e: MouseEvent): void {
    onclick?.(e)
    if (e.defaultPrevented) return
    ctx.setOpen(true)
  }

  const childProps = $derived<DrawerTriggerChildProps>({
    attrs: createSlotChildProps(
      {
        ...rest,
        onclick: handleClick,
        'aria-haspopup': 'dialog',
        'aria-expanded': ctx.open,
        'aria-controls': ctx.contentId,
        'data-state': ctx.open ? 'open' : 'closed',
      },
      setTriggerRef,
    ) as DrawerTriggerChildAttrs,
    ref: setTriggerRef,
  })
</script>

{#if asChild}
  {@render (children as Snippet<[DrawerTriggerChildProps]>)?.(childProps)}
{:else}
  <button
    type="button"
    {...rest}
    use:setTriggerRef
    aria-haspopup="dialog"
    aria-expanded={ctx.open}
    aria-controls={ctx.contentId}
    data-state={ctx.open ? 'open' : 'closed'}
    onclick={handleClick}
  >
    {@render (children as Snippet)?.()}
  </button>
{/if}
