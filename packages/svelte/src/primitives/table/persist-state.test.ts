import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'
import PersistStateHarness from './persist-state-harness.svelte'
import { IRIS_TABLE_PERSIST_DEFAULT_KEY } from './table-persist.svelte'
import type { IrisTableColumn, IrisTablePersistConfig, IrisTableSortState } from './types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const baseColumns: IrisTableColumn[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true, align: 'right' },
]
const baseRows = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
]

const DEFAULT_KEY = IRIS_TABLE_PERSIST_DEFAULT_KEY

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

function headers(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-iris-table-header]')) as HTMLElement[]
}

function lastSaved(storage: { setItem: Mock }): Record<string, unknown> {
  const calls = storage.setItem.mock.calls as Array<[string, string]>
  expect(calls.length).toBeGreaterThan(0)
  return JSON.parse(calls[calls.length - 1]![1]!) as Record<string, unknown>
}

interface HarnessOptions {
  persist: IrisTablePersistConfig
  initialSort?: IrisTableSortState | null
  onSortChange?: Mock
  onFiltersChange?: Mock
  onColumnWidthsChange?: Mock
  onPageChange?: Mock
  query?: Mock
  pageSize?: number
  remoteSort?: boolean
  remoteFilter?: boolean
  noWidths?: boolean
}

function renderHarness(options: HarnessOptions): ReturnType<typeof render> {
  return render(PersistStateHarness, {
    props: {
      persist: options.persist,
      onSortChange: options.onSortChange,
      onFiltersChange: options.onFiltersChange,
      onColumnWidthsChange: options.onColumnWidthsChange,
      onPageChange: options.onPageChange,
      query: options.query,
      pageSize: options.pageSize,
      remoteSort: options.remoteSort,
      remoteFilter: options.remoteFilter,
      noWidths: options.noWidths,
    },
  })
}

describe('@iris-ui-kit/svelte IrisTable persistState (batch EJ, iris 独有)', () => {
  it('mount applies restored state through the change callbacks', async () => {
    const seed = JSON.stringify({
      sort: { key: 'name', direction: 'desc' },
      filters: { name: 'ali' },
      columnWidths: { name: 120, age: 80 },
    })
    const storage = makeStorage(seed)
    const onSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onColumnWidthsChange = vi.fn()
    const { container } = renderHarness({
      persist: { storage: { getItem: storage.getItem, setItem: storage.setItem } },
      onSortChange,
      onFiltersChange,
      onColumnWidthsChange,
    })
    await waitFor(() => {
      expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'desc' })
      expect(onFiltersChange).toHaveBeenCalledWith({ name: 'ali' })
      expect(onColumnWidthsChange).toHaveBeenCalledWith({ name: 120, age: 80 })
    })
    // The restored state flows back into the controlled table: aria-sort on
    // the name header, the text filter keeps only Alice, widths hit the grid.
    await waitFor(() => {
      expect(container.querySelector('[aria-sort="descending"]')).not.toBeNull()
      expect(
        Array.from(container.querySelectorAll('[data-iris-table-row]')).map((row) =>
          row.textContent?.includes('Alice'),
        ),
      ).toEqual([true])
      expect(
        container.querySelector('[data-iris-table-header-row]')?.getAttribute('style'),
      ).toContain('120px')
    })
  })

  it('a change fires a save with the JSON (whole snapshot serialized)', async () => {
    const storage = makeStorage('{"sort":{"key":"name","direction":"asc"}}')
    const { container } = renderHarness({
      persist: { storage: { getItem: storage.getItem, setItem: storage.setItem } },
    })
    await waitFor(() => {
      expect(storage.getItem).toHaveBeenCalledWith(DEFAULT_KEY)
    })
    // Header click cycles asc → desc (controlled parent applies the change).
    await fireEvent.click(headers(container)[0]!)
    const saved = lastSaved(storage)
    expect(saved.sort).toEqual({ key: 'name', direction: 'desc' })
  })

  it('mount commit never overwrites storage with pre-restore values', async () => {
    const seed = '{"sort":{"key":"name","direction":"desc"}}'
    const storage = makeStorage(seed)
    renderHarness({
      persist: { storage: { getItem: storage.getItem, setItem: storage.setItem } },
    })
    await waitFor(() => {
      const saved = lastSaved(storage)
      expect(saved.sort).toEqual({ key: 'name', direction: 'desc' })
      expect((JSON.parse(storage.data.get(DEFAULT_KEY)!) as { sort: unknown }).sort).toEqual({
        key: 'name',
        direction: 'desc',
      })
    })
  })

  it('storage: false fully disables persistence (no reads, no writes)', () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn() })
    const onSortChange = vi.fn()
    const { container } = renderHarness({ persist: { storage: false }, onSortChange })
    expect(localStorage.getItem).not.toHaveBeenCalled()
    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(onSortChange).not.toHaveBeenCalled()
    expect(container.querySelector('[role=table]')).not.toBeNull()
  })

  it('corrupt JSON is ignored (no restore, no crash)', async () => {
    const storage = makeStorage('{oops: not json')
    const onSortChange = vi.fn()
    const { container } = renderHarness({
      persist: { storage: { getItem: storage.getItem, setItem: storage.setItem } },
      onSortChange,
    })
    expect(onSortChange).not.toHaveBeenCalled()
    expect(container.querySelector('[role=table]')).not.toBeNull()
    // A change still saves a FRESH valid snapshot (self-heal).
    await fireEvent.click(headers(container)[0]!)
    expect(lastSaved(storage).sort).toEqual({ key: 'name', direction: 'asc' })
  })

  it('non-object JSON (null / array / string / number) is ignored', async () => {
    for (const bad of ['null', '[]', '"str"', '42']) {
      cleanup()
      const storage = makeStorage(bad)
      const onSortChange = vi.fn()
      renderHarness({
        persist: { storage: { getItem: storage.getItem, setItem: storage.setItem } },
        onSortChange,
      })
      expect(onSortChange).not.toHaveBeenCalled()
    }
  })

  it('include restricts both restore and save to the listed pieces', async () => {
    const seed = JSON.stringify({
      sort: { key: 'name', direction: 'asc' },
      filters: { name: 'ali' },
    })
    const storage = makeStorage(seed)
    const onSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const { container } = renderHarness({
      persist: {
        storage: { getItem: storage.getItem, setItem: storage.setItem },
        include: ['sort'],
      },
      onSortChange,
      onFiltersChange,
    })
    await waitFor(() => {
      expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'asc' })
    })
    expect(onFiltersChange).not.toHaveBeenCalled()
    await fireEvent.click(headers(container)[0]!)
    const saved = lastSaved(storage)
    expect(saved.sort).toEqual({ key: 'name', direction: 'desc' })
    expect(saved.filters).toBeUndefined()
  })

  it('a custom key is used for reads and writes', async () => {
    const storage = makeStorage()
    const { container } = renderHarness({
      persist: {
        storage: { getItem: storage.getItem, setItem: storage.setItem },
        key: 'my-table-state',
      },
    })
    expect(storage.getItem).toHaveBeenCalledWith('my-table-state')
    await fireEvent.click(headers(container)[0]!)
    expect(storage.setItem.mock.calls[0]?.[0]).toBe('my-table-state')
  })

  it('pageSize restores through the proxy BEFORE the first query', async () => {
    const seed = JSON.stringify({ pageSize: 25 })
    const storage = makeStorage(seed)
    const query = vi.fn(async () => ({ rows: [] as Array<Record<string, unknown>>, total: 0 }))
    const onPageChange = vi.fn()
    renderHarness({
      persist: { storage: { getItem: storage.getItem, setItem: storage.setItem } },
      query,
      onPageChange,
    })
    // Notified with page 1 + the restored size, and the FIRST query already
    // used it (no default-10 double fetch).
    await waitFor(() => {
      expect(onPageChange).toHaveBeenCalledWith(1, 25)
      expect(query).toHaveBeenCalledTimes(1)
      expect(query.mock.calls[0]?.[0]).toMatchObject({ page: 1, pageSize: 25 })
    })
    // The proxy state flows back into the snapshot → saved.
    await waitFor(() => {
      expect(lastSaved(storage).pageSize).toBe(25)
    })
  })

  it('pageSize is skipped entirely without a proxy', async () => {
    const seed = JSON.stringify({ pageSize: 25 })
    const storage = makeStorage(seed)
    const onPageChange = vi.fn()
    const { container } = renderHarness({
      persist: { storage: { getItem: storage.getItem, setItem: storage.setItem } },
      onPageChange,
    })
    expect(onPageChange).not.toHaveBeenCalled()
    // No proxy → the snapshot never carries pageSize → never saved. (The
    // mount write legitimately replaces the stored snapshot with the
    // restorable pieces — pageSize is dropped, not preserved.)
    await fireEvent.click(headers(container)[0]!)
    const saved = lastSaved(storage)
    expect(saved.pageSize).toBeUndefined()
  })

  it('the default storage adapter (localStorage) is used when storage is omitted', async () => {
    const getItem = vi.fn(() => '{"sort":{"key":"name","direction":"asc"}}')
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem, setItem })
    const { container } = renderHarness({ persist: {} })
    expect(getItem).toHaveBeenCalledWith(DEFAULT_KEY)
    // Restored through the callback → the table actually applies it.
    await waitFor(() => {
      expect(container.querySelector('[aria-sort="ascending"]')).not.toBeNull()
    })
  })

  it('quota / security write errors never break the table', async () => {
    const storage = makeStorage()
    storage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { container } = renderHarness({
      persist: { storage: { getItem: storage.getItem, setItem: storage.setItem } },
    })
    await fireEvent.click(headers(container)[0]!)
    // No crash; the change still went through the callback.
    expect(container.querySelector('[aria-sort="ascending"]')).not.toBeNull()
  })

  it('no persistState prop → no storage access at all', () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn() })
    render(IrisTable, { props: { columns: baseColumns, data: baseRows, rowKey: 'id' } })
    expect(localStorage.getItem).not.toHaveBeenCalled()
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('seeded columnVisibility/columnOrder are inert (no channel, no replay, no save)', async () => {
    const seed = JSON.stringify({
      columnVisibility: { age: false },
      columnOrder: ['age', 'name'],
    })
    const storage = makeStorage(seed)
    const onSortChange = vi.fn()
    const { container } = renderHarness({
      persist: { storage: { getItem: storage.getItem, setItem: storage.setItem } },
      onSortChange,
    })
    // Nothing restorable landed in a channel → zero dispatches; the mount
    // commit never echoes the inert pieces back into storage.
    expect(onSortChange).not.toHaveBeenCalled()
    await fireEvent.click(headers(container)[0]!)
    const saved = lastSaved(storage)
    expect(saved.columnVisibility).toBeUndefined()
    expect(saved.columnOrder).toBeUndefined()
    expect(container.querySelector('[role=table]')).not.toBeNull()
  })

  it('a piece without its change callback is inert in both directions', async () => {
    // Widths have no owning callback → a seeded widths snapshot must not
    // replay and the collector never captures widths into a save.
    const seed = JSON.stringify({
      sort: { key: 'name', direction: 'asc' },
      columnWidths: { name: 999 },
    })
    const storage = makeStorage(seed)
    const onSortChange = vi.fn()
    const { container } = renderHarness({
      persist: { storage: { getItem: storage.getItem, setItem: storage.setItem } },
      onSortChange,
      noWidths: true,
    })
    await waitFor(() => {
      expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'asc' })
    })
    await fireEvent.click(headers(container)[0]!)
    const saved = lastSaved(storage)
    expect(saved.sort).toEqual({ key: 'name', direction: 'desc' })
    expect(saved.columnWidths).toBeUndefined()
  })

  it('uncontrolled table without change callbacks restores nothing and writes nothing', async () => {
    const seed = '{"sort":{"key":"name","direction":"desc"}}'
    const storage = makeStorage(seed)
    const { container } = render(IrisTable, {
      props: {
        columns: baseColumns,
        data: baseRows,
        rowKey: 'id',
        persistState: { storage: { getItem: storage.getItem, setItem: storage.setItem } },
      },
    })
    // No owning callback → the seeded sort stays inert (no aria-sort) and
    // nothing is ever written (the collector gates every piece).
    expect(container.querySelector('[aria-sort="descending"]')).toBeNull()
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('remoteSort: a restored sort re-queries the server with the restored sort', async () => {
    const seed = JSON.stringify({ sort: { key: 'name', direction: 'desc' } })
    const storage = makeStorage(seed)
    const query = vi.fn(async () => ({ rows: baseRows, total: baseRows.length }))
    renderHarness({
      persist: { storage: { getItem: storage.getItem, setItem: storage.setItem } },
      query,
      remoteSort: true,
    })
    await waitFor(() => {
      const params = query.mock.calls[query.mock.calls.length - 1]?.[0] as {
        sort: IrisTableSortState | null
      }
      expect(params.sort).toEqual({ key: 'name', direction: 'desc' })
    })
  })

  it('remoteFilter: a restored filter re-queries the server with the restored filters', async () => {
    const seed = JSON.stringify({ filters: { name: 'ali' } })
    const storage = makeStorage(seed)
    const query = vi.fn(async () => ({ rows: baseRows, total: baseRows.length }))
    renderHarness({
      persist: { storage: { getItem: storage.getItem, setItem: storage.setItem } },
      query,
      remoteFilter: true,
    })
    await waitFor(() => {
      const params = query.mock.calls[query.mock.calls.length - 1]?.[0] as {
        filters: Record<string, string>
      }
      expect(params.filters).toMatchObject({ name: 'ali' })
    })
  })
})
