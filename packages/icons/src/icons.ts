import type { IrisIcon, IrisIconNode, IrisIconSet } from './types'

// Compact node constructors — keep the icon table readable. Each is a tiny pure
// helper that builds ONE structured SVG node; the per-icon consts below call
// them inline so an individual icon import pulls only its own node data.
const line = (x1: number, y1: number, x2: number, y2: number): IrisIconNode => ({
  tag: 'line',
  attrs: { x1, y1, x2, y2 },
})
const circle = (cx: number, cy: number, r: number): IrisIconNode => ({
  tag: 'circle',
  attrs: { cx, cy, r },
})
const poly = (points: string): IrisIconNode => ({ tag: 'polyline', attrs: { points } })
const path = (d: string): IrisIconNode => ({ tag: 'path', attrs: { d } })
const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  rx: number,
  ry: number,
): IrisIconNode => ({ tag: 'rect', attrs: { x, y, width, height, rx, ry } })

/**
 * Built-in icon set — Feather-style 24×24 line icons covering the glyphs the
 * Iris primitives need (navigation chevrons, form affordances, status, files).
 * The default `0 0 24 24` viewBox and the `currentColor` stroke convention are
 * applied at render time, so a single CSS `color` themes every icon.
 *
 * TREE-SHAKEABLE BY DESIGN: every icon is its own top-level `export const`
 * (`{ name, nodes }`) that references ONLY its own node data — never a shared
 * all-icons object. A size-conscious consumer can therefore pull just the
 * glyphs they use:
 *
 * ```ts
 * import { chevronDown, search, createIconRegistry } from '@iris-ui/icons'
 * // A minimal registry built from ONLY the imported icons — the whole default
 * // set is never pulled in:
 * const lean = createIconRegistry({ icons: [chevronDown, search] })
 * lean.resolve('chevron-down') // → chevronDown
 * ```
 *
 * The whole-set consumers (`defaultIcons` / `defaultIconRegistry`, used by the
 * Icon components) are unaffected — `defaultIcons` simply AGGREGATES the same
 * per-icon consts, in declaration order, into the identical map shape as before.
 */

// ── Per-icon, individually tree-shakeable exports ────────────────────────────
// Export name = camelCase of the semantic `name`. `name` stays the canonical
// kebab-case key used by registries, themes, and `resolveIcon(name)`.

export const chevronDown: IrisIcon = { name: 'chevron-down', nodes: [poly('6 9 12 15 18 9')] }
export const chevronUp: IrisIcon = { name: 'chevron-up', nodes: [poly('18 15 12 9 6 15')] }
export const chevronLeft: IrisIcon = { name: 'chevron-left', nodes: [poly('15 18 9 12 15 6')] }
export const chevronRight: IrisIcon = { name: 'chevron-right', nodes: [poly('9 18 15 12 9 6')] }
export const check: IrisIcon = { name: 'check', nodes: [poly('20 6 9 17 4 12')] }
export const x: IrisIcon = { name: 'x', nodes: [line(18, 6, 6, 18), line(6, 6, 18, 18)] }
export const search: IrisIcon = {
  name: 'search',
  nodes: [circle(11, 11, 8), line(21, 21, 16.65, 16.65)],
}
export const plus: IrisIcon = { name: 'plus', nodes: [line(12, 5, 12, 19), line(5, 12, 19, 12)] }
export const minus: IrisIcon = { name: 'minus', nodes: [line(5, 12, 19, 12)] }
export const calendar: IrisIcon = {
  name: 'calendar',
  nodes: [rect(3, 4, 18, 18, 2, 2), line(16, 2, 16, 6), line(8, 2, 8, 6), line(3, 10, 21, 10)],
}
export const clock: IrisIcon = {
  name: 'clock',
  nodes: [circle(12, 12, 10), poly('12 6 12 12 16 14')],
}
export const info: IrisIcon = {
  name: 'info',
  nodes: [circle(12, 12, 10), line(12, 16, 12, 12), line(12, 8, 12.01, 8)],
}
export const alertTriangle: IrisIcon = {
  name: 'alert-triangle',
  nodes: [
    path(
      'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    ),
    line(12, 9, 12, 13),
    line(12, 17, 12.01, 17),
  ],
}
export const alertCircle: IrisIcon = {
  name: 'alert-circle',
  nodes: [circle(12, 12, 10), line(12, 8, 12, 12), line(12, 16, 12.01, 16)],
}
export const checkCircle: IrisIcon = {
  name: 'check-circle',
  nodes: [path('M22 11.08V12a10 10 0 1 1-5.93-9.14'), poly('22 4 12 14.01 9 11.01')],
}
export const menu: IrisIcon = {
  name: 'menu',
  nodes: [line(3, 12, 21, 12), line(3, 6, 21, 6), line(3, 18, 21, 18)],
}
export const moreHorizontal: IrisIcon = {
  name: 'more-horizontal',
  nodes: [circle(12, 12, 1), circle(19, 12, 1), circle(5, 12, 1)],
}
export const eye: IrisIcon = {
  name: 'eye',
  nodes: [path('M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'), circle(12, 12, 3)],
}
export const eyeOff: IrisIcon = {
  name: 'eye-off',
  nodes: [
    path(
      'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24',
    ),
    line(1, 1, 23, 23),
  ],
}
export const upload: IrisIcon = {
  name: 'upload',
  nodes: [
    path('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'),
    poly('17 8 12 3 7 8'),
    line(12, 3, 12, 15),
  ],
}
export const folder: IrisIcon = {
  name: 'folder',
  nodes: [path('M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z')],
}
export const file: IrisIcon = {
  name: 'file',
  nodes: [
    path('M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z'),
    poly('13 2 13 9 20 9'),
  ],
}
export const sun: IrisIcon = {
  name: 'sun',
  nodes: [
    circle(12, 12, 5),
    line(12, 1, 12, 3),
    line(12, 21, 12, 23),
    line(4.22, 4.22, 5.64, 5.64),
    line(18.36, 18.36, 19.78, 19.78),
    line(1, 12, 3, 12),
    line(21, 12, 23, 12),
    line(4.22, 19.78, 5.64, 18.36),
    line(18.36, 5.64, 19.78, 4.22),
  ],
}
export const moon: IrisIcon = {
  name: 'moon',
  nodes: [path('M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z')],
}

/**
 * The built-in icon set, addressable by semantic name. Identical in shape and
 * content to the legacy hand-written map — it is now AGGREGATED from the per-icon
 * consts above (in declaration order, which fixes `defaultIcons` key order and
 * thus `defaultIconRegistry.list()`), so existing consumers (Icon components,
 * themes) are unaffected.
 *
 * The aggregation is a single `/*@__PURE__*\/`-annotated IIFE: the inline array
 * of all-icon references lives ONLY inside it, so when a consumer imports just a
 * per-icon const and never touches `defaultIcons`, a bundler drops the whole
 * IIFE — and with it the references that would otherwise keep every glyph alive.
 * That is what makes a single-icon import pull just that glyph.
 */
export const defaultIcons: IrisIconSet = /*@__PURE__*/ (() => ({
  name: 'iris-default',
  icons: Object.fromEntries(
    [
      chevronDown,
      chevronUp,
      chevronLeft,
      chevronRight,
      check,
      x,
      search,
      plus,
      minus,
      calendar,
      clock,
      info,
      alertTriangle,
      alertCircle,
      checkCircle,
      menu,
      moreHorizontal,
      eye,
      eyeOff,
      upload,
      folder,
      file,
      sun,
      moon,
    ].map((icon): [string, IrisIcon] => [icon.name, icon]),
  ),
}))()
