<script lang="ts">
  import { APPS } from './apps'
  import { wm, useWmState } from './wm.svelte'
  import Window from './Window.svelte'
  import Taskbar from './Taskbar.svelte'
  import StartMenu from './StartMenu.svelte'

  /** Desktop shortcuts shown top-left; double-click opens the app. */
  const SHORTCUTS = ['about', 'files', 'showcase', 'notepad']

  const wmState = useWmState()
  const windows = $derived(wmState.value.windows)
  // Windows painted in ascending z-order.
  const ordered = $derived([...windows].sort((a, b) => a.z - b.z))

  let launcherOpen = $state(false)

  function open(appId: string) {
    const app = APPS.find((a) => a.id === appId)
    if (app) wm.open({ appId: app.id, title: app.name, rect: app.defaultSize })
  }

  // Keyboard shortcuts: Alt+Tab cycles focus, Meta+Space toggles the launcher,
  // Escape closes it.
  $effect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
      if (e.key === 'Escape' && launcherOpen) {
        e.preventDefault()
        launcherOpen = false
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="desktop" onpointerdown={() => (launcherOpen = false)}>
  <!-- Desktop icons -->
  <div class="icons">
    {#each SHORTCUTS as id (id)}
      {@const app = APPS.find((a) => a.id === id)}
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

  <!-- Windows (painted in z-order) -->
  {#each ordered as w (w.id)}
    <Window window={w} />
  {/each}

  <!-- Empty-desktop hint when nothing is open -->
  {#if windows.length === 0}
    <div class="hint">
      <div>
        <div style="font-size:22px;font-weight:600">Iris Desktop OS</div>
        <div style="opacity:.85;margin-top:6px">
          Double-click an icon, or press Start. The same window manager as the React demo, on Svelte.
        </div>
      </div>
    </div>
  {/if}

  <StartMenu open={launcherOpen} onClose={() => (launcherOpen = false)} />
  <Taskbar {launcherOpen} onToggleLauncher={() => (launcherOpen = !launcherOpen)} />
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
