<script lang="ts">
  import { getDropdownContext } from './context'
  import type { IrisDropdownTriggerProps } from './types'

  let { onclick, children, ...rest }: IrisDropdownTriggerProps = $props()
  const ctx = getDropdownContext('IrisDropdownTrigger')

  function setTriggerRef(node: HTMLElement) {
    ctx.setTrigger(node)
    return { destroy: () => ctx.setTrigger(undefined) }
  }

  function handleClick(e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
    onclick?.(e)
    ctx.setOpen(!ctx.open)
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
>
  {@render children?.()}
</button>
