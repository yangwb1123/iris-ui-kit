<script lang="ts">
  import type { Snippet } from 'svelte'
  import { getDrawerContext } from './context'
  import { createSlotChildProps, type IrisSlotChildProps } from '../slot/slot'

  /** Props forwarded to an `asChild` consumer's element (spread `{...props}`). */
  export interface DrawerCloseChildProps extends IrisSlotChildProps {
    onclick: (e: MouseEvent) => void
    'data-iris-drawer-close': true
  }

  interface Props {
    /** Render the single child as the close control instead of a wrapper `<button>`. */
    asChild?: boolean
    onclick?: (e: MouseEvent) => void
    children?: Snippet<[DrawerCloseChildProps]> | Snippet
    [key: string]: unknown
  }

  let { asChild = false, onclick, children, ...rest }: Props = $props()
  const ctx = getDrawerContext('IrisDrawerClose')

  function handleClick(e: MouseEvent): void {
    onclick?.(e)
    if (e.defaultPrevented) return
    ctx.setOpen(false)
  }

  const childProps = $derived<DrawerCloseChildProps>(
    createSlotChildProps({
      ...rest,
      onclick: handleClick,
      'data-iris-drawer-close': true,
    }) as DrawerCloseChildProps,
  )
</script>

{#if asChild}
  {@render (children as Snippet<[DrawerCloseChildProps]>)?.(childProps)}
{:else}
  <button type="button" {...rest} data-iris-drawer-close onclick={handleClick}>
    {@render (children as Snippet)?.()}
  </button>
{/if}
