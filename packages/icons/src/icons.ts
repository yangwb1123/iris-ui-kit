import type { IrisIcon, IrisIconNode, IrisIconSet } from './types'

// Compact node constructors — keep the icon table readable.
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
 * Built-in icon set: Feather-style 24×24 line icons covering the glyphs the
 * Iris primitives need (navigation chevrons, form affordances, status, files).
 * The default `0 0 24 24` viewBox and the `currentColor` stroke convention are
 * applied at render time, so a single CSS `color` themes every icon.
 */
const NODES: Record<string, IrisIconNode[]> = {
  'chevron-down': [poly('6 9 12 15 18 9')],
  'chevron-up': [poly('18 15 12 9 6 15')],
  'chevron-left': [poly('15 18 9 12 15 6')],
  'chevron-right': [poly('9 18 15 12 9 6')],
  check: [poly('20 6 9 17 4 12')],
  x: [line(18, 6, 6, 18), line(6, 6, 18, 18)],
  search: [circle(11, 11, 8), line(21, 21, 16.65, 16.65)],
  plus: [line(12, 5, 12, 19), line(5, 12, 19, 12)],
  minus: [line(5, 12, 19, 12)],
  calendar: [rect(3, 4, 18, 18, 2, 2), line(16, 2, 16, 6), line(8, 2, 8, 6), line(3, 10, 21, 10)],
  clock: [circle(12, 12, 10), poly('12 6 12 12 16 14')],
  info: [circle(12, 12, 10), line(12, 16, 12, 12), line(12, 8, 12.01, 8)],
  'alert-triangle': [
    path('M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'),
    line(12, 9, 12, 13),
    line(12, 17, 12.01, 17),
  ],
  'alert-circle': [circle(12, 12, 10), line(12, 8, 12, 12), line(12, 16, 12.01, 16)],
  'check-circle': [
    path('M22 11.08V12a10 10 0 1 1-5.93-9.14'),
    poly('22 4 12 14.01 9 11.01'),
  ],
  menu: [line(3, 12, 21, 12), line(3, 6, 21, 6), line(3, 18, 21, 18)],
  'more-horizontal': [circle(12, 12, 1), circle(19, 12, 1), circle(5, 12, 1)],
  eye: [path('M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'), circle(12, 12, 3)],
  'eye-off': [
    path(
      'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24',
    ),
    line(1, 1, 23, 23),
  ],
  upload: [
    path('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'),
    poly('17 8 12 3 7 8'),
    line(12, 3, 12, 15),
  ],
  folder: [path('M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z')],
  file: [
    path('M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z'),
    poly('13 2 13 9 20 9'),
  ],
  sun: [
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
  moon: [path('M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z')],
}

export const defaultIcons: IrisIconSet = {
  name: 'iris-default',
  icons: Object.fromEntries(
    Object.entries(NODES).map(([name, nodes]): [string, IrisIcon] => [name, { name, nodes }]),
  ),
}
