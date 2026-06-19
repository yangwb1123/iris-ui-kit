import * as React from 'react'
import { IrisMovable, IrisResizable } from '@iris-ui/react'
import { type DesktopWindow } from '@iris-ui/core/window'
import { getApp } from '../apps'
import { useOs, useWm } from '../shell'

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
  const app = getApp(w.appId)
  const controls = <Controls window={w} />
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
    </div>
  )
}

function Body({ window: w }: { window: DesktopWindow }) {
  const app = getApp(w.appId)
  return (
    <div className="win-body" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      {app ? app.render() : <div style={{ padding: 16 }}>Unknown app: {w.appId}</div>}
    </div>
  )
}

/** The window frame, wired to the core window manager + IrisMovable/IrisResizable. */
export function Window({ window: w }: { window: DesktopWindow }) {
  const wm = useWm()
  const rect = wm.displayRect(w)
  const focused = wm.isFocused(w.id)
  if (w.state === 'minimized') return null

  const frame = (
    <div
      className="win-frame"
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
      onPositionChange={(p) => wm.move(w.id, p.x, p.y)}
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
