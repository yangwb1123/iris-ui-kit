import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { render, act } from '@testing-library/react'
import { useFloating } from './useFloating'

/**
 * The stale-result guard: computePosition() is async, so a result that
 * resolves AFTER the floating panel closed/unmounted — or after a newer
 * update() started — must be dropped instead of applying stale coordinates
 * (which on React also triggers a setState-after-unmount warning).
 *
 * autoUpdate is mocked to a no-op so update() only runs when we call it,
 * making the overlapping-result ordering deterministic.
 */
const { computePositionMock } = vi.hoisted(() => ({ computePositionMock: vi.fn() }))
vi.mock('@floating-ui/dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@floating-ui/dom')>()
  return {
    ...actual,
    computePosition: (...args: unknown[]) => computePositionMock(...args),
    autoUpdate: () => () => {},
  }
})

function pos(x: number, y: number) {
  return { x, y, placement: 'bottom', strategy: 'absolute', middlewareData: {} }
}

function Harness({ onUpdate }: { onUpdate: (u: () => Promise<void>) => void }) {
  const anchor = React.useRef<HTMLDivElement | null>(null)
  const floating = React.useRef<HTMLDivElement | null>(null)
  const { x, y, update } = useFloating({ anchor, floating, open: true, offset: 8 })
  onUpdate(update)
  return (
    <div>
      <div ref={anchor} />
      <div ref={floating} data-testid="xy">{`${x},${y}`}</div>
    </div>
  )
}

describe('useFloating stale-result guard', () => {
  beforeEach(() => computePositionMock.mockReset())
  afterEach(() => vi.restoreAllMocks())

  it('drops a computePosition result that resolves after unmount', async () => {
    let resolve!: (v: ReturnType<typeof pos>) => void
    const pending = new Promise<ReturnType<typeof pos>>((r) => (resolve = r))
    computePositionMock.mockReturnValue(pending)
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    let update!: () => Promise<void>
    const { unmount } = render(<Harness onUpdate={(u) => (update = u)} />)

    let p!: Promise<void>
    act(() => {
      p = update()
    })
    unmount()
    await act(async () => {
      resolve(pos(123, 456))
      await p
    })

    expect(err.mock.calls.some((c) => String(c[0]).includes('unmounted'))).toBe(false)
  })

  it('applies only the latest of two overlapping updates', async () => {
    const queue = [pos(10, 10), pos(20, 20)]
    computePositionMock.mockImplementation(() => Promise.resolve(queue.shift()))

    let update!: () => Promise<void>
    const { getByTestId } = render(<Harness onUpdate={(u) => (update = u)} />)

    await act(async () => {
      const a = update()
      const b = update()
      await Promise.all([a, b])
    })
    // The second update started last, so its epoch token wins.
    expect(getByTestId('xy').textContent).toBe('20,20')
  })

  it('adds the viewport-clamping size middleware when `size` is enabled', async () => {
    computePositionMock.mockResolvedValue(pos(0, 0))
    function SizeHarness({ onUpdate }: { onUpdate: (u: () => Promise<void>) => void }) {
      const anchor = React.useRef<HTMLDivElement | null>(null)
      const floating = React.useRef<HTMLDivElement | null>(null)
      const { update } = useFloating({ anchor, floating, open: true, size: true })
      onUpdate(update)
      return (
        <div>
          <div ref={anchor} />
          <div ref={floating} />
        </div>
      )
    }
    let update!: () => Promise<void>
    render(<SizeHarness onUpdate={(u) => (update = u)} />)
    await act(async () => {
      await update()
    })
    const opts = computePositionMock.mock.calls.at(-1)?.[2] as {
      middleware: { name?: string }[]
    }
    expect(opts.middleware.some((m) => m?.name === 'size')).toBe(true)
  })
})
