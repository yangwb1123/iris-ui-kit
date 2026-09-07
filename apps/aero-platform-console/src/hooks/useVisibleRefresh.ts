import * as React from 'react'

export interface VisibleRefreshHost {
  isVisible(): boolean
  schedule(callback: () => void, delayMs: number): number
  cancel(handle: number): void
  subscribe(callback: () => void): () => void
}

function browserHost(): VisibleRefreshHost {
  return {
    isVisible: () => document.visibilityState === 'visible',
    schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
    cancel: (handle) => window.clearTimeout(handle),
    subscribe: (callback) => {
      document.addEventListener('visibilitychange', callback)
      return () => document.removeEventListener('visibilitychange', callback)
    },
  }
}

export function startVisibleRefresh(
  refresh: () => void,
  intervalMs: number,
  host: VisibleRefreshHost = browserHost(),
): () => void {
  let handle: number | undefined
  let disposed = false

  const cancel = () => {
    if (handle === undefined) return
    host.cancel(handle)
    handle = undefined
  }
  const schedule = () => {
    cancel()
    if (disposed || !host.isVisible()) return
    handle = host.schedule(
      () => {
        handle = undefined
        if (disposed || !host.isVisible()) return
        refresh()
        schedule()
      },
      Math.max(250, intervalMs),
    )
  }
  const visibilityChanged = () => {
    cancel()
    if (disposed || !host.isVisible()) return
    refresh()
    schedule()
  }
  const unsubscribe = host.subscribe(visibilityChanged)
  schedule()

  return () => {
    disposed = true
    cancel()
    unsubscribe()
  }
}

export function useVisibleRefresh(enabled: boolean, refresh: () => void, intervalMs = 2_000): void {
  const refreshRef = React.useRef(refresh)
  React.useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])
  React.useEffect(() => {
    if (!enabled) return undefined
    return startVisibleRefresh(() => refreshRef.current(), intervalMs)
  }, [enabled, intervalMs])
}
