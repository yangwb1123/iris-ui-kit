import * as React from 'react'
import { IrisButton, IrisBadge, IrisInput } from '@iris-ui/react'
import { OS_ORDER, CHROMES } from './os'
import { useOs, useWm, useWmState } from './shell'
import { DataApp } from './appviews/Data'
import { CalculatorApp } from './appviews/Calculator'
import { TerminalApp } from './appviews/Terminal'
import { PhotosApp } from './appviews/Photos'

export interface AppDef {
  id: string
  name: string
  /** Emoji glyph used as the icon (keeps the demo dependency-free). */
  icon: string
  defaultSize?: { width: number; height: number }
  render: () => React.ReactNode
}

function Pane({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 20, display: 'grid', gap: 14, lineHeight: 1.6 }}>{children}</div>
}

function AboutApp() {
  return (
    <Pane>
      <h2 style={{ margin: 0 }}>Iris Desktop OS</h2>
      <p style={{ margin: 0 }}>
        A windowed desktop shell whose entire window logic — open, focus &amp; z-order, minimize,
        maximize/restore, move/resize, edge-snap — lives in the framework-agnostic{' '}
        <code>@iris-ui/core/window</code> (<code>createWindowManager</code>). The chrome you see is
        a thin React renderer; drag uses <code>IrisMovable</code>, resize uses{' '}
        <code>IrisResizable</code>.
      </p>
      <p style={{ margin: 0 }}>
        <strong>One logic, three looks:</strong> open <em>Settings</em> to switch the skin between
        Windows 11, macOS and KDE Plasma — the same windows just re-style.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <IrisBadge tone="primary" variant="subtle">
          createWindowManager
        </IrisBadge>
        <IrisBadge tone="success" variant="subtle">
          IrisMovable
        </IrisBadge>
        <IrisBadge tone="success" variant="subtle">
          IrisResizable
        </IrisBadge>
      </div>
    </Pane>
  )
}

function NotepadApp() {
  const [text, setText] = React.useState('')
  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder="Type something… (state lives in this window)"
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        border: 'none',
        outline: 'none',
        resize: 'none',
        padding: 16,
        font: '14px/1.6 ui-monospace, monospace',
        background: 'transparent',
        color: 'var(--os-window-fg)',
      }}
    />
  )
}

const FILES = [
  { name: 'Documents', kind: 'folder', icon: '📁' },
  { name: 'Pictures', kind: 'folder', icon: '📁' },
  { name: 'roadmap-v4.md', kind: 'file', icon: '📄' },
  { name: 'budget.xlsx', kind: 'file', icon: '📊' },
  { name: 'wallpaper.png', kind: 'file', icon: '🖼️' },
]

function FilesApp() {
  return (
    <div style={{ padding: 12, display: 'grid', gap: 4 }}>
      {FILES.map((f) => (
        <div
          key={f.name}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            borderRadius: 6,
            cursor: 'default',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(127,127,127,0.12)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ fontSize: 20 }}>{f.icon}</span>
          <span style={{ flex: 1 }}>{f.name}</span>
          <span style={{ opacity: 0.5, fontSize: 12 }}>{f.kind}</span>
        </div>
      ))}
    </div>
  )
}

function ShowcaseApp() {
  const [name, setName] = React.useState('')
  return (
    <Pane>
      <p style={{ margin: 0 }}>
        Real Iris components, rendered inside a managed window — they inherit the OS skin via
        tokens.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <IrisButton variant="solid">Solid</IrisButton>
        <IrisButton variant="outline">Outline</IrisButton>
        <IrisButton variant="ghost">Ghost</IrisButton>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <IrisBadge tone="primary" variant="solid">
          primary
        </IrisBadge>
        <IrisBadge tone="success" variant="subtle">
          success
        </IrisBadge>
        <IrisBadge tone="warning" variant="subtle">
          warning
        </IrisBadge>
        <IrisBadge tone="danger" variant="subtle">
          danger
        </IrisBadge>
      </div>
      <IrisInput value={name} onChange={(e) => setName(e.target.value)} placeholder="IrisInput…" />
      {name && <p style={{ margin: 0 }}>Hello, {name} 👋</p>}
    </Pane>
  )
}

function SettingsApp() {
  const { chrome, setOs } = useOs()
  return (
    <Pane>
      <h3 style={{ margin: 0 }}>Appearance</h3>
      <p style={{ margin: 0, opacity: 0.7 }}>
        Switch the desktop skin. The window manager, taskbar, and every open window stay exactly the
        same — only the look changes.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {OS_ORDER.map((id) => {
          const c = CHROMES[id]
          const active = chrome.id === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setOs(id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderRadius: 10,
                cursor: 'pointer',
                textAlign: 'left',
                border: active ? '2px solid var(--os-accent)' : '1px solid rgba(127,127,127,0.3)',
                background: active
                  ? 'color-mix(in srgb, var(--os-accent) 12%, transparent)'
                  : 'transparent',
                color: 'inherit',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 44,
                  height: 30,
                  borderRadius: 6,
                  background: c.vars['--os-wallpaper'],
                  flexShrink: 0,
                  border: '1px solid rgba(255,255,255,0.4)',
                }}
              />
              <span style={{ flex: 1 }}>
                <strong>{c.label}</strong>
                <br />
                <span style={{ fontSize: 12, opacity: 0.65 }}>
                  controls {c.controls} · {c.bottomBar}
                </span>
              </span>
              {active && (
                <IrisBadge tone="primary" variant="solid">
                  active
                </IrisBadge>
              )}
            </button>
          )
        })}
      </div>
    </Pane>
  )
}

function TaskManagerApp() {
  const wm = useWm()
  const state = useWmState()
  return (
    <div style={{ padding: 12, display: 'grid', gap: 4 }}>
      <div style={{ opacity: 0.6, fontSize: 12, padding: '0 8px' }}>
        {state.windows.length} open window(s) — live from the window manager store
      </div>
      {state.windows.map((w) => (
        <div
          key={w.id}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px' }}
        >
          <span style={{ flex: 1 }}>{w.title}</span>
          <span style={{ fontSize: 12, opacity: 0.5 }}>{w.state}</span>
          <IrisButton variant="ghost" onClick={() => wm.close(w.id)}>
            End task
          </IrisButton>
        </div>
      ))}
    </div>
  )
}

export const APPS: AppDef[] = [
  {
    id: 'about',
    name: 'About',
    icon: 'ℹ️',
    defaultSize: { width: 460, height: 360 },
    render: () => <AboutApp />,
  },
  {
    id: 'files',
    name: 'Files',
    icon: '📁',
    defaultSize: { width: 520, height: 400 },
    render: () => <FilesApp />,
  },
  {
    id: 'notepad',
    name: 'Notepad',
    icon: '📝',
    defaultSize: { width: 480, height: 360 },
    render: () => <NotepadApp />,
  },
  {
    id: 'showcase',
    name: 'Iris Showcase',
    icon: '🎛️',
    defaultSize: { width: 460, height: 380 },
    render: () => <ShowcaseApp />,
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: '⚙️',
    defaultSize: { width: 440, height: 420 },
    render: () => <SettingsApp />,
  },
  {
    id: 'taskmgr',
    name: 'Task Manager',
    icon: '📈',
    defaultSize: { width: 420, height: 340 },
    render: () => <TaskManagerApp />,
  },
  {
    id: 'data',
    name: 'Data',
    icon: '📊',
    defaultSize: { width: 560, height: 420 },
    render: () => <DataApp />,
  },
  {
    id: 'calculator',
    name: 'Calculator',
    icon: '🧮',
    defaultSize: { width: 300, height: 440 },
    render: () => <CalculatorApp />,
  },
  {
    id: 'terminal',
    name: 'Terminal',
    icon: '⌨️',
    defaultSize: { width: 520, height: 360 },
    // `APPS` is fully initialized by the time any window renders, so reading it
    // here (rather than at module top-level) is safe and keeps `apps` live.
    render: () => <TerminalApp appNames={APPS.map((a) => a.name)} />,
  },
  {
    id: 'photos',
    name: 'Photos',
    icon: '🖼️',
    defaultSize: { width: 520, height: 420 },
    render: () => <PhotosApp />,
  },
]

export const getApp = (appId: string): AppDef | undefined => APPS.find((a) => a.id === appId)
