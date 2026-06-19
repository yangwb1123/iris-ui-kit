import { Show, createMemo, type JSX } from 'solid-js'
import { IrisMovable, IrisResizable } from '@iris-ui/solid'
import { type DesktopWindow } from '@iris-ui/core/window'
import { getApp } from './apps'
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
  const app = createMemo(() => getApp(props.window().appId))
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

function Body(props: { window: WinAccessor }): JSX.Element {
  const app = createMemo(() => getApp(props.window().appId))
  return (
    <div class="win-body" style={{ flex: 1, 'min-height': 0, overflow: 'auto' }}>
      <Show
        when={app()}
        fallback={<div style={{ padding: '16px' }}>Unknown app: {props.window().appId}</div>}
      >
        {(a) => a().render()}
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
