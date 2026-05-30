import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

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
export function usePrefersReducedMotion(): Ref<boolean> {
  const reduced = ref<boolean>(read())
  let mq: MediaQueryList | null = null
  const onChange = () => {
    if (mq) reduced.value = mq.matches
  }

  onMounted(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    mq = window.matchMedia(QUERY)
    reduced.value = mq.matches
    mq.addEventListener?.('change', onChange)
  })
  onBeforeUnmount(() => {
    mq?.removeEventListener?.('change', onChange)
  })

  return reduced
}
