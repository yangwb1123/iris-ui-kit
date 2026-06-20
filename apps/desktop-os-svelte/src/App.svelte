<script lang="ts">
  import { barInsets } from './os'
  import { useOs } from './os-state.svelte'
  import { wm } from './wm.svelte'
  import { profile } from './profile.svelte'
  import Desktop from './Desktop.svelte'

  let rootEl: HTMLDivElement | undefined = $state()

  // The live OS skin (Win11 / macOS). Its `chrome.vars` are written onto the
  // desktop root inline (replacing the hardcoded Win11 vars in style.css) so a
  // skin switch re-skins everything live, and its `barInsets` drive the WM work
  // area so maximize / snap track the taskbar vs. the menu-bar + dock.
  const osCtx = useOs()
  const chrome = $derived(osCtx.chrome)
  // The chrome's CSS custom properties as a `--key:value;…` inline-style string.
  const skinStyle = $derived(
    Object.entries(chrome.vars)
      .map(([k, v]) => `${k}:${v}`)
      .join(';'),
  )

  // Load the user profile (installed apps + custom web apps + prefs) from storage
  // once at startup. Hydration is async; the desktop renders immediately and the
  // installed/custom apps appear in the launchers when it lands.
  $effect(() => {
    void profile.hydrate()
  })

  // Reserve the top + bottom bars and feed the remaining rectangle to the WM as
  // its work area (drives maximize + snap). Re-measured on resize via a
  // ResizeObserver AND recomputed whenever the chrome (skin) changes — reading
  // `chrome` here makes the `$effect` re-run on every OS switch.
  $effect(() => {
    const el = rootEl
    if (!el) return
    const { top, bottom } = barInsets(chrome)
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

<div bind:this={rootEl} class="os-root" style={skinStyle}>
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
