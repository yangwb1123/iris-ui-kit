import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

beforeEach(() => {
  vi.useFakeTimers()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

const editableCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age' },
]

function loadingRow(): HTMLElement | null {
  return document.querySelector('[data-iris-table-row="loading"]')
}

function bodyRows(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll('[data-iris-table-row]:not([data-iris-table-row="header"])'),
  )
}

function freshnessStamp(): HTMLElement | null {
  return document.querySelector('[data-iris-freshness]')
}

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function editor(): HTMLInputElement | null {
  return document.querySelector('[data-iris-table-editor]')
}

/** Settle one round of proxy microtasks (autoLoad / refetch promises). */
async function settle(): Promise<void> {
  await act(async () => {})
}

describe('@iris-ui-kit/react IrisTable autoRefresh (batch AS, iris 独有)', () => {
  it('the interval fires refetch — the query runs again on every tick', async () => {
    const query = vi.fn(async () => ({ rows: [], total: 0 }))
    render(
      <IrisTable
        columns={cols}
        rowKey="id"
        proxyConfig={{ query }}
        autoRefresh={{ intervalMs: 1000 }}
      />,
    )
    await settle() // initial autoLoad
    expect(query).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    await settle()
    expect(query).toHaveBeenCalledTimes(2)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    await settle()
    expect(query).toHaveBeenCalledTimes(3)
  })

  it('unmount clears the timer — no further queries after teardown', async () => {
    const query = vi.fn(async () => ({ rows: [], total: 0 }))
    const { unmount } = render(
      <IrisTable
        columns={cols}
        rowKey="id"
        proxyConfig={{ query }}
        autoRefresh={{ intervalMs: 1000 }}
      />,
    )
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
    unmount()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('no autoRefresh prop → no timer (query only from autoLoad)', async () => {
    const query = vi.fn(async () => ({ rows: [], total: 0 }))
    render(<IrisTable columns={cols} rowKey="id" proxyConfig={{ query }} />)
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('changing intervalMs restarts the timer (keyed on the scalar)', async () => {
    const query = vi.fn(async () => ({ rows: [], total: 0 }))
    const { rerender } = render(
      <IrisTable
        columns={cols}
        rowKey="id"
        proxyConfig={{ query }}
        autoRefresh={{ intervalMs: 1000 }}
      />,
    )
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    await settle()
    expect(query).toHaveBeenCalledTimes(2)
    // 1000 → 2000: the old 1000ms timer is torn down; the new one is not due
    // until 2000ms, so another 1000ms of fake time must NOT fire a query.
    rerender(
      <IrisTable
        columns={cols}
        rowKey="id"
        proxyConfig={{ query }}
        autoRefresh={{ intervalMs: 2000 }}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    await settle()
    expect(query).toHaveBeenCalledTimes(2)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    await settle()
    expect(query).toHaveBeenCalledTimes(3)
  })

  it('intervalMs ≤ 0 is fail-closed (no timer)', async () => {
    const query = vi.fn(async () => ({ rows: [], total: 0 }))
    render(
      <IrisTable
        columns={cols}
        rowKey="id"
        proxyConfig={{ query }}
        autoRefresh={{ intervalMs: 0 }}
      />,
    )
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('a refetch tick uses the standard refetch path — loading flashes true until the response lands', async () => {
    let resolveQuery: (v: { rows: Row[]; total: number }) => void = () => {}
    const query = vi.fn(
      () =>
        new Promise<{ rows: Row[]; total: number }>((resolve) => {
          resolveQuery = resolve
        }),
    )
    render(
      <IrisTable
        columns={cols}
        rowKey="id"
        proxyConfig={{ query }}
        autoRefresh={{ intervalMs: 1000 }}
      />,
    )
    await act(async () => {
      resolveQuery({ rows: [{ id: 1, name: 'A', age: 1 }], total: 1 })
    })
    expect(query).toHaveBeenCalledTimes(1)
    expect(loadingRow()).toBeNull()
    expect(bodyRows().length).toBe(1)
    // Tick: refetch fires, its promise stays pending → the same loading row
    // the built-in ↻ button shows (the core source has no silent option).
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(query).toHaveBeenCalledTimes(2)
    expect(loadingRow()).not.toBeNull()
    await act(async () => {
      resolveQuery({ rows: [{ id: 2, name: 'B', age: 2 }], total: 1 })
    })
    expect(loadingRow()).toBeNull()
    expect(bodyRows().length).toBe(1)
  })

  it('non-proxy data tables are inert — autoRefresh has nothing to refetch', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" autoRefresh={{ intervalMs: 1000 }} />)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(loadingRow()).toBeNull()
    expect(bodyRows().length).toBe(3)
  })
})

describe('@iris-ui-kit/react IrisTable freshness (batch AS, iris 独有)', () => {
  it('initial data stamps the timestamp (local 24h formatClock)', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 9, 5, 30))
    render(<IrisTable columns={cols} data={rows} rowKey="id" freshness />)
    const stamp = freshnessStamp()
    expect(stamp).not.toBeNull()
    expect(stamp!.textContent).toBe('Updated at 09:05:30')
  })

  it('an edit commit re-stamps the time', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 9, 5, 30))
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" freshness />)
    expect(freshnessStamp()!.textContent).toBe('Updated at 09:05:30')
    vi.setSystemTime(new Date(2026, 0, 1, 9, 6, 0))
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    act(() => {
      fireEvent.change(editor()!, { target: { value: 'Renamed' } })
      fireEvent.keyDown(editor()!, { key: 'Enter' })
    })
    expect(freshnessStamp()!.textContent).toBe('Updated at 09:06:00')
  })

  it('proxy mode stamps on the FIRST data arrival — hidden until rows exist', async () => {
    vi.setSystemTime(new Date(2026, 0, 1, 9, 5, 30))
    const query = vi.fn(async () => ({ rows: [{ id: 1, name: 'A', age: 1 }], total: 1 }))
    render(<IrisTable columns={cols} rowKey="id" proxyConfig={{ query }} freshness />)
    expect(freshnessStamp()).toBeNull()
    await settle()
    const stamp = freshnessStamp()
    expect(stamp).not.toBeNull()
    expect(stamp!.textContent).toBe('Updated at 09:05:30')
  })

  it('the stamp stays hidden while there are no rows', () => {
    render(<IrisTable columns={cols} data={[]} rowKey="id" freshness />)
    expect(freshnessStamp()).toBeNull()
  })

  it('without freshness the stamp element is absent', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(freshnessStamp()).toBeNull()
  })
})
