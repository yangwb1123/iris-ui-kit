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

interface RenderOwnership {
  committed: boolean
}

/**
 * React lifecycle bridge for one framework-agnostic Grid Core. Features are
 * captured on the first render; use `core.use()` for an explicit late install.
 */
export function useGridCore<Row extends Record<string, unknown> = Record<string, unknown>>(
  options: UseGridCoreOptions<Row> = {},
): GridCore<Row> {
  const coreRef = React.useRef<GridCore<Row> | null>(null)
  const ownershipRef = React.useRef<RenderOwnership | null>(null)
  if (coreRef.current === null) {
    const core = createGridCore(options)
    const ownership: RenderOwnership = { committed: false }
    coreRef.current = core
    ownershipRef.current = ownership
    // A render which never commits cannot receive an effect cleanup. A
    // committed render claims this ticket in the commit phase before this
    // microtask can run, while a discarded render is deterministically closed.
    queueMicrotask(() => {
      if (!ownership.committed) core.destroy()
    })
  }
  const core = coreRef.current
  const ownership = ownershipRef.current
  const lifecycleGeneration = React.useRef(0)

  // Insertion effects run during commit and are a safe commit marker for the
  // render ticket. Unlike a layout effect, they are also silent in SSR.
  React.useInsertionEffect(() => {
    ownership!.committed = true
  }, [core, ownership])

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
