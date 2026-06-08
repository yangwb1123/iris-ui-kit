<script lang="ts">
  import { getDrawerContext } from './context'

  interface Props {
    onclick?: (e: MouseEvent) => void
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { onclick, children, ...rest }: Props = $props()
  const ctx = getDrawerContext('IrisDrawerTrigger')

  function setTriggerRef(node: HTMLElement): { destroy: () => void } {
    ctx.setTrigger(node)
    return { destroy: () => ctx.setTrigger(undefined) }
  }

  function handleClick(e: MouseEvent): void {
    onclick?.(e)
    ctx.setOpen(true)
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
