<script lang="ts">
  import { generateId, createHoverIntent } from '@iris-ui-kit/core'
  import { useFloating } from '../../floating/useFloating.svelte'
  import { portal } from '../../internal/portal'
  import type { Placement } from '@iris-ui-kit/core'

  interface Props {
    content?: string
    placement?: Placement
    offset?: number
    openDelay?: number
    closeDelay?: number
    disabled?: boolean
    /** Portal target — pass `false` to render in place. */
    portalTarget?: HTMLElement | false
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
    portalTarget,
    children,
    'content-slot': contentSlot,
    ...rest
  }: Props = $props()

  let open = $state(false)
  let triggerEl = $state<HTMLElement | undefined>(undefined)
  let tooltipEl = $state<HTMLElement | undefined>(undefined)
  const tooltipId = generateId()

  // createHoverIntent — state machine driven timing for open/close delays.
  // The onChange callback synchronously sets the reactive $state variable.
  // Created eagerly so event handlers on first mount have a valid `hi`.
  let hi: ReturnType<typeof createHoverIntent> = createHoverIntent({
    onChange: (v) => {
      open = v
    },
  })

  // Re-create when openDelay/closeDelay change; cleanup on unmount.
  $effect(() => {
    void openDelay
    void closeDelay
    hi.stop()
    hi = createHoverIntent({
      openDelay,
      closeDelay,
      onChange: (v) => {
        open = v
      },
    })
    return () => hi.stop()
  })

  // Escape closes immediately
  $effect(() => {
    if (!open || typeof document === 'undefined') return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        hi.close()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  // If disabled while open, close immediately
  $effect(() => {
    if (disabled && open) {
      hi.close()
    }
  })

  const floating = useFloating({
    anchor: () => triggerEl,
    floating: () => tooltipEl,
    open: () => open,
    placement: () => placement,
    offset: () => offset,
  })

  function setTrigger(node: HTMLElement): { destroy: () => void } {
    triggerEl = node
    return {
      destroy: () => {
        triggerEl = undefined
      },
    }
  }

  function setTooltip(node: HTMLElement): { destroy: () => void } {
    tooltipEl = node
    return {
      destroy: () => {
        tooltipEl = undefined
      },
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->

<!-- Trigger wrapper -->
<span
  use:setTrigger
  role="group"
  aria-describedby={open ? tooltipId : undefined}
  onpointerenter={() => {
    if (openDelay > 0) hi.pointerEnter()
    else hi.open()
  }}
  onpointerleave={() => {
    if (closeDelay > 0) hi.pointerLeave()
    else hi.close()
  }}
  onfocusin={() => hi.open()}
  onfocusout={() => hi.close()}
  data-iris-tooltip-trigger
  style="display: contents"
>
  {@render children?.()}
</span>

{#if open}
  <div
    {...rest}
    use:setTooltip
    use:portal={portalTarget}
    id={tooltipId}
    role="tooltip"
    data-iris-tooltip
    data-state="open"
    data-placement={placement}
    style="{floating.floatingStyles}; background: var(--iris-foreground); color: var(--iris-background); padding: 4px 8px; border-radius: var(--iris-radius-sm, 4px); font-size: 12px; line-height: 1.4; max-width: 240px; pointer-events: none; z-index: 1100; {rest.style ??
      ''}"
  >
    {#if contentSlot}
      {@render contentSlot()}
    {:else}
      {content}
    {/if}
  </div>
{/if}
