import * as React from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function read(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(QUERY).matches
}

/**
 * Reactive `prefers-reduced-motion` flag. Returns `false` where `matchMedia`
 * is unavailable (SSR / older jsdom) so animation is the safe default only when
 * the user has not asked to reduce it.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(read)

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(QUERY)
    const onChange = () => setReduced(mq.matches)
    onChange()
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  return reduced
}
