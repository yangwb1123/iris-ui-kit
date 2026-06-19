<script lang="ts">
  import type { Snippet } from 'svelte'
  import { getDialogContext } from './context'

  /** Props forwarded to an `asChild` consumer's element (spread `{...props}`). */
  export interface DialogCloseChildProps {
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
    if (e.defaultPrevented) return
    onclick?.(e)
    ctx.setOpen(false)
  }

  const childProps = $derived<DialogCloseChildProps>({
    onclick: handleClick,
    'data-iris-dialog-close': true,
  })
</script>

{#if asChild}
  {@render (children as Snippet<[DialogCloseChildProps]>)?.(childProps)}
{:else}
  <button type="button" {...rest} data-iris-dialog-close onclick={handleClick}>
    {@render (children as Snippet)?.()}
  </button>
{/if}
