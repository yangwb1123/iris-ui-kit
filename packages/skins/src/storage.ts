import type { SkinStorage } from './types'

/**
 * Persist the selected skin id in `localStorage`. SSR-safe: every method is a
 * no-op when `window`/`localStorage` is unavailable or throws (private mode).
 */
export function localStorageSkinStorage(key = 'iris-skin'): SkinStorage {
  function store(): Storage | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null
      return window.localStorage
    } catch {
      return null
    }
  }
  return {
    get: () => store()?.getItem(key) ?? null,
    set: (id) => store()?.setItem(key, id),
    remove: () => store()?.removeItem(key),
  }
}

/** In-memory storage for tests / SSR. */
export function memorySkinStorage(initial: string | null = null): SkinStorage {
  let value = initial
  return {
    get: () => value,
    set: (id) => {
      value = id
    },
    remove: () => {
      value = null
    },
  }
}
