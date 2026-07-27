import type { JSX } from 'solid-js'

/** Solid's style object uses dash-cased logical properties. */
export function pinnedStyle(column: { pinned?: 'left' | 'right' }): JSX.CSSProperties | undefined {
  if (!column.pinned) return undefined
  return column.pinned === 'left'
    ? { position: 'sticky', 'inset-inline-start': '0', 'z-index': 1 }
    : { position: 'sticky', 'inset-inline-end': '0', 'z-index': 1 }
}
