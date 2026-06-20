import { Show, createMemo, type JSX } from 'solid-js'
import { type SnapZone } from '@iris-ui/core/window'
import { useWmState } from './wm'
import { previewRect } from './depth'

/**
 * Translucent, accent-tinted SNAP PREVIEW overlay shown while a window is
 * dragged near a work-area edge (Windows/KDE "Snap Assist" feel). Painted
 * BEHIND windows (windows have z ≥ 1) but above the wallpaper. Token-driven
 * via `--os-accent`. Renders nothing when no zone is hinted.
 */
export function SnapPreview(props: { zone: SnapZone | null }): JSX.Element {
  const state = useWmState()
  // Geometry only matters when a zone is hinted; recompute as the work area /
  // zone change so the overlay tracks the live snap target.
  const rect = createMemo(() => (props.zone ? previewRect(props.zone, state().workArea) : null))

  return (
    <Show when={rect()} keyed>
      {(r) => (
        <div
          aria-hidden
          data-snap-preview={props.zone ?? undefined}
          style={{
            position: 'absolute',
            left: `${r.x}px`,
            top: `${r.y}px`,
            width: `${r.width}px`,
            height: `${r.height}px`,
            'z-index': 0,
            'pointer-events': 'none',
            'border-radius': 'var(--os-window-radius)',
            background: 'color-mix(in srgb, var(--os-accent) 28%, transparent)',
            border: '2px solid var(--os-accent)',
            'box-shadow': '0 8px 32px rgba(0, 0, 0, 0.28)',
            'backdrop-filter': 'var(--os-blur)',
            '-webkit-backdrop-filter': 'var(--os-blur)',
            transition: 'left 90ms ease, top 90ms ease, width 90ms ease, height 90ms ease',
          }}
        />
      )}
    </Show>
  )
}
