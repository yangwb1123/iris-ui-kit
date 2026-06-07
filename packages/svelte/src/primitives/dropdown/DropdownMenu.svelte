<script lang="ts">
  import { getDropdownContext } from './context'
  import { useFloating } from '../../floating/useFloating.svelte'
  import { useDismiss } from '../../floating/useDismiss.svelte'
  import { portal } from '../../internal/portal'
  import { mergeStyle } from '../../internal/style'
  import type { IrisDropdownMenuProps } from './types'

  let { portalTarget, style, onkeydown, children, ...rest }: IrisDropdownMenuProps = $props()
  const ctx = getDropdownContext('IrisDropdownMenu')

  const floating = useFloating({
    anchor: () => ctx.trigger,
    floating: () => ctx.content,
    open: () => ctx.open,
    placement: ctx.placement,
    offset: ctx.offset,
  })

  useDismiss({
    enabled: () => ctx.open,
    exclude: [() => ctx.trigger, () => ctx.content],
    onDismiss: () => ctx.setOpen(false),
  })

  function setContentRef(node: HTMLElement) {
    ctx.setContent(node)
    return { destroy: () => ctx.setContent(undefined) }
  }

  // Focus the first item on open; restore focus to the trigger on close.
  let wasOpen = false
  $effect(() => {
    const open = ctx.open
    if (open && !wasOpen) {
      queueMicrotask(() => {
        ctx.content?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
      })
    } else if (!open && wasOpen) {
      ctx.trigger?.focus?.()
    }
    wasOpen = open
  })

  function handleKeyDown(e: KeyboardEvent & { currentTarget: EventTarget & HTMLDivElement }) {
    onkeydown?.(e)
    const root = ctx.content
    if (!root) return
    const items = Array.from(
      root.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'),
    )
    if (items.length === 0) return
    const index = items.indexOf(document.activeElement as HTMLElement)
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        items[index < 0 ? 0 : (index + 1) % items.length]?.focus()
        break
      case 'ArrowUp':
        e.preventDefault()
        items[index <= 0 ? items.length - 1 : index - 1]?.focus()
        break
      case 'Home':
        e.preventDefault()
        items[0]?.focus()
        break
      case 'End':
        e.preventDefault()
        items[items.length - 1]?.focus()
        break
      case 'Tab':
        ctx.setOpen(false)
        break
    }
  }

  const VISUAL =
    'background: var(--iris-surface); color: var(--iris-foreground); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px); padding: var(--iris-padding-sm, 4px); box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.16), 0 4px 8px -2px rgba(0, 0, 0, 0.08); min-width: 160px; outline: none; z-index: 1000'
  const menuStyle = $derived(mergeStyle(`${floating.floatingStyles}; ${VISUAL}`, style))
</script>

{#if ctx.open}
  <div
    {...rest}
    use:setContentRef
    use:portal={portalTarget}
    id={ctx.contentId}
    role="menu"
    tabindex={-1}
    data-iris-dropdown-menu
    data-state="open"
    onkeydown={handleKeyDown}
    style={menuStyle}
  >
    {@render children?.()}
  </div>
{/if}
