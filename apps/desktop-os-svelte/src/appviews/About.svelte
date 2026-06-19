<script lang="ts">
  import { IrisBadge } from '@iris-ui/svelte'
</script>

<div class="pane">
  <h2 style="margin:0">Iris Desktop OS</h2>
  <p style="margin:0">
    A windowed desktop shell whose entire window logic — open, focus &amp; z-order, minimize,
    maximize/restore, move/resize, edge-snap — lives in the framework-agnostic
    <code>@iris-ui/core/window</code> (<code>createWindowManager</code>). The chrome you see is a
    thin Svelte 5 renderer; drag uses <code>IrisMovable</code>, resize uses
    <code>IrisResizable</code>.
  </p>
  <p style="margin:0">
    This is the <strong>same window manager</strong> the React demo drives — proving the core engine
    runs unchanged on Svelte.
  </p>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <IrisBadge tone="primary" variant="subtle">createWindowManager</IrisBadge>
    <IrisBadge tone="success" variant="subtle">IrisMovable</IrisBadge>
    <IrisBadge tone="success" variant="subtle">IrisResizable</IrisBadge>
  </div>
</div>

<style>
  .pane {
    padding: 20px;
    display: grid;
    gap: 14px;
    line-height: 1.6;
  }
</style>
