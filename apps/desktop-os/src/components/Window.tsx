import * as React from 'react'
import { IrisMovable, IrisResizable } from '@iris-ui/react'
import { type DesktopWindow, type SnapZone } from '@iris-ui/core/window'
import { getManifest } from '../catalog'
import { loadRemoteApp } from '../remoteApp'
import { useOs, useWm, useWmState } from '../shell'
import { snapHintFor } from '../depth'
import { ContextMenu, type MenuItem } from './ContextMenu'

/** Window control buttons (minimize / maximize-restore / close), placement + style per OS. */
function Controls({ window: w }: { window: DesktopWindow }) {
  const wm = useWm()
  const { chrome } = useOs()
  const stop = (fn: () => void) => (e: React.PointerEvent) => {
    e.stopPropagation()
    fn()
  }

  if (chrome.controlStyle === 'mac') {
    const dot = (color: string, label: string, fn: () => void) => (
      <button
        type="button"
        aria-label={label}
        onPointerDown={stop(fn)}
        style={{
          width: 13,
          height: 13,
          borderRadius: '50%',
          border: 'none',
          background: color,
          cursor: 'pointer',
          padding: 0,
        }}
      />
    )
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {dot('#ff5f57', 'Close', () => wm.close(w.id))}
        {dot('#febc2e', 'Minimize', () => wm.minimize(w.id))}
        {dot('#28c840', 'Maximize', () => wm.toggleMaximize(w.id))}
      </div>
    )
  }

  // Windows / KDE: glyph buttons on the right; close hovers red.
  const btn = (label: string, glyph: string, fn: () => void, danger = false) => (
    <button
      type="button"
      aria-label={label}
      onPointerDown={stop(fn)}
      className={danger ? 'win-ctl win-ctl--close' : 'win-ctl'}
    >
      {glyph}
    </button>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      {btn('Minimize', '–', () => wm.minimize(w.id))}
      {btn('Maximize', w.state === 'maximized' ? '❒' : '☐', () => wm.toggleMaximize(w.id))}
      {btn('Close', '✕', () => wm.close(w.id), true)}
    </div>
  )
}

function Chrome({ window: w }: { window: DesktopWindow }) {
  const wm = useWm()
  const { chrome } = useOs()
  const app = getManifest(w.appId)
  // Titlebar right-click menu anchor (null = closed).
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null)
  const controls = <Controls window={w} />

  const menuItems: MenuItem[] = [
    { label: 'Minimize', onClick: () => wm.minimize(w.id) },
    {
      label: w.state === 'maximized' ? 'Restore' : 'Maximize',
      onClick: () => wm.toggleMaximize(w.id),
    },
    { separator: true },
    { label: 'Snap left', onClick: () => wm.snap(w.id, 'left') },
    { label: 'Snap right', onClick: () => wm.snap(w.id, 'right') },
    { separator: true },
    { label: 'Close', danger: true, onClick: () => wm.close(w.id) },
  ]
  const title = (
    <div
      data-iris-movable-handle
      onDoubleClick={() => wm.toggleMaximize(w.id)}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 'var(--os-titlebar-h)',
        padding: '0 10px',
        cursor: 'default',
        userSelect: 'none',
        minWidth: 0,
      }}
    >
      <span aria-hidden style={{ fontSize: 14 }}>
        {app?.icon}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {w.title}
      </span>
    </div>
  )
  return (
    <div
      className="win-titlebar"
      onContextMenu={(e) => {
        e.preventDefault()
        // Don't let the desktop's own context menu also fire for titlebar clicks.
        e.stopPropagation()
        wm.focus(w.id)
        setMenu({ x: e.clientX, y: e.clientY })
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        flexDirection: chrome.controls === 'left' ? 'row' : 'row',
        background: 'var(--os-titlebar-bg)',
        borderTopLeftRadius: 'inherit',
        borderTopRightRadius: 'inherit',
      }}
    >
      {chrome.controls === 'left' ? (
        <>
          <div style={{ padding: '0 10px' }}>{controls}</div>
          {title}
        </>
      ) : (
        <>
          {title}
          {controls}
        </>
      )}
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}

/**
 * Embedded (`kind:'iframe'`) app body. Always overlays an "Open in new tab"
 * affordance: we can't reliably detect when a site refuses embedding (it just
 * renders blank under X-Frame-Options / CSP `frame-ancestors`), so we make the
 * escape hatch always available.
 */
function IframeBody({ url }: { url: string }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <iframe
        src={url}
        title={url}
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
      />
      <div
        style={{
          position: 'absolute',
          left: 8,
          right: 8,
          bottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderRadius: 8,
          fontSize: 11,
          background: 'color-mix(in srgb, var(--os-window-bg) 88%, transparent)',
          color: 'var(--os-window-fg)',
          border: '1px solid rgba(127,127,127,0.3)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
          backdropFilter: 'var(--os-blur)',
          WebkitBackdropFilter: 'var(--os-blur)',
        }}
      >
        <span style={{ flex: 1, opacity: 0.75 }}>
          If this stays blank, the site disallows embedding —
        </span>
        <button
          type="button"
          onClick={() => window.open(url, '_blank', 'noopener')}
          style={{
            border: '1px solid var(--os-accent)',
            background: 'var(--os-accent)',
            color: '#fff',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
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
 * unmount (or url change). Shows a loading placeholder while importing and an
 * error fallback if the import fails or the module has no `mount`.
 */
function RemoteBody({ url }: { url: string }) {
  const hostRef = React.useRef<HTMLDivElement>(null)
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let unmount: (() => void) | void
    let cancelled = false
    setStatus('loading')
    setError('')
    loadRemoteApp(url)
      .then((mount) => {
        if (cancelled || !hostRef.current) return
        unmount = mount(hostRef.current)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setStatus('error')
      })
    return () => {
      cancelled = true
      unmount?.()
    }
  }, [url])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={hostRef} style={{ width: '100%', height: '100%' }} />
      {status === 'loading' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            fontSize: 13,
            opacity: 0.7,
          }}
        >
          Loading remote app…
        </div>
      )}
      {status === 'error' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            textAlign: 'center',
            fontSize: 13,
            color: '#ff5f57',
          }}
        >
          Couldn’t load remote app from {url}
          {error ? ` — ${error}` : ''}
        </div>
      )}
    </div>
  )
}

function Body({ window: w }: { window: DesktopWindow }) {
  const app = getManifest(w.appId)
  const scroll = app?.kind === 'iframe' ? 'hidden' : 'auto'
  return (
    <div className="win-body" style={{ flex: 1, minHeight: 0, overflow: scroll }}>
      {!app ? (
        <div style={{ padding: 16 }}>Unknown app: {w.appId}</div>
      ) : app.kind === 'iframe' && app.url ? (
        <IframeBody url={app.url} />
      ) : app.kind === 'remote' && app.url ? (
        <RemoteBody url={app.url} />
      ) : (
        app.render?.()
      )}
    </div>
  )
}

export interface WindowProps {
  window: DesktopWindow
  /**
   * Report the live drag-to-edge snap zone (or `null` to clear) so the Desktop
   * can render the snap preview. Omitted in non-snapping contexts (e.g. tests).
   */
  onSnapHint?: (zone: SnapZone | null) => void
}

/** The window frame, wired to the core window manager + IrisMovable/IrisResizable. */
export function Window({ window: w, onSnapHint }: WindowProps) {
  const wm = useWm()
  const { workArea } = useWmState()
  const rect = wm.displayRect(w)
  const focused = wm.isFocused(w.id)
  // The snap zone hinted by the IN-FLIGHT drag (mirrored to Desktop via onSnapHint).
  const dragZoneRef = React.useRef<SnapZone | null>(null)
  // Play the open animation on the FIRST mount only (not on re-render / maximize).
  const firstMount = React.useRef(true)
  const openClass = firstMount.current ? ' win-open' : ''
  React.useEffect(() => {
    firstMount.current = false
  }, [])
  if (w.state === 'minimized') return null

  const frame = (
    <div
      className={`win-frame${openClass}`}
      onPointerDownCapture={() => wm.focus(w.id)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        borderRadius: w.state === 'maximized' ? 0 : 'var(--os-window-radius)',
        overflow: 'hidden',
        background: 'var(--os-window-bg)',
        color: 'var(--os-window-fg)',
        border: 'var(--os-window-border)',
        boxShadow: focused ? 'var(--os-window-shadow)' : '0 6px 20px rgba(0,0,0,0.22)',
        backdropFilter: 'var(--os-blur)',
        WebkitBackdropFilter: 'var(--os-blur)',
      }}
    >
      <Chrome window={w} />
      <Body window={w} />
    </div>
  )

  // Maximized: pinned to the work area, no drag/resize.
  if (w.state === 'maximized') {
    return (
      <div
        style={{
          position: 'absolute',
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          zIndex: w.z,
        }}
      >
        {frame}
      </div>
    )
  }

  return (
    <IrisMovable
      position={{ x: rect.x, y: rect.y }}
      onPositionChange={(p) => {
        wm.move(w.id, p.x, p.y)
        // Detect a snap zone from the (clamped) top-left and surface it to Desktop.
        const zone = snapHintFor(p, workArea)
        if (zone !== dragZoneRef.current) {
          dragZoneRef.current = zone
          onSnapHint?.(zone)
        }
      }}
      onDragEnd={() => {
        const zone = dragZoneRef.current
        dragZoneRef.current = null
        onSnapHint?.(null)
        if (zone) wm.snap(w.id, zone)
      }}
      byHandle
      style={{ zIndex: w.z }}
    >
      <IrisResizable
        size={{ width: rect.width, height: rect.height }}
        onSizeChange={(s) => wm.resize(w.id, s.width, s.height)}
        handles={['right', 'bottom', 'bottom-right']}
        minWidth={w.minSize.width}
        minHeight={w.minSize.height}
      >
        {frame}
      </IrisResizable>
    </IrisMovable>
  )
}
