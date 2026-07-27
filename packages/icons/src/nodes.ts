import type { IrisIconNode } from './types'

// Compact, side-effect-free constructors keep the icon catalogue readable
// while allowing bundlers to remove node shapes that an imported icon does not use.
export const line = /* @__NO_SIDE_EFFECTS__ */ (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): IrisIconNode => ({
  tag: 'line',
  attrs: { x1, y1, x2, y2 },
})

export const circle = /* @__NO_SIDE_EFFECTS__ */ (
  cx: number,
  cy: number,
  r: number,
): IrisIconNode => ({
  tag: 'circle',
  attrs: { cx, cy, r },
})

export const poly = /* @__NO_SIDE_EFFECTS__ */ (points: string): IrisIconNode => ({
  tag: 'polyline',
  attrs: { points },
})

export const path = /* @__NO_SIDE_EFFECTS__ */ (d: string): IrisIconNode => ({
  tag: 'path',
  attrs: { d },
})

export const rect = /* @__NO_SIDE_EFFECTS__ */ (
  x: number,
  y: number,
  width: number,
  height: number,
  rx: number,
  ry: number,
): IrisIconNode => ({ tag: 'rect', attrs: { x, y, width, height, rx, ry } })
