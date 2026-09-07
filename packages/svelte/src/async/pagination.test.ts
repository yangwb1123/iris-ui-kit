import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get } from 'svelte/store'
import type { PageQuery, PageResult } from '@iris-ui-kit/core'

const lifecycle = vi.hoisted(() => ({
  destroy: undefined as (() => void) | undefined,
  mount: undefined as (() => void) | undefined,
}))

vi.mock('svelte', () => ({
  onDestroy: (callback: () => void) => {
    lifecycle.destroy = callback
  },
  onMount: (callback: () => void) => {
    lifecycle.mount = callback
  },
}))

import { usePaginatedResource } from './usePaginatedResource'

describe('@iris-ui-kit/svelte usePaginatedResource', () => {
  beforeEach(() => {
    lifecycle.destroy = undefined
    lifecycle.mount = undefined
  })

  it('keeps loadMore append-compatible when mode is omitted', async () => {
    const resource = usePaginatedResource(dataset(25), { pageSize: 10 })
    const stopItems = resource.items.subscribe(() => {})
    const stopPage = resource.page.subscribe(() => {})
    await resource.loadMore()
    await resource.loadMore()
    expect(get(resource.items)).toHaveLength(20)
    expect(get(resource.page)).toBe(2)
    stopItems()
    stopPage()
  })

  it('replaces pages in explicit paged mode and appends in infinite mode', async () => {
    const paged = usePaginatedResource(dataset(25), { pageSize: 10, mode: 'paged' })
    const stopPaged = paged.items.subscribe(() => {})
    await paged.loadMore()
    await paged.loadMore()
    expect(get(paged.items)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
    stopPaged()

    const infinite = usePaginatedResource(dataset(25), { pageSize: 10, mode: 'infinite' })
    const stopInfinite = infinite.items.subscribe(() => {})
    await infinite.loadMore()
    await infinite.loadMore()
    expect(get(infinite.items)).toHaveLength(20)
    stopInfinite()
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
    const resource = usePaginatedResource(fetcher, { pageSize: 10 })
    const stopItems = resource.items.subscribe(() => {})
    const stopLoading = resource.isLoading.subscribe(() => {})
    const stopStatus = resource.status.subscribe(() => {})

    const cancelled = resource.loadMore()
    expect(get(resource.isLoading)).toBe(true)
    resource.cancel()
    expect(get(resource.isLoading)).toBe(false)
    expect(signals[0]?.aborted).toBe(true)

    const retry = resource.loadMore()
    first.resolve({ items: [0] })
    second.resolve({ items: [1], total: 1 })
    await Promise.all([cancelled, retry])
    expect(get(resource.items)).toEqual([1])
    expect(get(resource.status)).toBe('success')
    stopItems()
    stopLoading()
    stopStatus()
  })

  it('cancels the request from the component destroy lifecycle', async () => {
    const d = deferred<PageResult<number>>()
    let signal: AbortSignal | undefined
    const fetcher = vi.fn((_query: PageQuery, nextSignal?: AbortSignal) => {
      signal = nextSignal
      return d.promise
    })
    const resource = usePaginatedResource(fetcher, { pageSize: 10 })
    const pending = resource.goToPage(1)
    lifecycle.destroy?.()
    expect(signal?.aborted).toBe(true)
    d.resolve({ items: [1] })
    await pending
    expect(get(resource.items)).toEqual([])
  })
})

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
