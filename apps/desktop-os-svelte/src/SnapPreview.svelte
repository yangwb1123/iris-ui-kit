<script lang="ts">
  import type { SnapZone } from '@iris-ui-kit/core/window'
  import { useWmState } from './wm.svelte'
  import { previewRect } from './depth'

  interface Props {
    /** The hinted snap zone (or `null` to render nothing). */
    zone: SnapZone | null
  }

  let { zone }: Props = $props()

  // Read the live work area from the WM so the preview tracks bar insets / resizes.
  const wmState = useWmState()
  const workArea = $derived(wmState.value.workArea)
  const r = $derived(zone ? previewRect(zone, workArea) : null)
</script>

<!--
  Translucent, accent-tinted SNAP PREVIEW overlay shown while a window is dragged
  near a work-area edge (Windows/KDE "Snap Assist" feel). Painted BEHIND windows
  (windows have z ≥ 1) but above the wallpaper, z-index 0, pointer-events none.
  Token-driven via `--os-accent`. Renders nothing when no zone is hinted.
-->
{#if zone && r}
  <div
    aria-hidden="true"
    data-snap-preview={zone}
    class="snap-preview"
    style:left="{r.x}px"
    style:top="{r.y}px"
    style:width="{r.width}px"
    style:height="{r.height}px"
  ></div>
{/if}

<style>
  .snap-preview {
    position: absolute;
    z-index: 0;
    pointer-events: none;
    border-radius: var(--os-window-radius);
    background: color-mix(in srgb, var(--os-accent) 28%, transparent);
    border: 2px solid var(--os-accent);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.28);
    backdrop-filter: var(--os-blur);
    -webkit-backdrop-filter: var(--os-blur);
    transition:
      left 90ms ease,
      top 90ms ease,
      width 90ms ease,
      height 90ms ease;
  }
</style>
