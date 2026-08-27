import { onBeforeUnmount, onMounted, watch } from 'vue'

/** True when the keydown target lives inside the table root element. */
export function isInsideTableRoot(
  root: () => HTMLElement | null,
  target: EventTarget | null,
): boolean {
  return (
    target !== null &&
    typeof target === 'object' &&
    'nodeType' in target &&
    root() !== null &&
    root()!.contains(target as Node)
  )
}

/** Text controls keep their own shortcuts — the table never intercepts them. */
export function isTextControl(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const element = target as HTMLElement
  return (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT' ||
    element.dataset?.irisTableEditor !== undefined
  )
}

/** Mount-scoped window keydown registration, gated on a reactive predicate. */
export function registerScopedKeydownListener(
  gate: () => boolean,
  handler: (event: KeyboardEvent) => void,
): void {
  let listening = false
  let stopGateWatch: (() => void) | null = null
  const syncListener = (): void => {
    if (typeof window === 'undefined') return
    if (gate() && !listening) {
      window.addEventListener('keydown', handler)
      listening = true
    } else if (!gate() && listening) {
      window.removeEventListener('keydown', handler)
      listening = false
    }
  }
  onMounted(() => {
    syncListener()
    stopGateWatch = watch(gate, syncListener)
  })
  onBeforeUnmount(() => {
    stopGateWatch?.()
    stopGateWatch = null
    if (listening && typeof window !== 'undefined') {
      window.removeEventListener('keydown', handler)
      listening = false
    }
  })
}
