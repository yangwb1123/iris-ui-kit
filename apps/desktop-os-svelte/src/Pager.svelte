<script lang="ts">
  /**
   * Virtual-desktop PAGER — the Svelte mirror of React's `components/Pager.tsx`.
   * A compact switcher for the window manager's workspaces (GNOME/KDE pager feel):
   * one pip per desktop, highlights the active one, marks desktops that have
   * windows, and switches on click. Renders nothing when there's only a single
   * workspace (the feature is opt-in via the WM config). Token-skinned to the
   * active OS; sits top-center above windows.
   */
  import { wm, useWmState } from './wm.svelte'

  const wmState = useWmState()
  const workspaces = $derived(wmState.value.workspaces)
  const currentWorkspace = $derived(wmState.value.currentWorkspace)
  const windows = $derived(wmState.value.windows)
</script>

{#if workspaces > 1}
  <div class="pager" role="tablist" aria-label="Virtual desktops">
    {#each Array.from({ length: workspaces }, (_, i) => i) as i (i)}
      {@const active = i === currentWorkspace}
      {@const hasWindows = windows.some((w) => w.workspace === i)}
      <button
        type="button"
        role="tab"
        aria-selected={active}
        aria-label={`Desktop ${i + 1}`}
        title={`Desktop ${i + 1}`}
        class="pager-pip"
        class:pager-pip--active={active}
        class:pager-pip--has-windows={hasWindows}
        onclick={() => wm.setWorkspace(i)}
      >
        {i + 1}
      </button>
    {/each}
  </div>
{/if}

<style>
  .pager {
    position: absolute;
    top: calc(var(--os-topbar-h, 0px) + 8px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 80000;
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    background: var(--os-window-bg);
    border: var(--os-window-border);
    box-shadow: var(--os-window-shadow);
    backdrop-filter: var(--os-blur);
    -webkit-backdrop-filter: var(--os-blur);
  }
  .pager-pip {
    width: 26px;
    height: 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 11px;
    line-height: 18px;
    color: inherit;
    border: 1px solid rgba(127, 127, 127, 0.4);
    background: transparent;
  }
  .pager-pip--has-windows {
    border-color: var(--os-accent);
  }
  .pager-pip--active {
    color: #fff;
    background: color-mix(in srgb, var(--os-accent) 85%, transparent);
  }
</style>
