import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@solidjs/testing-library'
import { useFloating } from './useFloating'

/**
 * The floating composable runs positioning inside the `autoUpdate` callback.
 * `autoUpdate` is mocked to invoke that callback once synchronously, so a single
 * `computePosition` call fires. `size` is kept as the real export (via
 * importOriginal) so the pushed middleware's `.name` is genuinely "size".
 */
// A DEFAULT resolved-promise impl is essential: this file's `vi.mock` is hoisted
// process-wide, and Solid's vitest runs with isolate:false, so the mock leaks to
// every other solid test file. Without a default, an unconfigured call (from
// another file's floating component) returns undefined and `undefined.then`
// throws an unhandled error. The default keeps it a Promise everywhere.
const { computePositionMock } = vi.hoisted(() => ({
  computePositionMock: vi.fn(async (..._args: unknown[]) => ({
    x: 0,
    y: 0,
    placement: 'bottom' as const,
    strategy: 'absolute' as const,
    middlewareData: {},
  })),
}))
vi.mock('@floating-ui/dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@floating-ui/dom')>()
  return {
    ...actual,
    computePosition: (...args: unknown[]) => computePositionMock(...args),
    // Invoke the update callback once, then return a no-op cleanup.
    autoUpdate: (_a: unknown, _f: unknown, cb: () => void) => {
      cb()
      return () => {}
    },
  }
})

describe('useFloating size middleware', () => {
  // mockClear (not mockReset) so the default Promise impl survives, and NO
  // restoreAllMocks (it would clear that impl after this file, re-introducing
  // the leak) — see the leak note on the mock above.
  beforeEach(() => computePositionMock.mockClear())
  afterEach(() => cleanup())

  it('adds the viewport-clamping size middleware when `size` is enabled', async () => {
    const el = document.createElement('div')
    renderHook(() =>
      useFloating({
        anchor: () => el,
        floating: () => el,
        open: () => true,
        size: true,
      }),
    )
    await waitFor(() => expect(computePositionMock).toHaveBeenCalled())
    const opts = computePositionMock.mock.calls.at(-1)?.[2] as {
      middleware: { name?: string }[]
    }
    expect(opts.middleware.some((m) => m?.name === 'size')).toBe(true)
  })

  it('omits the size middleware by default', async () => {
    const el = document.createElement('div')
    renderHook(() =>
      useFloating({
        anchor: () => el,
        floating: () => el,
        open: () => true,
      }),
    )
    await waitFor(() => expect(computePositionMock).toHaveBeenCalled())
    const opts = computePositionMock.mock.calls.at(-1)?.[2] as {
      middleware: { name?: string }[]
    }
    expect(opts.middleware.some((m) => m?.name === 'size')).toBe(false)
  })

  it('populates arrowX / arrowY / arrowSide from middlewareData.arrow', async () => {
    computePositionMock.mockResolvedValue({
      x: 10,
      y: 20,
      placement: 'bottom' as const,
      strategy: 'absolute' as const,
      middlewareData: { arrow: { x: 5 } },
    })
    const el = document.createElement('div')
    let result!: ReturnType<typeof useFloating>
    renderHook(() => {
      result = useFloating({
        anchor: () => el,
        floating: () => el,
        open: () => true,
        arrow: () => el,
      })
    })
    await waitFor(() => expect(computePositionMock).toHaveBeenCalled())
    expect(result.arrowX()).toBe(5)
    expect(result.arrowY()).toBeUndefined()
    expect(result.arrowSide()).toBe('top')
  })
})
