<script lang="ts">
  /**
   * App Store — browse the catalog and install link / iframe apps into the user
   * profile. Add ANY external service via "Add a web app"; manage them under
   * "My apps". Built-in component apps are shown for reference but can't be
   * removed. Drives the SAME `@iris-ui/core/profile` engine as the React demo.
   */
  import { IrisButton, IrisBadge, IrisInput } from '@iris-ui/svelte'
  import { CATALOG, INSTALLABLE_APPS, type AppManifest, type AppKind } from '../catalog'
  import {
    profile,
    useProfileState,
    readCustomApps,
    addCustomApp,
    removeCustomApp,
    launchApp,
  } from '../profile.svelte'

  const KIND_LABEL: Record<AppKind, string> = {
    component: 'Built-in',
    link: 'Link',
    iframe: 'Embed',
    remote: 'Remote',
  }
  const KIND_TONE: Record<AppKind, 'primary' | 'success' | 'warning'> = {
    component: 'primary',
    link: 'success',
    iframe: 'warning',
    remote: 'warning',
  }

  const pstate = useProfileState()

  const customApps = $derived(readCustomApps(pstate.value))
  const links = $derived(INSTALLABLE_APPS.filter((a) => a.kind === 'link'))
  const iframes = $derived(INSTALLABLE_APPS.filter((a) => a.kind === 'iframe'))
  const builtins = $derived(CATALOG.filter((a) => a.builtin))

  // `pstate.value` is read so install/uninstall re-derives the button state.
  function isInstalled(app: AppManifest): boolean {
    void pstate.value
    return Boolean(app.builtin) || profile.isInstalled(app.id)
  }

  // ── Add-a-web-app form state ────────────────────────────────────────────────
  let name = $state('')
  let url = $state('')
  let icon = $state('')
  let kind = $state<'link' | 'iframe'>('iframe')

  const canAdd = $derived(url.trim().length > 0)

  function submit(e: SubmitEvent) {
    e.preventDefault()
    if (!canAdd) return
    const manifest = addCustomApp({ name, url, kind, icon })
    // Install so it shows up across launchers immediately (custom apps removable).
    profile.install(manifest.id)
    name = ''
    url = ''
    icon = ''
  }
</script>

<div class="store">
  <header class="hdr">
    <h2 style="margin:0">App Store</h2>
    <p class="lede">
      Install apps into your profile (persisted to this device). Link &amp; iframe apps aggregate
      external services — most major sites block iframe embedding, so those open in a new tab.
    </p>
  </header>

  <!-- Add a web app -->
  <section class="add-card">
    <div style="display:grid;gap:4px">
      <strong style="font-size:14px">Add a web app</strong>
      <p class="lede" style="margin:0">
        Aggregate any service by URL. It appears across the desktop (Start menu, taskbar, command
        palette).
      </p>
    </div>
    <form onsubmit={submit} style="display:grid;gap:10px">
      <div class="fields">
        <label class="field">
          Name
          <IrisInput
            value={name}
            oninput={(e) => (name = e.currentTarget.value)}
            placeholder="My Service"
          />
        </label>
        <label class="field">
          URL
          <IrisInput
            value={url}
            oninput={(e) => (url = e.currentTarget.value)}
            placeholder="https://example.com"
          />
        </label>
        <label class="field">
          Icon (emoji)
          <IrisInput
            value={icon}
            oninput={(e) => (icon = e.currentTarget.value)}
            placeholder="🔗"
            maxlength={4}
          />
        </label>
        <div class="field">
          How it opens
          <div style="display:flex;gap:6px">
            {#each ['iframe', 'link'] as const as k (k)}
              <button
                type="button"
                class="kind-btn{kind === k ? ' kind-btn--on' : ''}"
                onclick={() => (kind = k)}
              >
                {k === 'iframe' ? '🪟 Embed' : '🔗 New tab'}
              </button>
            {/each}
          </div>
        </div>
      </div>
      <div>
        <IrisButton type="submit" variant="solid" disabled={!canAdd}>Add to desktop</IrisButton>
      </div>
    </form>
  </section>

  {#snippet appCard(app: AppManifest, onRemove?: (id: string) => void)}
    <div class="card">
      <div class="card-icon">{app.icon}</div>
      <div class="card-body">
        <div class="card-title">
          <strong style="font-size:14px">{app.name}</strong>
          <IrisBadge tone={KIND_TONE[app.kind]} variant="subtle" size="sm">
            {KIND_LABEL[app.kind]}
          </IrisBadge>
          {#if app.custom}
            <IrisBadge tone="primary" variant="subtle" size="sm">Yours</IrisBadge>
          {/if}
        </div>
        {#if app.description}
          <p style="margin:0;font-size:12px;opacity:.7">{app.description}</p>
        {/if}
        <div class="card-actions">
          {#if app.builtin}
            <IrisBadge tone="neutral" variant="subtle" size="sm">Built-in</IrisBadge>
          {:else if isInstalled(app)}
            <IrisButton variant="solid" onclick={() => launchApp(app.id)}>Open</IrisButton>
            {#if onRemove}
              <IrisButton variant="outline" onclick={() => onRemove(app.id)}>Remove</IrisButton>
            {:else}
              <IrisButton variant="outline" onclick={() => profile.uninstall(app.id)}>
                Uninstall
              </IrisButton>
            {/if}
          {:else}
            <IrisButton variant="solid" onclick={() => profile.install(app.id)}>Install</IrisButton>
          {/if}
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet section(title: string, apps: AppManifest[], onRemove?: (id: string) => void)}
    {#if apps.length > 0}
      <section style="display:grid;gap:10px">
        <h3 class="sec-title">{title}</h3>
        <div class="grid">
          {#each apps as app (app.id)}
            {@render appCard(app, onRemove)}
          {/each}
        </div>
      </section>
    {/if}
  {/snippet}

  {@render section('My apps', customApps, removeCustomApp)}
  {@render section('Embedded apps', iframes)}
  {@render section('Web links', links)}
  {@render section('Built-in', builtins)}
</div>

<style>
  .store {
    padding: 18px;
    display: grid;
    gap: 20px;
  }
  .hdr {
    display: grid;
    gap: 6px;
  }
  .lede {
    margin: 0;
    font-size: 12px;
    opacity: 0.7;
    line-height: 1.5;
  }
  .add-card {
    display: grid;
    gap: 12px;
    padding: 14px;
    border-radius: 10px;
    border: 1px dashed rgba(127, 127, 127, 0.4);
    background: color-mix(in srgb, var(--os-accent) 6%, transparent);
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
  }
  .field {
    font-size: 12px;
    opacity: 0.85;
    display: grid;
    gap: 4px;
  }
  .kind-btn {
    flex: 1;
    padding: 8px 10px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12px;
    color: inherit;
    border: 1px solid rgba(127, 127, 127, 0.3);
    background: transparent;
  }
  .kind-btn--on {
    border: 2px solid var(--os-accent);
    background: color-mix(in srgb, var(--os-accent) 14%, transparent);
  }
  .card {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 12px;
    padding: 14px;
    border-radius: 10px;
    border: 1px solid rgba(127, 127, 127, 0.25);
    background: color-mix(in srgb, var(--os-window-fg) 4%, transparent);
  }
  .card-icon {
    font-size: 30px;
    line-height: 1;
    text-align: center;
  }
  .card-body {
    display: grid;
    gap: 6px;
    min-width: 0;
  }
  .card-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .card-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 2px;
  }
  .sec-title {
    margin: 0;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.6;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }
</style>
