/**
 * Desktop "depth" interaction helpers — pure geometry for drag-to-edge SNAP
 * (Windows / KDE style) and the matching snap-preview overlay. Kept framework-
 * free + side-effect-free so it's trivially testable and so the window manager
 * (`@iris-ui-kit/core/window`) stays the single source of truth for snap geometry
 * (we only reuse its zones + `snapRect`-equivalent halves here for the preview).
 */
import { type SnapZone, type WindowRect } from '@iris-ui-kit/core/window'

/** Px from a work-area edge within which a dragged window snaps to it. */
export const SNAP_THRESHOLD = 18

/**
 * Which snap zone (if any) a dragged window's TOP-LEFT corner is hinting at.
 *
 * Windows/KDE convention: near the left edge → `left` half, near the right
 * edge → `right` half, near the top edge → `maximize` (full work area).
 * Returns `null` when the corner is away from every edge. Pure.
 */
export function snapHintFor(
  topLeft: { x: number; y: number },
  area: WindowRect,
  threshold = SNAP_THRESHOLD,
): SnapZone | null {
  const left = area.x
  const right = area.x + area.width
  const top = area.y
  // Top edge wins (most decisive gesture) → maximize.
  if (topLeft.y <= top + threshold) return 'maximize'
  if (topLeft.x <= left + threshold) return 'left'
  if (topLeft.x >= right - threshold) return 'right'
  return null
}

/** Geometry of a snap zone's PREVIEW overlay within the work area. Pure. */
export function previewRect(zone: SnapZone, area: WindowRect): WindowRect {
  const halfW = Math.round(area.width / 2)
  switch (zone) {
    case 'left':
      return { x: area.x, y: area.y, width: halfW, height: area.height }
    case 'right':
      return { x: area.x + halfW, y: area.y, width: area.width - halfW, height: area.height }
    case 'maximize':
    default:
      return { x: area.x, y: area.y, width: area.width, height: area.height }
  }
}
