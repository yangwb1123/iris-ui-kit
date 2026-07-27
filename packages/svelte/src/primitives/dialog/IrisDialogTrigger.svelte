<script lang="ts">
  import type { Snippet } from 'svelte'
  import { getDialogContext } from './context'
  import { createSlotChildProps, type IrisSlotChildProps } from '../slot/slot'

  /** Spreadable attributes/handlers for an `asChild` consumer's element. */
  export interface DialogTriggerChildAttrs extends IrisSlotChildProps {
    onclick: (e: MouseEvent) => void
    'aria-haspopup': 'dialog'
    'aria-expanded': boolean
    'aria-controls': string
    'data-state': 'open' | 'closed'
  }

  /**
   * Props forwarded to an `asChild` consumer's child snippet. Spread
   * `{...props.attrs}` onto the element; for a raw element, attach
   * `use:props.ref` to keep focus-restoration working (the open dialog returns
   * focus to the trigger on close). Mirrors the React/Vue adapters, which merge
   * these onto the cloned child.
   */
  export interface DialogTriggerChildProps {
    attrs: DialogTriggerChildAttrs
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
    children?: Snippet<[DialogTriggerChildProps]> | Snippet
    [key: string]: unknown
  }

  let { asChild = false, onclick, children, ...rest }: Props = $props()
  const ctx = getDialogContext('IrisDialogTrigger')

  function setTriggerRef(node: HTMLElement): { destroy: () => void } {
    ctx.setTrigger(node)
    return { destroy: () => ctx.setTrigger(undefined) }
  }

  function handleClick(e: MouseEvent): void {
    onclick?.(e)
    if (e.defaultPrevented) return
    ctx.setOpen(true)
  }

  const childProps = $derived<DialogTriggerChildProps>({
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
    ) as DialogTriggerChildAttrs,
    ref: setTriggerRef,
  })
</script>

{#if asChild}
  {@render (children as Snippet<[DialogTriggerChildProps]>)?.(childProps)}
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
