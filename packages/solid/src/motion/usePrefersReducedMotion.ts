import { createEffect, createSignal, onMount, onCleanup, type Accessor } from 'solid-js'

const QUERY = '(prefers-reduced-motion: reduce)'

function read(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(QUERY).matches
}

/**
 * Reactive `prefers-reduced-motion` flag. Returns `false` where `matchMedia`
 * is unavailable (SSR / older jsdom). Solid port of the Vue equivalent.
 * When `enabled` is supplied, browser media-query work is deferred until it
 * becomes true; this keeps default-off optional features resource-free.
 */
export function usePrefersReducedMotion(enabled?: Accessor<boolean>): Accessor<boolean> {
  const lazy = enabled !== undefined
  const [reduced, setReduced] = createSignal(lazy ? false : read())

  const subscribe = (): (() => void) | undefined => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia(QUERY)
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }

  onMount(() => {
    if (enabled) {
      createEffect(() => {
        if (!enabled()) {
          setReduced(false)
          return
        }
        const cleanup = subscribe()
        if (cleanup) onCleanup(cleanup)
      })
      return
    }
    const cleanup = subscribe()
    if (cleanup) onCleanup(cleanup)
  })

  return reduced
}
