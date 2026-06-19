import * as React from 'react'
import { getApp } from '../apps'
import { useWmState } from '../shell'

/** macOS global menu bar: Apple menu + focused app's name + faux menus; clock right. */
export function MenuBar() {
  const state = useWmState()
  const focused = state.windows.find((w) => w.id === state.focusedId && w.state !== 'minimized')
  const appName = focused ? (getApp(focused.appId)?.name ?? focused.title) : 'Finder'
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30)
    return () => clearInterval(t)
  }, [])

  const item = (label: string, bold = false) => (
    <span style={{ padding: '0 10px', fontWeight: bold ? 700 : 500, cursor: 'default' }}>
      {label}
    </span>
  )

  return (
    <div
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
      <span style={{ padding: '0 12px', fontSize: 15 }}></span>
      {item(appName, true)}
      {item('File')}
      {item('Edit')}
      {item('View')}
      {item('Window')}
      {item('Help')}
      <span style={{ flex: 1 }} />
      <span style={{ padding: '0 10px' }}>🔋 􀙇 🔍</span>
      <span style={{ padding: '0 14px 0 6px' }}>
        {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  )
}
