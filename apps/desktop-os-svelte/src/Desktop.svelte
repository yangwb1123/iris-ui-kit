<script lang="ts">
  import type { SnapZone } from '@iris-ui/core/window'
  import { wm, useWmState } from './wm.svelte'
  import { useOs } from './os-state.svelte'
  import { OS_ORDER, CHROMES } from './os'
  import { getManifest } from './catalog'
  import { launchApp } from './profile.svelte'
  import Window from './Window.svelte'
  import SnapPreview from './SnapPreview.svelte'
  import ContextMenu, { type MenuItem } from './ContextMenu.svelte'
  import Taskbar from './Taskbar.svelte'
  import StartMenu from './StartMenu.svelte'
  import MenuBar from './MenuBar.svelte'
  import Dock from './Dock.svelte'
  import Panel from './Panel.svelte'
  import Spotlight from './Spotlight.svelte'
  import Kickoff from './Kickoff.svelte'
  import CommandPalette from './CommandPalette.svelte'

  // The live OS skin drives the bar dispatch (the Svelte counterpart of React's
  // `Bars.tsx`): TopBar (MenuBar | none), BottomBar (Taskbar | Dock | Panel) and
  // Launcher (StartMenu | Spotlight | Kickoff) are chosen from the active
  // chrome's structural flags.
  const osCtx = useOs()
  const chrome = $derived(osCtx.chrome)

  /** Desktop shortcuts shown top-left; double-click opens the app. */
  const SHORTCUTS = ['about', 'appstore', 'files', 'showcase']

  const wmState = useWmState()
  const windows = $derived(wmState.value.windows)
  // Windows painted in ascending z-order.
  const ordered = $derived([...windows].sort((a, b) => a.z - b.z))

  let launcherOpen = $state(false)
  let paletteOpen = $state(false)
  // Live drag-to-edge snap zone (lifted from Window) → drives the snap preview.
  let snapHint = $state<SnapZone | null>(null)
  // Right-click desktop menu anchor (null = closed).
  let menu = $state<{ x: number; y: number } | null>(null)

  function open(appId: string) {
    launchApp(appId)
  }

  // Desktop right-click menu: switch OS skin, open Display settings, or refresh
  // (just dismiss). Mirrors React's `Desktop.tsx` `desktopMenuItems`.
  const desktopMenuItems = $derived<MenuItem[]>([
    ...OS_ORDER.map(
      (id): MenuItem => ({ label: `Use ${CHROMES[id].label}`, onClick: () => osCtx.setOs(id) }),
    ),
    { separator: true },
    { label: 'Display settings', onClick: () => open('settings') },
    { label: 'Refresh', onClick: () => (menu = null) },
  ])

  // Keyboard shortcuts: Alt+Tab cycles focus, (Meta|Ctrl)+K toggles the command
  // palette, Meta+Space toggles the launcher, Escape closes the open overlay.
  $effect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        paletteOpen = !paletteOpen
        return
      }
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault()
        const cyclable = wm.ordered().filter((w) => w.state !== 'minimized')
        if (cyclable.length === 0) return
        const focusedId = wm.getState().focusedId
        const idx = cyclable.findIndex((w) => w.id === focusedId)
        const next = cyclable[(idx + 1) % cyclable.length]
        wm.focus(next.id)
        return
      }
      if (e.metaKey && e.code === 'Space') {
        e.preventDefault()
        launcherOpen = !launcherOpen
        return
      }
      if (e.key === 'Escape') {
        if (paletteOpen) {
          e.preventDefault()
          paletteOpen = false
        } else if (launcherOpen) {
          e.preventDefault()
          launcherOpen = false
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="desktop"
  onpointerdown={() => (launcherOpen = false)}
  oncontextmenu={(e) => {
    e.preventDefault()
    menu = { x: e.clientX, y: e.clientY }
  }}
>
  <!-- Desktop icons -->
  <div class="icons">
    {#each SHORTCUTS as id (id)}
      {@const app = getManifest(id)}
      {#if app}
        <button
          type="button"
          class="desktop-icon"
          ondblclick={() => open(id)}
          onpointerdown={(e) => e.stopPropagation()}
        >
          <span style="font-size:30px">{app.icon}</span>
          <span style="font-size:12px">{app.name}</span>
        </button>
      {/if}
    {/each}
  </div>

  <!-- Drag-to-edge snap preview — behind windows (z 0), above the wallpaper -->
  <SnapPreview zone={snapHint} />

  <!-- Windows (painted in z-order) -->
  {#each ordered as w (w.id)}
    <Window window={w} onSnapHint={(z) => (snapHint = z)} />
  {/each}

  <!-- Empty-desktop hint when nothing is open -->
  {#if windows.length === 0}
    <div class="hint">
      <div>
        <div style="font-size:22px;font-weight:600">Iris Desktop OS</div>
        <div style="opacity:.85;margin-top:6px">
          Double-click an icon, or press Start. The same window manager as the React demo, on
          Svelte.
        </div>
      </div>
    </div>
  {/if}

  <!-- Launcher — Spotlight (mac), Kickoff (KDE) or Start menu (Win), per skin. -->
  {#if chrome.launcher === 'spotlight'}
    <Spotlight open={launcherOpen} onClose={() => (launcherOpen = false)} />
  {:else if chrome.launcher === 'kickoff'}
    <Kickoff open={launcherOpen} onClose={() => (launcherOpen = false)} />
  {:else}
    <StartMenu open={launcherOpen} onClose={() => (launcherOpen = false)} />
  {/if}

  <!-- Top bar — macOS menu bar; nothing on Windows / KDE. -->
  {#if chrome.topBar === 'menubar'}
    <MenuBar />
  {/if}

  <!-- Bottom bar — Dock (mac), Panel (KDE) or Taskbar (Win), per skin. -->
  {#if chrome.bottomBar === 'dock'}
    <Dock onToggleLauncher={() => (launcherOpen = !launcherOpen)} />
  {:else if chrome.bottomBar === 'panel'}
    <Panel onToggleLauncher={() => (launcherOpen = !launcherOpen)} />
  {:else}
    <Taskbar {launcherOpen} onToggleLauncher={() => (launcherOpen = !launcherOpen)} />
  {/if}

  <CommandPalette open={paletteOpen} onClose={() => (paletteOpen = false)} />

  <!-- Desktop right-click context menu (anchored at the click). -->
  {#if menu}
    <ContextMenu x={menu.x} y={menu.y} items={desktopMenuItems} onClose={() => (menu = null)} />
  {/if}
</div>

<style>
  .desktop {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .icons {
    position: absolute;
    top: 16px;
    left: 16px;
    display: grid;
    gap: 6px;
    grid-auto-rows: min-content;
  }
  .hint {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    color: rgba(255, 255, 255, 0.85);
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.5);
    text-align: center;
  }
</style>
