/**
 * Compose multiple event handlers. Stops calling subsequent handlers once
 * `event.defaultPrevented` is true (matching Radix-style semantics).
 */
export function composeEventHandlers<E extends { defaultPrevented: boolean }>(
  ...handlers: Array<((event: E) => void) | undefined>
): (event: E) => void {
  return (event: E) => {
    for (const handler of handlers) {
      if (event.defaultPrevented) return
      handler?.(event)
    }
  }
}

/**
 * Shallow-merge prop objects. Right wins. Useful when adapters compose props
 * for the root element of a primitive.
 */
export function mergeProps<A extends object, B extends object>(a: A, b: B): A & B {
  return { ...a, ...b }
}

/**
 * Generate a runtime-unique id.
 *
 * This is intentionally not an SSR id primitive: adapters rendering DOM must
 * use their framework's request-scoped id API (for example Svelte's
 * `$props.id()`). Keeping entropy local to the call avoids a module-global
 * counter leaking request state between server renders.
 */
export function generateId(prefix = 'iris'): string {
  const cryptoApi = (
    globalThis as typeof globalThis & {
      crypto?: { randomUUID?: () => string }
    }
  ).crypto
  const suffix =
    cryptoApi?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${suffix}`
}

/**
 * Dedupe an array (preserve order); in single mode keep at most the last key.
 * Used by `createExpansion` and `createSelectionModel`.
 */
export function normalizeKeys<K extends string | number>(
  keys: K[],
  mode: 'single' | 'multiple',
): K[] {
  const deduped = Array.from(new Set(keys))
  if (mode === 'single' && deduped.length > 1) return [deduped[deduped.length - 1]!]
  return deduped
}

/**
 * Defensive array wrapper: returns an empty array when `arr` is null or undefined.
 * Use in component top-level prop reads to prevent `Cannot read properties of
 * undefined` crashes when an async caller hasn't loaded data yet.
 *
 * ```ts
 * const rows = safeArray(props.data)        // [] when null/undef
 * const items = safeArray(props.options)     // []
 * ```
 */
export function safeArray<T>(arr: readonly T[] | null | undefined): readonly T[] {
  return arr ?? []
}

/**
 * Defensive number clamp: returns the given number if finite, else `fallback`.
 * Protects against NaN / Infinity from user-provided prop values.
 */
export function safeNumber(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback
}
