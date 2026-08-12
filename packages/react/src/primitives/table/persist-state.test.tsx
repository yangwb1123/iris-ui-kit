import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTablePersistConfig, IrisTableSortState } from './types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
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

const baseColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true, align: 'right' },
]

const DEFAULT_KEY = 'iris-table-state'

/** In-memory Storage adapter stub with spies on getItem/setItem. */
function makeStorage(seed?: string | null): {
  data: Map<string, string>
  getItem: Mock
  setItem: Mock
} {
  const data = new Map<string, string>()
  if (seed != null) data.set(DEFAULT_KEY, seed)
  return {
    data,
    getItem: vi.fn((k: string) => data.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => {
      data.set(k, v)
    }),
  }
}

function headers(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-table-header]'))
}

function lastSaved(storage: { setItem: Mock }): Record<string, unknown> {
  const calls = storage.setItem.mock.calls as Array<[string, string]>
  expect(calls.length).toBeGreaterThan(0)
  return JSON.parse(calls[calls.length - 1]![1]!) as Record<string, unknown>
}

interface HarnessProps {
  persist: IrisTablePersistConfig
  multiSort?: boolean
  initialSort?: IrisTableSortState | null
  proxy?: { query: Mock; pageSize?: number; onPageChange?: Mock }
  onSortChange?: Mock
  onMultiSortChange?: Mock
  onFiltersChange?: Mock
  onFilterValuesChange?: Mock
  onColumnVisibilityChange?: Mock
  onColumnOrderChange?: Mock
  onColumnWidthsChange?: Mock
}

/** Fully CONTROLLED table: every piece is parent-owned through a callback
 * (the table itself holds zero state — exactly what persistState assumes). */
function ControlledHarness(props: HarnessProps): React.ReactElement {
  const {
    persist,
    multiSort = false,
    initialSort = null,
    proxy,
    onSortChange,
    onMultiSortChange,
    onFiltersChange,
    onFilterValuesChange,
    onColumnVisibilityChange,
    onColumnOrderChange,
    onColumnWidthsChange,
  } = props
  const [sort, setSort] = React.useState<IrisTableSortState | null>(initialSort)
  const [multi, setMulti] = React.useState<IrisTableSortState[]>([])
  const [filters, setFilters] = React.useState<Record<string, string>>({})
  const [filterValues, setFilterValues] = React.useState<Record<string, string[]>>({})
  const [visibility, setVisibility] = React.useState<Record<string, boolean>>({})
  const [order, setOrder] = React.useState<string[] | undefined>(undefined)
  const [widths, setWidths] = React.useState<Record<string, number>>({})
  const [pageSize, setPageSize] = React.useState(proxy?.pageSize ?? 10)
  return (
    <IrisTable
      columns={baseColumns}
      data={rows}
      rowKey="id"
      sort={sort}
      onSortChange={(next) => {
        setSort(next)
        onSortChange?.(next)
      }}
      multiSort={multiSort}
      multiSortState={multi}
      onMultiSortChange={(next) => {
        setMulti(next)
        onMultiSortChange?.(next)
      }}
      filters={filters}
      onFiltersChange={(next) => {
        setFilters(next)
        onFiltersChange?.(next)
      }}
      filterValues={filterValues}
      onFilterValuesChange={(next) => {
        setFilterValues(next)
        onFilterValuesChange?.(next)
      }}
      columnVisibility={visibility}
      onColumnVisibilityChange={(next) => {
        setVisibility(next)
        onColumnVisibilityChange?.(next)
      }}
      columnOrder={order}
      onColumnOrderChange={(next) => {
        setOrder(next)
        onColumnOrderChange?.(next)
      }}
      columnWidths={widths}
      onColumnWidthsChange={(next) => {
        setWidths(next)
        onColumnWidthsChange?.(next)
      }}
      persistState={persist}
      proxyConfig={
        proxy
          ? {
              query: proxy.query,
              pageSize,
              onPageChange: (p, s) => {
                setPageSize(s)
                proxy.onPageChange?.(p, s)
              },
            }
          : undefined
      }
    />
  )
}

describe('@iris-ui-kit/react IrisTable persistState (batch AG, iris 独有)', () => {
  it('mount applies restored state through the change callbacks', () => {
    const seed = JSON.stringify({
      sort: { key: 'name', direction: 'desc' },
      filters: { name: 'ali' },
      filterValues: { age: ['25'] },
      columnVisibility: { age: false },
      columnOrder: ['age', 'name'],
      columnWidths: { name: 120, age: 80 },
    })
    const storage = makeStorage(seed)
    const onSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const onColumnVisibilityChange = vi.fn()
    const onColumnOrderChange = vi.fn()
    const onColumnWidthsChange = vi.fn()
    render(
      <ControlledHarness
        persist={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
        onSortChange={onSortChange}
        onFiltersChange={onFiltersChange}
        onFilterValuesChange={onFilterValuesChange}
        onColumnVisibilityChange={onColumnVisibilityChange}
        onColumnOrderChange={onColumnOrderChange}
        onColumnWidthsChange={onColumnWidthsChange}
      />,
    )
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'desc' })
    expect(onFiltersChange).toHaveBeenCalledWith({ name: 'ali' })
    expect(onFilterValuesChange).toHaveBeenCalledWith({ age: ['25'] })
    expect(onColumnVisibilityChange).toHaveBeenCalledWith({ age: false })
    expect(onColumnOrderChange).toHaveBeenCalledWith(['age', 'name'])
    expect(onColumnWidthsChange).toHaveBeenCalledWith({ name: 120, age: 80 })
    // The restored state flows back into the controlled table.
    expect(document.querySelector('[aria-sort="descending"]')).not.toBeNull()
  })

  it('a change fires a save with the JSON (whole snapshot serialized)', () => {
    const storage = makeStorage('{"sort":{"key":"name","direction":"asc"}}')
    render(
      <ControlledHarness
        persist={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
      />,
    )
    expect(storage.getItem).toHaveBeenCalledWith(DEFAULT_KEY)
    // Header click cycles asc → desc (controlled parent applies the change).
    act(() => fireEvent.click(headers()[0]!))
    const saved = lastSaved(storage)
    expect(saved.sort).toEqual({ key: 'name', direction: 'desc' })
  })

  it('mount commit never overwrites storage with pre-restore values', () => {
    const seed = '{"sort":{"key":"name","direction":"desc"}}'
    const storage = makeStorage(seed)
    render(
      <ControlledHarness
        persist={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
      />,
    )
    // Whatever the mount write is, the stored sort stays the RESTORED desc —
    // the pre-restore null never lands in storage (the other channels are
    // self-seeded alongside, per-channel skip-first semantics).
    const saved = lastSaved(storage)
    expect(saved.sort).toEqual({ key: 'name', direction: 'desc' })
    expect((JSON.parse(storage.data.get(DEFAULT_KEY)!) as { sort: unknown }).sort).toEqual({
      key: 'name',
      direction: 'desc',
    })
  })

  it('storage: false fully disables persistence (no reads, no writes)', () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn() })
    const onSortChange = vi.fn()
    render(<ControlledHarness persist={{ storage: false }} onSortChange={onSortChange} />)
    expect(localStorage.getItem).not.toHaveBeenCalled()
    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(onSortChange).not.toHaveBeenCalled()
    // The table itself still renders normally.
    expect(document.querySelector('[role=table]')).not.toBeNull()
  })

  it('corrupt JSON is ignored (no restore, no crash)', () => {
    const storage = makeStorage('{oops: not json')
    const onSortChange = vi.fn()
    render(
      <ControlledHarness
        persist={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
        onSortChange={onSortChange}
      />,
    )
    expect(onSortChange).not.toHaveBeenCalled()
    expect(document.querySelector('[role=table]')).not.toBeNull()
    // A change still saves a FRESH valid snapshot (self-heal).
    act(() => fireEvent.click(headers()[0]!))
    expect(lastSaved(storage).sort).toEqual({ key: 'name', direction: 'asc' })
  })

  it('non-object JSON (null / array / string) is ignored', () => {
    for (const bad of ['null', '[]', '"str"', '42']) {
      cleanup()
      const storage = makeStorage(bad)
      const onSortChange = vi.fn()
      render(
        <ControlledHarness
          persist={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
          onSortChange={onSortChange}
        />,
      )
      expect(onSortChange).not.toHaveBeenCalled()
    }
  })

  it('include restricts both restore and save to the listed pieces', () => {
    const seed = JSON.stringify({
      sort: { key: 'name', direction: 'asc' },
      filters: { name: 'ali' },
    })
    const storage = makeStorage(seed)
    const onSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    render(
      <ControlledHarness
        persist={{
          storage: { getItem: storage.getItem, setItem: storage.setItem },
          include: ['sort'],
        }}
        onSortChange={onSortChange}
        onFiltersChange={onFiltersChange}
      />,
    )
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'asc' })
    expect(onFiltersChange).not.toHaveBeenCalled()
    act(() => fireEvent.click(headers()[0]!))
    const saved = lastSaved(storage)
    expect(saved.sort).toEqual({ key: 'name', direction: 'desc' })
    expect(saved.filters).toBeUndefined()
  })

  it('multiSortState restores only in multiSort mode', () => {
    const seed = JSON.stringify({
      multiSortState: [
        { key: 'name', direction: 'asc' },
        { key: 'age', direction: 'desc' },
      ],
    })
    // multiSort on → restored through onMultiSortChange.
    const storage = makeStorage(seed)
    const onMultiSortChange = vi.fn()
    render(
      <ControlledHarness
        persist={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
        multiSort
        onMultiSortChange={onMultiSortChange}
      />,
    )
    expect(onMultiSortChange).toHaveBeenCalledWith([
      { key: 'name', direction: 'asc' },
      { key: 'age', direction: 'desc' },
    ])
    // multiSort off → the channel is not owned (snapshot gate), no restore.
    cleanup()
    const storage2 = makeStorage(seed)
    const onMultiSortChange2 = vi.fn()
    render(
      <ControlledHarness
        persist={{ storage: { getItem: storage2.getItem, setItem: storage2.setItem } }}
        onMultiSortChange={onMultiSortChange2}
      />,
    )
    expect(onMultiSortChange2).not.toHaveBeenCalled()
  })

  it('a custom key is used for reads and writes', () => {
    const storage = makeStorage()
    render(
      <ControlledHarness
        persist={{
          storage: { getItem: storage.getItem, setItem: storage.setItem },
          key: 'my-table-state',
        }}
      />,
    )
    expect(storage.getItem).toHaveBeenCalledWith('my-table-state')
    act(() => fireEvent.click(headers()[0]!))
    expect(storage.setItem.mock.calls[0]?.[0]).toBe('my-table-state')
  })

  it('pageSize restores through the proxy BEFORE the first query', async () => {
    const seed = JSON.stringify({ pageSize: 25 })
    const storage = makeStorage(seed)
    const query = vi.fn(async () => ({ rows: [], total: 0 }))
    const onPageChange = vi.fn()
    render(
      <ControlledHarness
        persist={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
        proxy={{ query, onPageChange }}
      />,
    )
    await act(async () => {})
    // Notified with page 1 + the restored size, and the FIRST query already
    // used it (no default-10 double fetch).
    expect(onPageChange).toHaveBeenCalledWith(1, 25)
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]?.[0]).toMatchObject({ page: 1, pageSize: 25 })
    // The pager state flows back into the snapshot → saved.
    expect(lastSaved(storage).pageSize).toBe(25)
  })

  it('pageSize is skipped entirely without a proxy', () => {
    const seed = JSON.stringify({ pageSize: 25 })
    const storage = makeStorage(seed)
    const onPageChange = vi.fn()
    render(
      <ControlledHarness
        persist={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
        onSortChange={vi.fn()}
      />,
    )
    expect(onPageChange).not.toHaveBeenCalled()
    // No proxy → the snapshot never carries pageSize → never saved. (The
    // mount write legitimately replaces the stored snapshot with the
    // restorable pieces — pageSize is dropped, not preserved.)
    act(() => fireEvent.click(headers()[0]!))
    const saved = lastSaved(storage)
    expect(saved.pageSize).toBeUndefined()
  })

  it('the default storage adapter (localStorage) is used when storage is omitted', () => {
    const getItem = vi.fn(() => '{"sort":{"key":"name","direction":"asc"}}')
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem, setItem })
    render(<ControlledHarness persist={{}} />)
    expect(getItem).toHaveBeenCalledWith(DEFAULT_KEY)
    // Restored through the callback → the table actually applies it.
    expect(document.querySelector('[aria-sort="ascending"]')).not.toBeNull()
  })

  it('quota / security write errors never break the table', () => {
    const storage = makeStorage()
    storage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    render(
      <ControlledHarness
        persist={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
      />,
    )
    act(() => fireEvent.click(headers()[0]!))
    // No crash; the change still went through the callback.
    expect(document.querySelector('[aria-sort="ascending"]')).not.toBeNull()
  })

  it('no persistState prop → no storage access at all', () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn() })
    render(<IrisTable columns={baseColumns} data={rows} rowKey="id" />)
    expect(localStorage.getItem).not.toHaveBeenCalled()
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })
})
