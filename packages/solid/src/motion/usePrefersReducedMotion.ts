import { createSignal, onMount, onCleanup, type Accessor } from 'solid-js'

const QUERY = '(prefers-reduced-motion: reduce)'

function read(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(QUERY).matches
}

/**
 * Reactive `prefers-reduced-motion` flag. Returns `false` where `matchMedia`
 * is unavailable (SSR / older jsdom). Solid port of the Vue equivalent.
 */
export function usePrefersReducedMotion(): Accessor<boolean> {
  const [reduced, setReduced] = createSignal(read())

  onMount(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(QUERY)
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener?.('change', onChange)
    onCleanup(() => mq.removeEventListener?.('change', onChange))
  })

  return reduced
}
