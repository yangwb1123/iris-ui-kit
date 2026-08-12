import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTableViewConfig, IrisTableSortState } from './types'

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
  { key: 'age', title: 'Age', sortable: true },
]

const DEFAULT_KEY = 'iris-table-views'
/** The toolbar select's internal "＋ 保存" item value (see TableViews.tsx). */
const SAVE_ITEM = '__iris-save-view'

interface StoredView {
  name: string
  snapshot: Record<string, unknown>
}

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

function storageAdapter(storage: { getItem: Mock; setItem: Mock }): {
  getItem: Mock
  setItem: Mock
} {
  return { getItem: storage.getItem, setItem: storage.setItem }
}

function lastSaved(storage: { setItem: Mock }): StoredView[] {
  const calls = storage.setItem.mock.calls as Array<[string, string]>
  expect(calls.length).toBeGreaterThan(0)
  return JSON.parse(calls[calls.length - 1]![1]!) as StoredView[]
}

function headers(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-table-header]'))
}

function viewsSelect(): HTMLSelectElement {
  const el = document.querySelector('[data-iris-table-views]')
  expect(el).not.toBeNull()
  return el as HTMLSelectElement
}

/** Stored view names (raw values — excludes the placeholder + save items). */
function viewNames(): string[] {
  return Array.from(viewsSelect().options)
    .map((o) => o.value)
    .filter((v) => v !== '' && v !== SAVE_ITEM)
}

/** Open the inline save input, type a name and confirm with Enter. */
function saveView(name: string): void {
  fireEvent.change(viewsSelect(), { target: { value: SAVE_ITEM } })
  const input = document.querySelector('[data-iris-views-save]') as HTMLInputElement
  expect(input).not.toBeNull()
  fireEvent.change(input, { target: { value: name } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

interface HarnessProps {
  viewsCfg?: IrisTableViewConfig
  onActiveViewChange?: Mock
  onSortChange?: Mock
  onFiltersChange?: Mock
  proxy?: { query: Mock; pageSize?: number; onPageChange?: Mock }
}

/** Fully CONTROLLED table: sort/filters are parent-owned through callbacks —
 * views capture them via the same collector as persistState and replay them
 * through the same change callbacks. */
function ViewsHarness(props: HarnessProps): React.ReactElement {
  const { viewsCfg, onActiveViewChange, onSortChange, onFiltersChange, proxy } = props
  const [sort, setSort] = React.useState<IrisTableSortState | null>(null)
  const [filters, setFilters] = React.useState<Record<string, string>>({})
  const [pageSize, setPageSize] = React.useState(proxy?.pageSize ?? 10)
  return (
    <IrisTable
      columns={baseColumns}
      data={rows}
      rowKey="id"
      views={viewsCfg}
      onActiveViewChange={onActiveViewChange}
      sort={sort}
      onSortChange={(next) => {
        setSort(next)
        onSortChange?.(next)
      }}
      filters={filters}
      onFiltersChange={(next) => {
        setFilters(next)
        onFiltersChange?.(next)
      }}
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

describe('@iris-ui-kit/react IrisTable views (batch AH, iris 独有)', () => {
  it('loads saved views from storage on mount (same guards as persistState)', () => {
    const seed = JSON.stringify([
      { name: 'Fav', snapshot: { sort: { key: 'name', direction: 'asc' } } },
    ])
    const storage = makeStorage(seed)
    render(<ViewsHarness viewsCfg={{ storage: storageAdapter(storage) }} />)
    expect(storage.getItem).toHaveBeenCalledWith(DEFAULT_KEY)
    expect(viewNames()).toEqual(['Fav'])
  })

  it('save snapshots the CURRENT pieces under the typed name + persists', () => {
    const storage = makeStorage()
    const onActiveViewChange = vi.fn()
    render(
      <ViewsHarness
        viewsCfg={{ storage: storageAdapter(storage) }}
        onActiveViewChange={onActiveViewChange}
      />,
    )
    // Sort asc first so the snapshot carries a real piece.
    act(() => fireEvent.click(headers()[0]!))
    saveView('My View')
    const stored = lastSaved(storage)
    expect(stored).toHaveLength(1)
    expect(stored[0]!.name).toBe('My View')
    // Owned channels (sort + filters, wired by the harness) are captured;
    // unowned ones (visibility/order/widths/pageSize) stay absent.
    expect(stored[0]!.snapshot).toEqual({
      sort: { key: 'name', direction: 'asc' },
      filters: {},
    })
    expect(viewNames()).toEqual(['My View'])
    // Saving selects the new view (controlled-only activeKey, not persisted).
    expect(onActiveViewChange).toHaveBeenCalledWith('My View')
  })

  it('only parent-owned channels are captured (collector gating)', () => {
    const storage = makeStorage()
    // A bare table with ZERO change callbacks → nothing is restorable → the
    // snapshot stays empty.
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        views={{ storage: storageAdapter(storage) }}
      />,
    )
    saveView('Empty')
    expect(lastSaved(storage)[0]!.snapshot).toEqual({})
  })

  it('selecting a view applies its snapshot through the change callbacks', () => {
    const storage = makeStorage()
    const onSortChange = vi.fn()
    render(
      <ViewsHarness viewsCfg={{ storage: storageAdapter(storage) }} onSortChange={onSortChange} />,
    )
    act(() => fireEvent.click(headers()[0]!)) // asc
    saveView('Asc')
    act(() => fireEvent.click(headers()[0]!)) // asc → desc
    expect(document.querySelector('[aria-sort="descending"]')).not.toBeNull()
    fireEvent.change(viewsSelect(), { target: { value: 'Asc' } })
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'name', direction: 'asc' })
    expect(document.querySelector('[aria-sort="ascending"]')).not.toBeNull()
  })

  it('delete removes the view + persists; deleting the active view clears it', () => {
    const storage = makeStorage()
    const onActiveViewChange = vi.fn()
    render(
      <ViewsHarness
        viewsCfg={{ storage: storageAdapter(storage) }}
        onActiveViewChange={onActiveViewChange}
      />,
    )
    saveView('Temp')
    expect(viewNames()).toEqual(['Temp'])
    const del = document.querySelector('[data-iris-table-views-delete]')
    expect(del).not.toBeNull()
    fireEvent.click(del!)
    expect(lastSaved(storage)).toEqual([])
    expect(viewNames()).toEqual([])
    expect(onActiveViewChange).toHaveBeenLastCalledWith(null)
  })

  it('storage: false keeps views in-memory (no reads, no writes)', () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn() })
    render(<ViewsHarness viewsCfg={{ storage: false }} />)
    expect(localStorage.getItem).not.toHaveBeenCalled()
    saveView('Memory')
    expect(viewNames()).toEqual(['Memory'])
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('corrupt JSON is ignored (no crash; a fresh save self-heals)', () => {
    const storage = makeStorage('{oops: not json')
    render(<ViewsHarness viewsCfg={{ storage: storageAdapter(storage) }} />)
    expect(viewNames()).toEqual([])
    saveView('Healed')
    expect(lastSaved(storage)[0]!.name).toBe('Healed')
  })

  it('non-array / malformed-entry JSON is ignored', () => {
    const bads = ['null', '"str"', '42', '{}', '[{"name": 7}, {"snapshot": {}}, "x"]']
    for (const bad of bads) {
      cleanup()
      const storage = makeStorage(bad)
      render(<ViewsHarness viewsCfg={{ storage: storageAdapter(storage) }} />)
      expect(viewNames()).toEqual([])
      expect(document.querySelector('[role=table]')).not.toBeNull()
    }
  })

  it('duplicate names upsert (one entry, newest snapshot)', () => {
    const storage = makeStorage()
    render(<ViewsHarness viewsCfg={{ storage: storageAdapter(storage) }} />)
    act(() => fireEvent.click(headers()[0]!)) // asc
    saveView('V')
    act(() => fireEvent.click(headers()[0]!)) // asc → desc
    saveView('V')
    const stored = lastSaved(storage)
    expect(stored).toHaveLength(1)
    expect(stored[0]!.snapshot.sort).toEqual({ key: 'name', direction: 'desc' })
  })

  it('an empty name never saves', () => {
    const storage = makeStorage()
    render(<ViewsHarness viewsCfg={{ storage: storageAdapter(storage) }} />)
    fireEvent.change(viewsSelect(), { target: { value: SAVE_ITEM } })
    const input = document.querySelector('[data-iris-views-save]') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Enter' }) // empty draft
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(viewNames()).toEqual([])
  })

  it('label formats the view names in the select', () => {
    const storage = makeStorage(JSON.stringify([{ name: 'Fav', snapshot: {} }]))
    render(<ViewsHarness viewsCfg={{ storage: storageAdapter(storage), label: (n) => `★ ${n}` }} />)
    const fav = Array.from(viewsSelect().options).find((o) => o.value === 'Fav')
    expect(fav?.textContent).toBe('★ Fav')
  })

  it('controlled activeKey: the prop drives the select; changes only notify', () => {
    const storage = makeStorage(
      JSON.stringify([
        { name: 'A', snapshot: {} },
        { name: 'B', snapshot: {} },
      ]),
    )
    const onActiveViewChange = vi.fn()
    render(
      <ViewsHarness
        viewsCfg={{ storage: storageAdapter(storage), activeKey: 'A' }}
        onActiveViewChange={onActiveViewChange}
      />,
    )
    expect(viewsSelect().value).toBe('A')
    fireEvent.change(viewsSelect(), { target: { value: 'B' } })
    expect(onActiveViewChange).toHaveBeenCalledWith('B')
    // Controlled: the parent never wrote the prop back → the select stays A.
    expect(viewsSelect().value).toBe('A')
  })

  it('pageSize in a view reproduces the mount-restore sequence (proxy)', async () => {
    const storage = makeStorage(JSON.stringify([{ name: 'Big', snapshot: { pageSize: 25 } }]))
    const query = vi.fn(async () => ({ rows: [], total: 0 }))
    const onPageChange = vi.fn()
    render(
      <ViewsHarness
        viewsCfg={{ storage: storageAdapter(storage) }}
        proxy={{ query, onPageChange }}
      />,
    )
    await act(async () => {}) // first autoLoad query settles (page 1, size 10)
    expect(query).toHaveBeenCalledTimes(1)
    fireEvent.change(viewsSelect(), { target: { value: 'Big' } })
    await act(async () => {})
    expect(onPageChange).toHaveBeenCalledWith(1, 25)
    expect(query).toHaveBeenCalledTimes(2)
    expect(query.mock.calls[1]?.[0]).toMatchObject({ page: 1, pageSize: 25 })
  })

  it('no views prop → no select and no storage access', () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn() })
    render(<IrisTable columns={baseColumns} data={rows} rowKey="id" />)
    expect(document.querySelector('[data-iris-table-views]')).toBeNull()
    expect(localStorage.getItem).not.toHaveBeenCalled()
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })
})
