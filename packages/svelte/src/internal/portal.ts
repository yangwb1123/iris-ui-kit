import type { Action } from 'svelte/action'

/**
 * Svelte action mirroring React's `createPortal` / Solid's `<Portal>`: relocate
 * the node to a portal target (default `document.body`) so a floating surface
 * escapes overflow/stacking contexts. `false` keeps it in place. Actions only
 * run in the browser, so the `document.body` default is SSR-safe.
 */
export const portal: Action<HTMLElement, HTMLElement | false | undefined> = (node, target) => {
  if (target === false) return {}
  const dest = target instanceof HTMLElement ? target : document.body
  dest.appendChild(node)
  return {
    destroy() {
      if (node.parentNode === dest) dest.removeChild(node)
    },
  }
}
