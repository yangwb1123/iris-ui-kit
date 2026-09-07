import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@solidjs/testing-library'
import { usePaginatedResource } from './usePaginatedResource'
import type { PageQuery, PageResult } from '@iris-ui-kit/core'

afterEach(cleanup)

function dataset(total: number) {
  const all = Array.from({ length: total }, (_, i) => i)
  return async ({ page, pageSize }: PageQuery): Promise<PageResult<number>> => {
    const start = (page - 1) * pageSize
    return { items: all.slice(start, start + pageSize), total }
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('@iris-ui-kit/solid usePaginatedResource', () => {
  it('keeps loadMore append-compatible when mode is omitted', async () => {
    const { result } = renderHook(() => usePaginatedResource(dataset(25), { pageSize: 10 }))
    await result.loadMore()
    await result.loadMore()
    expect(result.items()).toHaveLength(20)
    expect(result.page()).toBe(2)
  })

  it('replaces pages in explicit paged mode and appends in infinite mode', async () => {
    const paged = renderHook(() =>
      usePaginatedResource(dataset(25), { pageSize: 10, mode: 'paged' }),
    ).result
    await paged.loadMore()
    await paged.loadMore()
    expect(paged.items()).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])

    const infinite = renderHook(() =>
      usePaginatedResource(dataset(25), { pageSize: 10, mode: 'infinite' }),
    ).result
    await infinite.loadMore()
    await infinite.loadMore()
    expect(infinite.items()).toHaveLength(20)
  })

  it('forwards signals, exposes cancel, and allows a retry after cancellation', async () => {
    const first = deferred<PageResult<number>>()
    const second = deferred<PageResult<number>>()
    const signals: AbortSignal[] = []
    let call = 0
    const fetcher = vi.fn((_query: PageQuery, signal?: AbortSignal) => {
      if (signal) signals.push(signal)
      return ++call === 1 ? first.promise : second.promise
    })
    const { result } = renderHook(() => usePaginatedResource(fetcher, { pageSize: 10 }))

    const cancelled = result.loadMore()
    expect(result.isLoading()).toBe(true)
    result.cancel()
    expect(result.isLoading()).toBe(false)
    expect(signals[0]?.aborted).toBe(true)

    const retry = result.loadMore()
    first.resolve({ items: [0] })
    second.resolve({ items: [1], total: 1 })
    await Promise.all([cancelled, retry])
    expect(result.items()).toEqual([1])
    expect(result.status()).toBe('success')
  })

  it('cancels the request when the owner is cleaned up', async () => {
    const d = deferred<PageResult<number>>()
    let signal: AbortSignal | undefined
    const fetcher = vi.fn((_query: PageQuery, nextSignal?: AbortSignal) => {
      signal = nextSignal
      return d.promise
    })
    const { result } = renderHook(() => usePaginatedResource(fetcher, { pageSize: 10 }))
    const pending = result.goToPage(1)
    cleanup()
    expect(signal?.aborted).toBe(true)
    d.resolve({ items: [1] })
    await pending
    expect(result.items()).toEqual([])
  })
})
