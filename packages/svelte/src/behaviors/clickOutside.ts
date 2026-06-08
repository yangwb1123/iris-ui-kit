import type { Action } from 'svelte/action'

/**
 * Svelte action: calls `onClickOutside` when a pointerdown event occurs
 * outside the host element. Cleaned up on destroy.
 */
export const clickOutside: Action<HTMLElement, (e: PointerEvent) => void> = (node, handler) => {
  let currentHandler = handler

  const listener = (e: PointerEvent) => {
    const target = e.target as Node | null
    if (target && !node.contains(target)) {
      currentHandler(e)
    }
  }

  document.addEventListener('pointerdown', listener)

  return {
    update(newHandler: (e: PointerEvent) => void) {
      currentHandler = newHandler
    },
    destroy() {
      document.removeEventListener('pointerdown', listener)
    },
  }
}
