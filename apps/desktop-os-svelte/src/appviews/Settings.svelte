<script lang="ts">
  /**
   * Settings — a genuine, portable, self-contained preference pane for the Svelte
   * shell. (React's `SettingsView` switches OS skins, but this shell is Win11-only,
   * so there's nothing to switch.) Instead this picks the desktop ACCENT COLOR:
   * it applies live by writing `--os-accent` on the document element (the token
   * the taskbar, command palette, and accent text all read) and persists the
   * choice to the user profile under the `accent` pref, re-reading + re-applying
   * it on mount so it survives a reload.
   */
  import { IrisButton, IrisBadge } from '@iris-ui/svelte'
  import { profile, getApps, useProfileState } from '../profile.svelte'
  import { PERMISSION_META, useGrants } from '../permissions.svelte'
  import type { AppManifest } from '../catalog'

  const ACCENT_PREF = 'accent'
  /** Default mirrors `style.css`'s `--os-accent`. */
  const DEFAULT_ACCENT = '#0a84ff'

  const PRESETS: { name: string; color: string }[] = [
    { name: 'Blue', color: '#0a84ff' },
    { name: 'Purple', color: '#7c5cff' },
    { name: 'Pink', color: '#ff2d92' },
    { name: 'Red', color: '#ff453a' },
    { name: 'Orange', color: '#ff9f0a' },
    { name: 'Green', color: '#30d158' },
    { name: 'Teal', color: '#40c8e0' },
    { name: 'Graphite', color: '#8e8e93' },
  ]

  let accent = $state<string>(profile.getPref<string>(ACCENT_PREF) ?? DEFAULT_ACCENT)

  /** Write the accent to the document + persist it to the profile. */
  function applyAccent(color: string): void {
    accent = color
    document.documentElement.style.setProperty('--os-accent', color)
    profile.setPref(ACCENT_PREF, color)
  }

  // Read + apply the saved accent on mount, so a reload restores the user's pick.
  $effect(() => {
    const saved = profile.getPref<string>(ACCENT_PREF) ?? DEFAULT_ACCENT
    accent = saved
    document.documentElement.style.setProperty('--os-accent', saved)
  })

  // ── Privacy & permissions ───────────────────────────────────────────────────
  // Surface every app the user can see (built-in + installed + custom). Exposing
  // built-ins too keeps the model honest + lets users tighten even them.
  const pstate = useProfileState()
  const apps = $derived(getApps(pstate.value))
  const grants = useGrants()
</script>

<div class="settings">
  <h3 class="heading">Accent color</h3>
  <p class="blurb">
    Pick the desktop accent. It applies instantly to the taskbar, command palette, and accent text
    via the <code>--os-accent</code> token, and your choice is saved to your profile — it survives a reload.
  </p>

  <div class="swatches">
    {#each PRESETS as p (p.color)}
      <button
        type="button"
        class="swatch"
        class:swatch--active={accent.toLowerCase() === p.color.toLowerCase()}
        style="--swatch: {p.color}"
        aria-label={`Use ${p.name} accent`}
        aria-pressed={accent.toLowerCase() === p.color.toLowerCase()}
        title={p.name}
        onclick={() => applyAccent(p.color)}
      >
        <span class="dot"></span>
        <span class="swatch-name">{p.name}</span>
      </button>
    {/each}
  </div>

  <label class="custom">
    <span>Custom</span>
    <input
      type="color"
      value={accent}
      aria-label="Custom accent color"
      oninput={(e) => applyAccent(e.currentTarget.value)}
    />
    <code class="hex">{accent}</code>
  </label>

  <div class="footer">
    <IrisBadge tone="primary" variant="subtle">Saved to profile</IrisBadge>
    <IrisButton variant="outline" size="sm" onclick={() => applyAccent(DEFAULT_ACCENT)}>
      Reset
    </IrisButton>
  </div>

  <!-- ── Privacy & permissions ─────────────────────────────────────────────── -->
  <h3 class="heading">Privacy &amp; permissions</h3>
  <p class="blurb">
    Each app declares the capabilities it wants. Grant or revoke them per app — your choices persist
    in your profile. (Enforcement is advisory in this demo; the transparent contract is the point.)
  </p>

  {#snippet appPermissions(app: AppManifest)}
    <div class="perm-card">
      <div class="perm-head">
        <span style="font-size:18px">{app.icon}</span>
        <strong style="font-size:13px;flex:1">{app.name}</strong>
        {#if app.custom}
          <IrisBadge tone="primary" variant="subtle" size="sm">Yours</IrisBadge>
        {/if}
      </div>
      {#if (app.permissions ?? []).length === 0}
        <span style="font-size:12px;opacity:.6">No permissions requested.</span>
      {:else}
        <div class="perm-list">
          {#each app.permissions ?? [] as perm (perm)}
            {@const meta = PERMISSION_META[perm]}
            {@const granted = grants.isGranted(app.id, perm)}
            <div class="perm-row" title={meta.description}>
              <span style="font-size:15px" aria-hidden="true">{meta.icon}</span>
              <span class="perm-text">
                <strong style="font-size:12px">{meta.label}</strong>
                <br />
                <span style="font-size:11px;opacity:.6">{meta.description}</span>
              </span>
              {#if granted}
                <IrisBadge tone="success" variant="subtle" size="sm">Granted</IrisBadge>
              {:else}
                <IrisBadge tone="neutral" variant="subtle" size="sm">Blocked</IrisBadge>
              {/if}
              <IrisButton
                variant={granted ? 'outline' : 'solid'}
                size="sm"
                onclick={() => (granted ? grants.revoke(app.id, perm) : grants.grant(app.id, perm))}
              >
                {granted ? 'Revoke' : 'Grant'}
              </IrisButton>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/snippet}

  <div class="perm-apps">
    {#each apps as app (app.id)}
      {@render appPermissions(app)}
    {/each}
  </div>
</div>

<style>
  .settings {
    padding: 20px;
    display: grid;
    gap: 14px;
    line-height: 1.6;
    color: var(--os-window-fg);
  }
  .heading {
    margin: 0;
  }
  .blurb {
    margin: 0;
    opacity: 0.7;
    font-size: 13px;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
  }
  .swatch {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    cursor: pointer;
    text-align: left;
    border: 1px solid rgba(127, 127, 127, 0.3);
    background: transparent;
    color: inherit;
    font: inherit;
  }
  .swatch--active {
    border: 2px solid var(--swatch);
    background: color-mix(in srgb, var(--swatch) 12%, transparent);
  }
  .dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--swatch);
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.4);
  }
  .swatch-name {
    font-size: 13px;
  }
  .custom {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }
  .custom input[type='color'] {
    width: 44px;
    height: 30px;
    padding: 0;
    border: 1px solid rgba(127, 127, 127, 0.3);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
  }
  .hex {
    opacity: 0.7;
  }
  .footer {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .perm-apps {
    display: grid;
    gap: 10px;
  }
  .perm-card {
    display: grid;
    gap: 8px;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid rgba(127, 127, 127, 0.25);
    background: color-mix(in srgb, var(--os-window-fg) 4%, transparent);
  }
  .perm-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .perm-list {
    display: grid;
    gap: 6px;
  }
  .perm-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .perm-text {
    flex: 1;
    min-width: 0;
  }
</style>
