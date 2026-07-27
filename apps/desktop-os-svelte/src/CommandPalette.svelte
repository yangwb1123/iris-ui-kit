<script lang="ts">
  /**
   * ⌘K / Ctrl+K command palette — a centered, token-skinned overlay that fuzzy-
   * searches the shared command registry and runs the chosen command. ↑/↓ move
   * the selection, Enter runs it (then closes), Esc + click-outside close.
   *
   * It re-registers the live desktop commands (from the profile + WM snapshots)
   * whenever those change, so results always track the current apps + focused
   * window — the registry is the single source the palette searches.
   */
  import type { Command, CommandHit } from '@iris-ui-kit/core/commands'
  import { registry, buildDesktopCommands } from './commands.svelte'
  import { useWmState } from './wm.svelte'
  import { useProfileState } from './profile.svelte'

  interface Props {
    open: boolean
    onClose: () => void
  }

  let { open, onClose }: Props = $props()

  const wmState = useWmState()
  const pstate = useProfileState()

  // Keep the registry in sync with the live desktop state.
  $effect(() => {
    const commands = buildDesktopCommands(pstate.value, wmState.value)
    return registry.registerMany(commands)
  })

  let query = $state('')
  let active = $state(0)
  let inputEl: HTMLInputElement | undefined = $state()

  // Snapshot the registry store so `search` re-derives when commands change.
  let regState = $state(registry.getState())
  $effect(() => registry.subscribe((s) => (regState = s)))

  // Reset query/selection + focus the input each time the palette opens.
  $effect(() => {
    if (open) {
      query = ''
      active = 0
      inputEl?.focus()
    }
  })

  // `regState` is the change signal for the registry contents; reading it here
  // makes the search re-run when commands (or the query) change.
  const hits = $derived.by<CommandHit[]>(() => {
    void regState
    return registry.search(query)
  })
  const selectedIndex = $derived(hits.length === 0 ? -1 : Math.min(active, hits.length - 1))

  // Group hits in best-score order, preserving first-seen group order.
  const groups = $derived.by(() => {
    const out: { group: string; hits: CommandHit[] }[] = []
    for (const hit of hits) {
      const group = hit.command.group ?? 'Commands'
      const bucket = out.find((g) => g.group === group)
      if (bucket) bucket.hits.push(hit)
      else out.push({ group, hits: [hit] })
    }
    return out
  })

  function run(command: Command) {
    void registry.run(command.id)
    onClose()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      active = Math.min(active + 1, hits.length - 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      active = Math.max(active - 1, 0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = hits[selectedIndex]
      if (hit) run(hit.command)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onpointerdown={onClose}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="palette"
      role="dialog"
      tabindex="-1"
      aria-label="Command palette"
      onpointerdown={(e) => e.stopPropagation()}
    >
      <div class="search-row">
        <span style="font-size:18px;opacity:.6">⌘</span>
        <input
          bind:this={inputEl}
          bind:value={query}
          oninput={() => (active = 0)}
          onkeydown={onKeyDown}
          placeholder="Type a command…"
          aria-label="Search commands"
          class="search-input"
        />
      </div>

      <div class="results">
        {#each groups as g (g.group)}
          <div>
            <div class="group-label">{g.group}</div>
            {#each g.hits as hit (hit.command.id)}
              {@const flat = hits.indexOf(hit)}
              <button
                type="button"
                class="hit{flat === selectedIndex ? ' hit--active' : ''}"
                onclick={() => run(hit.command)}
                onpointerenter={() => (active = flat)}
              >
                <span class="hit-icon">{hit.command.icon ?? '•'}</span>
                <span style="flex:1">{hit.command.title}</span>
              </button>
            {/each}
          </div>
        {/each}
        {#if hits.length === 0}
          <div style="padding:16px;opacity:.6;font-size:14px">No commands found.</div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 16vh;
    background: rgba(0, 0, 0, 0.18);
    z-index: 100001;
  }
  .palette {
    width: min(620px, 92vw);
    max-height: 64vh;
    display: flex;
    flex-direction: column;
    border-radius: var(--os-window-radius);
    overflow: hidden;
    background: var(--os-window-bg);
    color: var(--os-window-fg);
    border: var(--os-window-border);
    box-shadow: var(--os-window-shadow);
    backdrop-filter: var(--os-blur);
    -webkit-backdrop-filter: var(--os-blur);
  }
  .search-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(127, 127, 127, 0.2);
  }
  .search-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font-size: 18px;
  }
  .results {
    overflow: auto;
    padding: 6px 0;
  }
  .group-label {
    padding: 8px 16px 4px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    opacity: 0.45;
  }
  .hit {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 9px 16px;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;
    font-size: 15px;
  }
  .hit--active {
    background: color-mix(in srgb, var(--os-accent) 22%, transparent);
  }
  .hit-icon {
    width: 22px;
    text-align: center;
    font-size: 16px;
  }
</style>
