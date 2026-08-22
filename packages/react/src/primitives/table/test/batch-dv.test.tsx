import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from '../Table'
import type {
  IrisTableColumn,
  IrisTableFilterValues,
  IrisTablePersistConfig,
  IrisTableSortState,
} from '../types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', 'http://localhost:3000/')
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  city: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', city: 'Paris', age: 25 },
  { id: 2, name: 'Alice', city: 'Berlin', age: 32 },
  { id: 3, name: 'Bob', city: 'Oslo', age: 28 },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'city', title: 'City', sortable: true },
  { key: 'age', title: 'Age', sortable: true, align: 'right' },
]

const DEFAULT_PERSIST_KEY = 'iris-table-state'

function makeStorage(seed?: string | null): {
  data: Map<string, string>
  getItem: Mock
  setItem: Mock
} {
  const data = new Map<string, string>()
  if (seed != null) data.set(DEFAULT_PERSIST_KEY, seed)
  return {
    data,
    getItem: vi.fn((k: string) => data.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => {
      data.set(k, v)
    }),
  }
}

/** Serialize a payload into the `_table` param using the SAME URLSearchParams
 * codec the table uses (the wire form a user's browser bar would hold). */
function urlWithTable(payload: unknown): string {
  const url = new URL('http://localhost:3000/')
  url.searchParams.set('_table', JSON.stringify(payload))
  url.searchParams.set('keep', '1')
  return url.search + url.hash
}

function currentTable(): unknown {
  const raw = new URLSearchParams(window.location.search).get('_table')
  return raw === null ? null : JSON.parse(raw)
}

function setLocation(url: string): void {
  window.history.replaceState(null, '', url)
}

/** Paste a different share link while the app is open (replaceState + the
 * `hashchange` event — the spec's mid-session restore channel). */
function pasteUrl(url: string): void {
  window.history.replaceState(null, '', url)
  act(() => {
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

interface HarnessProps {
  urlState?: boolean
  persist?: IrisTablePersistConfig
  multiSort?: boolean
  proxy?: { query: Mock; pageSize?: number; onPageChange?: Mock }
  onSortChange?: Mock
  onMultiSortChange?: Mock
  onFiltersChange?: Mock
  onFilterValuesChange?: Mock
  initialSort?: IrisTableSortState | null
  initialFilterValues?: IrisTableFilterValues
  initialFilters?: Record<string, string>
}

/** Fully CONTROLLED table: every URL-ownable piece is parent-owned through a
 * callback (the persistState/urlState convention — restore replays through the
 * callbacks, save serializes the current props). */
function ControlledHarness(props: HarnessProps): React.ReactElement {
  const {
    urlState = false,
    persist,
    multiSort = false,
    proxy,
    onSortChange,
    onMultiSortChange,
    onFiltersChange,
    onFilterValuesChange,
    initialSort = null,
    initialFilterValues = {},
    initialFilters = {},
  } = props
  const [sort, setSort] = React.useState<IrisTableSortState | null>(initialSort)
  const [multi, setMulti] = React.useState<IrisTableSortState[]>([])
  const [filters, setFilters] = React.useState<Record<string, string>>(initialFilters)
  const [filterValues, setFilterValues] = React.useState<IrisTableFilterValues>(initialFilterValues)
  const [pageSize, setPageSize] = React.useState(proxy?.pageSize ?? 10)
  return (
    <IrisTable
      columns={columns}
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
      persistState={persist}
      urlState={urlState}
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

function headers(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-table-header]'))
}

describe('@iris-ui-kit/react IrisTable urlState (batch DV, iris 独有)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', 'http://localhost:3000/')
  })

  it('encodes sort into ONE _table param and preserves other params', () => {
    setLocation('?tab=1&keep=yes')
    render(<ControlledHarness urlState onSortChange={vi.fn()} />)
    act(() => fireEvent.click(headers()[0]!)) // name asc
    const payload = currentTable()
    expect(payload).toEqual({ v: 1, sort: { key: 'name', direction: 'asc' } })
    const search = new URLSearchParams(window.location.search)
    expect(search.get('tab')).toBe('1')
    expect(search.get('keep')).toBe('yes')
  })

  it('encodes filters and filterValues when the parent owns them', () => {
    render(
      <ControlledHarness
        urlState
        onFiltersChange={vi.fn()}
        onFilterValuesChange={vi.fn()}
        initialFilters={{ name: 'ali' }}
        initialFilterValues={{ city: ['Paris', 'Oslo'] }}
      />,
    )
    act(() => fireEvent.click(headers()[1]!)) // sort rides the same channel set
    const payload = currentTable()
    expect(payload).toMatchObject({
      filters: { name: 'ali' },
      filterValues: { city: ['Paris', 'Oslo'] },
    })
  })

  it('encodes proxy page+pageSize and drops inactive sort (empty removes _table)', async () => {
    const onPageChange = vi.fn()
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 25 }))
    render(<ControlledHarness urlState proxy={{ query, onPageChange }} />)
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    expect(currentTable()).toBeNull() // page 1 / default size → nothing to encode
    act(() => fireEvent.click(document.querySelector('[data-iris-pagination-item="next"]')!))
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    // page moved; pageSize stayed at the proxy default (10) → omitted (the
    // default is the URL's omission threshold — restore reproduces it anyway).
    expect(currentTable()).toEqual({ v: 1, page: 2 })
  })

  it('restores sort from the URL on mount through the change callback', () => {
    setLocation(urlWithTable({ v: 1, sort: { key: 'name', direction: 'desc' } }))
    const onSortChange = vi.fn()
    render(<ControlledHarness urlState onSortChange={onSortChange} />)
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'desc' })
    // The controlled parent applies it back — the column header shows it.
    expect(document.querySelector('[aria-sort="descending"]')).not.toBeNull()
  })

  it('restores proxy page/pageSize PRE-QUERY — exactly ONE request', async () => {
    setLocation(
      urlWithTable({ v: 1, page: 3, pageSize: 20, sort: { key: 'age', direction: 'asc' } }),
    )
    const onPageChange = vi.fn()
    const onSortChange = vi.fn()
    const query = vi.fn(async ({ page, pageSize }: { page: number; pageSize: number }) => ({
      rows: [rows[page - 1]!],
      total: 60,
      pageSize,
    }))
    render(
      <ControlledHarness urlState proxy={{ query, onPageChange }} onSortChange={onSortChange} />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    // The ONE query carries the deep-linked page/size. Sort is NOT part of the
    // first request — it restores through onSortChange right after (the
    // pre-query injection is page/pageSize only, the persistState precedent);
    // with remote sort off no second query follows, exactly one total.
    expect(query).toHaveBeenCalledWith(expect.objectContaining({ page: 3, pageSize: 20 }))
    expect(query).toHaveBeenCalledTimes(1)
    expect(onPageChange).toHaveBeenCalledWith(3, 20)
    expect(onSortChange).toHaveBeenCalledWith({ key: 'age', direction: 'asc' })
    // The restored sort lands client-side (aria-sort on the age column).
    expect(document.querySelector('[aria-sort="ascending"]')).not.toBeNull()
  })

  it('restores mid-session via hashchange (share link pasted while open)', () => {
    const onSortChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    render(
      <ControlledHarness
        urlState
        onSortChange={onSortChange}
        onFilterValuesChange={onFilterValuesChange}
      />,
    )
    pasteUrl(urlWithTable({ v: 1, sort: { key: 'city', direction: 'desc' } }))
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'city', direction: 'desc' })
    pasteUrl(urlWithTable({ v: 1, filterValues: { city: ['Oslo'] } }))
    expect(onFilterValuesChange).toHaveBeenLastCalledWith({ city: ['Oslo'] })
  })

  it('is idempotent: an unchanged payload is a no-op (no re-apply)', () => {
    setLocation(urlWithTable({ v: 1, sort: { key: 'name', direction: 'asc' } }))
    const onSortChange = vi.fn()
    render(<ControlledHarness urlState onSortChange={onSortChange} />)
    expect(onSortChange).toHaveBeenCalledTimes(1)
    pasteUrl(urlWithTable({ v: 1, sort: { key: 'name', direction: 'asc' } }))
    expect(onSortChange).toHaveBeenCalledTimes(1)
  })

  it('is whole-state fail-closed: corrupt / wrong-version / wrong types restore nothing', () => {
    for (const bad of [
      'not-json',
      '{"v":2,"sort":{"key":"name","direction":"asc"}}',
      '{"v":1,"sort":"asc"}',
      '{"v":1,"sorts":[{"key":"name"}]}',
      '{"v":1,"filters":[1,2]}',
      '{"v":1,"pageSize":-3}',
    ]) {
      cleanup()
      setLocation(`?_table=${encodeURIComponent(bad)}`)
      const onSortChange = vi.fn()
      render(<ControlledHarness urlState onSortChange={onSortChange} />)
      expect(onSortChange, `payload ${bad}`).not.toHaveBeenCalled()
    }
  })

  it('prop off is fully inert: no URL read, no URL write, no restore', () => {
    setLocation(urlWithTable({ v: 1, sort: { key: 'name', direction: 'asc' } }))
    const onSortChange = vi.fn()
    render(<ControlledHarness onSortChange={onSortChange} />)
    expect(onSortChange).not.toHaveBeenCalled()
    const before = window.location.href
    act(() => fireEvent.click(headers()[0]!)) // would encode sort if urlState were on
    expect(window.location.href).toBe(before)
  })

  it('round-trips the multiSort channel through onMultiSortChange', () => {
    setLocation(
      urlWithTable({
        v: 1,
        sorts: [
          { key: 'name', direction: 'asc' },
          { key: 'age', direction: 'desc' },
        ],
      }),
    )
    const onMultiSortChange = vi.fn()
    render(<ControlledHarness urlState multiSort onMultiSortChange={onMultiSortChange} />)
    expect(onMultiSortChange).toHaveBeenCalledWith([
      { key: 'name', direction: 'asc' },
      { key: 'age', direction: 'desc' },
    ])
  })

  it('share-link round-trip keeps Unicode + reserved chars byte-exact', async () => {
    const onFilterValuesChange = vi.fn()
    const onSortChange = vi.fn()
    const original = new URL('http://localhost:3000/')
    original.searchParams.set(
      '_table',
      JSON.stringify({ v: 1, sort: { key: 'name', direction: 'asc' } }),
    )
    setLocation(original.search)
    render(
      <ControlledHarness
        urlState
        onSortChange={onSortChange}
        onFilterValuesChange={onFilterValuesChange}
      />,
    )
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'asc' })
    // The writer's URLSearchParams codec round-trips through the paste channel.
    const share = urlWithTable({
      v: 1,
      sort: { key: 'name', direction: 'asc' },
      filterValues: { city: ['北京, 上海', 'a&b=c?d#e', "don't"] },
    })
    pasteUrl(share)
    expect(onFilterValuesChange).toHaveBeenLastCalledWith({
      city: ['北京, 上海', 'a&b=c?d#e', "don't"],
    })
    expect(currentTable()).toEqual({
      v: 1,
      sort: { key: 'name', direction: 'asc' },
      filterValues: { city: ['北京, 上海', 'a&b=c?d#e', "don't"] },
    })
  })

  it('an uncontrolled table never touches the URL: a seeded deep link survives mount AND interaction', () => {
    // No callbacks = no owning channel — the seed must survive mount (the
    // review gate defect: the pre-fix writer serialized an empty payload to
    // null and DELETED `_table` before the first post-mount render) and stay
    // untouched across an internal uncontrolled sort flip.
    setLocation(urlWithTable({ v: 1, sort: { key: 'name', direction: 'asc' } }))
    const before = window.location.search // pre-render captured, not post
    render(<IrisTable columns={columns} data={rows} rowKey="id" urlState />)
    expect(window.location.search).toBe(before) // seed survived the mount write
    act(() => fireEvent.click(headers()[0]!)) // internal uncontrolled sort flip
    expect(window.location.search).toBe(before)
  })

  it('URL wins over persistState on mount conflicts', () => {
    const storage = makeStorage(
      '{"sort":{"key":"name","direction":"desc"},"filterValues":{"city":["Oslo"]}}',
    )
    setLocation(urlWithTable({ v: 1, sort: { key: 'age', direction: 'asc' } }))
    const onSortChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    render(
      <ControlledHarness
        urlState
        persist={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
        onSortChange={onSortChange}
        onFilterValuesChange={onFilterValuesChange}
      />,
    )
    // URL sort (asc/age) lands LAST — it wins the conflict.
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'age', direction: 'asc' })
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'desc' })
    // Non-conflicting pieces still restore from storage.
    expect(onFilterValuesChange).toHaveBeenCalledWith({ city: ['Oslo'] })
    expect(document.querySelector('[aria-sort="ascending"]')).not.toBeNull()
  })
})
