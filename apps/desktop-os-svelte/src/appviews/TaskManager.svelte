<script lang="ts">
  /**
   * Task Manager — a live view of the desktop's window-manager state. It reads
   * the SAME `createWindowManager` singleton every other shell component drives
   * (via `useWmState`), so the open-window list, each window's state, and "End
   * task" stay in lock-step with the real desktop. The Svelte 5 twin of the
   * React `TaskManagerView`.
   */
  import { IrisButton } from '@iris-ui-kit/svelte'
  import { wm, useWmState } from '../wm.svelte'

  const wmState = useWmState()
  const windows = $derived(wmState.value.windows)
</script>

<div class="taskmgr">
  <div class="summary">
    {windows.length} open window(s) — live from the window manager store
  </div>
  {#each windows as w (w.id)}
    <div class="row">
      <span style="flex:1">{w.title}</span>
      <span class="state">{w.state}</span>
      <IrisButton variant="ghost" onclick={() => wm.close(w.id)}>End task</IrisButton>
    </div>
  {/each}
</div>

<style>
  .taskmgr {
    padding: 12px;
    display: grid;
    gap: 4px;
  }
  .summary {
    opacity: 0.6;
    font-size: 12px;
    padding: 0 8px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
  }
  .state {
    font-size: 12px;
    opacity: 0.5;
  }
</style>
