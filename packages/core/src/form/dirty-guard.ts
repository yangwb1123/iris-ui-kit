/**
 * Create an SSR-safe `beforeunload` guard. The browser-specific listener is
 * intentionally isolated from the framework-agnostic form store.
 */
interface BeforeUnloadEventLike {
  preventDefault(): void
  returnValue: string
}

interface BeforeUnloadTarget {
  addEventListener?: (
    type: 'beforeunload',
    listener: (event: BeforeUnloadEventLike) => void,
  ) => void
  removeEventListener?: (
    type: 'beforeunload',
    listener: (event: BeforeUnloadEventLike) => void,
  ) => void
}

export function createDirtyGuard(isDirty: () => boolean): {
  attach: () => void
  detach: () => void
} {
  const g = typeof globalThis !== 'undefined' ? (globalThis as unknown as BeforeUnloadTarget) : null
  const handler = (event: BeforeUnloadEventLike): void => {
    if (isDirty()) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  return {
    attach: () => {
      if (g?.addEventListener) g.addEventListener('beforeunload', handler)
    },
    detach: () => {
      if (g?.removeEventListener) g.removeEventListener('beforeunload', handler)
    },
  }
}
