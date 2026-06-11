import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import FloatingHarness from './FloatingHarness.svelte'

/**
 * The Svelte `useFloating` builds its Floating UI middleware inside an
 * `$effect` and runs `computePosition` through the `autoUpdate` callback. We
 * mock `@floating-ui/dom` so `autoUpdate` invokes its callback once on
 * subscribe (deterministically driving one positioning cycle) and capture the
 * options handed to `computePosition`. The real `size` export is preserved via
 * `importOriginal` so the produced middleware keeps its `name === 'size'`.
 */
const { computePositionMock } = vi.hoisted(() => ({ computePositionMock: vi.fn() }))
vi.mock('@floating-ui/dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@floating-ui/dom')>()
  return {
    ...actual,
    computePosition: (...args: unknown[]) => computePositionMock(...args),
    // Invoke the update callback once on subscribe; return a no-op cleanup.
    autoUpdate: (_a: unknown, _f: unknown, update: () => void) => {
      update()
      return () => {}
    },
  }
})

function pos(x: number, y: number) {
  return { x, y, placement: 'bottom', strategy: 'absolute', middlewareData: {} }
}

function lastMiddleware(): { name?: string }[] {
  const opts = computePositionMock.mock.calls.at(-1)?.[2] as {
    middleware: { name?: string }[]
  }
  return opts.middleware
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useFloating (svelte) size middleware', () => {
  it('adds the viewport-clamping size middleware when `size` is enabled', () => {
    computePositionMock.mockReset()
    computePositionMock.mockResolvedValue(pos(0, 0))

    render(FloatingHarness, { props: { size: true } })
    flushSync()

    expect(lastMiddleware().some((m) => m?.name === 'size')).toBe(true)
  })

  it('omits the size middleware by default (off by default)', () => {
    computePositionMock.mockReset()
    computePositionMock.mockResolvedValue(pos(0, 0))

    render(FloatingHarness)
    flushSync()

    expect(lastMiddleware().some((m) => m?.name === 'size')).toBe(false)
  })
})
