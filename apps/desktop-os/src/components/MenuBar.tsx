import * as React from 'react'
import { getApp } from '../apps'
import { useWm, useWmState } from '../shell'

interface MenuEntry {
  label: string
  /** Action to run; omit for a disabled-looking, inert item. */
  onSelect?: () => void
  /** Render as a thin divider instead of a clickable row. */
  separator?: boolean
}

/** macOS global menu bar: Apple menu + focused app's name + working menus; clock right. */
export function MenuBar() {
  const wm = useWm()
  const state = useWmState()
  const focused = state.windows.find((w) => w.id === state.focusedId && w.state !== 'minimized')
  const appName = focused ? (getApp(focused.appId)?.name ?? focused.title) : 'Finder'

  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30)
    return () => clearInterval(t)
  }, [])

  // Which menu is open (by key); null = none. Click-outside / select closes.
  const [openMenu, setOpenMenu] = React.useState<string | null>(null)
  const barRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!openMenu) return
    const onDown = (e: PointerEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [openMenu])

  const run = (fn?: () => void) => {
    setOpenMenu(null)
    fn?.()
  }

  const menus: Record<string, MenuEntry[]> = {
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
      { label: `About ${appName}` },
      { label: 'sep1', separator: true },
      { label: 'Preferences…', onSelect: () => openSettings() },
      { label: 'sep2', separator: true },
      {
        label: `Quit ${appName}`,
        onSelect: focused ? () => wm.close(focused.id) : undefined,
      },
    ],
    window: [
      {
        label: 'Minimize',
        onSelect: focused ? () => wm.minimize(focused.id) : undefined,
      },
      {
        label: 'Zoom',
        onSelect: focused ? () => wm.toggleMaximize(focused.id) : undefined,
      },
      { label: 'sep1', separator: true },
      {
        label: 'Close Window',
        onSelect: focused ? () => wm.close(focused.id) : undefined,
      },
    ],
    help: [{ label: 'Iris Desktop OS Help' }],
  }

  const openAbout = () => {
    const app = getApp('about')
    if (app) wm.open({ appId: 'about', title: app.name, rect: app.defaultSize })
  }
  const openSettings = () => {
    const app = getApp('settings')
    if (app) wm.open({ appId: 'settings', title: app.name, rect: app.defaultSize })
  }

  const Dropdown = ({ entries }: { entries: MenuEntry[] }) => (
    <div
      role="menu"
      style={{
        position: 'absolute',
        top: 'calc(100% + 2px)',
        left: 0,
        minWidth: 200,
        padding: 5,
        borderRadius: 8,
        background: 'var(--os-window-bg)',
        color: 'var(--os-window-fg)',
        border: 'var(--os-window-border)',
        boxShadow: '0 18px 50px rgba(0,0,0,0.4)',
        backdropFilter: 'var(--os-blur)',
        WebkitBackdropFilter: 'var(--os-blur)',
        textShadow: 'none',
        zIndex: 1,
      }}
    >
      {entries.map((entry) =>
        entry.separator ? (
          <div
            key={entry.label}
            style={{ height: 1, margin: '5px 6px', background: 'rgba(127,127,127,0.28)' }}
          />
        ) : (
          <button
            key={entry.label}
            type="button"
            role="menuitem"
            disabled={!entry.onSelect}
            onClick={() => run(entry.onSelect)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '4px 10px',
              borderRadius: 5,
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              font: 'inherit',
              fontSize: 13,
              cursor: entry.onSelect ? 'default' : 'default',
              opacity: entry.onSelect ? 1 : 0.4,
            }}
            onMouseEnter={(e) => {
              if (entry.onSelect)
                e.currentTarget.style.background = 'color-mix(in srgb, var(--os-accent) 90%, white)'
              if (entry.onSelect) e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'inherit'
            }}
          >
            {entry.label}
          </button>
        ),
      )}
    </div>
  )

  const Title = ({ menuKey, label, bold }: { menuKey: string; label: string; bold?: boolean }) => {
    const active = openMenu === menuKey
    return (
      <span style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpenMenu(active ? null : menuKey)}
          onPointerEnter={() => setOpenMenu((m) => (m ? menuKey : m))}
          style={{
            padding: '0 10px',
            height: 'var(--os-topbar-h)',
            lineHeight: 'var(--os-topbar-h)',
            fontWeight: bold ? 700 : 500,
            fontSize: menuKey === 'apple' ? 15 : 13,
            border: 'none',
            background: active ? 'rgba(255,255,255,0.22)' : 'transparent',
            color: 'inherit',
            textShadow: 'inherit',
            cursor: 'default',
            borderRadius: 4,
          }}
        >
          {label}
        </button>
        {active && <Dropdown entries={menus[menuKey] ?? []} />}
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
        alignItems: 'center',
        fontSize: 13,
        color: '#fff',
        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        background: 'rgba(0,0,0,0.28)',
        backdropFilter: 'var(--os-blur)',
        WebkitBackdropFilter: 'var(--os-blur)',
        zIndex: 90000,
        userSelect: 'none',
      }}
    >
      <Title menuKey="apple" label="" />
      <Title menuKey="app" label={appName} bold />
      <Title menuKey="file" label="File" />
      <Title menuKey="edit" label="Edit" />
      <Title menuKey="view" label="View" />
      <Title menuKey="window" label="Window" />
      <Title menuKey="help" label="Help" />
      <span style={{ flex: 1 }} />
      <span style={{ padding: '0 10px' }}>🔋 􀙇 🔍</span>
      <span style={{ padding: '0 14px 0 6px' }}>
        {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  )
}
