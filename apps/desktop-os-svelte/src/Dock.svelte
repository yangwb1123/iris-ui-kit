<script lang="ts">
  /**
   * macOS Dock — the Svelte mirror of React's `components/Dock.tsx`. A centered
   * translucent pill of pinned + running apps with running dots, hover
   * magnification (cosine falloff), launch-bounce, and a Launchpad trigger that
   * toggles the launcher (Spotlight). Rendered as the BottomBar when the active
   * chrome's `bottomBar === 'dock'`.
   */
  import { wm, useWmState } from './wm.svelte'
  import { getManifest } from './catalog'
  import { getApps, launchApp, useProfileState } from './profile.svelte'

  interface Props {
    onToggleLauncher: () => void
  }

  let { onToggleLauncher }: Props = $props()

  const PINNED = ['about', 'appstore', 'files', 'showcase', 'settings']

  const BASE = 46 // resting icon box
  const MAX_BOOST = 26 // extra px added to the icon under the cursor
  const RADIUS = 110 // how far (px) the magnification reaches along the dock
  const GAP = 6
  const PAD = 10

  const wmState = useWmState()
  const pstate = useProfileState()
  const apps = $derived(getApps(pstate.value))
  const windows = $derived(wmState.value.windows)
  const currentWorkspace = $derived(wmState.value.currentWorkspace)
  // Only windows on the active virtual desktop count as "running" here.
  const wsWindows = $derived(windows.filter((w) => w.workspace === currentWorkspace))

  const available = $derived(new Set(apps.map((a) => a.id)))
  const running = $derived(new Set(wsWindows.map((w) => w.appId)))

  // Pinned apps that are actually available + any running app not already pinned.
  const items = $derived.by(() => {
    const ids = [
      ...PINNED.filter((id) => available.has(id)),
      ...wsWindows.map((w) => w.appId).filter((id) => !PINNED.includes(id)),
    ]
    const seen = new Set<string>()
    return ids.filter((id) => (seen.has(id) ? false : (seen.add(id), true)))
  })

  // Resolve each item's resting center so magnification is symmetric around the cursor.
  const centers = $derived.by(() => {
    let cursor = 0
    return items.map(() => {
      const c = PAD + cursor + BASE / 2
      cursor += BASE + GAP
      return c
    })
  })

  // Pointer X relative to the dock pill; null when the cursor isn't over it.
  let pointerX = $state<number | null>(null)
  // Icons that should bounce (keyed by appId) right after launch.
  let bouncing = $state<Set<string>>(new Set())

  function bounce(appId: string) {
    bouncing = new Set(bouncing).add(appId)
    window.setTimeout(() => {
      const next = new Set(bouncing)
      next.delete(appId)
      bouncing = next
    }, 560)
  }

  function activate(appId: string) {
    const win = windows.find((w) => w.appId === appId)
    if (win) {
      if (win.focused && win.state !== 'minimized') wm.minimize(win.id)
      else wm.focus(win.id)
    } else {
      const app = getManifest(appId)
      if (!app) return
      launchApp(appId)
      // Only window-creating apps bounce; `link` apps open in a new tab.
      if (app.kind !== 'link') bounce(appId)
    }
  }

  /** Magnification scale (1 → 1+boost) for an icon centered at `center` px. */
  function scaleFor(center: number): number {
    if (pointerX == null) return 1
    const dist = Math.abs(pointerX - center)
    if (dist >= RADIUS) return 1
    // Cosine falloff: smooth, peaks at the cursor, settles to 1 at the radius.
    const t = (Math.cos((dist / RADIUS) * Math.PI) + 1) / 2
    return 1 + (MAX_BOOST / BASE) * t
  }

  function onPillMove(e: PointerEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    pointerX = e.clientX - rect.left
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="dock-wrap" onpointerdown={(e) => e.stopPropagation()}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="dock"
    onpointermove={onPillMove}
    onpointerleave={() => (pointerX = null)}
    style:gap="{GAP}px"
    style:padding="8px {PAD}px"
  >
    {#each items as id, i (id)}
      {@const app = getManifest(id)}
      {#if app}
        {@const scale = scaleFor(centers[i] ?? 0)}
        {@const isBouncing = bouncing.has(id)}
        <button
          type="button"
          title={app.name}
          class="dock-item"
          onclick={() => activate(id)}
          style:width="{BASE}px"
          style:height="{BASE}px"
          style:transform={isBouncing
            ? 'translateY(-22px) scale(1.08)'
            : `scale(${scale.toFixed(3)})`}
        >
          <span style="display:block">{app.icon}</span>
          {#if running.has(id)}
            <span class="dock-dot"></span>
          {/if}
        </button>
      {/if}
    {/each}
    <span class="dock-sep"></span>
    <button
      type="button"
      title="Launchpad"
      class="dock-item dock-item--launcher"
      onclick={onToggleLauncher}
      style:width="{BASE}px"
      style:height="{BASE}px"
    >
      🚀
    </button>
  </div>
</div>

<style>
  .dock-wrap {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 10px;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }
  .dock {
    pointer-events: auto;
    display: flex;
    align-items: flex-end;
    background: var(--os-bar-bg);
    backdrop-filter: var(--os-blur);
    -webkit-backdrop-filter: var(--os-blur);
    border-radius: var(--os-bar-radius);
    border: 1px solid rgba(255, 255, 255, 0.35);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  }
  .dock-item {
    position: relative;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 30px;
    line-height: 1;
    padding: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    transition: transform 140ms cubic-bezier(0.25, 1, 0.5, 1);
    transform-origin: bottom center;
    will-change: transform;
  }
  .dock-item--launcher {
    font-size: 28px;
  }
  .dock-item--launcher:hover {
    transform: scale(1.35);
  }
  .dock-dot {
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--os-window-fg);
    opacity: 0.7;
  }
  .dock-sep {
    width: 1px;
    align-self: stretch;
    margin: 4px;
    background: rgba(0, 0, 0, 0.18);
  }
</style>
