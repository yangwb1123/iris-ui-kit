import { createDisposable, type Disposable } from './disposable'

/** The media query used by motion components to honor the user's preference. */
export const PREFERS_REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** The part of a MediaQueryList change event needed by the core watcher. */
export interface MediaQueryChangeEvent {
  readonly matches: boolean
}

/**
 * DOM-free shape of a MediaQueryList. Adapters pass the browser's native list
 * at their lifecycle boundary, while core owns the listener and teardown.
 */
export interface MediaQueryListLike {
  readonly matches: boolean
  addEventListener?: (type: 'change', listener: (event: MediaQueryChangeEvent) => void) => void
  removeEventListener?: (type: 'change', listener: (event: MediaQueryChangeEvent) => void) => void
  addListener?: (listener: (event: MediaQueryChangeEvent) => void) => void
  removeListener?: (listener: (event: MediaQueryChangeEvent) => void) => void
}

/**
 * Watch a MediaQueryList and invoke `onChange` for its current and future
 * values. The returned disposable removes the listener exactly once and is
 * safe to hand to an adapter's lifecycle bridge. Passing `null`/`undefined`
 * represents SSR or an older environment without matchMedia and reports the
 * safe default (`false`).
 */
export function watchMediaQuery(
  mediaQuery: MediaQueryListLike | null | undefined,
  onChange: (matches: boolean) => void,
): Disposable {
  if (!mediaQuery) {
    onChange(false)
    return createDisposable()
  }

  const listener = (event: MediaQueryChangeEvent | undefined): void =>
    onChange(typeof event?.matches === 'boolean' ? event.matches : mediaQuery.matches)
  onChange(mediaQuery.matches)

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', listener)
    return createDisposable(() => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', listener)
      } else {
        mediaQuery.removeListener?.(listener)
      }
    })
  }

  if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(listener)
    return createDisposable(() => mediaQuery.removeListener?.(listener))
  }

  return createDisposable()
}
