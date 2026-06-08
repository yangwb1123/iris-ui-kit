<script lang="ts">
  import { generateId } from '@iris-ui/core'
  import { useFloating } from '../../floating/useFloating.svelte'
  import { portal } from '../../internal/portal'
  import type { Placement } from '@iris-ui/core'

  interface Props {
    content?: string
    placement?: Placement
    offset?: number
    openDelay?: number
    closeDelay?: number
    disabled?: boolean
    class?: string
    style?: string
    children?: import('svelte').Snippet
    'content-slot'?: import('svelte').Snippet
    [key: string]: unknown
  }

  let {
    content = '',
    placement = 'top',
    offset = 6,
    openDelay = 600,
    closeDelay = 0,
    disabled = false,
    children,
    'content-slot': contentSlot,
    ...rest
  }: Props = $props()

  let open = $state(false)
  let triggerEl = $state<HTMLElement | undefined>(undefined)
  let tooltipEl = $state<HTMLElement | undefined>(undefined)
  const tooltipId = generateId()

  let openTimer: ReturnType<typeof setTimeout> | null = null
  let closeTimer: ReturnType<typeof setTimeout> | null = null

  function clearTimers(): void {
    if (openTimer) { clearTimeout(openTimer); openTimer = null }
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
  }

  function scheduleOpen(): void {
    if (disabled) return
    clearTimers()
    if (openDelay <= 0) { open = true; return }
    openTimer = setTimeout(() => { open = true; openTimer = null }, openDelay)
  }

  function scheduleClose(): void {
    clearTimers()
    if (closeDelay <= 0) { open = false; return }
    closeTimer = setTimeout(() => { open = false; closeTimer = null }, closeDelay)
  }

  // Close immediately on Escape
  $effect(() => {
    if (!open || typeof document === 'undefined') return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { clearTimers(); open = false }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  // If disabled while open, close immediately
  $effect(() => {
    if (disabled && open) { clearTimers(); open = false }
  })

  const floating = useFloating({
    anchor: () => triggerEl,
    floating: () => tooltipEl,
    open: () => open,
    placement,
    offset,
  })

  function setTrigger(node: HTMLElement): { destroy: () => void } {
    triggerEl = node
    return { destroy: () => { triggerEl = undefined } }
  }

  function setTooltip(node: HTMLElement): { destroy: () => void } {
    tooltipEl = node
    return { destroy: () => { tooltipEl = undefined } }
  }
</script>

<!-- Trigger wrapper — we render the children in a span and attach events -->
<span
  use:setTrigger
  aria-describedby={open ? tooltipId : undefined}
  onpointerenter={scheduleOpen}
  onpointerleave={scheduleClose}
  onfocus={scheduleOpen}
  onblur={scheduleClose}
  data-iris-tooltip-trigger
  style="display: contents"
>
  {@render children?.()}
</span>

{#if open}
  <div
    {...rest}
    use:setTooltip
    use:portal
    id={tooltipId}
    role="tooltip"
    data-iris-tooltip
    data-state="open"
    data-placement={placement}
    style="{floating.floatingStyles}; background: var(--iris-foreground); color: var(--iris-background); padding: 4px 8px; border-radius: var(--iris-radius-sm, 4px); font-size: 12px; line-height: 1.4; max-width: 240px; pointer-events: none; z-index: 1100; {rest.style ?? ''}"
  >
    {#if contentSlot}
      {@render contentSlot()}
    {:else}
      {content}
    {/if}
  </div>
{/if}
