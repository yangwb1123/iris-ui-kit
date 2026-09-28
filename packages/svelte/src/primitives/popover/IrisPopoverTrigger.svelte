<script lang="ts">
  import type { Snippet } from 'svelte'
  import { getPopoverContext } from './context'
  import { createSlotChildProps, type IrisSlotChildProps } from '../slot/slot'

  /** Spreadable attributes/handlers for an `asChild` consumer's element. */
  export interface PopoverTriggerChildAttrs extends IrisSlotChildProps {
    onclick: (e: MouseEvent) => void
    'aria-haspopup': 'dialog'
    'aria-expanded': boolean
    'aria-controls': string
    'data-state': 'open' | 'closed'
  }

  /**
   * Props forwarded to an `asChild` consumer's child snippet. Spread
   * `{...props.attrs}` onto the element, and attach `use:props.ref` so the
   * popover anchors to the real trigger node.
   */
  export interface PopoverTriggerChildProps {
    attrs: PopoverTriggerChildAttrs
    ref: (node: HTMLElement) => { destroy: () => void }
  }

  interface Props {
    /** Render the single child as the trigger instead of a wrapper `<button>`. */
    asChild?: boolean
    onclick?: (e: MouseEvent) => void
    /**
     * When `asChild`, the child snippet receives the trigger props to spread
     * onto its own element; otherwise it is the button's content.
     */
    children?: Snippet<[PopoverTriggerChildProps]> | Snippet
    [key: string]: unknown
  }

  let { asChild = false, onclick, children, ...rest }: Props = $props()
  const ctx = getPopoverContext('IrisPopoverTrigger')

  function setTriggerRef(node: HTMLElement): { destroy: () => void } {
    ctx.setTrigger(node)
    return { destroy: () => ctx.setTrigger(undefined) }
  }

  function handleClick(e: MouseEvent): void {
    onclick?.(e)
    if (e.defaultPrevented) return
    ctx.setOpen(!ctx.open)
  }

  const childProps = $derived<PopoverTriggerChildProps>({
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
    ) as PopoverTriggerChildAttrs,
    ref: setTriggerRef,
  })
</script>

{#if asChild}
  {@render (children as Snippet<[PopoverTriggerChildProps]>)?.(childProps)}
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
