<script lang="ts">
  import { APPS } from './apps'
  import { wm } from './wm.svelte'

  interface Props {
    open: boolean
    onClose: () => void
  }

  let { open, onClose }: Props = $props()

  let query = $state('')
  let inputEl: HTMLInputElement | undefined = $state()

  // Reset + focus the search field whenever the menu opens.
  $effect(() => {
    if (open) {
      query = ''
      inputEl?.focus()
    }
  })

  const q = $derived(query.trim().toLowerCase())
  const results = $derived(q ? APPS.filter((a) => a.name.toLowerCase().includes(q)) : APPS)

  function launch(appId: string) {
    const app = APPS.find((a) => a.id === appId)
    if (!app) return
    wm.open({ appId: app.id, title: app.name, rect: app.defaultSize })
    onClose()
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="startmenu" onpointerdown={(e) => e.stopPropagation()}>
    <input bind:this={inputEl} bind:value={query} placeholder="Search apps…" class="sm-search" />
    <div class="sm-label">
      {q ? `${results.length} result(s)` : 'All apps'}
    </div>
    <div class="sm-grid">
      {#each results as app (app.id)}
        <button type="button" class="launch-tile" onclick={() => launch(app.id)}>
          <span style="font-size:28px">{app.icon}</span>
          <span style="font-size:12px;text-align:center">{app.name}</span>
        </button>
      {/each}
      {#if results.length === 0}
        <div style="opacity:.6;grid-column:1 / -1;padding:16px">No apps match “{query}”.</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .startmenu {
    position: absolute;
    bottom: calc(var(--os-bar-h) + 10px);
    left: 50%;
    transform: translateX(-50%);
    width: min(560px, 92vw);
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
    border-radius: 14px;
    background: var(--os-window-bg);
    color: var(--os-window-fg);
    border: var(--os-window-border);
    box-shadow: var(--os-window-shadow);
    backdrop-filter: var(--os-blur);
    -webkit-backdrop-filter: var(--os-blur);
    z-index: 100000;
  }
  .sm-search {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 14px;
    border-radius: 999px;
    border: 1px solid rgba(127, 127, 127, 0.35);
    background: rgba(255, 255, 255, 0.6);
    color: inherit;
    outline: none;
    font-size: 14px;
  }
  .sm-label {
    font-size: 12px;
    opacity: 0.6;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .sm-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 10px;
    overflow: auto;
  }
</style>
