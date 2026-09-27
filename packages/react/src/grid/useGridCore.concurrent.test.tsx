// @vitest-environment jsdom
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGridFeature, type GridCore } from '@iris-ui-kit/core/grid'
import { useGridCore } from './useGridCore'

const DESTROYED_MESSAGE = 'Grid Core is destroyed.'

/** Blocks the current scheduler slice long enough that React must yield. */
function Busy({ durationMs = 8 }: { durationMs?: number }) {
  const start = performance.now()
  while (performance.now() - start < durationMs) {
    // Intentionally empty: burn scheduler frame budget.
  }
  return null
}

/** Trivial trailing fiber so the work loop re-checks the frame budget after `Busy`. */
function Tail() {
  return null
}

interface ConcurrentHarness {
  readonly App: React.ComponentType
  readonly core: () => GridCore | undefined
  readonly ready: ReturnType<typeof vi.fn>
  readonly dispose: ReturnType<typeof vi.fn>
}

function createHarness(busyCount: number): ConcurrentHarness {
  const ready = vi.fn()
  const dispose = vi.fn()
  let core: GridCore | undefined
  const feature = createGridFeature({
    name: 'concurrent-render',
    setup: ({ core: instance }) => {
      core = instance
      return { onReady: ready, dispose }
    },
  })
  function Consumer() {
    useGridCore({ features: [feature] })
    return null
  }
  function App() {
    return (
      <>
        <Consumer />
        {Array.from({ length: busyCount }, (_, index) => (
          <Busy key={index} />
        ))}
        <Tail />
      </>
    )
  }
  return { App, core: () => core, ready, dispose }
}

async function flushMacrotasks(turns = 6): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
}

function consoleErrors(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls.flat().map(String).join('\n')
}

describe('useGridCore concurrent rendering', () => {
  const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false
  })

  afterEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
    vi.restoreAllMocks()
  })

  it.each([1, 2])(
    'keeps the Grid Core alive across %i scheduler yield(s) before commit',
    async (busyCount) => {
      const harness = createHarness(busyCount)
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const uncaught: Error[] = []
      const onUncaught = (error: Error) => {
        uncaught.push(error)
      }
      process.on('uncaughtException', onUncaught)

      const container = document.createElement('div')
      document.body.appendChild(container)
      const root = createRoot(container)
      try {
        React.startTransition(() => {
          root.render(<harness.App />)
        })
        await vi.waitFor(() => {
          expect(harness.core()?.status).not.toBe('created')
        })
        await flushMacrotasks()

        const core = harness.core()
        expect(core?.status).toBe('ready')
        expect(harness.ready).toHaveBeenCalledTimes(1)
        expect(harness.dispose).not.toHaveBeenCalled()
        expect(consoleErrors(consoleError)).not.toContain(DESTROYED_MESSAGE)
        expect(uncaught).toEqual([])

        root.unmount()
        await flushMacrotasks()
        expect(core?.status).toBe('destroyed')
        expect(harness.dispose).toHaveBeenCalledTimes(1)
      } finally {
        process.off('uncaughtException', onUncaught)
        consoleError.mockRestore()
        container.remove()
      }
    },
  )
})
