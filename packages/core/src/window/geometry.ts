import type { SnapZone, WindowRect, WindowSize } from './types'

const ZERO_AREA: WindowRect = { x: 0, y: 0, width: 0, height: 0 }
const ZERO_SIZE: WindowSize = { width: 0, height: 0 }

const readFiniteProperty = (value: unknown, key: string): number | undefined => {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return undefined
  try {
    const candidate = (value as Record<string, unknown>)[key]
    return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined
  } catch {
    return undefined
  }
}

const finitePropertyOr = (value: unknown, fallback: unknown, key: string): number => {
  const direct = readFiniteProperty(value, key)
  if (direct !== undefined) return direct
  // Avoid probing the same hostile object twice when it is also the fallback.
  if (value === fallback) return 0
  return readFiniteProperty(fallback, key) ?? 0
}

/** Normalize external desktop dimensions without retaining the caller's object. */
export function normalizeWindowArea(
  area: WindowRect,
  fallback: WindowRect = ZERO_AREA,
): WindowRect {
  return {
    x: finitePropertyOr(area, fallback, 'x'),
    y: finitePropertyOr(area, fallback, 'y'),
    width: Math.max(0, finitePropertyOr(area, fallback, 'width')),
    height: Math.max(0, finitePropertyOr(area, fallback, 'height')),
  }
}

/** Normalize a size, treating negative dimensions as zero and copying it. */
export function normalizeWindowSize(
  size: WindowSize,
  fallback: WindowSize = ZERO_SIZE,
): WindowSize {
  return {
    width: Math.max(0, finitePropertyOr(size, fallback, 'width')),
    height: Math.max(0, finitePropertyOr(size, fallback, 'height')),
  }
}

/** Geometry for a snap zone within `area`. Pure. */
export function snapRect(zone: SnapZone, area: WindowRect): WindowRect {
  const safeArea = normalizeWindowArea(area)
  const { x, y, width: w, height: h } = safeArea
  const halfW = Math.round(w / 2)
  const halfH = Math.round(h / 2)
  let rect: WindowRect
  switch (zone) {
    case 'maximize':
      rect = { x, y, width: w, height: h }
      break
    case 'left':
      rect = { x, y, width: halfW, height: h }
      break
    case 'right':
      rect = { x: x + halfW, y, width: w - halfW, height: h }
      break
    case 'top':
      rect = { x, y, width: w, height: halfH }
      break
    case 'bottom':
      rect = { x, y: y + halfH, width: w, height: h - halfH }
      break
    case 'top-left':
      rect = { x, y, width: halfW, height: halfH }
      break
    case 'top-right':
      rect = { x: x + halfW, y, width: w - halfW, height: halfH }
      break
    case 'bottom-left':
      rect = { x, y: y + halfH, width: halfW, height: h - halfH }
      break
    case 'bottom-right':
      rect = { x: x + halfW, y: y + halfH, width: w - halfW, height: h - halfH }
      break
    case 'center': {
      const cw = Math.round(w * 0.6)
      const ch = Math.round(h * 0.6)
      rect = {
        x: x + Math.round((w - cw) / 2),
        y: y + Math.round((h - ch) / 2),
        width: cw,
        height: ch,
      }
      break
    }
    default:
      rect = safeArea
  }
  return clampRect(rect, safeArea, ZERO_SIZE)
}

/** Clamp `rect` to sit within `area`, enforcing `minSize` when possible. Pure. */
export function clampRect(rect: WindowRect, area: WindowRect, minSize: WindowSize): WindowRect {
  const safeArea = normalizeWindowArea(area)
  const safeMin = normalizeWindowSize(minSize)
  const requestedWidth = Math.max(0, finitePropertyOr(rect, safeMin, 'width'))
  const requestedHeight = Math.max(0, finitePropertyOr(rect, safeMin, 'height'))
  // A minimum larger than the available area cannot satisfy both contracts;
  // containment wins so geometry never escapes the work area.
  const width = Math.min(safeArea.width, Math.max(safeMin.width, requestedWidth))
  const height = Math.min(safeArea.height, Math.max(safeMin.height, requestedHeight))
  const requestedX = finitePropertyOr(rect, safeArea, 'x')
  const requestedY = finitePropertyOr(rect, safeArea, 'y')
  const x = Math.max(safeArea.x, Math.min(requestedX, safeArea.x + safeArea.width - width))
  const y = Math.max(safeArea.y, Math.min(requestedY, safeArea.y + safeArea.height - height))
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
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0
  const safeStep = Number.isFinite(step) ? Math.max(0, step) : 0
  const off = (safeIndex % span) * safeStep
  const safeArea = normalizeWindowArea(area)
  const safeSize = normalizeWindowSize(size)
  return clampRect(
    { x: safeArea.x + 32 + off, y: safeArea.y + 24 + off, ...safeSize },
    safeArea,
    safeSize,
  )
}
