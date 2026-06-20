<script lang="ts">
  /**
   * macOS Spotlight — the Svelte mirror of React's `components/Spotlight.tsx`. A
   * centered search overlay over the same app registry the Start menu uses: type
   * to filter, ↑/↓ to move, Enter/click to open, Esc / click-outside to close,
   * with a preview column for the selected result. Rendered as the Launcher when
   * the active chrome's `launcher === 'spotlight'`.
   */
  import { getApps, launchApp, useProfileState } from './profile.svelte'

  interface Props {
    open: boolean
    onClose: () => void
  }

  let { open, onClose }: Props = $props()

  const pstate = useProfileState()
  const apps = $derived(getApps(pstate.value))

  let query = $state('')
  let active = $state(0)
  // Drives the scale/opacity entrance; flipped on after open so CSS transitions in.
  let shown = $state(false)
  let inputEl: HTMLInputElement | undefined = $state()

  $effect(() => {
    if (open) {
      query = ''
      active = 0
      inputEl?.focus()
      const r = requestAnimationFrame(() => (shown = true))
      return () => cancelAnimationFrame(r)
    }
    shown = false
    return undefined
  })

  const q = $derived(query.trim().toLowerCase())
  const results = $derived(q ? apps.filter((a) => a.name.toLowerCase().includes(q)) : apps)
  const selectedIndex = $derived(results.length === 0 ? -1 : Math.min(active, results.length - 1))
  const selected = $derived(selectedIndex >= 0 ? results[selectedIndex] : undefined)

  function launch(id: string) {
    launchApp(id)
    onClose()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && selected) launch(selected.id)
    else if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      active = Math.min(active + 1, results.length - 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      active = Math.max(active - 1, 0)
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="spotlight-overlay" onpointerdown={onClose}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="spotlight"
      class:spotlight--shown={shown}
      role="dialog"
      tabindex="-1"
      aria-label="Spotlight Search"
      onpointerdown={(e) => e.stopPropagation()}
    >
      <div class="spotlight-search">
        <span style="font-size:22px;opacity:.6">🔍</span>
        <input
          bind:this={inputEl}
          bind:value={query}
          oninput={() => (active = 0)}
          onkeydown={onKeyDown}
          placeholder="Spotlight Search"
          aria-label="Spotlight Search"
          class="spotlight-input"
        />
      </div>

      <div class="spotlight-body">
        <!-- Results list -->
        <div class="spotlight-results">
          <div class="spotlight-section">Applications</div>
          {#each results as app, i (app.id)}
            {@const isActive = i === selectedIndex}
            <button
              type="button"
              class="spotlight-hit{isActive ? ' spotlight-hit--active' : ''}"
              onclick={() => launch(app.id)}
              onpointerenter={() => (active = i)}
            >
              <span style="font-size:22px">{app.icon}</span>
              {app.name}
            </button>
          {/each}
          {#if results.length === 0}
            <div style="padding:18px;opacity:.6">No results.</div>
          {/if}
        </div>

        <!-- Preview column for the selected result -->
        <div class="spotlight-preview">
          {#if selected}
            <div style="font-size:64px;line-height:1">{selected.icon}</div>
            <div style="font-size:17px;font-weight:600">{selected.name}</div>
            <div style="font-size:12px;opacity:.55">Application</div>
          {:else}
            <div style="font-size:13px;opacity:.45">No selection</div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .spotlight-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 18vh;
    background: rgba(0, 0, 0, 0.06);
    z-index: 100000;
  }
  .spotlight {
    width: min(680px, 92vw);
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    border-radius: 14px;
    overflow: hidden;
    background: var(--os-window-bg);
    color: var(--os-window-fg);
    border: var(--os-window-border);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
    backdrop-filter: var(--os-blur);
    -webkit-backdrop-filter: var(--os-blur);
    transform-origin: top center;
    transform: scale(0.96);
    opacity: 0;
    transition:
      transform 160ms cubic-bezier(0.2, 0.9, 0.3, 1),
      opacity 160ms ease;
  }
  .spotlight--shown {
    transform: scale(1);
    opacity: 1;
  }
  .spotlight-search {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border-bottom: 1px solid rgba(127, 127, 127, 0.2);
  }
  .spotlight-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font-size: 22px;
  }
  .spotlight-body {
    display: flex;
    min-height: 0;
  }
  .spotlight-results {
    flex: 1;
    overflow: auto;
    border-right: 1px solid rgba(127, 127, 127, 0.18);
  }
  .spotlight-section {
    padding: 8px 18px 4px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    opacity: 0.45;
  }
  .spotlight-hit {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 9px 18px;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;
    font-size: 15px;
  }
  .spotlight-hit--active {
    background: color-mix(in srgb, var(--os-accent) 22%, transparent);
  }
  .spotlight-preview {
    width: 220px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px 16px;
    text-align: center;
  }
</style>
