import { Show, createMemo, createSignal, onCleanup, onMount, type JSX } from 'solid-js'
import { IrisMovable, IrisResizable } from '@iris-ui/solid'
import { type DesktopWindow } from '@iris-ui/core/window'
import { getManifest } from './catalog'
import { loadRemoteApp } from './remoteApp'
import { useWm, useWmState } from './wm'

/** A reactive accessor to one live window. */
type WinAccessor = () => DesktopWindow

/** Window control buttons (minimize / maximize-restore / close) — Windows style, right-aligned. */
function Controls(props: { window: WinAccessor }): JSX.Element {
  const wm = useWm()
  const stop = (fn: () => void) => (e: PointerEvent) => {
    e.stopPropagation()
    fn()
  }
  return (
    <div style={{ display: 'flex', 'align-items': 'stretch' }}>
      <button
        type="button"
        aria-label="Minimize"
        onPointerDown={stop(() => wm.minimize(props.window().id))}
        class="win-ctl"
      >
        –
      </button>
      <button
        type="button"
        aria-label="Maximize"
        onPointerDown={stop(() => wm.toggleMaximize(props.window().id))}
        class="win-ctl"
      >
        {props.window().state === 'maximized' ? '❒' : '☐'}
      </button>
      <button
        type="button"
        aria-label="Close"
        onPointerDown={stop(() => wm.close(props.window().id))}
        class="win-ctl win-ctl--close"
      >
        ✕
      </button>
    </div>
  )
}

/** Title bar — app icon + title (drag handle, double-click maximizes) + controls on the right. */
function Chrome(props: { window: WinAccessor }): JSX.Element {
  const wm = useWm()
  const app = createMemo(() => getManifest(props.window().appId))
  return (
    <div
      class="win-titlebar"
      style={{
        display: 'flex',
        'align-items': 'center',
        background: 'var(--os-titlebar-bg)',
        'border-top-left-radius': 'inherit',
        'border-top-right-radius': 'inherit',
      }}
    >
      <div
        data-iris-movable-handle
        onDblClick={() => wm.toggleMaximize(props.window().id)}
        style={{
          flex: 1,
          display: 'flex',
          'align-items': 'center',
          gap: '8px',
          height: 'var(--os-titlebar-h)',
          padding: '0 10px',
          cursor: 'default',
          'user-select': 'none',
          'min-width': 0,
        }}
      >
        <span aria-hidden style={{ 'font-size': '14px' }}>
          {app()?.icon}
        </span>
        <span
          style={{
            'font-size': '13px',
            'font-weight': 600,
            'white-space': 'nowrap',
            overflow: 'hidden',
            'text-overflow': 'ellipsis',
          }}
        >
          {props.window().title}
        </span>
      </div>
      <Controls window={props.window} />
    </div>
  )
}

/**
 * Embedded (`kind:'iframe'`) app body. Always overlays an "Open in new tab"
 * affordance: we can't reliably detect when a site refuses embedding (it just
 * renders blank under X-Frame-Options / CSP `frame-ancestors`), so the escape
 * hatch is always available.
 */
function IframeBody(props: { url: string }): JSX.Element {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <iframe
        src={props.url}
        title={props.url}
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
      />
      <div
        style={{
          position: 'absolute',
          left: '8px',
          right: '8px',
          bottom: '8px',
          display: 'flex',
          'align-items': 'center',
          gap: '8px',
          padding: '6px 10px',
          'border-radius': '8px',
          'font-size': '11px',
          background: 'color-mix(in srgb, var(--os-window-bg) 88%, transparent)',
          color: 'var(--os-window-fg)',
          border: '1px solid rgba(127,127,127,0.3)',
          'box-shadow': '0 4px 14px rgba(0,0,0,0.25)',
          'backdrop-filter': 'var(--os-blur)',
          '-webkit-backdrop-filter': 'var(--os-blur)',
        }}
      >
        <span style={{ flex: 1, opacity: 0.75 }}>
          If this stays blank, the site disallows embedding —
        </span>
        <button
          type="button"
          onClick={() => window.open(props.url, '_blank', 'noopener')}
          style={{
            border: '1px solid var(--os-accent)',
            background: 'var(--os-accent)',
            color: '#fff',
            'border-radius': '6px',
            padding: '4px 10px',
            'font-size': '11px',
            cursor: 'pointer',
            'white-space': 'nowrap',
          }}
        >
          Open in new tab
        </button>
      </div>
    </div>
  )
}

/**
 * Remote (`kind:'remote'`) app body. Dynamic-imports the module at `url` AT
 * RUNTIME and hands its `mount` a host DOM node; the returned teardown runs on
 * unmount. Shows a loading placeholder while importing and an error fallback if
 * the import fails or the module has no `mount`.
 */
function RemoteBody(props: { url: string }): JSX.Element {
  let host: HTMLDivElement | undefined
  const [status, setStatus] = createSignal<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = createSignal('')
  let unmount: (() => void) | void

  onMount(() => {
    loadRemoteApp(props.url)
      .then((mount) => {
        if (!host) return
        unmount = mount(host)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e))
        setStatus('error')
      })
  })
  onCleanup(() => unmount?.())

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={host} style={{ width: '100%', height: '100%' }} />
      <Show when={status() === 'loading'}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            'place-items': 'center',
            'font-size': '13px',
            opacity: 0.7,
          }}
        >
          Loading remote app…
        </div>
      </Show>
      <Show when={status() === 'error'}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            'place-items': 'center',
            padding: '16px',
            'text-align': 'center',
            'font-size': '13px',
            color: '#ff5f57',
          }}
        >
          Couldn’t load remote app from {props.url}
          {error() ? ` — ${error()}` : ''}
        </div>
      </Show>
    </div>
  )
}

function Body(props: { window: WinAccessor }): JSX.Element {
  const app = createMemo(() => getManifest(props.window().appId))
  // iframe / remote bodies own their scroll; component bodies scroll the win-body.
  const scroll = createMemo(() =>
    app()?.kind === 'iframe' || app()?.kind === 'remote' ? 'hidden' : 'auto',
  )
  return (
    <div class="win-body" style={{ flex: 1, 'min-height': 0, overflow: scroll() }}>
      <Show
        when={app()}
        fallback={<div style={{ padding: '16px' }}>Unknown app: {props.window().appId}</div>}
      >
        {(a) => (
          <Show
            when={a().kind === 'remote' && a().url}
            fallback={
              <Show when={a().kind === 'iframe' && a().url} fallback={a().render?.()}>
                <IframeBody url={a().url!} />
              </Show>
            }
          >
            <RemoteBody url={a().url!} />
          </Show>
        )}
      </Show>
    </div>
  )
}

/**
 * The window frame, wired to the core window manager + IrisMovable/IrisResizable.
 * Looks up its live window by id from the manager store so move/resize/focus/
 * maximize all re-render from the SAME framework-agnostic engine the React demo
 * uses.
 */
export function Window(props: { windowId: string }): JSX.Element {
  const wm = useWm()
  const state = useWmState()

  const win = createMemo(() => state().windows.find((w) => w.id === props.windowId))

  return (
    <Show when={win()} keyed={false}>
      {(() => {
        // `win` is guaranteed defined inside this branch; re-narrow per access.
        const w: WinAccessor = () => win()!
        const rect = createMemo(() => wm.displayRect(w()))
        const focused = createMemo(() => state().focusedId === w().id)

        const frame = (extraClass = ''): JSX.Element => (
          <div
            class={`win-frame${extraClass}`}
            onPointerDown={() => wm.focus(w().id)}
            style={{
              display: 'flex',
              'flex-direction': 'column',
              width: '100%',
              height: '100%',
              'border-radius': w().state === 'maximized' ? '0' : 'var(--os-window-radius)',
              overflow: 'hidden',
              background: 'var(--os-window-bg)',
              color: 'var(--os-window-fg)',
              border: 'var(--os-window-border)',
              'box-shadow': focused() ? 'var(--os-window-shadow)' : '0 6px 20px rgba(0,0,0,0.22)',
              'backdrop-filter': 'var(--os-blur)',
              '-webkit-backdrop-filter': 'var(--os-blur)',
            }}
          >
            <Chrome window={w} />
            <Body window={w} />
          </div>
        )

        return (
          <Show when={w().state !== 'minimized'}>
            <Show
              when={w().state === 'maximized'}
              fallback={
                // IrisMovable owns its own absolute positioning, so the per-window
                // z-index lives on the wrapper (it stacks the windows).
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    'z-index': w().z,
                    'pointer-events': 'none',
                  }}
                >
                  <div style={{ position: 'absolute', 'pointer-events': 'auto' }}>
                    <IrisMovable
                      position={{ x: rect().x, y: rect().y }}
                      onPositionChange={(p) => wm.move(w().id, p.x, p.y)}
                      byHandle
                    >
                      <IrisResizable
                        size={{ width: rect().width, height: rect().height }}
                        onSizeChange={(s) => wm.resize(w().id, s.width, s.height)}
                        handles={['right', 'bottom', 'bottom-right']}
                        minSize={{ width: w().minSize.width, height: w().minSize.height }}
                      >
                        {frame(' win-open')}
                      </IrisResizable>
                    </IrisMovable>
                  </div>
                </div>
              }
            >
              {/* Maximized: pinned to the work area, no drag/resize. */}
              <div
                style={{
                  position: 'absolute',
                  left: `${rect().x}px`,
                  top: `${rect().y}px`,
                  width: `${rect().width}px`,
                  height: `${rect().height}px`,
                  'z-index': w().z,
                }}
              >
                {frame()}
              </div>
            </Show>
          </Show>
        )
      })()}
    </Show>
  )
}
