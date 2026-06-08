<script lang="ts">
  import { getPopoverContext } from './context'

  interface Props {
    onclick?: (e: MouseEvent) => void
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { onclick, children, ...rest }: Props = $props()
  const ctx = getPopoverContext('IrisPopoverTrigger')

  function setTriggerRef(node: HTMLElement): { destroy: () => void } {
    ctx.setTrigger(node)
    return { destroy: () => ctx.setTrigger(undefined) }
  }

  function handleClick(e: MouseEvent): void {
    onclick?.(e)
    ctx.setOpen(!ctx.open)
  }
</script>

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
  {@render children?.()}
</button>
