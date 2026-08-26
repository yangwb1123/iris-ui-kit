import * as React from 'react'
import {
  createGridCore,
  type GridCore,
  type GridCoreOptions,
  type GridFeature,
} from '@iris-ui-kit/core/grid'

export interface UseGridCoreOptions<
  Row extends Record<string, unknown>,
> extends GridCoreOptions<Row> {
  readonly features?: readonly GridFeature<Row>[]
}

/**
 * React lifecycle bridge for one framework-agnostic Grid Core. Features are
 * captured on the first render; use `core.use()` for an explicit late install.
 */
export function useGridCore<Row extends Record<string, unknown> = Record<string, unknown>>(
  options: UseGridCoreOptions<Row> = {},
): GridCore<Row> {
  const coreRef = React.useRef<GridCore<Row> | null>(null)
  if (coreRef.current === null) coreRef.current = createGridCore(options)
  const core = coreRef.current
  const lifecycleGeneration = React.useRef(0)

  React.useEffect(() => {
    const generation = ++lifecycleGeneration.current
    core.ready()
    return () => {
      // React Strict Mode replays effects without discarding hook state. Delay
      // teardown by one microtask so the replay can advance the generation;
      // a real unmount has no next effect and therefore destroys the core.
      queueMicrotask(() => {
        if (lifecycleGeneration.current === generation) core.destroy()
      })
    }
  }, [core])

  return core
}
