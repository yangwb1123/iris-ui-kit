<script lang="ts">
  /**
   * macOS global menu bar — the Svelte mirror of React's `components/MenuBar.tsx`.
   * Apple menu + the focused app's name + working menus on the left, a clock on
   * the right. Rendered only when the active chrome's `topBar === 'menubar'` (see
   * the TopBar dispatch in Desktop.svelte). Menus open on click / hover-while-open
   * and close on select or click-outside; only a few entries are wired to real WM
   * actions (the rest are inert, like the reference).
   */
  import { wm, useWmState } from './wm.svelte'
  import { getManifest } from './catalog'

  interface MenuEntry {
    label: string
    /** Action to run; omit for a disabled-looking, inert item. */
    onSelect?: () => void
    /** Render as a thin divider instead of a clickable row. */
    separator?: boolean
  }

  const wmState = useWmState()
  const focused = $derived(
    wmState.value.windows.find(
      (w) => w.id === wmState.value.focusedId && w.state !== 'minimized',
    ) ?? null,
  )
  const appName = $derived(focused ? (getManifest(focused.appId)?.name ?? focused.title) : 'Finder')

  // Live clock (refresh every 30s, like the reference).
  let now = $state(new Date())
  $effect(() => {
    const t = setInterval(() => (now = new Date()), 1000 * 30)
    return () => clearInterval(t)
  })
  const dateLabel = $derived(
    now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
  )
  const timeLabel = $derived(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))

  // Which menu is open (by key); null = none. Click-outside / select closes.
  let openMenu = $state<string | null>(null)
  let barEl: HTMLDivElement | undefined = $state()

  $effect(() => {
    if (!openMenu) return
    const onDown = (e: PointerEvent) => {
      if (barEl && !barEl.contains(e.target as Node)) openMenu = null
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  })

  function run(fn?: () => void) {
    openMenu = null
    fn?.()
  }

  function openAbout() {
    const app = getManifest('about')
    if (app) wm.open({ appId: 'about', title: app.name, rect: app.defaultSize })
  }
  function openSettings() {
    const app = getManifest('settings')
    if (app) wm.open({ appId: 'settings', title: app.name, rect: app.defaultSize })
  }

  // Re-derive the menus whenever the focused app changes so labels/actions track it.
  const menus = $derived<Record<string, MenuEntry[]>>({
    apple: [
      { label: 'About This Mac', onSelect: () => openAbout() },
      { label: 'sep1', separator: true },
      { label: 'System Settings…', onSelect: () => openSettings() },
      { label: 'sep2', separator: true },
      { label: 'Sleep' },
      { label: 'Restart…' },
      { label: 'Shut Down…' },
    ],
    file: [
      { label: 'New' },
      { label: 'Open…' },
      { label: 'sep1', separator: true },
      { label: 'Save' },
    ],
    edit: [
      { label: 'Undo' },
      { label: 'Redo' },
      { label: 'sep1', separator: true },
      { label: 'Cut' },
      { label: 'Copy' },
      { label: 'Paste' },
    ],
    view: [{ label: 'as Icons' }, { label: 'as List' }, { label: 'Show Toolbar' }],
    app: [
      { label: `About ${appName}` },
      { label: 'sep1', separator: true },
      { label: 'Preferences…', onSelect: () => openSettings() },
      { label: 'sep2', separator: true },
      { label: `Quit ${appName}`, onSelect: focused ? () => wm.close(focused.id) : undefined },
    ],
    window: [
      { label: 'Minimize', onSelect: focused ? () => wm.minimize(focused.id) : undefined },
      { label: 'Zoom', onSelect: focused ? () => wm.toggleMaximize(focused.id) : undefined },
      { label: 'sep1', separator: true },
      { label: 'Close Window', onSelect: focused ? () => wm.close(focused.id) : undefined },
    ],
    help: [{ label: 'Iris Desktop OS Help' }],
  })

  const titles: { key: string; label: string; bold?: boolean }[] = $derived([
    { key: 'apple', label: '' },
    { key: 'app', label: appName, bold: true },
    { key: 'file', label: 'File' },
    { key: 'edit', label: 'Edit' },
    { key: 'view', label: 'View' },
    { key: 'window', label: 'Window' },
    { key: 'help', label: 'Help' },
  ])

  function onTitleEnter(key: string) {
    // Hover switches the open menu only when one is already open (mac behavior).
    if (openMenu) openMenu = key
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={barEl} class="menubar" onpointerdown={(e) => e.stopPropagation()}>
  {#each titles as t (t.key)}
    {@const active = openMenu === t.key}
    <span class="menu-anchor">
      <button
        type="button"
        class="menu-title"
        class:menu-title--apple={t.key === 'apple'}
        class:menu-title--bold={t.bold}
        class:menu-title--active={active}
        onclick={() => (openMenu = active ? null : t.key)}
        onpointerenter={() => onTitleEnter(t.key)}
      >
        {t.key === 'apple' ? '' : t.label}
      </button>
      {#if active}
        <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
        <div role="menu" class="menu-dropdown">
          {#each menus[t.key] ?? [] as entry (entry.label)}
            {#if entry.separator}
              <div class="menu-sep"></div>
            {:else}
              <button
                type="button"
                role="menuitem"
                class="menu-item"
                disabled={!entry.onSelect}
                onclick={() => run(entry.onSelect)}
              >
                {entry.label}
              </button>
            {/if}
          {/each}
        </div>
      {/if}
    </span>
  {/each}
  <span style="flex:1"></span>
  <span class="menu-status">🔋 🔍</span>
  <span class="menu-clock">{dateLabel} {timeLabel}</span>
</div>

<style>
  .menubar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: var(--os-topbar-h);
    display: flex;
    align-items: center;
    font-size: 13px;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    background: rgba(0, 0, 0, 0.28);
    backdrop-filter: var(--os-blur);
    -webkit-backdrop-filter: var(--os-blur);
    z-index: 90000;
    user-select: none;
  }
  .menu-anchor {
    position: relative;
  }
  .menu-title {
    padding: 0 10px;
    height: var(--os-topbar-h);
    line-height: var(--os-topbar-h);
    font-weight: 500;
    font-size: 13px;
    border: none;
    background: transparent;
    color: inherit;
    text-shadow: inherit;
    cursor: default;
    border-radius: 4px;
  }
  .menu-title--apple {
    font-size: 15px;
  }
  .menu-title--bold {
    font-weight: 700;
  }
  .menu-title--active {
    background: rgba(255, 255, 255, 0.22);
  }
  .menu-dropdown {
    position: absolute;
    top: calc(100% + 2px);
    left: 0;
    min-width: 200px;
    padding: 5px;
    border-radius: 8px;
    background: var(--os-window-bg);
    color: var(--os-window-fg);
    border: var(--os-window-border);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.4);
    backdrop-filter: var(--os-blur);
    -webkit-backdrop-filter: var(--os-blur);
    text-shadow: none;
    z-index: 1;
  }
  .menu-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 4px 10px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 13px;
    cursor: default;
  }
  .menu-item:disabled {
    opacity: 0.4;
  }
  .menu-item:not(:disabled):hover {
    background: color-mix(in srgb, var(--os-accent) 90%, white);
    color: #fff;
  }
  .menu-sep {
    height: 1px;
    margin: 5px 6px;
    background: rgba(127, 127, 127, 0.28);
  }
  .menu-status {
    padding: 0 10px;
  }
  .menu-clock {
    padding: 0 14px 0 6px;
  }
</style>
