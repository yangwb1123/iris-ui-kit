import { afterEach, describe, expect, it } from 'vitest'
import * as React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { usePaginatedResource } from './usePaginatedResource'
import type { PageQuery, PageResult } from '@iris-ui/core'

afterEach(cleanup)

function dataset(total: number) {
  const all = Array.from({ length: total }, (_, i) => i)
  return async ({ page, pageSize }: PageQuery): Promise<PageResult<number>> => {
    const start = (page - 1) * pageSize
    return { items: all.slice(start, start + pageSize), total }
  }
}

function Probe({ mode }: { mode?: 'paged' | 'infinite' }) {
  const p = usePaginatedResource(dataset(25), { pageSize: 10, mode, immediate: true })
  return (
    <div>
      <span data-testid="count">{p.items.length}</span>
      <span data-testid="page">{p.page}</span>
      <span data-testid="hasMore">{String(p.hasMore)}</span>
      <button type="button" onClick={() => void p.loadMore()}>
        more
      </button>
      <button type="button" onClick={() => void p.goToPage(2)}>
        page2
      </button>
    </div>
  )
}

describe('@iris-ui/react usePaginatedResource', () => {
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
})
