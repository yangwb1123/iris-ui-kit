<script lang="ts">
  import type { Snippet } from 'svelte'
  import { getDialogContext } from './context'
  import { createSlotChildProps, type IrisSlotChildProps } from '../slot/slot'

  /** Props forwarded to an `asChild` consumer's element (spread `{...props}`). */
  export interface DialogCloseChildProps extends IrisSlotChildProps {
    onclick: (e: MouseEvent) => void
    'data-iris-dialog-close': true
  }

  interface Props {
    /** Render the single child as the close control instead of a wrapper `<button>`. */
    asChild?: boolean
    onclick?: (e: MouseEvent) => void
    children?: Snippet<[DialogCloseChildProps]> | Snippet
    [key: string]: unknown
  }

  let { asChild = false, onclick, children, ...rest }: Props = $props()
  const ctx = getDialogContext('IrisDialogClose')

  function handleClick(e: MouseEvent): void {
    onclick?.(e)
    if (e.defaultPrevented) return
    ctx.setOpen(false)
  }

  const childProps = $derived<DialogCloseChildProps>(
    createSlotChildProps({
      ...rest,
      onclick: handleClick,
      'data-iris-dialog-close': true,
    }) as DialogCloseChildProps,
  )
</script>

{#if asChild}
  {@render (children as Snippet<[DialogCloseChildProps]>)?.(childProps)}
{:else}
  <button type="button" {...rest} data-iris-dialog-close onclick={handleClick}>
    {@render (children as Snippet)?.()}
  </button>
{/if}
