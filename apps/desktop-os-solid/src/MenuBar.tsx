import { For, Show, createMemo, createSignal, onCleanup, type JSX } from 'solid-js'
import { getManifest } from './catalog'
import { useWm, useWmState } from './wm'

interface MenuEntry {
  label: string
  /** Action to run; omit for a disabled-looking, inert item. */
  onSelect?: () => void
  /** Render as a thin divider instead of a clickable row. */
  separator?: boolean
}

/**
 * macOS global menu bar: Apple menu + the focused app's name + working menus;
 * clock pinned right. Mirrors the React shell's MenuBar — the same Apple/app/
 * File/Edit/View/Window/Help structure, here in Solid idioms. Pinned absolute to
 * the top of the desktop; the work area reserves `--os-topbar-h` for it.
 */
export function MenuBar(): JSX.Element {
  const wm = useWm()
  const state = useWmState()

  const focused = createMemo(() => {
    const s = state()
    return s.windows.find((w) => w.id === s.focusedId && w.state !== 'minimized') ?? null
  })
  const appName = createMemo(() => {
    const f = focused()
    return f ? (getManifest(f.appId)?.name ?? f.title) : 'Finder'
  })

  const [now, setNow] = createSignal(new Date())
  const tick = setInterval(() => setNow(new Date()), 1000 * 30)
  onCleanup(() => clearInterval(tick))

  // Which menu is open (by key); null = none. Click-outside / select closes.
  const [openMenu, setOpenMenu] = createSignal<string | null>(null)
  let barRef: HTMLDivElement | undefined
  const onDown = (e: PointerEvent): void => {
    if (barRef && !barRef.contains(e.target as Node)) setOpenMenu(null)
  }
  document.addEventListener('pointerdown', onDown, true)
  onCleanup(() => document.removeEventListener('pointerdown', onDown, true))

  const openAbout = (): void => {
    const app = getManifest('about')
    if (app) wm.open({ appId: 'about', title: app.name, rect: app.defaultSize })
  }
  const openSettings = (): void => {
    const app = getManifest('settings')
    if (app) wm.open({ appId: 'settings', title: app.name, rect: app.defaultSize })
  }

  const run = (fn?: () => void): void => {
    setOpenMenu(null)
    fn?.()
  }

  // Built lazily per render so labels/actions track the focused window + app name.
  const menus = createMemo<Record<string, MenuEntry[]>>(() => {
    const f = focused()
    const name = appName()
    return {
      apple: [
        { label: 'About This Mac', onSelect: () => openAbout() },
        { label: 'sep1', separator: true },
        { label: 'System Settings…', onSelect: () => openSettings() },
        { label: 'sep2', separator: true },
        { label: 'Sleep' },
        { label: 'Restart…' },
        { label: 'Shut Down…' },
      ],
      file: [
        { label: 'New' },
        { label: 'Open…' },
        { label: 'sep1', separator: true },
        { label: 'Save' },
      ],
      edit: [
        { label: 'Undo' },
        { label: 'Redo' },
        { label: 'sep1', separator: true },
        { label: 'Cut' },
        { label: 'Copy' },
        { label: 'Paste' },
      ],
      view: [{ label: 'as Icons' }, { label: 'as List' }, { label: 'Show Toolbar' }],
      app: [
        { label: `About ${name}` },
        { label: 'sep1', separator: true },
        { label: 'Preferences…', onSelect: () => openSettings() },
        { label: 'sep2', separator: true },
        { label: `Quit ${name}`, onSelect: f ? () => wm.close(f.id) : undefined },
      ],
      window: [
        { label: 'Minimize', onSelect: f ? () => wm.minimize(f.id) : undefined },
        { label: 'Zoom', onSelect: f ? () => wm.toggleMaximize(f.id) : undefined },
        { label: 'sep1', separator: true },
        { label: 'Close Window', onSelect: f ? () => wm.close(f.id) : undefined },
      ],
      help: [{ label: 'Iris Desktop OS Help' }],
    }
  })

  const Dropdown = (props: { entries: MenuEntry[] }): JSX.Element => (
    <div
      role="menu"
      style={{
        position: 'absolute',
        top: 'calc(100% + 2px)',
        left: 0,
        'min-width': '200px',
        padding: '5px',
        'border-radius': '8px',
        background: 'var(--os-window-bg)',
        color: 'var(--os-window-fg)',
        border: 'var(--os-window-border)',
        'box-shadow': '0 18px 50px rgba(0,0,0,0.4)',
        'backdrop-filter': 'var(--os-blur)',
        '-webkit-backdrop-filter': 'var(--os-blur)',
        'text-shadow': 'none',
        'z-index': 1,
      }}
    >
      <For each={props.entries}>
        {(entry) => (
          <Show
            when={!entry.separator}
            fallback={
              <div
                style={{ height: '1px', margin: '5px 6px', background: 'rgba(127,127,127,0.28)' }}
              />
            }
          >
            <button
              type="button"
              role="menuitem"
              disabled={!entry.onSelect}
              onClick={() => run(entry.onSelect)}
              style={{
                display: 'block',
                width: '100%',
                'text-align': 'left',
                padding: '4px 10px',
                'border-radius': '5px',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                font: 'inherit',
                'font-size': '13px',
                cursor: 'default',
                opacity: entry.onSelect ? 1 : 0.4,
              }}
              onMouseEnter={(e) => {
                if (entry.onSelect) {
                  e.currentTarget.style.background =
                    'color-mix(in srgb, var(--os-accent) 90%, white)'
                  e.currentTarget.style.color = '#fff'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'inherit'
              }}
            >
              {entry.label}
            </button>
          </Show>
        )}
      </For>
    </div>
  )

  const Title = (props: { menuKey: string; label: string; bold?: boolean }): JSX.Element => {
    const active = (): boolean => openMenu() === props.menuKey
    return (
      <span style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpenMenu(active() ? null : props.menuKey)}
          onPointerEnter={() => setOpenMenu((m) => (m ? props.menuKey : m))}
          style={{
            padding: '0 10px',
            height: 'var(--os-topbar-h)',
            'line-height': 'var(--os-topbar-h)',
            'font-weight': props.bold ? 700 : 500,
            'font-size': props.menuKey === 'apple' ? '15px' : '13px',
            border: 'none',
            background: active() ? 'rgba(255,255,255,0.22)' : 'transparent',
            color: 'inherit',
            'text-shadow': 'inherit',
            cursor: 'default',
            'border-radius': '4px',
          }}
        >
          {props.label}
        </button>
        <Show when={active()}>
          <Dropdown entries={menus()[props.menuKey] ?? []} />
        </Show>
      </span>
    )
  }

  return (
    <div
      ref={barRef}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 'var(--os-topbar-h)',
        display: 'flex',
        'align-items': 'center',
        'font-size': '13px',
        color: '#fff',
        'text-shadow': '0 1px 2px rgba(0,0,0,0.3)',
        background: 'rgba(0,0,0,0.28)',
        'backdrop-filter': 'var(--os-blur)',
        '-webkit-backdrop-filter': 'var(--os-blur)',
        'z-index': 90000,
        'user-select': 'none',
      }}
    >
      <Title menuKey="apple" label="" />
      <Title menuKey="app" label={appName()} bold />
      <Title menuKey="file" label="File" />
      <Title menuKey="edit" label="Edit" />
      <Title menuKey="view" label="View" />
      <Title menuKey="window" label="Window" />
      <Title menuKey="help" label="Help" />
      <span style={{ flex: 1 }} />
      <span style={{ padding: '0 10px' }}>🔋 🔍</span>
      <span style={{ padding: '0 14px 0 6px' }}>
        {now().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
        {now().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  )
}
