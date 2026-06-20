import { For, Show, createMemo, createSignal, onMount, type JSX } from 'solid-js'
import { IrisBadge, IrisButton } from '@iris-ui/solid'
import { type AppManifest } from './catalog'
import { OS_ORDER, CHROMES } from './os'
import { useApps, useProfile } from './profile'
import { useOs } from './os-state'
import { PERMISSION_META, useGrants } from './permissions'

/** Profile pref key the chosen accent persists under. */
const ACCENT_PREF = 'accent'

/** The CSS custom property the whole skin reads its accent from. */
const ACCENT_VAR = '--os-accent'

interface Swatch {
  id: string
  label: string
  color: string
}

/** A small palette of accent colors to pick from. */
const SWATCHES: Swatch[] = [
  { id: 'blue', label: 'Blue', color: '#0a84ff' },
  { id: 'purple', label: 'Purple', color: '#7c5cff' },
  { id: 'pink', label: 'Pink', color: '#ff2d95' },
  { id: 'red', label: 'Red', color: '#ff453a' },
  { id: 'orange', label: 'Orange', color: '#ff9f0a' },
  { id: 'green', label: 'Green', color: '#30d158' },
  { id: 'teal', label: 'Teal', color: '#40c8e0' },
  { id: 'graphite', label: 'Graphite', color: '#5e5e66' },
]

/** Push the chosen accent onto the document root so the whole skin recolors. */
function applyAccent(color: string): void {
  document.documentElement.style.setProperty(ACCENT_VAR, color)
}

/**
 * The OS-skin picker. Switches the whole desktop chrome (titlebar controls, top
 * menu bar, dock/taskbar, launcher, palette) between Windows 11 and macOS LIVE —
 * the window manager + every open window stay exactly the same, only the look
 * changes. The choice persists to the profile (`os` pref) via {@link useOs}.
 */
function OsSkinSettings(): JSX.Element {
  const { os, setOs } = useOs()
  return (
    <>
      <h3 style={{ margin: 0 }}>Appearance</h3>
      <p style={{ margin: 0, opacity: 0.7 }}>
        Switch the desktop skin. The window manager, bottom bar, and every open window stay exactly
        the same — only the look changes. Your choice is saved to your profile and survives a
        reload.
      </p>
      <div style={{ display: 'grid', gap: '10px' }}>
        <For each={OS_ORDER}>
          {(id) => {
            const c = CHROMES[id]
            const active = (): boolean => os() === id
            return (
              <button
                type="button"
                onClick={() => setOs(id)}
                aria-pressed={active()}
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '12px',
                  padding: '12px',
                  'border-radius': '10px',
                  cursor: 'pointer',
                  'text-align': 'left',
                  border: active()
                    ? '2px solid var(--os-accent)'
                    : '1px solid rgba(127,127,127,0.3)',
                  background: active()
                    ? 'color-mix(in srgb, var(--os-accent) 12%, transparent)'
                    : 'transparent',
                  color: 'inherit',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: '44px',
                    height: '30px',
                    'border-radius': '6px',
                    background: c.vars['--os-wallpaper'],
                    'flex-shrink': 0,
                    border: '1px solid rgba(255,255,255,0.4)',
                  }}
                />
                <span style={{ flex: 1 }}>
                  <strong>{c.label}</strong>
                  <br />
                  <span style={{ 'font-size': '12px', opacity: 0.65 }}>
                    controls {c.controls} · {c.bottomBar}
                  </span>
                </span>
                <Show when={active()}>
                  <IrisBadge tone="primary" variant="solid">
                    active
                  </IrisBadge>
                </Show>
              </button>
            )
          }}
        </For>
      </div>
    </>
  )
}

/**
 * The accent-color picker. The choice applies live via
 * `document.documentElement.style.setProperty('--os-accent', …)` (the var every
 * Iris/OS surface reads) and persists to the user profile (`accent` pref) — read
 * back + re-applied on mount so it survives a reload.
 */
function AppearanceSettings(): JSX.Element {
  const profile = useProfile()
  const [accent, setAccent] = createSignal<string>(
    profile.getPref<string>(ACCENT_PREF) ?? SWATCHES[0].color,
  )

  // Read + apply the saved accent on mount (survives a reload). Profile hydrate
  // is async, so re-read here in case the value landed after first render.
  onMount(() => {
    const saved = profile.getPref<string>(ACCENT_PREF)
    if (saved) setAccent(saved)
    applyAccent(accent())
  })

  const choose = (color: string): void => {
    setAccent(color)
    applyAccent(color)
    profile.setPref(ACCENT_PREF, color)
  }

  return (
    <>
      <h3 style={{ margin: 0 }}>Accent color</h3>
      <p style={{ margin: 0, opacity: 0.7 }}>
        Pick the desktop accent. The change applies instantly to every Iris surface (it sets the{' '}
        <code>--os-accent</code> CSS variable) and is saved to your profile, so it survives a
        reload.
      </p>
      <div
        style={{
          display: 'grid',
          'grid-template-columns': 'repeat(auto-fill, minmax(96px, 1fr))',
          gap: '10px',
        }}
      >
        <For each={SWATCHES}>
          {(s) => {
            const active = (): boolean => accent() === s.color
            return (
              <button
                type="button"
                onClick={() => choose(s.color)}
                aria-label={`${s.label} accent`}
                aria-pressed={active()}
                style={{
                  display: 'grid',
                  'justify-items': 'center',
                  gap: '8px',
                  padding: '12px',
                  'border-radius': '10px',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: 'inherit',
                  border: active()
                    ? '2px solid var(--os-accent)'
                    : '1px solid rgba(127,127,127,0.3)',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: '40px',
                    height: '40px',
                    'border-radius': '50%',
                    background: s.color,
                    border: '1px solid rgba(255,255,255,0.4)',
                  }}
                />
                <span style={{ 'font-size': '12px' }}>{s.label}</span>
                <Show when={active()}>
                  <IrisBadge tone="primary" variant="solid" size="sm">
                    active
                  </IrisBadge>
                </Show>
              </button>
            )
          }}
        </For>
      </div>
    </>
  )
}

/** One app's permission grant/revoke toggles in the privacy panel. */
function AppPermissionRow(props: { app: AppManifest }): JSX.Element {
  const { isGranted, grant, revoke } = useGrants()
  const perms = (): NonNullable<AppManifest['permissions']> => props.app.permissions ?? []
  return (
    <div
      style={{
        display: 'grid',
        gap: '8px',
        padding: '12px',
        'border-radius': '10px',
        border: '1px solid rgba(127,127,127,0.25)',
        background: 'color-mix(in srgb, var(--os-window-fg) 4%, transparent)',
      }}
    >
      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
        <span style={{ 'font-size': '18px' }}>{props.app.icon}</span>
        <strong style={{ 'font-size': '13px', flex: 1 }}>{props.app.name}</strong>
        <Show when={props.app.custom}>
          <IrisBadge tone="primary" variant="subtle" size="sm">
            Yours
          </IrisBadge>
        </Show>
      </div>
      <div style={{ display: 'grid', gap: '6px' }}>
        <For each={perms()}>
          {(perm) => {
            const meta = PERMISSION_META[perm]
            const granted = (): boolean => isGranted(props.app.id, perm)
            return (
              <div
                style={{ display: 'flex', 'align-items': 'center', gap: '10px' }}
                title={meta.description}
              >
                <span style={{ 'font-size': '15px' }} aria-hidden>
                  {meta.icon}
                </span>
                <span style={{ flex: 1, 'min-width': 0 }}>
                  <strong style={{ 'font-size': '12px' }}>{meta.label}</strong>
                  <br />
                  <span style={{ 'font-size': '11px', opacity: 0.6 }}>{meta.description}</span>
                </span>
                <Show
                  when={granted()}
                  fallback={
                    <IrisBadge tone="neutral" variant="subtle" size="sm">
                      Blocked
                    </IrisBadge>
                  }
                >
                  <IrisBadge tone="success" variant="subtle" size="sm">
                    Granted
                  </IrisBadge>
                </Show>
                <IrisButton
                  variant={granted() ? 'outline' : 'solid'}
                  size="sm"
                  onClick={() =>
                    granted() ? revoke(props.app.id, perm) : grant(props.app.id, perm)
                  }
                >
                  {granted() ? 'Revoke' : 'Grant'}
                </IrisButton>
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}

/**
 * Privacy & permissions: list installed + built-in apps that request
 * capabilities, each with per-permission grant/revoke toggles persisted in the
 * profile (`grants` pref). Mirrors the React desktop's Privacy panel. Enforcement
 * is advisory in this demo — the transparent, user-visible contract is the point.
 */
function PrivacySettings(): JSX.Element {
  const apps = useApps()
  const appsWithPerms = createMemo(() => apps().filter((a) => (a.permissions ?? []).length > 0))
  return (
    <>
      <h3 style={{ margin: 0 }}>Privacy &amp; permissions</h3>
      <p style={{ margin: 0, opacity: 0.7 }}>
        Each app declares the capabilities it wants. Grant or revoke them per app — your choices
        persist in your profile. (Enforcement is advisory in this demo; the transparent contract is
        the point.)
      </p>
      <div style={{ display: 'grid', gap: '10px' }}>
        <For each={appsWithPerms()}>{(app) => <AppPermissionRow app={app} />}</For>
      </div>
    </>
  )
}

/**
 * A GENUINE, portable Settings app: an OS-skin picker (Windows 11 / macOS) + an
 * accent-color picker + a Privacy & permissions panel. All persist to the user
 * profile (`os` / `accent` / `grants` prefs) and re-skin / recolor live.
 */
export function SettingsApp(): JSX.Element {
  return (
    <div style={{ padding: '20px', display: 'grid', gap: '14px', 'line-height': 1.6 }}>
      <OsSkinSettings />
      <AppearanceSettings />
      <PrivacySettings />
    </div>
  )
}
