import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from '../Table'
import type {
  IrisTableColumn,
  IrisTableFilterValues,
  IrisTableHandle,
  IrisTableSortState,
} from '../types'

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

interface HarnessProps {
  detail?: boolean
  multiSort?: boolean
  proxy?: { query: Mock; pageSize?: number; onPageChange?: Mock }
  initialQuery?: string
  initialOrder?: string[]
  onSortChange?: Mock
  onMultiSortChange?: Mock
  onFiltersChange?: Mock
  onFilterValuesChange?: Mock
  onColumnVisibilityChange?: Mock
  onColumnOrderChange?: Mock
  onColumnWidthsChange?: Mock
  onExpandedRowsChange?: Mock
  onQueryChange?: Mock
  tableRef: { current: IrisTableHandle<Row> | null }
}

/** Fully CONTROLLED harness: every piece is parent-owned through a callback
 * (the table itself holds zero state) + detail + proxy + query — the union of
 * all 9 spec channels. `tableRef` is captured on mount by the table's effect,
 * so tests call exportStateJson/importStateJson through it. */
function ControlledHarness(props: HarnessProps): React.ReactElement {
  const {
    detail = false,
    multiSort = false,
    proxy,
    initialQuery,
    initialOrder,
    tableRef,
    onSortChange,
    onMultiSortChange,
    onFiltersChange,
    onFilterValuesChange,
    onColumnVisibilityChange,
    onColumnOrderChange,
    onColumnWidthsChange,
    onExpandedRowsChange,
    onQueryChange,
  } = props
  const [sort, setSort] = React.useState<IrisTableSortState | null>(null)
  const [multi, setMulti] = React.useState<IrisTableSortState[]>([])
  const [filters, setFilters] = React.useState<Record<string, string>>({})
  const [filterValues, setFilterValues] = React.useState<IrisTableFilterValues>({})
  const [visibility, setVisibility] = React.useState<Record<string, boolean>>({})
  const [order, setOrder] = React.useState<string[] | undefined>(initialOrder)
  const [widths, setWidths] = React.useState<Record<string, number>>({})
  const [pageSize, setPageSize] = React.useState(proxy?.pageSize ?? 10)
  const [query, setQuery] = React.useState<string | undefined>(initialQuery)
  return (
    <IrisTable
      columns={baseColumns}
      data={rows}
      rowKey="id"
      tableRef={tableRef}
      {...(detail ? { renderDetail: (r: Row): React.ReactNode => <div>detail-{r.id}</div> } : {})}
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
      query={query}
      onQueryChange={(next) => {
        setQuery(next)
        onQueryChange?.(next)
      }}
      onExpandedRowsChange={onExpandedRowsChange}
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

/** The sortable column header for `key` — detail/seq columns render
 * non-sortable headers (attribute `""`) BEFORE the data columns, so never
 * assume headers()[0]; the data header carries `data-iris-table-header={key}`. */
function headerByKey(key: string): HTMLElement {
  const el = document.querySelector(`[data-iris-table-header="${key}"]`)
  if (!el) throw new Error(`header ${key} not found`)
  return el as HTMLElement
}

function toggle(rowId: string | number): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-expand-toggle]`,
  ) as HTMLElement
}

function detail(rowId: string | number): HTMLElement | null {
  return document.querySelector(`[data-iris-table-row-detail="${rowId}"]`)
}

/** Proxy query that resolves with the LOCAL rows — proxy-mode tests need real
 * rows rendered for DOM assertions (an empty page leaves no rows). */
function rowsQuery(): Mock {
  return vi.fn(async () => ({ rows, total: rows.length }))
}

/** All 9 spec blocks, valid values for the fully-owned harness. */
const FULL_STATE = JSON.stringify({
  sort: { key: 'name', direction: 'desc' },
  filters: { name: 'ali' },
  filterValues: { age: ['25'] },
  columnVisibility: { age: false },
  columnOrder: ['age', 'name'],
  columnWidths: { name: 120, age: 80 },
  pageSize: 25,
  expandedKeys: ['2'],
  query: 'age > 25',
})

describe('@iris-ui-kit/react IrisTable state export/import (batch BZ, iris 独有)', () => {
  it('export carries all 9 spec blocks when the owning callbacks exist', async () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    render(
      <ControlledHarness
        detail
        proxy={{ query: rowsQuery() }}
        initialQuery="age > 25"
        initialOrder={['age', 'name']}
        tableRef={ref}
        onSortChange={vi.fn()}
        onFiltersChange={vi.fn()}
        onFilterValuesChange={vi.fn()}
        onColumnVisibilityChange={vi.fn()}
        onColumnOrderChange={vi.fn()}
        onColumnWidthsChange={vi.fn()}
        onExpandedRowsChange={vi.fn()}
      />,
    )
    await act(async () => {}) // first autoLoad query settles → rows render
    act(() => fireEvent.click(headerByKey('name'))) // name asc
    act(() => fireEvent.click(toggle(2))) // expandedKeys ['2']
    const parsed = JSON.parse(ref.current!.exportStateJson()) as Record<string, unknown>
    expect(Object.keys(parsed).sort()).toEqual([
      'columnOrder',
      'columnVisibility',
      'columnWidths',
      'expandedKeys',
      'filterValues',
      'filters',
      'pageSize',
      'query',
      'sort',
    ])
    expect(parsed.sort).toEqual({ key: 'name', direction: 'asc' })
    expect(parsed.filters).toEqual({})
    expect(parsed.filterValues).toEqual({})
    expect(parsed.columnVisibility).toEqual({})
    expect(parsed.columnOrder).toEqual(['age', 'name'])
    expect(parsed.columnWidths).toEqual({})
    expect(parsed.pageSize).toBe(10)
    expect(parsed.expandedKeys).toEqual(['2'])
    expect(parsed.query).toBe('age > 25')
  })

  it('export gates pieces without owning callbacks (lazy collector)', () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        onSortChange={vi.fn()}
      />,
    )
    const parsed = JSON.parse(ref.current!.exportStateJson()) as Record<string, unknown>
    // Only sort (callback present, null value); everything else lacks a
    // callback / proxy / expandable mode / query value.
    expect(Object.keys(parsed)).toEqual(['sort'])
    expect(parsed.sort).toBeNull()
  })

  it('a bare table exports an empty object (no callbacks, no pieces)', () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    render(<IrisTable columns={baseColumns} data={rows} rowKey="id" tableRef={ref} />)
    expect(ref.current!.exportStateJson()).toBe('{}')
  })

  it('import applies every piece through the owning callbacks (original values)', async () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    const proxyQuery = rowsQuery()
    const onSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const onColumnVisibilityChange = vi.fn()
    const onColumnOrderChange = vi.fn()
    const onColumnWidthsChange = vi.fn()
    const onExpandedRowsChange = vi.fn()
    const onQueryChange = vi.fn()
    const onPageChange = vi.fn()
    render(
      <ControlledHarness
        detail
        proxy={{ query: proxyQuery, onPageChange }}
        tableRef={ref}
        onSortChange={onSortChange}
        onFiltersChange={onFiltersChange}
        onFilterValuesChange={onFilterValuesChange}
        onColumnVisibilityChange={onColumnVisibilityChange}
        onColumnOrderChange={onColumnOrderChange}
        onColumnWidthsChange={onColumnWidthsChange}
        onExpandedRowsChange={onExpandedRowsChange}
        onQueryChange={onQueryChange}
      />,
    )
    await act(async () => {}) // mount autoLoad query settles
    let ok = false
    act(() => {
      ok = ref.current!.importStateJson(FULL_STATE)
    })
    await act(async () => {})
    expect(ok).toBe(true)
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'desc' })
    expect(onFiltersChange).toHaveBeenCalledWith({ name: 'ali' })
    expect(onFilterValuesChange).toHaveBeenCalledWith({ age: ['25'] })
    expect(onColumnVisibilityChange).toHaveBeenCalledWith({ age: false })
    expect(onColumnOrderChange).toHaveBeenCalledWith(['age', 'name'])
    expect(onColumnWidthsChange).toHaveBeenCalledWith({ name: 120, age: 80 })
    expect(onExpandedRowsChange).toHaveBeenCalledWith(['2'])
    expect(onQueryChange).toHaveBeenCalledWith('age > 25')
    expect(onPageChange).toHaveBeenCalledWith(1, 25)
    expect(detail(2)).not.toBeNull()
    expect(detail(1)).toBeNull() // full-set replace — row 1 stays collapsed
  })

  it('query restores FIRST (before any other piece)', () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    const order: string[] = []
    render(
      <ControlledHarness
        tableRef={ref}
        onSortChange={vi.fn(() => order.push('sort'))}
        onQueryChange={vi.fn(() => order.push('query'))}
      />,
    )
    act(() => {
      ref.current!.importStateJson(
        JSON.stringify({ query: 'age > 25', sort: { key: 'name', direction: 'asc' } }),
      )
    })
    expect(order).toEqual(['query', 'sort'])
  })

  it('import pageSize reproduces onPageChange(1, size) + exactly one request', async () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    const proxyQuery = rowsQuery()
    const onPageChange = vi.fn()
    render(<ControlledHarness proxy={{ query: proxyQuery, onPageChange }} tableRef={ref} />)
    await act(async () => {}) // first autoLoad query settles (page 1, size 10)
    expect(proxyQuery).toHaveBeenCalledTimes(1)
    act(() => {
      ref.current!.importStateJson(JSON.stringify({ pageSize: 25 }))
    })
    await act(async () => {})
    expect(onPageChange).toHaveBeenCalledWith(1, 25)
    expect(proxyQuery).toHaveBeenCalledTimes(2)
    expect(proxyQuery.mock.calls[1]?.[0]).toMatchObject({ page: 1, pageSize: 25 })
  })

  it('import expandedKeys replaces the whole set and expands the DOM', () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    const onChange = vi.fn()
    render(<ControlledHarness detail tableRef={ref} onExpandedRowsChange={onChange} />)
    // Expand rows 1 and 2 through the UI first.
    act(() => fireEvent.click(toggle(1)))
    act(() => fireEvent.click(toggle(2)))
    expect(detail(1)).not.toBeNull()
    expect(detail(2)).not.toBeNull()
    onChange.mockClear()
    act(() => {
      expect(ref.current!.importStateJson(JSON.stringify({ expandedKeys: ['2'] }))).toBe(true)
    })
    expect(onChange).toHaveBeenCalledWith(['2'])
    expect(detail(2)).not.toBeNull()
    expect(detail(1)).toBeNull() // full-set replacement — row 1 collapses
  })

  it('export → import → export is byte-identical (round-trip)', async () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    render(
      <ControlledHarness
        detail
        proxy={{ query: rowsQuery() }}
        initialQuery="age > 25"
        tableRef={ref}
        onSortChange={vi.fn()}
        onFiltersChange={vi.fn()}
        onFilterValuesChange={vi.fn()}
        onColumnVisibilityChange={vi.fn()}
        onColumnOrderChange={vi.fn()}
        onColumnWidthsChange={vi.fn()}
        onExpandedRowsChange={vi.fn()}
      />,
    )
    await act(async () => {}) // first autoLoad query settles → rows render
    act(() => fireEvent.click(headerByKey('name')))
    act(() => fireEvent.click(toggle(2)))
    const first = ref.current!.exportStateJson()
    let ok = false
    act(() => {
      ok = ref.current!.importStateJson(first)
    })
    await act(async () => {})
    expect(ok).toBe(true)
    expect(ref.current!.exportStateJson()).toBe(first)
  })

  it('invalid JSON / non-object values → false with nothing applied', () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    const onSortChange = vi.fn()
    const onQueryChange = vi.fn()
    const onExpandedRowsChange = vi.fn()
    render(
      <ControlledHarness
        detail
        tableRef={ref}
        onSortChange={onSortChange}
        onQueryChange={onQueryChange}
        onExpandedRowsChange={onExpandedRowsChange}
      />,
    )
    for (const bad of ['{oops: not json', '', 'null', '[]', '42']) {
      let ok = true
      act(() => {
        ok = ref.current!.importStateJson(bad)
      })
      expect(ok).toBe(false)
    }
    expect(onSortChange).not.toHaveBeenCalled()
    expect(onQueryChange).not.toHaveBeenCalled()
    expect(onExpandedRowsChange).not.toHaveBeenCalled()
    expect(detail(1)).toBeNull()
    expect(detail(2)).toBeNull()
  })

  it('valid JSON with ineligible pieces applies lazily and still returns true', () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    const onFiltersChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        onFiltersChange={onFiltersChange}
      />,
    )
    let ok = false
    act(() => {
      ok = ref.current!.importStateJson(
        JSON.stringify({
          sort: { key: 'name', direction: 'asc' }, // no onSortChange → skipped
          query: 'age > 25', // no onQueryChange → skipped
          filters: { name: 'ali' },
        }),
      )
    })
    expect(ok).toBe(true)
    expect(onFiltersChange).toHaveBeenCalledWith({ name: 'ali' })
  })

  it('corrupted piece types are skipped lazily (type guards), still true', () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    const onSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onColumnOrderChange = vi.fn()
    render(
      <ControlledHarness
        tableRef={ref}
        onSortChange={onSortChange}
        onFiltersChange={onFiltersChange}
        onColumnOrderChange={onColumnOrderChange}
      />,
    )
    let ok = false
    act(() => {
      ok = ref.current!.importStateJson(
        JSON.stringify({
          sort: 'not-an-object',
          columnOrder: 'nope',
          filters: { name: 'ali' },
        }),
      )
    })
    expect(ok).toBe(true)
    expect(onSortChange).not.toHaveBeenCalled()
    expect(onColumnOrderChange).not.toHaveBeenCalled()
    expect(onFiltersChange).toHaveBeenCalledWith({ name: 'ali' })
  })

  it('multiSortState imports as a superset but is never exported (spec exclusion)', () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    const onMultiSortChange = vi.fn()
    render(<ControlledHarness multiSort tableRef={ref} onMultiSortChange={onMultiSortChange} />)
    act(() => {
      expect(
        ref.current!.importStateJson(
          JSON.stringify({ multiSortState: [{ key: 'name', direction: 'asc' }] }),
        ),
      ).toBe(true)
    })
    expect(onMultiSortChange).toHaveBeenCalledWith([{ key: 'name', direction: 'asc' }])
    const parsed = JSON.parse(ref.current!.exportStateJson()) as Record<string, unknown>
    expect((parsed as { multiSortState?: unknown }).multiSortState).toBeUndefined()
  })
})
