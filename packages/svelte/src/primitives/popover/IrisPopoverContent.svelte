<script lang="ts">
  import { getPopoverContext } from './context'
  import { useFloating } from '../../floating/useFloating.svelte'
  import { useDismiss } from '../../floating/useDismiss.svelte'
  import { portal } from '../../internal/portal'

  interface Props {
    style?: string
    /** Focus the panel when it opens. Default true. */
    autoFocus?: boolean
    /** Restore focus to the trigger when it closes. Default true. */
    restoreFocus?: boolean
    /** Portal target — pass `false` to render in place. */
    portalTarget?: HTMLElement | false
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let {
    style,
    autoFocus = true,
    restoreFocus = true,
    portalTarget,
    children,
    ...rest
  }: Props = $props()
  const ctx = getPopoverContext('IrisPopoverContent')

  // Focus the panel on open; restore focus to the trigger on close (mirrors
  // React/Vue; defaults on).
  let wasOpen = false
  let lastFocused: HTMLElement | null = null
  $effect(() => {
    const isOpen = ctx.open
    if (isOpen && !wasOpen) {
      lastFocused = (document.activeElement as HTMLElement | null) ?? ctx.trigger ?? null
      if (autoFocus) queueMicrotask(() => ctx.content?.focus())
    } else if (!isOpen && wasOpen) {
      if (restoreFocus) (ctx.trigger ?? lastFocused)?.focus()
    }
    wasOpen = isOpen
  })

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

  const VISUAL =
    'background: var(--iris-surface-floating); animation: var(--iris-anim-popover); color: var(--iris-foreground); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px); padding: var(--iris-padding-md, 8px); box-shadow: var(--iris-shadow-lg); min-width: 160px; outline: none; z-index: var(--iris-z-popover, 1000)'
  const mergedStyle = $derived(`${floating.floatingStyles}; ${VISUAL}${style ? '; ' + style : ''}`)
</script>

{#if ctx.open}
  <div
    {...rest}
    use:setContentRef
    use:portal={portalTarget}
    id={ctx.contentId}
    role="dialog"
    tabindex={-1}
    data-iris-popover-content
    data-state="open"
    style={mergedStyle}
  >
    {@render children?.()}
  </div>
{/if}
