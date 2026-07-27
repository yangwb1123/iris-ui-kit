import { circle, line, path, poly, rect } from './nodes'
import type { IrisIcon } from './types'

export const check: IrisIcon = { name: 'check', nodes: [/* @__PURE__ */ poly('20 6 9 17 4 12')] }
export const x: IrisIcon = {
  name: 'x',
  nodes: [/* @__PURE__ */ line(18, 6, 6, 18), /* @__PURE__ */ line(6, 6, 18, 18)],
}
export const close: IrisIcon = {
  name: 'close',
  nodes: [/* @__PURE__ */ line(18, 6, 6, 18), /* @__PURE__ */ line(6, 6, 18, 18)],
}
export const plus: IrisIcon = {
  name: 'plus',
  nodes: [/* @__PURE__ */ line(12, 5, 12, 19), /* @__PURE__ */ line(5, 12, 19, 12)],
}
export const minus: IrisIcon = { name: 'minus', nodes: [/* @__PURE__ */ line(5, 12, 19, 12)] }
export const edit: IrisIcon = {
  name: 'edit',
  nodes: [
    /* @__PURE__ */ path('M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'),
    /* @__PURE__ */ path('M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'),
  ],
}
export const copy: IrisIcon = {
  name: 'copy',
  nodes: [
    /* @__PURE__ */ rect(9, 9, 12, 12, 2, 2),
    /* @__PURE__ */ path('M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'),
  ],
}
export const save: IrisIcon = {
  name: 'save',
  nodes: [
    /* @__PURE__ */ path('M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z'),
    /* @__PURE__ */ poly('17 21 17 13 7 13 7 21'),
    /* @__PURE__ */ poly('7 3 7 8 15 8'),
  ],
}
export const trash: IrisIcon = {
  name: 'trash',
  nodes: [
    /* @__PURE__ */ poly('3 6 5 6 21 6'),
    /* @__PURE__ */ path(
      'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    ),
    /* @__PURE__ */ line(10, 11, 10, 17),
    /* @__PURE__ */ line(14, 11, 14, 17),
  ],
}
export const share: IrisIcon = {
  name: 'share',
  nodes: [
    /* @__PURE__ */ circle(18, 5, 3),
    /* @__PURE__ */ circle(6, 12, 3),
    /* @__PURE__ */ circle(18, 19, 3),
    /* @__PURE__ */ line(8.59, 13.51, 15.42, 17.49),
    /* @__PURE__ */ line(15.41, 6.51, 8.59, 10.49),
  ],
}
export const refresh: IrisIcon = {
  name: 'refresh',
  nodes: [
    /* @__PURE__ */ poly('23 4 23 10 17 10'),
    /* @__PURE__ */ poly('1 20 1 14 7 14'),
    /* @__PURE__ */ path('M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15'),
  ],
}
export const filter: IrisIcon = {
  name: 'filter',
  nodes: [/* @__PURE__ */ poly('22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3')],
}
export const download: IrisIcon = {
  name: 'download',
  nodes: [
    /* @__PURE__ */ path('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'),
    /* @__PURE__ */ poly('7 10 12 15 17 10'),
    /* @__PURE__ */ line(12, 15, 12, 3),
  ],
}
export const upload: IrisIcon = {
  name: 'upload',
  nodes: [
    /* @__PURE__ */ path('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'),
    /* @__PURE__ */ poly('17 8 12 3 7 8'),
    /* @__PURE__ */ line(12, 3, 12, 15),
  ],
}
export const loader: IrisIcon = {
  name: 'loader',
  nodes: [
    /* @__PURE__ */ line(12, 2, 12, 6),
    /* @__PURE__ */ line(12, 18, 12, 22),
    /* @__PURE__ */ poly('4.93 4.93 7.76 7.76'),
    /* @__PURE__ */ poly('16.24 16.24 19.07 19.07'),
    /* @__PURE__ */ line(2, 12, 6, 12),
    /* @__PURE__ */ line(18, 12, 22, 12),
    /* @__PURE__ */ poly('19.07 4.93 16.24 7.76'),
    /* @__PURE__ */ poly('7.76 16.24 4.93 19.07'),
  ],
}
export const sortAsc: IrisIcon = {
  name: 'sort-asc',
  nodes: [
    /* @__PURE__ */ line(4, 6, 16, 6),
    /* @__PURE__ */ line(4, 12, 11, 12),
    /* @__PURE__ */ line(4, 18, 11, 18),
    /* @__PURE__ */ poly('15 15 18 18 21 15'),
    /* @__PURE__ */ line(18, 6, 18, 18),
  ],
}
export const sortDesc: IrisIcon = {
  name: 'sort-desc',
  nodes: [
    /* @__PURE__ */ line(4, 6, 16, 6),
    /* @__PURE__ */ line(4, 12, 11, 12),
    /* @__PURE__ */ line(4, 18, 11, 18),
    /* @__PURE__ */ poly('15 9 18 6 21 9'),
    /* @__PURE__ */ line(18, 18, 18, 6),
  ],
}
