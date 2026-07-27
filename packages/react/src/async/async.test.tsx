import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useAsyncResource } from './useAsyncResource'

afterEach(cleanup)

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function Probe({ fetcher, immediate }: { fetcher: () => Promise<string>; immediate?: boolean }) {
  const r = useAsyncResource(fetcher, { immediate })
  return (
    <div>
      <span data-testid="status">{r.status}</span>
      <span data-testid="data">{r.data ?? '—'}</span>
      <span data-testid="loading">{String(r.isLoading)}</span>
      <button type="button" onClick={() => void r.load()}>
        load
      </button>
    </div>
  )
}

describe('@iris-ui-kit/react useAsyncResource', () => {
  it('starts idle and loads on demand', async () => {
    render(<Probe fetcher={async () => 'hello'} />)
    expect(screen.getByTestId('status').textContent).toBe('idle')
    fireEvent.click(screen.getByText('load'))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'))
    expect(screen.getByTestId('data').textContent).toBe('hello')
  })

  it('immediate auto-loads on mount', async () => {
    const fetcher = vi.fn(async () => 'auto')
    render(<Probe fetcher={fetcher} immediate />)
    await waitFor(() => expect(screen.getByTestId('data').textContent).toBe('auto'))
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('reflects the loading state while in flight', async () => {
    const d = deferred<string>()
    render(<Probe fetcher={() => d.promise} />)
    fireEvent.click(screen.getByText('load'))
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('true'))
    act(() => d.resolve('done'))
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('data').textContent).toBe('done')
  })

  it('surfaces the error state', async () => {
    render(
      <Probe
        fetcher={async () => {
          throw new Error('nope')
        }}
      />,
    )
    fireEvent.click(screen.getByText('load'))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'))
  })
})
