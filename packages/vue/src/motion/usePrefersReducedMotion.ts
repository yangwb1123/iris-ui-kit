import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

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
export function usePrefersReducedMotion(enabled?: Readonly<Ref<boolean>>): Ref<boolean> {
  const reduced = ref<boolean>(enabled?.value === false ? false : read())
  let mq: MediaQueryList | null = null
  let mounted = false
  const onChange = () => {
    if (mq) reduced.value = mq.matches
  }
  const start = () => {
    if (
      !mounted ||
      enabled?.value === false ||
      mq !== null ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return
    mq = window.matchMedia(QUERY)
    reduced.value = mq.matches
    mq.addEventListener?.('change', onChange)
  }
  const stop = () => {
    mq?.removeEventListener?.('change', onChange)
    mq = null
    reduced.value = false
  }

  onMounted(() => {
    mounted = true
    start()
  })
  if (enabled) {
    watch(enabled, (active) => {
      if (!mounted) return
      if (active) start()
      else stop()
    })
  }
  onBeforeUnmount(() => {
    mounted = false
    stop()
  })

  return reduced
}
