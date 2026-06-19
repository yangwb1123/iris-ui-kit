import { For, createSignal, type JSX } from 'solid-js'
import { IrisButton, IrisBadge } from '@iris-ui/solid'

export interface AppDef {
  id: string
  name: string
  /** Emoji glyph used as the icon (keeps the demo dependency-free). */
  icon: string
  defaultSize?: { width: number; height: number }
  render: () => JSX.Element
}

function Pane(props: { children: JSX.Element }): JSX.Element {
  return (
    <div style={{ padding: '20px', display: 'grid', gap: '14px', 'line-height': 1.6 }}>
      {props.children}
    </div>
  )
}

function AboutApp(): JSX.Element {
  return (
    <Pane>
      <h2 style={{ margin: 0 }}>Iris Desktop OS — Solid</h2>
      <p style={{ margin: 0 }}>
        A windowed desktop shell whose entire window logic — open, focus &amp; z-order, minimize,
        maximize/restore, move/resize, edge-snap — lives in the framework-agnostic{' '}
        <code>@iris-ui/core/window</code> (<code>createWindowManager</code>). This is the very same
        engine the React demo drives — here it runs on <strong>SolidJS</strong>. The chrome is a
        thin Solid renderer; drag uses <code>IrisMovable</code>, resize uses{' '}
        <code>IrisResizable</code>.
      </p>
      <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap' }}>
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

function NotepadApp(): JSX.Element {
  const [text, setText] = createSignal('')
  return (
    <textarea
      value={text()}
      onInput={(e) => setText(e.currentTarget.value)}
      placeholder="Type something… (state lives in this window)"
      style={{
        width: '100%',
        height: '100%',
        'box-sizing': 'border-box',
        border: 'none',
        outline: 'none',
        resize: 'none',
        padding: '16px',
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

function FilesApp(): JSX.Element {
  return (
    <div style={{ padding: '12px', display: 'grid', gap: '4px' }}>
      <For each={FILES}>
        {(f) => (
          <div
            style={{
              display: 'flex',
              'align-items': 'center',
              gap: '10px',
              padding: '8px 10px',
              'border-radius': '6px',
              cursor: 'default',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(127,127,127,0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ 'font-size': '20px' }}>{f.icon}</span>
            <span style={{ flex: 1 }}>{f.name}</span>
            <span style={{ opacity: 0.5, 'font-size': '12px' }}>{f.kind}</span>
          </div>
        )}
      </For>
    </div>
  )
}

function ShowcaseApp(): JSX.Element {
  return (
    <Pane>
      <p style={{ margin: 0 }}>
        Real <code>@iris-ui/solid</code> components, rendered inside a managed window.
      </p>
      <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap', 'align-items': 'center' }}>
        <IrisButton variant="solid">Solid</IrisButton>
        <IrisButton variant="outline">Outline</IrisButton>
        <IrisButton variant="ghost">Ghost</IrisButton>
      </div>
      <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap' }}>
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
    </Pane>
  )
}

export const APPS: AppDef[] = [
  {
    id: 'about',
    name: 'About',
    icon: 'ℹ️',
    defaultSize: { width: 480, height: 380 },
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
    defaultSize: { width: 460, height: 360 },
    render: () => <ShowcaseApp />,
  },
]

export const getApp = (appId: string): AppDef | undefined => APPS.find((a) => a.id === appId)
