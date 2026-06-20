<script lang="ts">
  /**
   * KDE Plasma panel — the Svelte mirror of React's `components/Panel.tsx`. A
   * full-width dark bar: the Kickoff launcher button + LEFT-aligned, LABELLED
   * task buttons for open windows on the left; a system-tray cluster (with a
   * quick-settings popup) + a stacked digital clock on the right. Task buttons
   * focus the window, or minimize it when it's already the active one; right-
   * clicking a task opens a small minimize/close menu. Rendered as the BottomBar
   * when the active chrome's `bottomBar === 'panel'`.
   */
  import { wm, useWmState } from './wm.svelte'
  import { getManifest } from './catalog'

  interface Props {
    onToggleLauncher: () => void
  }

  let { onToggleLauncher }: Props = $props()

  /** A faux quick-toggle in the KDE system-tray popup (Wi-Fi / Sound / Night-Color). */
  interface Toggle {
    id: string
    label: string
    icon: string
  }

  const TOGGLES: Toggle[] = [
    { id: 'wifi', label: 'Wi-Fi', icon: '🌐' },
    { id: 'sound', label: 'Sound', icon: '🔊' },
    { id: 'night', label: 'Night Color', icon: '🌙' },
  ]

  const wmState = useWmState()
  const windows = $derived(wmState.value.windows)

  // Live clock (refreshed every 30s, like the React panel + Taskbar).
  let now = $state(new Date())
  $effect(() => {
    const t = setInterval(() => (now = new Date()), 1000 * 30)
    return () => clearInterval(t)
  })
  const time = $derived(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  const date = $derived(now.toLocaleDateString([], { month: 'short', day: 'numeric' }))

  let trayOpen = $state(false)
  let toggles = $state<Record<string, boolean>>({ wifi: true, sound: true, night: false })
  // Right-click task menu: the window id + its anchor x (button offset), or null.
  let taskMenu = $state<{ id: string; x: number } | null>(null)
  let rootEl: HTMLDivElement | undefined = $state()

  function closePopups() {
    trayOpen = false
    taskMenu = null
  }

  // Click-outside closes the tray popup + the task context menu (the panel root
  // stops propagation, so a click landing outside it means "elsewhere").
  $effect(() => {
    if (!trayOpen && !taskMenu) return
    const onDoc = (e: PointerEvent) => {
      if (rootEl && !rootEl.contains(e.target as Node)) closePopups()
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  })

  function onTask(id: string) {
    const win = windows.find((x) => x.id === id)
    if (!win) return
    if (win.focused && win.state !== 'minimized') wm.minimize(id)
    else wm.focus(id)
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={rootEl} class="panel" onpointerdown={(e) => e.stopPropagation()}>
  <button
    type="button"
    aria-label="Application Launcher"
    class="kde-launch"
    onpointerdown={(e) => {
      e.stopPropagation()
      closePopups()
      onToggleLauncher()
    }}
  >
    <span style="font-size:18px">☰</span>
  </button>

  <!-- LEFT-aligned labelled task buttons for open windows. -->
  <div class="panel-tasks">
    {#each windows as w (w.id)}
      {@const active = w.focused && w.state !== 'minimized'}
      {@const minimized = w.state === 'minimized'}
      <button
        type="button"
        title={w.title}
        class="kde-task{active ? ' kde-task--active' : ''}"
        class:kde-task--min={minimized}
        onpointerdown={(e) => {
          e.stopPropagation()
          if (e.button === 2) return // handled by oncontextmenu
          taskMenu = null
          onTask(w.id)
        }}
        oncontextmenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          trayOpen = false
          taskMenu = { id: w.id, x: (e.currentTarget as HTMLElement).offsetLeft }
        }}
      >
        <span style="font-size:16px">{getManifest(w.appId)?.icon}</span>
        <span class="kde-task-label">{w.title}</span>
      </button>
    {/each}
  </div>

  <!-- System tray cluster — clicking toggles the quick-settings popup. -->
  <button
    type="button"
    aria-label="System Tray"
    class="kde-tray{trayOpen ? ' kde-tray--open' : ''}"
    onpointerdown={(e) => {
      e.stopPropagation()
      taskMenu = null
      trayOpen = !trayOpen
    }}
  >
    <span style:opacity={toggles.sound ? 1 : 0.4}>🔊</span>
    <span style:opacity={toggles.wifi ? 1 : 0.4}>🌐</span>
    <span>🔔</span>
  </button>

  <!-- Digital clock — time over date, stacked. -->
  <div aria-label="Clock" class="kde-clock">
    <span class="kde-clock-time">{time}</span>
    <span class="kde-clock-date">{date}</span>
  </div>

  <!-- Quick-settings tray popup. -->
  {#if trayOpen}
    <div role="menu" aria-label="Quick Settings" class="kde-popup kde-popup--tray">
      <div class="kde-popup-title">Quick Settings</div>
      {#each TOGGLES as t (t.id)}
        {@const on = toggles[t.id]}
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={on}
          class="kde-popup-item"
          onpointerdown={(e) => e.stopPropagation()}
          onclick={() => (toggles = { ...toggles, [t.id]: !toggles[t.id] })}
        >
          <span aria-hidden="true" class="kde-toggle-icon{on ? ' kde-toggle-icon--on' : ''}">
            {t.icon}
          </span>
          <span style="flex:1;font-size:13px">{t.label}</span>
          <span style="font-size:11px;opacity:.7">{on ? 'On' : 'Off'}</span>
        </button>
      {/each}
    </div>
  {/if}

  <!-- Task button right-click context menu. -->
  {#if taskMenu}
    {@const menu = taskMenu}
    <div
      role="menu"
      aria-label="Task Actions"
      class="kde-popup kde-popup--task"
      style:left="{Math.max(6, menu.x)}px"
    >
      <button
        type="button"
        role="menuitem"
        class="kde-popup-item kde-popup-item--task"
        onpointerdown={(e) => e.stopPropagation()}
        onclick={() => {
          wm.minimize(menu.id)
          taskMenu = null
        }}
      >
        <span aria-hidden="true" style="width:16px;text-align:center">🗕</span>
        Minimize
      </button>
      <button
        type="button"
        role="menuitem"
        class="kde-popup-item kde-popup-item--task"
        onpointerdown={(e) => e.stopPropagation()}
        onclick={() => {
          wm.close(menu.id)
          taskMenu = null
        }}
      >
        <span aria-hidden="true" style="width:16px;text-align:center">✕</span>
        Close
      </button>
    </div>
  {/if}
</div>

<style>
  .panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: var(--os-bar-h);
    display: flex;
    align-items: stretch;
    gap: 4px;
    padding: 0 6px;
    color: var(--os-bar-fg);
    background: var(--os-bar-bg);
    backdrop-filter: var(--os-blur);
    -webkit-backdrop-filter: var(--os-blur);
    border-top: 2px solid var(--os-accent);
    font-family: var(--os-font);
  }

  .kde-launch {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-weight: 600;
    transition:
      background 0.12s,
      box-shadow 0.12s;
  }
  .kde-launch:hover {
    background: rgba(255, 255, 255, 0.08);
    box-shadow: inset 0 2px 0 0 var(--os-accent);
  }

  .panel-tasks {
    display: flex;
    align-items: stretch;
    gap: 4px;
    flex: 1;
    overflow: hidden;
  }

  .kde-task {
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 180px;
    padding: 0 12px;
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: inherit;
    cursor: pointer;
    transition:
      background 0.12s,
      box-shadow 0.12s;
  }
  .kde-task:hover {
    background: rgba(255, 255, 255, 0.07);
    box-shadow: inset 0 2px 0 0 var(--os-accent);
  }
  .kde-task--active {
    border-bottom-color: var(--os-accent);
    background: rgba(255, 255, 255, 0.12);
  }
  .kde-task--active:hover {
    background: rgba(255, 255, 255, 0.12);
  }
  .kde-task--min {
    opacity: 0.6;
  }
  .kde-task-label {
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kde-tray {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 12px;
    transition:
      background 0.12s,
      box-shadow 0.12s;
  }
  .kde-tray:hover {
    background: rgba(255, 255, 255, 0.07);
    box-shadow: inset 0 2px 0 0 var(--os-accent);
  }
  .kde-tray--open,
  .kde-tray--open:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .kde-clock {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0 12px;
    line-height: 1.1;
    min-width: 64px;
  }
  .kde-clock-time {
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .kde-clock-date {
    font-size: 10px;
    opacity: 0.7;
  }

  .kde-popup {
    position: absolute;
    bottom: calc(var(--os-bar-h) + 6px);
    padding: 6px;
    border-radius: 6px;
    background: var(--os-bar-bg);
    color: var(--os-bar-fg);
    border: 1px solid rgba(61, 174, 233, 0.5);
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
    backdrop-filter: var(--os-blur);
    -webkit-backdrop-filter: var(--os-blur);
    z-index: 100000;
  }
  .kde-popup--tray {
    right: 6px;
    width: 240px;
  }
  .kde-popup--task {
    bottom: calc(var(--os-bar-h) + 4px);
    width: 150px;
    padding: 4px;
  }
  .kde-popup-title {
    padding: 6px 10px 8px;
    font-size: 11px;
    opacity: 0.6;
  }
  .kde-popup-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;
  }
  .kde-popup-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  .kde-popup-item--task {
    font-size: 13px;
  }
  .kde-toggle-icon {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 4px;
    font-size: 15px;
    background: rgba(255, 255, 255, 0.06);
  }
  .kde-toggle-icon--on {
    background: color-mix(in srgb, var(--os-accent) 85%, transparent);
  }
</style>
