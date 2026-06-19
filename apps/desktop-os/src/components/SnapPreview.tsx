import * as React from 'react'
import { type SnapZone } from '@iris-ui/core/window'
import { useWmState } from '../shell'
import { previewRect } from '../depth'

/**
 * Translucent, accent-tinted SNAP PREVIEW overlay shown while a window is
 * dragged near a work-area edge (Windows/KDE "Snap Assist" feel). Painted
 * BEHIND windows (windows have z ≥ 1) but above the wallpaper. Token-driven
 * via `--os-accent`. Renders nothing when no zone is hinted.
 */
export function SnapPreview({ zone }: { zone: SnapZone | null }): React.ReactElement | null {
  const { workArea } = useWmState()
  if (!zone) return null
  const r = previewRect(zone, workArea)
  return (
    <div
      aria-hidden
      data-snap-preview={zone}
      style={{
        position: 'absolute',
        left: r.x,
        top: r.y,
        width: r.width,
        height: r.height,
        zIndex: 0,
        pointerEvents: 'none',
        borderRadius: 'var(--os-window-radius)',
        background: 'color-mix(in srgb, var(--os-accent) 28%, transparent)',
        border: '2px solid var(--os-accent)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.28)',
        backdropFilter: 'var(--os-blur)',
        WebkitBackdropFilter: 'var(--os-blur)',
        transition: 'left 90ms ease, top 90ms ease, width 90ms ease, height 90ms ease',
      }}
    />
  )
}
