import { For, Show, createSignal, onMount, type JSX } from 'solid-js'
import { IrisBadge } from '@iris-ui/solid'
import { useProfile } from './profile'

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
 * A GENUINE, portable Settings app: an accent-color picker. The choice applies
 * live via `document.documentElement.style.setProperty('--os-accent', …)` (the
 * var every Iris/OS surface reads) and persists to the user profile (`accent`
 * pref) — read back + re-applied on mount so it survives a reload. Self-contained;
 * no OS-skin switching (this shell is Win11-only) and no cross-module wiring.
 */
export function SettingsApp(): JSX.Element {
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
    <div style={{ padding: '20px', display: 'grid', gap: '14px', 'line-height': 1.6 }}>
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
    </div>
  )
}
