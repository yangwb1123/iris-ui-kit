import * as React from 'react'
import type { ProTableStore } from '../core'

/** Bridge a horizontal scroll element's width into the core table store. */
export function useColumnViewport<Row extends Record<string, unknown>>(
  enabled: boolean,
  store: ProTableStore<Row>,
): React.RefObject<HTMLDivElement> {
  const ref = React.useRef<HTMLDivElement>(null!)
  React.useEffect(() => {
    const element = enabled ? ref.current : null
    if (!element) return
    store.setColumnViewportWidth(element.clientWidth)
    const observer = new ResizeObserver(([entry]) => {
      store.setColumnViewportWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [enabled, store])
  return ref
}
