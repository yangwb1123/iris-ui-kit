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
 * import { chevronDown, search, createIconRegistry } from '@iris-ui-kit/icons'
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

// ── Navigation ────────────────────────────────────────────────────────────────
export const chevronDown: IrisIcon = { name: 'chevron-down', nodes: [poly('6 9 12 15 18 9')] }
export const chevronUp: IrisIcon = { name: 'chevron-up', nodes: [poly('18 15 12 9 6 15')] }
export const chevronLeft: IrisIcon = { name: 'chevron-left', nodes: [poly('15 18 9 12 15 6')] }
export const chevronRight: IrisIcon = { name: 'chevron-right', nodes: [poly('9 18 15 12 9 6')] }
export const chevronsUp: IrisIcon = {
  name: 'chevrons-up',
  nodes: [poly('17 11 12 6 7 11'), poly('17 18 12 13 7 18')],
}
export const chevronsDown: IrisIcon = {
  name: 'chevrons-down',
  nodes: [poly('7 13 12 18 17 13'), poly('7 6 12 11 17 6')],
}
export const chevronsLeft: IrisIcon = {
  name: 'chevrons-left',
  nodes: [poly('11 17 6 12 11 7'), poly('18 17 13 12 18 7')],
}
export const chevronsRight: IrisIcon = {
  name: 'chevrons-right',
  nodes: [poly('13 17 18 12 13 7'), poly('6 17 11 12 6 7')],
}
export const arrowUp: IrisIcon = {
  name: 'arrow-up',
  nodes: [line(12, 19, 12, 5), poly('5 12 12 5 19 12')],
}
export const arrowDown: IrisIcon = {
  name: 'arrow-down',
  nodes: [line(12, 5, 12, 19), poly('19 12 12 19 5 12')],
}
export const arrowLeft: IrisIcon = {
  name: 'arrow-left',
  nodes: [line(19, 12, 5, 12), poly('12 19 5 12 12 5')],
}
export const arrowRight: IrisIcon = {
  name: 'arrow-right',
  nodes: [line(5, 12, 19, 12), poly('12 5 19 12 12 19')],
}
export const home: IrisIcon = {
  name: 'home',
  nodes: [path('M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'), poly('9 22 9 12 15 12 15 22')],
}
export const menu: IrisIcon = {
  name: 'menu',
  nodes: [line(3, 12, 21, 12), line(3, 6, 21, 6), line(3, 18, 21, 18)],
}
export const moreHorizontal: IrisIcon = {
  name: 'more-horizontal',
  nodes: [circle(12, 12, 1), circle(19, 12, 1), circle(5, 12, 1)],
}
export const moreVertical: IrisIcon = {
  name: 'more-vertical',
  nodes: [circle(12, 12, 1), circle(12, 5, 1), circle(12, 19, 1)],
}
export const sidebar: IrisIcon = {
  name: 'sidebar',
  nodes: [rect(3, 3, 18, 18, 2, 2), line(9, 3, 9, 21)],
}
export const externalLink: IrisIcon = {
  name: 'external-link',
  nodes: [
    path('M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'),
    poly('15 3 21 3 21 9'),
    line(10, 14, 21, 3),
  ],
}

// ── Actions ───────────────────────────────────────────────────────────────────
export const check: IrisIcon = { name: 'check', nodes: [poly('20 6 9 17 4 12')] }
export const x: IrisIcon = { name: 'x', nodes: [line(18, 6, 6, 18), line(6, 6, 18, 18)] }
export const close: IrisIcon = { name: 'close', nodes: [line(18, 6, 6, 18), line(6, 6, 18, 18)] }
export const plus: IrisIcon = { name: 'plus', nodes: [line(12, 5, 12, 19), line(5, 12, 19, 12)] }
export const minus: IrisIcon = { name: 'minus', nodes: [line(5, 12, 19, 12)] }
export const edit: IrisIcon = {
  name: 'edit',
  nodes: [
    path('M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'),
    path('M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'),
  ],
}
export const copy: IrisIcon = {
  name: 'copy',
  nodes: [
    rect(9, 9, 12, 12, 2, 2),
    path('M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'),
  ],
}
export const save: IrisIcon = {
  name: 'save',
  nodes: [
    path('M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z'),
    poly('17 21 17 13 7 13 7 21'),
    poly('7 3 7 8 15 8'),
  ],
}
export const trash: IrisIcon = {
  name: 'trash',
  nodes: [
    poly('3 6 5 6 21 6'),
    path('M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'),
    line(10, 11, 10, 17),
    line(14, 11, 14, 17),
  ],
}
export const share: IrisIcon = {
  name: 'share',
  nodes: [
    circle(18, 5, 3),
    circle(6, 12, 3),
    circle(18, 19, 3),
    line(8.59, 13.51, 15.42, 17.49),
    line(15.41, 6.51, 8.59, 10.49),
  ],
}
export const refresh: IrisIcon = {
  name: 'refresh',
  nodes: [
    poly('23 4 23 10 17 10'),
    poly('1 20 1 14 7 14'),
    path('M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15'),
  ],
}
export const filter: IrisIcon = {
  name: 'filter',
  nodes: [poly('22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3')],
}
export const download: IrisIcon = {
  name: 'download',
  nodes: [
    path('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'),
    poly('7 10 12 15 17 10'),
    line(12, 15, 12, 3),
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
export const loader: IrisIcon = {
  name: 'loader',
  nodes: [
    line(12, 2, 12, 6),
    line(12, 18, 12, 22),
    poly('4.93 4.93 7.76 7.76'),
    poly('16.24 16.24 19.07 19.07'),
    line(2, 12, 6, 12),
    line(18, 12, 22, 12),
    poly('19.07 4.93 16.24 7.76'),
    poly('7.76 16.24 4.93 19.07'),
  ],
}
export const sortAsc: IrisIcon = {
  name: 'sort-asc',
  nodes: [
    line(4, 6, 16, 6),
    line(4, 12, 11, 12),
    line(4, 18, 11, 18),
    poly('15 15 18 18 21 15'),
    line(18, 6, 18, 18),
  ],
}
export const sortDesc: IrisIcon = {
  name: 'sort-desc',
  nodes: [
    line(4, 6, 16, 6),
    line(4, 12, 11, 12),
    line(4, 18, 11, 18),
    poly('15 9 18 6 21 9'),
    line(18, 18, 18, 6),
  ],
}

// ── Status & Feedback ─────────────────────────────────────────────────────────
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
export const info: IrisIcon = {
  name: 'info',
  nodes: [circle(12, 12, 10), line(12, 16, 12, 12), line(12, 8, 12.01, 8)],
}
export const helpCircle: IrisIcon = {
  name: 'help-circle',
  nodes: [
    circle(12, 12, 10),
    path('M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'),
    line(12, 17, 12.01, 17),
  ],
}
export const slash: IrisIcon = {
  name: 'slash',
  nodes: [circle(12, 12, 10), line(4.93, 4.93, 19.07, 19.07)],
}
export const bell: IrisIcon = {
  name: 'bell',
  nodes: [path('M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'), path('M13.73 21a2 2 0 0 1-3.46 0')],
}
export const bellOff: IrisIcon = {
  name: 'bell-off',
  nodes: [
    path('M13.73 21a2 2 0 0 1-3.46 0'),
    path('M18.63 13A17.89 17.89 0 0 1 18 8'),
    path('M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14'),
    path('M18 8a6 6 0 0 0-9.33-5'),
  ],
  // skip the visible-slash decoration — bell-off already carries the concept
}

// ── Objects / Files / Media ───────────────────────────────────────────────────
export const file: IrisIcon = {
  name: 'file',
  nodes: [
    path('M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z'),
    poly('13 2 13 9 20 9'),
  ],
}
export const folder: IrisIcon = {
  name: 'folder',
  nodes: [path('M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z')],
}
export const image: IrisIcon = {
  name: 'image',
  nodes: [rect(2, 2, 20, 20, 2, 2), circle(8.5, 8.5, 1.5), poly('21 15 16 10 5 21')],
}
export const camera: IrisIcon = {
  name: 'camera',
  nodes: [
    path('M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z'),
    circle(12, 13, 4),
  ],
}
export const paperclip: IrisIcon = {
  name: 'paperclip',
  nodes: [
    path(
      'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48',
    ),
  ],
}
export const printer: IrisIcon = {
  name: 'printer',
  nodes: [
    poly('6 9 6 2 18 2 18 9'),
    path('M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2'),
    rect(6, 14, 12, 8, 0, 0),
  ],
}
export const tag: IrisIcon = {
  name: 'tag',
  nodes: [
    path('M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z'),
    line(7, 7, 7.01, 7),
  ],
}
export const gift: IrisIcon = {
  name: 'gift',
  nodes: [
    poly('20 12 20 22 4 22 4 12'),
    rect(2, 7, 20, 5, 0, 0),
    path('M12 22V7'),
    path('M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z'),
    path('M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z'),
  ],
}

// ── User & Profile ────────────────────────────────────────────────────────────
export const user: IrisIcon = {
  name: 'user',
  nodes: [path('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'), circle(12, 7, 4)],
}
export const users: IrisIcon = {
  name: 'users',
  nodes: [
    path('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'),
    circle(9, 7, 4),
    path('M23 21v-2a4 4 0 0 0-3-3.87'),
    path('M16 3.13a4 4 0 0 1 0 7.75'),
  ],
}
export const settings: IrisIcon = {
  name: 'settings',
  nodes: [
    circle(12, 12, 3),
    path(
      'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
    ),
  ],
}
export const logOut: IrisIcon = {
  name: 'log-out',
  nodes: [
    path('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'),
    poly('16 17 21 12 16 7'),
    line(21, 12, 9, 12),
  ],
}
export const logIn: IrisIcon = {
  name: 'log-in',
  nodes: [
    path('M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4'),
    poly('10 17 15 12 10 7'),
    line(15, 12, 3, 12),
  ],
}

// ── Data & Communication ──────────────────────────────────────────────────────
export const mail: IrisIcon = {
  name: 'mail',
  nodes: [
    path('M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z'),
    poly('22 6 12 13 2 6'),
  ],
}
export const send: IrisIcon = {
  name: 'send',
  nodes: [line(22, 2, 11, 13), poly('22 2 15 22 11 13 2 9 22 2')],
}
export const inbox: IrisIcon = {
  name: 'inbox',
  nodes: [
    poly('22 12 16 12 14 15 10 15 8 12 2 12'),
    path(
      'M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
    ),
  ],
}
export const phone: IrisIcon = {
  name: 'phone',
  nodes: [
    path(
      'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
    ),
  ],
}
export const globe: IrisIcon = {
  name: 'globe',
  nodes: [
    circle(12, 12, 10),
    line(2, 12, 22, 12),
    path(
      'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    ),
  ],
}
export const mapPin: IrisIcon = {
  name: 'map-pin',
  nodes: [path('M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'), circle(12, 10, 3)],
}

// ── Lock / Security ───────────────────────────────────────────────────────────
export const lock: IrisIcon = {
  name: 'lock',
  nodes: [rect(5, 11, 14, 10, 2, 2), path('M8 11V7a4 4 0 0 1 8 0v4'), circle(12, 16, 1)],
}
export const unlock: IrisIcon = {
  name: 'unlock',
  nodes: [rect(5, 11, 14, 10, 2, 2), path('M8 11V7a4 4 0 0 1 7.83-2'), circle(12, 16, 1)],
}
export const shield: IrisIcon = {
  name: 'shield',
  nodes: [path('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z')],
}
export const shieldOff: IrisIcon = {
  name: 'shield-off',
  nodes: [
    path('M19.69 14a6.9 6.9 0 0 0 .31-2V5l-8-3-3.16 1.18'),
    path('M4.73 4.73L4 5v7c0 6 8 10 8 10a20.29 20.29 0 0 0 5.62-4.38'),
    line(1, 1, 23, 23),
  ],
}

// ── Misc ──────────────────────────────────────────────────────────────────────
export const bookmark: IrisIcon = {
  name: 'bookmark',
  nodes: [path('M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z')],
}
export const star: IrisIcon = {
  name: 'star',
  nodes: [
    poly(
      '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2',
    ),
  ],
}
export const heart: IrisIcon = {
  name: 'heart',
  nodes: [
    path(
      'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
    ),
  ],
}
export const thumbsUp: IrisIcon = {
  name: 'thumbs-up',
  nodes: [
    path(
      'M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3',
    ),
  ],
}
export const thumbsDown: IrisIcon = {
  name: 'thumbs-down',
  nodes: [
    path(
      'M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17',
    ),
  ],
}
export const maximize: IrisIcon = {
  name: 'maximize',
  nodes: [
    path(
      'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',
    ),
  ],
}
export const minimize: IrisIcon = {
  name: 'minimize',
  nodes: [
    path(
      'M8 3v3a2 2 0 0 1-2 2H3m0 0h5M3 3l5 5m13 5v-3a2 2 0 0 0-2-2h-3m0 0h5M21 3l-5 5M3 21l5-5m13 5v-3a2 2 0 0 0-2-2h-3m0 0h5M21 21l-5-5',
    ),
  ],
}
export const grid: IrisIcon = {
  name: 'grid',
  nodes: [
    rect(3, 3, 7, 7, 0, 0),
    rect(14, 3, 7, 7, 0, 0),
    rect(14, 14, 7, 7, 0, 0),
    rect(3, 14, 7, 7, 0, 0),
  ],
}
export const list: IrisIcon = {
  name: 'list',
  nodes: [
    line(8, 6, 21, 6),
    line(8, 12, 21, 12),
    line(8, 18, 21, 18),
    line(3, 6, 3.01, 6),
    line(3, 12, 3.01, 12),
    line(3, 18, 3.01, 18),
  ],
}

export const calendar: IrisIcon = {
  name: 'calendar',
  nodes: [rect(3, 4, 18, 18, 2, 2), line(16, 2, 16, 6), line(8, 2, 8, 6), line(3, 10, 21, 10)],
}
export const clock: IrisIcon = {
  name: 'clock',
  nodes: [circle(12, 12, 10), poly('12 6 12 12 16 14')],
}
export const search: IrisIcon = {
  name: 'search',
  nodes: [circle(11, 11, 8), line(21, 21, 16.65, 16.65)],
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
      // Navigation
      chevronDown,
      chevronUp,
      chevronLeft,
      chevronRight,
      chevronsUp,
      chevronsDown,
      chevronsLeft,
      chevronsRight,
      arrowUp,
      arrowDown,
      arrowLeft,
      arrowRight,
      home,
      menu,
      moreHorizontal,
      moreVertical,
      sidebar,
      externalLink,
      // Actions
      check,
      x,
      close,
      plus,
      minus,
      edit,
      copy,
      save,
      trash,
      share,
      refresh,
      filter,
      download,
      upload,
      loader,
      sortAsc,
      sortDesc,
      // Status & Feedback
      alertTriangle,
      alertCircle,
      checkCircle,
      info,
      helpCircle,
      slash,
      bell,
      bellOff,
      // Objects / Files / Media
      file,
      folder,
      image,
      camera,
      paperclip,
      printer,
      tag,
      gift,
      // User & Profile
      user,
      users,
      settings,
      logOut,
      logIn,
      // Data & Communication
      mail,
      send,
      inbox,
      phone,
      globe,
      mapPin,
      // Lock / Security
      lock,
      unlock,
      shield,
      shieldOff,
      // Misc
      bookmark,
      star,
      heart,
      thumbsUp,
      thumbsDown,
      maximize,
      minimize,
      grid,
      list,
      // Primitives (kept at end to preserve declaration order from prior versions)
      calendar,
      clock,
      search,
      eye,
      eyeOff,
      sun,
      moon,
    ].map((icon): [string, IrisIcon] => [icon.name, icon]),
  ),
}))()
