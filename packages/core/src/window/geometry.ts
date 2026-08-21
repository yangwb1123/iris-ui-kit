import type { SnapZone, WindowRect, WindowSize } from './types'

/** Geometry for a snap zone within `area`. Pure. */
export function snapRect(zone: SnapZone, area: WindowRect): WindowRect {
  const { x, y, width: w, height: h } = area
  const halfW = Math.round(w / 2)
  const halfH = Math.round(h / 2)
  switch (zone) {
    case 'maximize':
      return { x, y, width: w, height: h }
    case 'left':
      return { x, y, width: halfW, height: h }
    case 'right':
      return { x: x + halfW, y, width: w - halfW, height: h }
    case 'top':
      return { x, y, width: w, height: halfH }
    case 'bottom':
      return { x, y: y + halfH, width: w, height: h - halfH }
    case 'top-left':
      return { x, y, width: halfW, height: halfH }
    case 'top-right':
      return { x: x + halfW, y, width: w - halfW, height: halfH }
    case 'bottom-left':
      return { x, y: y + halfH, width: halfW, height: h - halfH }
    case 'bottom-right':
      return { x: x + halfW, y: y + halfH, width: w - halfW, height: h - halfH }
    case 'center': {
      const cw = Math.round(w * 0.6)
      const ch = Math.round(h * 0.6)
      return {
        x: x + Math.round((w - cw) / 2),
        y: y + Math.round((h - ch) / 2),
        width: cw,
        height: ch,
      }
    }
  }
}

/** Clamp `rect` to sit within `area`, enforcing `minSize`. Pure. */
export function clampRect(rect: WindowRect, area: WindowRect, minSize: WindowSize): WindowRect {
  const width = Math.max(minSize.width, Math.min(rect.width, area.width))
  const height = Math.max(minSize.height, Math.min(rect.height, area.height))
  const x = Math.max(area.x, Math.min(rect.x, area.x + area.width - width))
  const y = Math.max(area.y, Math.min(rect.y, area.y + area.height - height))
  return { x, y, width, height }
}

/** Cascade placement for the Nth concurrently-open window. Pure. */
export function cascadeRect(
  index: number,
  area: WindowRect,
  size: WindowSize,
  step: number,
): WindowRect {
  const span = 6 // wrap the cascade so it never marches off-screen
  const off = (index % span) * step
  return clampRect({ x: area.x + 32 + off, y: area.y + 24 + off, ...size }, area, size)
}
