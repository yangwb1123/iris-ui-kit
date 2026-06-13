<script lang="ts">
  import { getMenuContext } from './context'

  interface Props {
    onclick?: (e: MouseEvent) => void
    onkeydown?: (e: KeyboardEvent) => void
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { onclick, onkeydown, children, ...rest }: Props = $props()
  const ctx = getMenuContext('IrisMenuTrigger')

  function setTriggerRef(node: HTMLElement): { destroy: () => void } {
    ctx.setTrigger(node)
    return { destroy: () => ctx.setTrigger(undefined) }
  }

  function handleClick(e: MouseEvent): void {
    onclick?.(e)
    ctx.setOpen(!ctx.open)
  }

  // Keyboard open: ArrowDown/Enter/Space open the menu (which then focuses
  // its first item). Matches the Vue/React/Solid triggers.
  function handleKeyDown(e: KeyboardEvent): void {
    onkeydown?.(e)
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      ctx.setOpen(true)
    }
  }
</script>

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
  {@render children?.()}
</button>
