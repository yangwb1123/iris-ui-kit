<script lang="ts" module>
  /** A single menu row, or a divider. */
  export type MenuItem =
    | { label: string; onClick?: () => void; danger?: boolean; disabled?: boolean }
    | { separator: true }

  const isSeparator = (item: MenuItem): item is { separator: true } =>
    (item as { separator?: true }).separator === true

  const MENU_WIDTH = 220
  const VIEWPORT_MARGIN = 8
</script>

<script lang="ts">
  interface Props {
    /** Anchor position (viewport coordinates); the menu is clamped to stay on screen. */
    x: number
    y: number
    items: MenuItem[]
    onClose: () => void
  }

  let { x, y, items, onClose }: Props = $props()

  let el = $state<HTMLDivElement>()
  // Measured clamped position; the $effect below sets it from the anchor (x, y)
  // on mount and whenever the anchor / items change.
  // svelte-ignore state_referenced_locally
  let pos = $state({ left: x, top: y })

  // Measure the rendered menu so the clamp can account for its real height.
  $effect(() => {
    // Re-run when the anchor or items change.
    void x
    void y
    void items
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = el?.offsetWidth ?? MENU_WIDTH
    const height = el?.offsetHeight ?? 0
    const left = Math.max(VIEWPORT_MARGIN, Math.min(x, vw - width - VIEWPORT_MARGIN))
    const top = Math.max(VIEWPORT_MARGIN, Math.min(y, vh - height - VIEWPORT_MARGIN))
    pos = { left, top }
  })

  // Dismiss on click-outside (captured pointerdown, so we win over the desktop's
  // own pointerdown handler) or Escape.
  $effect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (el && !el.contains(e.target as Node)) onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  })
</script>

<!--
  A reusable right-click menu, token-styled to the active OS skin. Renders at
  (x, y), clamped into the viewport, and dismisses on click-outside or Escape.
  Item clicks fire `onClick` then `onClose`.
-->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={el}
  role="menu"
  tabindex="-1"
  class="ctx-menu"
  style:position="fixed"
  style:left="{pos.left}px"
  style:top="{pos.top}px"
  style:z-index="99999"
  style:min-width="{MENU_WIDTH}px"
  style:padding="6px"
  style:border-radius="var(--os-window-radius)"
  style:background="var(--os-window-bg)"
  style:color="var(--os-window-fg)"
  style:border="var(--os-window-border)"
  style:box-shadow="var(--os-window-shadow)"
  style:backdrop-filter="var(--os-blur)"
  style:-webkit-backdrop-filter="var(--os-blur)"
  style:font="13px var(--os-font)"
  style:user-select="none"
  onpointerdown={(e) => e.stopPropagation()}
  oncontextmenu={(e) => e.preventDefault()}
>
  {#each items as item, i (i)}
    {#if isSeparator(item)}
      <div role="separator" class="ctx-sep"></div>
    {:else}
      <button
        type="button"
        role="menuitem"
        class="ctx-menu-item"
        disabled={item.disabled}
        style:color={item.danger ? '#e5484d' : 'inherit'}
        onclick={() => {
          item.onClick?.()
          onClose()
        }}
      >
        {item.label}
      </button>
    {/if}
  {/each}
</div>

<style>
  .ctx-menu {
    display: flex;
    flex-direction: column;
    animation: ctx-menu-in 90ms ease-out;
  }
  @keyframes ctx-menu-in {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  .ctx-sep {
    height: 1px;
    margin: 5px 6px;
    background: rgba(127, 127, 127, 0.28);
  }
  .ctx-menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 7px 12px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s ease;
  }
  .ctx-menu-item:hover:not(:disabled),
  .ctx-menu-item:focus-visible:not(:disabled) {
    background: rgba(127, 127, 127, 0.18);
    outline: none;
  }
  .ctx-menu-item:disabled {
    opacity: 0.45;
    cursor: default;
  }
  @media (prefers-reduced-motion: reduce) {
    .ctx-menu {
      animation: none;
    }
  }
</style>
