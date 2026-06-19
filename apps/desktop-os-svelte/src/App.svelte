<script lang="ts">
  import { barInsets } from './os'
  import { wm } from './wm.svelte'
  import Desktop from './Desktop.svelte'

  let rootEl: HTMLDivElement | undefined = $state()

  // Reserve the taskbar and feed the remaining rectangle to the WM as its work
  // area (drives maximize + snap). Re-measured on resize via ResizeObserver.
  $effect(() => {
    const el = rootEl
    if (!el) return
    const { top, bottom } = barInsets()
    const apply = () => {
      const r = el.getBoundingClientRect()
      wm.setWorkArea({
        x: 0,
        y: top,
        width: r.width,
        height: Math.max(240, r.height - top - bottom),
      })
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  })
</script>

<div bind:this={rootEl} class="os-root">
  <Desktop />
</div>

<style>
  .os-root {
    position: fixed;
    inset: 0;
    overflow: hidden;
    font-family: var(--os-font);
    background: var(--os-wallpaper);
  }
</style>
