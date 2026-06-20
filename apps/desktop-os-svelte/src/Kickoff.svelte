<script lang="ts">
  /**
   * KDE Kickoff — the Svelte mirror of React's `components/Kickoff.tsx`. A
   * bottom-left application launcher anchored to the Plasma panel: a user header,
   * a search box, a category rail (left) + the app list (right) over the SAME app
   * registry the Start menu / Spotlight use. Searching spans every app; otherwise
   * the list is scoped to the selected category. Click / Enter launches; Esc and
   * click-outside close. Rendered as the Launcher when the active chrome's
   * `launcher === 'kickoff'`.
   */
  import { type AppManifest } from './catalog'
  import { getApps, launchApp, useProfileState } from './profile.svelte'

  interface Props {
    open: boolean
    onClose: () => void
  }

  let { open, onClose }: Props = $props()

  /** A left-rail category in the Kickoff launcher. */
  interface Category {
    id: string
    label: string
    icon: string
    /** App ids this category contains; undefined = all applications. */
    apps?: string[]
  }

  const FAVORITE_IDS = ['files', 'notepad', 'settings']

  const CATEGORIES: Category[] = [
    { id: 'favorites', label: 'Favorites', icon: '⭐', apps: FAVORITE_IDS },
    { id: 'all', label: 'All Applications', icon: '🗂️' },
    { id: 'utilities', label: 'Utilities', icon: '🛠️', apps: ['files', 'notepad', 'taskmgr'] },
    { id: 'system', label: 'System', icon: '⚙️', apps: ['settings', 'about', 'taskmgr'] },
  ]

  const pstate = useProfileState()
  const apps = $derived(getApps(pstate.value))

  let query = $state('')
  let category = $state('favorites')
  let inputEl: HTMLInputElement | undefined = $state()

  // Reset + focus the search field whenever the launcher opens.
  $effect(() => {
    if (open) {
      query = ''
      category = 'favorites'
      inputEl?.focus()
    }
  })

  const q = $derived(query.trim().toLowerCase())
  const cat = $derived(CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[1])
  // Searching spans every app; otherwise scope to the selected category.
  const scoped = $derived(
    q
      ? apps
      : cat.apps
        ? cat.apps
            .map((id) => apps.find((a) => a.id === id))
            .filter((a): a is AppManifest => Boolean(a))
        : apps,
  )
  const results = $derived(q ? scoped.filter((a) => a.name.toLowerCase().includes(q)) : scoped)

  function launch(id: string) {
    launchApp(id)
    onClose()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && results[0]) launch(results[0].id)
    else if (e.key === 'Escape') onClose()
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="kickoff" onpointerdown={(e) => e.stopPropagation()}>
    <!-- User header. -->
    <div class="kickoff-header">
      <span aria-hidden="true" class="kickoff-avatar">👤</span>
      <div style="display:flex;flex-direction:column;line-height:1.25">
        <strong style="font-size:14px">user@iris-os</strong>
        <span style="font-size:11px;opacity:.65">Plasma Desktop</span>
      </div>
    </div>

    <!-- Search box. -->
    <div class="kickoff-search">
      <input
        bind:this={inputEl}
        bind:value={query}
        onkeydown={onKeyDown}
        placeholder="Search applications…"
        aria-label="Search applications"
        class="kickoff-input"
      />
    </div>

    <!-- Body: category rail (left) + app list (right). -->
    <div class="kickoff-body">
      <div role="tablist" aria-label="Categories" class="kickoff-rail">
        {#each CATEGORIES as c (c.id)}
          {@const selected = !q && c.id === category}
          <button
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={Boolean(q)}
            class="kickoff-cat{selected ? ' kickoff-cat--selected' : ''}"
            onclick={() => (category = c.id)}
          >
            <span aria-hidden="true" style="font-size:15px">{c.icon}</span>
            {c.label}
          </button>
        {/each}
      </div>

      <div class="kickoff-list">
        {#each results as app (app.id)}
          <button type="button" class="kickoff-app" onclick={() => launch(app.id)}>
            <span style="font-size:22px">{app.icon}</span>
            {app.name}
          </button>
        {/each}
        {#if results.length === 0}
          <div style="padding:12px;opacity:.6">No applications found.</div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .kickoff {
    position: absolute;
    bottom: calc(var(--os-bar-h) + 6px);
    left: 6px;
    width: 440px;
    height: 62vh;
    max-height: 520px;
    display: flex;
    flex-direction: column;
    border-radius: 6px;
    overflow: hidden;
    background: var(--os-bar-bg);
    color: var(--os-bar-fg);
    border: 1px solid rgba(61, 174, 233, 0.5);
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
    backdrop-filter: var(--os-blur);
    -webkit-backdrop-filter: var(--os-blur);
    font-family: var(--os-font);
    z-index: 100000;
  }

  .kickoff-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.18);
  }
  .kickoff-avatar {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 20px;
    color: #fff;
    background: linear-gradient(135deg, var(--os-accent) 0%, var(--os-accent-strong) 100%);
  }

  .kickoff-search {
    padding: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  .kickoff-input {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid rgba(61, 174, 233, 0.5);
    background: rgba(0, 0, 0, 0.25);
    color: inherit;
    outline: none;
    font-family: inherit;
  }

  .kickoff-body {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  .kickoff-rail {
    width: 140px;
    flex-shrink: 0;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.12);
    overflow: auto;
  }
  .kickoff-cat {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-left: 3px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;
    font-size: 13px;
    font-family: inherit;
  }
  .kickoff-cat:enabled:hover {
    background: rgba(255, 255, 255, 0.06);
  }
  .kickoff-cat:disabled {
    cursor: default;
    opacity: 0.4;
  }
  .kickoff-cat--selected,
  .kickoff-cat--selected:hover {
    border-left-color: var(--os-accent);
    background: color-mix(in srgb, var(--os-accent) 22%, transparent);
  }

  .kickoff-list {
    flex: 1;
    overflow: auto;
    padding: 6px;
  }
  .kickoff-app {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
  }
  .kickoff-app:hover {
    background: var(--os-accent);
    color: #fff;
  }
</style>
