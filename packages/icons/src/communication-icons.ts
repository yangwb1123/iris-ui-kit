import { circle, line, path, poly, rect } from './nodes'
import type { IrisIcon } from './types'

// Data & communication
export const mail: IrisIcon = {
  name: 'mail',
  nodes: [
    /* @__PURE__ */ path(
      'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z',
    ),
    /* @__PURE__ */ poly('22 6 12 13 2 6'),
  ],
}
export const send: IrisIcon = {
  name: 'send',
  nodes: [/* @__PURE__ */ line(22, 2, 11, 13), /* @__PURE__ */ poly('22 2 15 22 11 13 2 9 22 2')],
}
export const inbox: IrisIcon = {
  name: 'inbox',
  nodes: [
    /* @__PURE__ */ poly('22 12 16 12 14 15 10 15 8 12 2 12'),
    /* @__PURE__ */ path(
      'M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
    ),
  ],
}
export const phone: IrisIcon = {
  name: 'phone',
  nodes: [
    /* @__PURE__ */ path(
      'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
    ),
  ],
}
export const globe: IrisIcon = {
  name: 'globe',
  nodes: [
    /* @__PURE__ */ circle(12, 12, 10),
    /* @__PURE__ */ line(2, 12, 22, 12),
    /* @__PURE__ */ path(
      'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    ),
  ],
}
export const mapPin: IrisIcon = {
  name: 'map-pin',
  nodes: [
    /* @__PURE__ */ path('M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'),
    /* @__PURE__ */ circle(12, 10, 3),
  ],
}

// Lock & security
export const lock: IrisIcon = {
  name: 'lock',
  nodes: [
    /* @__PURE__ */ rect(5, 11, 14, 10, 2, 2),
    /* @__PURE__ */ path('M8 11V7a4 4 0 0 1 8 0v4'),
    /* @__PURE__ */ circle(12, 16, 1),
  ],
}
export const unlock: IrisIcon = {
  name: 'unlock',
  nodes: [
    /* @__PURE__ */ rect(5, 11, 14, 10, 2, 2),
    /* @__PURE__ */ path('M8 11V7a4 4 0 0 1 7.83-2'),
    /* @__PURE__ */ circle(12, 16, 1),
  ],
}
export const shield: IrisIcon = {
  name: 'shield',
  nodes: [/* @__PURE__ */ path('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z')],
}
export const shieldOff: IrisIcon = {
  name: 'shield-off',
  nodes: [
    /* @__PURE__ */ path('M19.69 14a6.9 6.9 0 0 0 .31-2V5l-8-3-3.16 1.18'),
    /* @__PURE__ */ path('M4.73 4.73L4 5v7c0 6 8 10 8 10a20.29 20.29 0 0 0 5.62-4.38'),
    /* @__PURE__ */ line(1, 1, 23, 23),
  ],
}
