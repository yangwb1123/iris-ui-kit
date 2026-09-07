import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

function Probe({
  mode,
  fetcher = dataset(25),
  immediate = true,
}: {
  mode?: 'paged' | 'infinite'
  fetcher?: (query: PageQuery, signal?: AbortSignal) => Promise<PageResult<number>>
  immediate?: boolean
}) {
  const p = usePaginatedResource<number>(fetcher, { pageSize: 10, mode, immediate })
  return (
    <div>
      <span data-testid="count">{p.items.length}</span>
      <span data-testid="page">{p.page}</span>
      <span data-testid="first">{p.items[0] ?? '—'}</span>
      <span data-testid="status">{p.status}</span>
      <span data-testid="hasMore">{String(p.hasMore)}</span>
      <button type="button" onClick={() => void p.loadMore()}>
        more
      </button>
      <button type="button" onClick={() => void p.goToPage(2)}>
        page2
      </button>
      <button type="button" onClick={() => p.cancel()}>
        cancel
      </button>
    </div>
  )
}

describe('@iris-ui-kit/react usePaginatedResource', () => {
  it('immediate loads page 1', async () => {
    render(<Probe />)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('10'))
    expect(screen.getByTestId('page').textContent).toBe('1')
    expect(screen.getByTestId('hasMore').textContent).toBe('true')
  })

  it('loadMore appends and updates hasMore', async () => {
    render(<Probe mode="infinite" />)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('10'))
    fireEvent.click(screen.getByText('more'))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('20'))
    fireEvent.click(screen.getByText('more'))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('25'))
    expect(screen.getByTestId('hasMore').textContent).toBe('false')
  })

  it('goToPage replaces the visible page', async () => {
    render(<Probe />)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('10'))
    fireEvent.click(screen.getByText('page2'))
    await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('2'))
    expect(screen.getByTestId('count').textContent).toBe('10')
  })

  it('paged mode makes loadMore replace the visible page', async () => {
    render(<Probe mode="paged" />)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('10'))
    expect(screen.getByTestId('first').textContent).toBe('0')
    fireEvent.click(screen.getByText('more'))
    await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('2'))
    expect(screen.getByTestId('count').textContent).toBe('10')
    expect(screen.getByTestId('first').textContent).toBe('10')
  })

  it('forwards the signal and cancels the request on unmount', async () => {
    const d = deferred<PageResult<number>>()
    let signal: AbortSignal | undefined
    const fetcher = vi.fn((_query: PageQuery, nextSignal?: AbortSignal) => {
      signal = nextSignal
      return d.promise
    })
    const { unmount } = render(<Probe fetcher={fetcher} />)
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    expect(signal).toBeInstanceOf(AbortSignal)
    unmount()
    expect(signal?.aborted).toBe(true)
    d.resolve({ items: [1] })
    await d.promise
  })

  it('exposes a retryable cancel state', async () => {
    const first = deferred<PageResult<number>>()
    const second = deferred<PageResult<number>>()
    let call = 0
    const fetcher = vi.fn((_query: PageQuery, _signal?: AbortSignal) =>
      ++call === 1 ? first.promise : second.promise,
    )
    render(<Probe fetcher={fetcher} immediate={false} />)
    fireEvent.click(screen.getByText('more'))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByText('cancel'))
    expect(screen.getByTestId('status').textContent).toBe('idle')
    fireEvent.click(screen.getByText('more'))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    second.resolve({ items: [2], total: 2 })
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'))
    first.resolve({ items: [1], total: 2 })
  })
})
