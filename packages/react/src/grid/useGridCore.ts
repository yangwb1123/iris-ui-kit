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
 * A concurrent render can yield to React's scheduler without committing and
 * resume in a later task. Such an attempt owns no effect cleanup, so its
 * render ticket must stay open until the attempt is provably abandoned.
 *
 * A resumed React slice only yields after burning the scheduler frame budget
 * (5ms in React 18/19), while an abandoned attempt leaves no continuation and
 * therefore no work between checks. Each check is deferred to a macrotask so
 * it runs behind React's scheduler continuations, and a busy turn re-arms the
 * check for any number of yields. Only a quiet turn closes the attempt.
 */
const ABANDON_QUIET_TURN_MS = 2

function currentTime(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/** Mirrors the host primitive React's scheduler picks for its continuations. */
function scheduleAfterTask(callback: () => void): void {
  if (typeof setImmediate === 'function') {
    setImmediate(callback)
    return
  }
  if (typeof MessageChannel !== 'undefined') {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      callback()
    }
    channel.port2.postMessage(null)
    return
  }
  setTimeout(callback, 0)
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
    // committed render claims this ticket in the commit phase, while a
    // discarded render is closed by a quiet-turn reaper which keeps a paused
    // (scheduler-yielded) attempt alive until it commits or stops working.
    queueMicrotask(() => {
      // A synchronous render has already committed by the end of this task.
      if (ownership.committed) return
      // Measure from the end of the render task: a resumed slice runs before
      // the first check and burns the frame budget, while an abandoned attempt
      // leaves the gap at task-scheduling overhead only.
      let lastCheck = currentTime()
      const check = (): void => {
        if (ownership.committed) return
        const checkTime = currentTime()
        if (checkTime - lastCheck < ABANDON_QUIET_TURN_MS) {
          core.destroy()
          return
        }
        lastCheck = checkTime
        scheduleAfterTask(check)
      }
      scheduleAfterTask(check)
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
