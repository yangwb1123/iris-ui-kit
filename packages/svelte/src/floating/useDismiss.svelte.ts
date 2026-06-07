export interface UseDismissOptions {
  /** While true, the dismiss listeners are active. */
  enabled: () => boolean
  /** Elements that, if clicked, should NOT trigger dismiss (trigger + content). */
  exclude: Array<() => HTMLElement | undefined | null>
  /** Called when the user attempts to dismiss the surface. */
  onDismiss: () => void
  escape?: boolean
  outsidePointerDown?: boolean
}

/**
 * Listen for the universal "dismiss" gestures — Escape key + outside
 * pointer-down (capture phase). Active only while `enabled()` is true; detaches
 * on disable / unmount via the `$effect` teardown. SSR-safe. Svelte port of the
 * React/Vue/Solid `useDismiss`.
 */
export function useDismiss(options: UseDismissOptions): void {
  const escape = options.escape !== false
  const outside = options.outsidePointerDown !== false

  $effect(() => {
    if (!options.enabled() || typeof document === 'undefined') return

    const isExcluded = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof Node)) return false
      for (const acc of options.exclude) {
        const el = acc()
        if (el && (el === target || el.contains(target))) return true
      }
      return false
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (isExcluded(event.target)) return
      options.onDismiss()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        options.onDismiss()
      }
    }

    if (outside) document.addEventListener('pointerdown', onPointerDown, true)
    if (escape) document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  })
}
