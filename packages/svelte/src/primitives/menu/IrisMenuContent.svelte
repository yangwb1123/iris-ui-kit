<script lang="ts">
  import { getMenuContext } from './context'
  import { useFloating } from '../../floating/useFloating.svelte'
  import { useDismiss } from '../../floating/useDismiss.svelte'
  import { portal } from '../../internal/portal'

  interface Props {
    style?: string
    /** Pass `false` to render the menu content inline (no portal). */
    portalTarget?: HTMLElement | false
    onkeydown?: (e: KeyboardEvent) => void
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { style, portalTarget, onkeydown, children, ...rest }: Props = $props()
  const ctx = getMenuContext('IrisMenuContent')

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

  function setContentRef(node: HTMLElement): { destroy: () => void } {
    ctx.setContent(node)
    return { destroy: () => ctx.setContent(undefined) }
  }

  // Auto-focus first item on open; restore focus on close.
  let wasOpen = false
  $effect(() => {
    const isOpen = ctx.open
    if (isOpen && !wasOpen) {
      queueMicrotask(() => {
        ctx.content
          ?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')
          ?.focus()
      })
    } else if (!isOpen && wasOpen) {
      ctx.trigger?.focus?.()
    }
    wasOpen = isOpen
  })

  function handleKeyDown(e: KeyboardEvent): void {
    onkeydown?.(e)
    const root = ctx.content
    if (!root) return
    const items = Array.from(
      root.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'),
    )
    if (items.length === 0) return
    const idx = items.indexOf(document.activeElement as HTMLElement)
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        items[idx < 0 ? 0 : (idx + 1) % items.length]?.focus()
        break
      case 'ArrowUp':
        e.preventDefault()
        items[idx <= 0 ? items.length - 1 : idx - 1]?.focus()
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
    'background: var(--iris-surface); color: var(--iris-foreground); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px); padding: var(--iris-padding-sm, 4px); box-shadow: var(--iris-shadow-lg); min-width: 160px; outline: none; z-index: 1000'
  const mergedStyle = $derived(`${floating.floatingStyles}; ${VISUAL}${style ? '; ' + style : ''}`)
</script>

{#if ctx.open}
  <div
    {...rest}
    use:setContentRef
    use:portal={portalTarget}
    id={ctx.contentId}
    role="menu"
    tabindex={-1}
    data-iris-menu-content
    data-state="open"
    onkeydown={handleKeyDown}
    style={mergedStyle}
  >
    {@render children?.()}
  </div>
{/if}
