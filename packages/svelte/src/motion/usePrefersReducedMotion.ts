import { readable, type Readable } from 'svelte/store'

const QUERY = '(prefers-reduced-motion: reduce)'

function read(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(QUERY).matches
}

/**
 * Returns a Svelte readable store indicating whether the user prefers reduced motion.
 */
export function usePrefersReducedMotion(): Readable<boolean> {
  return readable<boolean>(read(), (set) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(QUERY)
    set(mq.matches)
    const onChange = () => set(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  })
}
