import { For, Show, createEffect, createMemo, createSignal, type JSX } from 'solid-js'
import { type AppManifest } from './catalog'
import { useApps, useLaunchApp } from './profile'

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

/**
 * KDE Kickoff: bottom-left application launcher — user header, search box,
 * category rail + app list. Mirrors the React shell's Kickoff, here in Solid
 * signals. The launcher when the skin's `chrome.launcher === 'kickoff'`.
 * Searching spans every app; otherwise the list is scoped to the selected
 * category. Launch on click / Enter; Esc or click-outside closes.
 */
export function Kickoff(props: { open: boolean; onClose: () => void }): JSX.Element {
  const apps = useApps()
  const launchApp = useLaunchApp()
  const [query, setQuery] = createSignal('')
  const [category, setCategory] = createSignal('favorites')
  let inputRef: HTMLInputElement | undefined

  // Reset + focus on open.
  createEffect(() => {
    if (props.open) {
      setQuery('')
      setCategory('favorites')
      queueMicrotask(() => inputRef?.focus())
    }
  })

  const results = createMemo<AppManifest[]>(() => {
    const q = query().trim().toLowerCase()
    const cat = CATEGORIES.find((c) => c.id === category()) ?? CATEGORIES[1]
    // Searching spans every app; otherwise scope to the selected category.
    const scoped: AppManifest[] = q
      ? apps()
      : cat.apps
        ? cat.apps
            .map((id) => apps().find((a) => a.id === id))
            .filter((a): a is AppManifest => Boolean(a))
        : apps()
    return q ? scoped.filter((a) => a.name.toLowerCase().includes(q)) : scoped
  })

  const launch = (id: string): void => {
    launchApp(id)
    props.onClose()
  }

  return (
    <Show when={props.open}>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 'calc(var(--os-bar-h) + 6px)',
          left: '6px',
          width: '440px',
          height: '62vh',
          'max-height': '520px',
          display: 'flex',
          'flex-direction': 'column',
          'border-radius': '6px',
          overflow: 'hidden',
          background: 'var(--os-bar-bg)',
          color: 'var(--os-bar-fg)',
          border: '1px solid rgba(61,174,233,0.5)',
          'box-shadow': '0 14px 40px rgba(0,0,0,0.5)',
          'backdrop-filter': 'var(--os-blur)',
          '-webkit-backdrop-filter': 'var(--os-blur)',
          'font-family': 'var(--os-font)',
          'z-index': 100000,
        }}
      >
        {/* User header. */}
        <div
          style={{
            display: 'flex',
            'align-items': 'center',
            gap: '12px',
            padding: '14px 14px',
            'border-bottom': '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.18)',
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'grid',
              'place-items': 'center',
              width: '40px',
              height: '40px',
              'border-radius': '50%',
              'font-size': '20px',
              color: '#fff',
              background:
                'linear-gradient(135deg, var(--os-accent) 0%, var(--os-accent-strong) 100%)',
            }}
          >
            👤
          </span>
          <div style={{ display: 'flex', 'flex-direction': 'column', 'line-height': 1.25 }}>
            <strong style={{ 'font-size': '14px' }}>user@iris-os</strong>
            <span style={{ 'font-size': '11px', opacity: 0.65 }}>Plasma Desktop</span>
          </div>
        </div>

        {/* Search box. */}
        <div style={{ padding: '12px', 'border-bottom': '1px solid rgba(255,255,255,0.1)' }}>
          <input
            ref={inputRef}
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results()[0]) launch(results()[0].id)
              if (e.key === 'Escape') props.onClose()
            }}
            placeholder="Search applications…"
            style={{
              width: '100%',
              'box-sizing': 'border-box',
              padding: '8px 12px',
              'border-radius': '4px',
              border: '1px solid rgba(61,174,233,0.5)',
              background: 'rgba(0,0,0,0.25)',
              color: 'inherit',
              outline: 'none',
              'font-family': 'inherit',
            }}
          />
        </div>

        {/* Body: category rail (left) + app list (right). */}
        <div style={{ display: 'flex', flex: 1, 'min-height': 0 }}>
          <div
            role="tablist"
            aria-label="Categories"
            style={{
              width: '140px',
              'flex-shrink': 0,
              padding: '6px',
              display: 'flex',
              'flex-direction': 'column',
              gap: '2px',
              'border-right': '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.12)',
              overflow: 'auto',
            }}
          >
            <For each={CATEGORIES}>
              {(c) => {
                const searching = (): boolean => Boolean(query().trim())
                const selected = (): boolean => !searching() && c.id === category()
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selected()}
                    disabled={searching()}
                    onClick={() => setCategory(c.id)}
                    style={{
                      display: 'flex',
                      'align-items': 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 10px',
                      border: 'none',
                      'border-left': selected()
                        ? '3px solid var(--os-accent)'
                        : '3px solid transparent',
                      'border-radius': '4px',
                      background: selected()
                        ? 'color-mix(in srgb, var(--os-accent) 22%, transparent)'
                        : 'transparent',
                      color: 'inherit',
                      cursor: searching() ? 'default' : 'pointer',
                      opacity: searching() ? 0.4 : 1,
                      'text-align': 'left',
                      'font-size': '13px',
                      'font-family': 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      if (!selected() && !searching())
                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                    }}
                    onMouseLeave={(e) => {
                      if (!selected()) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span aria-hidden style={{ 'font-size': '15px' }}>
                      {c.icon}
                    </span>
                    {c.label}
                  </button>
                )
              }}
            </For>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '6px' }}>
            <For each={results()}>
              {(app) => (
                <button
                  type="button"
                  onClick={() => launch(app.id)}
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    'border-radius': '4px',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    'text-align': 'left',
                    'font-family': 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--os-accent)'
                    e.currentTarget.style.color = '#fff'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'inherit'
                  }}
                >
                  <span style={{ 'font-size': '22px' }}>{app.icon}</span>
                  {app.name}
                </button>
              )}
            </For>
            <Show when={results().length === 0}>
              <div style={{ padding: '12px', opacity: 0.6 }}>No applications found.</div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}
