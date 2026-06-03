import * as React from 'react'

export interface UseDismissOptions {
  /** While true, the dismiss listeners are active. */
  enabled: boolean
  /** Elements that, if clicked, should NOT trigger dismiss (typically trigger + content). */
  exclude: Array<React.RefObject<HTMLElement | null>>
  /** Called when the user attempts to dismiss the surface. */
  onDismiss: () => void
  /** Close on Escape key. Default `true`. */
  escape?: boolean
  /** Close on pointerdown outside the excluded elements. Default `true`. */
  outsidePointerDown?: boolean
}

/**
 * Listen for the universal "dismiss" gestures: Escape key and outside
 * pointer-down. Used by Popover / Menu / Dropdown. Tooltip does NOT use this —
 * it dismisses on mouseleave/blur instead.
 *
 * Listeners attach to `document` (pointerdown in the capture phase, mirroring
 * the Vue adapter) only while `enabled` is true, and detach on disable /
 * unmount. SSR-safe (no-op without `document`). The latest `onDismiss` /
 * `exclude` are read through refs so toggling them never re-subscribes.
 */
export function useDismiss(options: UseDismissOptions): void {
  const { enabled, escape = true, outsidePointerDown = true } = options

  const onDismissRef = React.useRef(options.onDismiss)
  const excludeRef = React.useRef(options.exclude)
  React.useEffect(() => {
    onDismissRef.current = options.onDismiss
    excludeRef.current = options.exclude
  })

  React.useEffect(() => {
    if (!enabled || typeof document === 'undefined') return

    const isExcluded = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof Node)) return false
      for (const r of excludeRef.current) {
        const el = r.current
        if (el && (el === target || el.contains(target))) return true
      }
      return false
    }

    const onPointerDown = (event: PointerEvent) => {
      if (isExcluded(event.target)) return
      onDismissRef.current()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onDismissRef.current()
      }
    }

    if (outsidePointerDown) document.addEventListener('pointerdown', onPointerDown, true)
    if (escape) document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [enabled, escape, outsidePointerDown])
}
