import { circle, line, path, poly, rect } from './nodes'
import type { IrisIcon } from './types'

export * from './action-icons'
export * from './communication-icons'

// Compact node constructors — keep the icon table readable. Each is a tiny pure
// helper that builds ONE structured SVG node; the per-icon consts below call
// them inline so an individual icon import pulls only its own node data.

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
export const chevronDown: IrisIcon = {
  name: 'chevron-down',
  nodes: [/* @__PURE__ */ poly('6 9 12 15 18 9')],
}
export const chevronUp: IrisIcon = {
  name: 'chevron-up',
  nodes: [/* @__PURE__ */ poly('18 15 12 9 6 15')],
}
export const chevronLeft: IrisIcon = {
  name: 'chevron-left',
  nodes: [/* @__PURE__ */ poly('15 18 9 12 15 6')],
}
export const chevronRight: IrisIcon = {
  name: 'chevron-right',
  nodes: [/* @__PURE__ */ poly('9 18 15 12 9 6')],
}
export const chevronsUp: IrisIcon = {
  name: 'chevrons-up',
  nodes: [/* @__PURE__ */ poly('17 11 12 6 7 11'), /* @__PURE__ */ poly('17 18 12 13 7 18')],
}
export const chevronsDown: IrisIcon = {
  name: 'chevrons-down',
  nodes: [/* @__PURE__ */ poly('7 13 12 18 17 13'), /* @__PURE__ */ poly('7 6 12 11 17 6')],
}
export const chevronsLeft: IrisIcon = {
  name: 'chevrons-left',
  nodes: [/* @__PURE__ */ poly('11 17 6 12 11 7'), /* @__PURE__ */ poly('18 17 13 12 18 7')],
}
export const chevronsRight: IrisIcon = {
  name: 'chevrons-right',
  nodes: [/* @__PURE__ */ poly('13 17 18 12 13 7'), /* @__PURE__ */ poly('6 17 11 12 6 7')],
}
export const arrowUp: IrisIcon = {
  name: 'arrow-up',
  nodes: [/* @__PURE__ */ line(12, 19, 12, 5), /* @__PURE__ */ poly('5 12 12 5 19 12')],
}
export const arrowDown: IrisIcon = {
  name: 'arrow-down',
  nodes: [/* @__PURE__ */ line(12, 5, 12, 19), /* @__PURE__ */ poly('19 12 12 19 5 12')],
}
export const arrowLeft: IrisIcon = {
  name: 'arrow-left',
  nodes: [/* @__PURE__ */ line(19, 12, 5, 12), /* @__PURE__ */ poly('12 19 5 12 12 5')],
}
export const arrowRight: IrisIcon = {
  name: 'arrow-right',
  nodes: [/* @__PURE__ */ line(5, 12, 19, 12), /* @__PURE__ */ poly('12 5 19 12 12 19')],
}
export const home: IrisIcon = {
  name: 'home',
  nodes: [
    /* @__PURE__ */ path('M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'),
    /* @__PURE__ */ poly('9 22 9 12 15 12 15 22'),
  ],
}
export const menu: IrisIcon = {
  name: 'menu',
  nodes: [
    /* @__PURE__ */ line(3, 12, 21, 12),
    /* @__PURE__ */ line(3, 6, 21, 6),
    /* @__PURE__ */ line(3, 18, 21, 18),
  ],
}
export const moreHorizontal: IrisIcon = {
  name: 'more-horizontal',
  nodes: [
    /* @__PURE__ */ circle(12, 12, 1),
    /* @__PURE__ */ circle(19, 12, 1),
    /* @__PURE__ */ circle(5, 12, 1),
  ],
}
export const moreVertical: IrisIcon = {
  name: 'more-vertical',
  nodes: [
    /* @__PURE__ */ circle(12, 12, 1),
    /* @__PURE__ */ circle(12, 5, 1),
    /* @__PURE__ */ circle(12, 19, 1),
  ],
}
export const sidebar: IrisIcon = {
  name: 'sidebar',
  nodes: [/* @__PURE__ */ rect(3, 3, 18, 18, 2, 2), /* @__PURE__ */ line(9, 3, 9, 21)],
}
export const externalLink: IrisIcon = {
  name: 'external-link',
  nodes: [
    /* @__PURE__ */ path('M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'),
    /* @__PURE__ */ poly('15 3 21 3 21 9'),
    /* @__PURE__ */ line(10, 14, 21, 3),
  ],
}

// ── Status & Feedback ─────────────────────────────────────────────────────────
export const alertTriangle: IrisIcon = {
  name: 'alert-triangle',
  nodes: [
    /* @__PURE__ */ path(
      'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    ),
    /* @__PURE__ */ line(12, 9, 12, 13),
    /* @__PURE__ */ line(12, 17, 12.01, 17),
  ],
}
export const alertCircle: IrisIcon = {
  name: 'alert-circle',
  nodes: [
    /* @__PURE__ */ circle(12, 12, 10),
    /* @__PURE__ */ line(12, 8, 12, 12),
    /* @__PURE__ */ line(12, 16, 12.01, 16),
  ],
}
export const checkCircle: IrisIcon = {
  name: 'check-circle',
  nodes: [
    /* @__PURE__ */ path('M22 11.08V12a10 10 0 1 1-5.93-9.14'),
    /* @__PURE__ */ poly('22 4 12 14.01 9 11.01'),
  ],
}
export const info: IrisIcon = {
  name: 'info',
  nodes: [
    /* @__PURE__ */ circle(12, 12, 10),
    /* @__PURE__ */ line(12, 16, 12, 12),
    /* @__PURE__ */ line(12, 8, 12.01, 8),
  ],
}
export const helpCircle: IrisIcon = {
  name: 'help-circle',
  nodes: [
    /* @__PURE__ */ circle(12, 12, 10),
    /* @__PURE__ */ path('M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'),
    /* @__PURE__ */ line(12, 17, 12.01, 17),
  ],
}
export const slash: IrisIcon = {
  name: 'slash',
  nodes: [/* @__PURE__ */ circle(12, 12, 10), /* @__PURE__ */ line(4.93, 4.93, 19.07, 19.07)],
}
export const bell: IrisIcon = {
  name: 'bell',
  nodes: [
    /* @__PURE__ */ path('M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'),
    /* @__PURE__ */ path('M13.73 21a2 2 0 0 1-3.46 0'),
  ],
}
export const bellOff: IrisIcon = {
  name: 'bell-off',
  nodes: [
    /* @__PURE__ */ path('M13.73 21a2 2 0 0 1-3.46 0'),
    /* @__PURE__ */ path('M18.63 13A17.89 17.89 0 0 1 18 8'),
    /* @__PURE__ */ path('M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14'),
    /* @__PURE__ */ path('M18 8a6 6 0 0 0-9.33-5'),
  ],
  // skip the visible-slash decoration — bell-off already carries the concept
}

// ── Objects / Files / Media ───────────────────────────────────────────────────
export const file: IrisIcon = {
  name: 'file',
  nodes: [
    /* @__PURE__ */ path('M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z'),
    /* @__PURE__ */ poly('13 2 13 9 20 9'),
  ],
}
export const folder: IrisIcon = {
  name: 'folder',
  nodes: [
    /* @__PURE__ */ path(
      'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
    ),
  ],
}
export const image: IrisIcon = {
  name: 'image',
  nodes: [
    /* @__PURE__ */ rect(2, 2, 20, 20, 2, 2),
    /* @__PURE__ */ circle(8.5, 8.5, 1.5),
    /* @__PURE__ */ poly('21 15 16 10 5 21'),
  ],
}
export const camera: IrisIcon = {
  name: 'camera',
  nodes: [
    /* @__PURE__ */ path(
      'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z',
    ),
    /* @__PURE__ */ circle(12, 13, 4),
  ],
}
export const paperclip: IrisIcon = {
  name: 'paperclip',
  nodes: [
    /* @__PURE__ */ path(
      'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48',
    ),
  ],
}
export const printer: IrisIcon = {
  name: 'printer',
  nodes: [
    /* @__PURE__ */ poly('6 9 6 2 18 2 18 9'),
    /* @__PURE__ */ path(
      'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2',
    ),
    /* @__PURE__ */ rect(6, 14, 12, 8, 0, 0),
  ],
}
export const tag: IrisIcon = {
  name: 'tag',
  nodes: [
    /* @__PURE__ */ path(
      'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z',
    ),
    /* @__PURE__ */ line(7, 7, 7.01, 7),
  ],
}
export const gift: IrisIcon = {
  name: 'gift',
  nodes: [
    /* @__PURE__ */ poly('20 12 20 22 4 22 4 12'),
    /* @__PURE__ */ rect(2, 7, 20, 5, 0, 0),
    /* @__PURE__ */ path('M12 22V7'),
    /* @__PURE__ */ path('M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z'),
    /* @__PURE__ */ path('M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z'),
  ],
}

// ── User & Profile ────────────────────────────────────────────────────────────
export const user: IrisIcon = {
  name: 'user',
  nodes: [
    /* @__PURE__ */ path('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'),
    /* @__PURE__ */ circle(12, 7, 4),
  ],
}
export const users: IrisIcon = {
  name: 'users',
  nodes: [
    /* @__PURE__ */ path('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'),
    /* @__PURE__ */ circle(9, 7, 4),
    /* @__PURE__ */ path('M23 21v-2a4 4 0 0 0-3-3.87'),
    /* @__PURE__ */ path('M16 3.13a4 4 0 0 1 0 7.75'),
  ],
}
export const settings: IrisIcon = {
  name: 'settings',
  nodes: [
    /* @__PURE__ */ circle(12, 12, 3),
    /* @__PURE__ */ path(
      'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
    ),
  ],
}
export const logOut: IrisIcon = {
  name: 'log-out',
  nodes: [
    /* @__PURE__ */ path('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'),
    /* @__PURE__ */ poly('16 17 21 12 16 7'),
    /* @__PURE__ */ line(21, 12, 9, 12),
  ],
}
export const logIn: IrisIcon = {
  name: 'log-in',
  nodes: [
    /* @__PURE__ */ path('M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4'),
    /* @__PURE__ */ poly('10 17 15 12 10 7'),
    /* @__PURE__ */ line(15, 12, 3, 12),
  ],
}

// ── Misc ──────────────────────────────────────────────────────────────────────
export const bookmark: IrisIcon = {
  name: 'bookmark',
  nodes: [/* @__PURE__ */ path('M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z')],
}
export const star: IrisIcon = {
  name: 'star',
  nodes: [
    /* @__PURE__ */ poly(
      '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2',
    ),
  ],
}
export const heart: IrisIcon = {
  name: 'heart',
  nodes: [
    /* @__PURE__ */ path(
      'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
    ),
  ],
}
export const thumbsUp: IrisIcon = {
  name: 'thumbs-up',
  nodes: [
    /* @__PURE__ */ path(
      'M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3',
    ),
  ],
}
export const thumbsDown: IrisIcon = {
  name: 'thumbs-down',
  nodes: [
    /* @__PURE__ */ path(
      'M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17',
    ),
  ],
}
export const maximize: IrisIcon = {
  name: 'maximize',
  nodes: [
    /* @__PURE__ */ path(
      'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',
    ),
  ],
}
export const minimize: IrisIcon = {
  name: 'minimize',
  nodes: [
    /* @__PURE__ */ path(
      'M8 3v3a2 2 0 0 1-2 2H3m0 0h5M3 3l5 5m13 5v-3a2 2 0 0 0-2-2h-3m0 0h5M21 3l-5 5M3 21l5-5m13 5v-3a2 2 0 0 0-2-2h-3m0 0h5M21 21l-5-5',
    ),
  ],
}
export const grid: IrisIcon = {
  name: 'grid',
  nodes: [
    /* @__PURE__ */ rect(3, 3, 7, 7, 0, 0),
    /* @__PURE__ */ rect(14, 3, 7, 7, 0, 0),
    /* @__PURE__ */ rect(14, 14, 7, 7, 0, 0),
    /* @__PURE__ */ rect(3, 14, 7, 7, 0, 0),
  ],
}
export const list: IrisIcon = {
  name: 'list',
  nodes: [
    /* @__PURE__ */ line(8, 6, 21, 6),
    /* @__PURE__ */ line(8, 12, 21, 12),
    /* @__PURE__ */ line(8, 18, 21, 18),
    /* @__PURE__ */ line(3, 6, 3.01, 6),
    /* @__PURE__ */ line(3, 12, 3.01, 12),
    /* @__PURE__ */ line(3, 18, 3.01, 18),
  ],
}

export const calendar: IrisIcon = {
  name: 'calendar',
  nodes: [
    /* @__PURE__ */ rect(3, 4, 18, 18, 2, 2),
    /* @__PURE__ */ line(16, 2, 16, 6),
    /* @__PURE__ */ line(8, 2, 8, 6),
    /* @__PURE__ */ line(3, 10, 21, 10),
  ],
}
export const clock: IrisIcon = {
  name: 'clock',
  nodes: [/* @__PURE__ */ circle(12, 12, 10), /* @__PURE__ */ poly('12 6 12 12 16 14')],
}
export const search: IrisIcon = {
  name: 'search',
  nodes: [/* @__PURE__ */ circle(11, 11, 8), /* @__PURE__ */ line(21, 21, 16.65, 16.65)],
}
export const eye: IrisIcon = {
  name: 'eye',
  nodes: [
    /* @__PURE__ */ path('M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'),
    /* @__PURE__ */ circle(12, 12, 3),
  ],
}
export const eyeOff: IrisIcon = {
  name: 'eye-off',
  nodes: [
    /* @__PURE__ */ path(
      'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24',
    ),
    /* @__PURE__ */ line(1, 1, 23, 23),
  ],
}
export const sun: IrisIcon = {
  name: 'sun',
  nodes: [
    /* @__PURE__ */ circle(12, 12, 5),
    /* @__PURE__ */ line(12, 1, 12, 3),
    /* @__PURE__ */ line(12, 21, 12, 23),
    /* @__PURE__ */ line(4.22, 4.22, 5.64, 5.64),
    /* @__PURE__ */ line(18.36, 18.36, 19.78, 19.78),
    /* @__PURE__ */ line(1, 12, 3, 12),
    /* @__PURE__ */ line(21, 12, 23, 12),
    /* @__PURE__ */ line(4.22, 19.78, 5.64, 18.36),
    /* @__PURE__ */ line(18.36, 5.64, 19.78, 4.22),
  ],
}
export const moon: IrisIcon = {
  name: 'moon',
  nodes: [/* @__PURE__ */ path('M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z')],
}
