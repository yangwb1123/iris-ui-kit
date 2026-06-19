<script lang="ts">
  import { IrisButton, IrisBadge } from '@iris-ui/svelte'

  let name = $state('')
</script>

<div class="pane">
  <p style="margin:0">
    Real Iris Svelte components, rendered inside a managed window — they inherit the OS skin via
    tokens.
  </p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <IrisButton variant="solid">Solid</IrisButton>
    <IrisButton variant="outline">Outline</IrisButton>
    <IrisButton variant="ghost">Ghost</IrisButton>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <IrisBadge tone="primary" variant="solid">primary</IrisBadge>
    <IrisBadge tone="success" variant="subtle">success</IrisBadge>
    <IrisBadge tone="warning" variant="subtle">warning</IrisBadge>
    <IrisBadge tone="danger" variant="subtle">danger</IrisBadge>
  </div>
  <input class="field" bind:value={name} placeholder="Type your name…" />
  {#if name}
    <p style="margin:0">Hello, {name} 👋</p>
  {/if}
</div>

<style>
  .pane {
    padding: 20px;
    display: grid;
    gap: 14px;
    line-height: 1.6;
  }
  .field {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid rgba(127, 127, 127, 0.35);
    background: rgba(255, 255, 255, 0.6);
    color: inherit;
    outline: none;
    font: inherit;
  }
</style>
