import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@solidjs/testing-library'
import { useFloating } from './useFloating'

/**
 * The floating composable runs positioning inside the `autoUpdate` callback.
 * `autoUpdate` is mocked to invoke that callback once synchronously, so a single
 * `computePosition` call fires. `size` is kept as the real export (via
 * importOriginal) so the pushed middleware's `.name` is genuinely "size".
 */
const { computePositionMock } = vi.hoisted(() => ({ computePositionMock: vi.fn() }))
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

function pos(x: number, y: number) {
  return { x, y, placement: 'bottom', strategy: 'absolute', middlewareData: {} }
}

describe('useFloating size middleware', () => {
  beforeEach(() => computePositionMock.mockReset())
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('adds the viewport-clamping size middleware when `size` is enabled', async () => {
    computePositionMock.mockResolvedValue(pos(0, 0))
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
    computePositionMock.mockResolvedValue(pos(0, 0))
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
})
