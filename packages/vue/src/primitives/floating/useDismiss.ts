import { onScopeDispose, watch, type Ref } from 'vue'

export interface UseDismissOptions {
  /** While true, the dismiss listeners are active. */
  enabled: Ref<boolean>
  /** Elements that, if clicked, should NOT trigger dismiss (typically trigger + content). */
  exclude: Array<Ref<HTMLElement | null | undefined>>
  /** Called when the user attempts to dismiss the surface. */
  onDismiss: () => void
  /** Close on Escape key. Default `true`. */
  escape?: boolean
  /** Close on pointerdown outside the excluded elements. Default `true`. */
  outsidePointerDown?: boolean
}

/**
 * Listen for the universal "dismiss" gestures: Escape key and outside
 * pointer-down. Used by Popover / Dialog / Menu / Combobox. Tooltip does
 * NOT use this — it dismisses on mouseleave/blur instead.
 *
 * Listeners are attached to `document` only while `enabled` is true, and
 * removed on disable / unmount. SSR-safe (no-op without `document`).
 */
export function useDismiss(options: UseDismissOptions): void {
  const escape = options.escape !== false
  const outsidePointerDown = options.outsidePointerDown !== false

  const isExcluded = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof Node)) return false
    for (const r of options.exclude) {
      const el = r.value
      if (!el) continue
      if (el === target || el.contains(target)) return true
    }
    return false
  }

  const onPointerDown = (event: PointerEvent) => {
    if (!options.enabled.value) return
    if (isExcluded(event.target)) return
    options.onDismiss()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!options.enabled.value) return
    if (event.key === 'Escape') {
      event.stopPropagation()
      options.onDismiss()
    }
  }

  const attach = () => {
    if (typeof document === 'undefined') return
    if (outsidePointerDown) {
      document.addEventListener('pointerdown', onPointerDown, true)
    }
    if (escape) {
      document.addEventListener('keydown', onKeyDown)
    }
  }

  const detach = () => {
    if (typeof document === 'undefined') return
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('keydown', onKeyDown)
  }

  watch(
    options.enabled,
    (enabled) => {
      detach()
      if (enabled) attach()
    },
    { immediate: true, flush: 'post' },
  )

  onScopeDispose(detach)
}
