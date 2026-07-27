import * as React from 'react'
import { IrisButton, IrisBadge, IrisInput } from '@iris-ui-kit/react'
import { OS_ORDER, CHROMES } from './os'
import { useOs, useWm, useWmState, useApps } from './shell'
import { type AppManifest } from './catalog'
import { PERMISSION_META, useGrants } from './permissions'
import { TerminalApp } from './appviews/Terminal'

/**
 * The built-in COMPONENT app views. The app catalog (manifests, kinds, install
 * state) lives in `./catalog`; this module only houses the React panes that the
 * `kind:'component'` manifests render. Re-exports the app-view components so the
 * catalog can wire them into manifests.
 */

function Pane({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 20, display: 'grid', gap: 14, lineHeight: 1.6 }}>{children}</div>
}

export function AboutView() {
  return (
    <Pane>
      <h2 style={{ margin: 0 }}>Iris Desktop OS</h2>
      <p style={{ margin: 0 }}>
        A windowed desktop shell whose entire window logic — open, focus &amp; z-order, minimize,
        maximize/restore, move/resize, edge-snap — lives in the framework-agnostic{' '}
        <code>@iris-ui-kit/core/window</code> (<code>createWindowManager</code>). The chrome you see
        is a thin React renderer; drag uses <code>IrisMovable</code>, resize uses{' '}
        <code>IrisResizable</code>.
      </p>
      <p style={{ margin: 0 }}>
        <strong>Aggregation shell:</strong> open the <em>App Store</em> to install link &amp; iframe
        apps; your profile (skin + installed apps) persists in localStorage via{' '}
        <code>@iris-ui-kit/core/profile</code>.
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

export function NotepadView() {
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

export function ShowcaseView() {
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

function AppearanceSettings() {
  const { chrome, setOs } = useOs()
  return (
    <>
      <h3 style={{ margin: 0 }}>Appearance</h3>
      <p style={{ margin: 0, opacity: 0.7 }}>
        Switch the desktop skin. The window manager, taskbar, and every open window stay exactly the
        same — only the look changes. Your choice is saved to your profile and survives a reload.
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
    </>
  )
}

/** One app's permission grant/revoke toggles in the privacy panel. */
function AppPermissionRow({ app }: { app: AppManifest }) {
  const { isGranted, grant, revoke } = useGrants()
  const perms = app.permissions ?? []
  return (
    <div
      style={{
        display: 'grid',
        gap: 8,
        padding: 12,
        borderRadius: 10,
        border: '1px solid rgba(127,127,127,0.25)',
        background: 'color-mix(in srgb, var(--os-window-fg) 4%, transparent)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{app.icon}</span>
        <strong style={{ fontSize: 13, flex: 1 }}>{app.name}</strong>
        {app.custom && (
          <IrisBadge tone="primary" variant="subtle" size="sm">
            Yours
          </IrisBadge>
        )}
      </div>
      {perms.length === 0 ? (
        <span style={{ fontSize: 12, opacity: 0.6 }}>No permissions requested.</span>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {perms.map((perm) => {
            const meta = PERMISSION_META[perm]
            const granted = isGranted(app.id, perm)
            return (
              <div
                key={perm}
                style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                title={meta.description}
              >
                <span style={{ fontSize: 15 }} aria-hidden>
                  {meta.icon}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 12 }}>{meta.label}</strong>
                  <br />
                  <span style={{ fontSize: 11, opacity: 0.6 }}>{meta.description}</span>
                </span>
                {granted ? (
                  <IrisBadge tone="success" variant="subtle" size="sm">
                    Granted
                  </IrisBadge>
                ) : (
                  <IrisBadge tone="neutral" variant="subtle" size="sm">
                    Blocked
                  </IrisBadge>
                )}
                <IrisButton
                  variant={granted ? 'outline' : 'solid'}
                  size="sm"
                  onClick={() => (granted ? revoke(app.id, perm) : grant(app.id, perm))}
                >
                  {granted ? 'Revoke' : 'Grant'}
                </IrisButton>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PrivacySettings() {
  const apps = useApps()
  // Built-ins ship granted-by-default conceptually, but exposing every app keeps
  // the model honest + lets users tighten even built-ins. Custom + installed too.
  return (
    <>
      <h3 style={{ margin: 0 }}>Privacy &amp; permissions</h3>
      <p style={{ margin: 0, opacity: 0.7 }}>
        Each app declares the capabilities it wants. Grant or revoke them per app — your choices
        persist in your profile. (Enforcement is advisory in this demo; the transparent contract is
        the point.)
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {apps.map((app) => (
          <AppPermissionRow key={app.id} app={app} />
        ))}
      </div>
    </>
  )
}

export function SettingsView() {
  return (
    <Pane>
      <AppearanceSettings />
      <PrivacySettings />
    </Pane>
  )
}

export function TaskManagerView() {
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

/** The terminal view, wrapped so the catalog can supply the live app-name list. */
export function TerminalView({ appNames }: { appNames: string[] }) {
  return <TerminalApp appNames={appNames} />
}
