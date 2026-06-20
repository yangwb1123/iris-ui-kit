<script lang="ts">
  import { wm, useWmState } from './wm.svelte'
  import { getManifest } from './catalog'

  interface Props {
    launcherOpen: boolean
    onToggleLauncher: () => void
  }

  let { launcherOpen, onToggleLauncher }: Props = $props()

  const wmState = useWmState()
  const windows = $derived(wmState.value.windows)
  const currentWorkspace = $derived(wmState.value.currentWorkspace)
  // Only windows on the active virtual desktop appear as task buttons.
  const wsWindows = $derived(windows.filter((w) => w.workspace === currentWorkspace))

  // Live clock.
  let now = $state(new Date())
  $effect(() => {
    const t = setInterval(() => (now = new Date()), 1000 * 30)
    return () => clearInterval(t)
  })
  const time = $derived(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  const date = $derived(
    now.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' }),
  )

  function onTask(id: string) {
    const win = windows.find((x) => x.id === id)
    if (!win) return
    if (win.focused && win.state !== 'minimized') wm.minimize(id)
    else wm.focus(id)
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="taskbar" onpointerdown={(e) => e.stopPropagation()}>
  <div style="display:flex;align-items:center;gap:4px">
    <button
      type="button"
      aria-label="Start"
      aria-pressed={launcherOpen}
      class="task-btn task-btn--start"
      style="font-size:18px"
      onpointerdown={(e) => {
        e.stopPropagation()
        onToggleLauncher()
      }}>⊞</button
    >
    {#each wsWindows as w (w.id)}
      {@const active = w.focused && w.state !== 'minimized'}
      <button
        type="button"
        title={w.title}
        class="task-btn{active ? ' task-btn--active' : ''}"
        onpointerdown={(e) => {
          e.stopPropagation()
          onTask(w.id)
        }}
      >
        <span style="font-size:18px">{getManifest(w.appId)?.icon}</span>
      </button>
    {/each}
  </div>
  <div class="clock">
    <div>{time}</div>
    <div>{date}</div>
  </div>
</div>

<style>
  .taskbar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: var(--os-bar-h);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--os-bar-fg);
    background: var(--os-bar-bg);
    backdrop-filter: var(--os-blur);
    -webkit-backdrop-filter: var(--os-blur);
    border-top: 1px solid rgba(255, 255, 255, 0.18);
  }
  .clock {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    text-align: right;
    font-size: 12px;
    line-height: 1.25;
    padding: 0 14px;
  }
</style>
