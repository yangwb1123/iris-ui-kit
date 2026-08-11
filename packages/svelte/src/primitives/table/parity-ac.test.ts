import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, waitFor, cleanup } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'

afterEach(cleanup)

const columns = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true },
  { key: 'city', title: 'City' },
]

const data = [
  { id: 1, name: 'Alice', age: 30, city: 'NYC' },
  { id: 2, name: 'Bob', age: 25, city: 'LA' },
  { id: 3, name: 'Charlie', age: 35, city: 'SF' },
]

type ProxyParams = {
  page: number
  pageSize: number
  sort: { key: string; direction: string } | null
  sorts?: Array<{ key: string; direction: string }>
  filters: Record<string, string>
}

function pageQuery(rows = data) {
  return vi.fn(async (params: ProxyParams) => {
    const start = (params.page - 1) * params.pageSize
    return { rows: rows.slice(start, start + params.pageSize), total: rows.length }
  })
}

function bodyRows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll('[data-iris-table-body] [data-iris-table-row]')]
}

describe('IrisTable batch AC — columnVisibility / filters / seq', () => {
  it('hides columns listed in columnVisibility', () => {
    const { container } = render(IrisTable, {
      props: { columns, data, columnVisibility: { age: false } },
    })
    const headers = [
      ...container.querySelectorAll('[data-iris-table-header-row] [role="columnheader"]'),
    ]
    expect(headers.map((h) => h.getAttribute('data-iris-table-header'))).toEqual(['name', 'city'])
    const cells = bodyRows(container)[0]!.querySelectorAll('[role="cell"]')
    expect(cells.length).toBe(2)
    expect(cells[0]!.getAttribute('data-iris-table-cell')).toBe('name')
    expect(cells[1]!.getAttribute('data-iris-table-cell')).toBe('city')
  })

  it('filters rows by case-insensitive substring (empty entries ignored)', () => {
    const { container } = render(IrisTable, {
      props: { columns, data, filters: { name: 'aLi' } },
    })
    const rows = bodyRows(container)
    expect(rows.length).toBe(1)
    expect(rows[0]!.textContent).toContain('Alice')
  })

  it('honors a column filterMethod override', () => {
    const exact = vi.fn(
      (value: unknown, _row: Record<string, unknown>, filterValue: string) =>
        String(value) === filterValue,
    )
    const cols = [{ key: 'name', title: 'Name', filterMethod: exact }]
    const { container } = render(IrisTable, {
      props: {
        columns: cols,
        data: [...data, { id: 4, name: 'Al', age: 20, city: 'PDX' }],
        filters: { name: 'Al' },
      },
    })
    const rows = bodyRows(container)
    expect(rows.length).toBe(1)
    expect(rows[0]!.textContent).toContain('Al')
  })

  it('renders a sequence column with seqStartIndex offset', () => {
    const { container } = render(IrisTable, {
      props: { columns, data, seq: true, seqStartIndex: 10 },
    })
    expect(container.querySelector('[data-iris-table-header="__seq"]')).not.toBeNull()
    const seqs = [...container.querySelectorAll('[data-iris-table-cell="__seq"]')]
    expect(seqs.map((s) => s.textContent?.trim())).toEqual(['10', '11', '12'])
  })

  it('seq composes with multi selection tracks', () => {
    const { container } = render(IrisTable, {
      props: { columns, data, seq: true, selectable: 'multi' },
    })
    const row = bodyRows(container)[0]!
    const cells = [...row.querySelectorAll('[role="cell"]')]
    expect(cells[0]!.getAttribute('data-iris-table-cell')).toBe('__seq')
    expect(cells[0]!.textContent?.trim()).toBe('1')
    expect(cells[1]!.querySelector('input[type="checkbox"]')).not.toBeNull()
    expect(cells[2]!.getAttribute('data-iris-table-cell')).toBe('name')
  })
})

describe('IrisTable batch AC — spanMethod', () => {
  const spanMethod = (params: { rowIndex: number; columnIndex: number }) => {
    if (params.rowIndex === 0 && params.columnIndex === 0) return { colspan: 2 }
    if (params.rowIndex === 1 && params.columnIndex === 1) return { rowspan: 2 }
    return null
  }

  it('merges cells via the occupied-set plan (colspan + rowspan)', () => {
    const { container } = render(IrisTable, { props: { columns, data, spanMethod } })
    const rows = bodyRows(container)
    expect(rows.length).toBe(3)
    // Row 0: name spans 2 tracks, age is covered → 2 cells.
    const row0Cells = [...rows[0]!.querySelectorAll('[role="cell"]')]
    expect(row0Cells.length).toBe(2)
    expect(row0Cells[0]!.getAttribute('style')).toContain('grid-column-end: span 2')
    expect(row0Cells[0]!.textContent).toContain('Alice')
    // Row 1: full 3 cells (age is the rowspan origin).
    expect(rows[1]!.querySelectorAll('[role="cell"]').length).toBe(3)
    // Row 2: age covered by row 1's rowspan → 2 cells.
    const row2Cells = [...rows[2]!.querySelectorAll('[role="cell"]')]
    expect(row2Cells.length).toBe(2)
    expect(row2Cells[0]!.textContent).toContain('Charlie')
    expect(row2Cells[1]!.textContent).toContain('SF')
  })
})

describe('IrisTable batch AC — proxyConfig', () => {
  it('shows loading until the query resolves, then rows + total', async () => {
    let resolveQuery: (v: { rows: Array<Record<string, unknown>>; total: number }) => void
    const query = vi.fn(
      () =>
        new Promise<{ rows: Array<Record<string, unknown>>; total: number }>((res) => {
          resolveQuery = res
        }),
    )
    const { container } = render(IrisTable, {
      props: {
        columns,
        proxyConfig: { query, pageSize: 10 },
        pagerConfig: { showTotal: true },
      },
    })
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-row="loading"]')).not.toBeNull()
    })
    resolveQuery!({ rows: data, total: data.length })
    await waitFor(() => {
      expect(bodyRows(container).length).toBe(3)
    })
    expect(container.querySelector('[data-iris-table-total]')?.textContent).toBe('Total 3')
    expect(container.querySelector('[data-iris-table-pager]')).not.toBeNull()
  })

  it('re-queries with the new page on pager change', async () => {
    const four = [...data, { id: 4, name: 'Dora', age: 40, city: 'PDX' }]
    const query = pageQuery(four)
    const onPageChange = vi.fn()
    const { container } = render(IrisTable, {
      props: {
        columns,
        proxyConfig: { query, pageSize: 2, onPageChange },
      },
    })
    await waitFor(() => {
      expect(bodyRows(container).map((r) => r.textContent)).toEqual(
        expect.arrayContaining([expect.stringContaining('Alice'), expect.stringContaining('Bob')]),
      )
    })
    await fireEvent.click(container.querySelector('[data-iris-pagination-item="next"]')!)
    await waitFor(() => {
      expect(bodyRows(container).map((r) => r.textContent)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Charlie'),
          expect.stringContaining('Dora'),
        ]),
      )
    })
    const lastCall = query.mock.calls[query.mock.calls.length - 1]![0] as ProxyParams
    expect(lastCall.page).toBe(2)
    expect(onPageChange).toHaveBeenCalledWith(2, 2)
  })

  it('autoLoad false skips the initial query; toolbar refresh re-queries', async () => {
    const query = pageQuery()
    const { container } = render(IrisTable, {
      props: {
        columns,
        proxyConfig: { query, autoLoad: false },
        toolbar: { onRefresh: vi.fn() },
      },
    })
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-row="empty"]')).not.toBeNull()
    })
    expect(query).not.toHaveBeenCalled()
    await fireEvent.click(container.querySelector('[data-iris-table-toolbar-refresh]')!)
    await waitFor(() => {
      expect(query).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(bodyRows(container).length).toBe(3)
    })
  })

  it('remoteSort re-queries with the active sort', async () => {
    const query = pageQuery()
    const { container } = render(IrisTable, {
      props: { columns, proxyConfig: { query, remoteSort: true } },
    })
    await waitFor(() => {
      expect(query).toHaveBeenCalled()
    })
    await fireEvent.click(container.querySelector('[data-iris-table-header="name"]')!)
    await waitFor(() => {
      const last = query.mock.calls[query.mock.calls.length - 1]![0] as ProxyParams
      expect(last.sort).toEqual({ key: 'name', direction: 'asc' })
    })
  })

  it('keeps local edits until the next refetch replaces the page', async () => {
    const editable = [
      { key: 'name', title: 'Name', editable: true },
      { key: 'age', title: 'Age' },
    ]
    const query = pageQuery()
    const onCellEdit = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns: editable, proxyConfig: { query }, onCellEdit },
    })
    await waitFor(() => {
      expect(bodyRows(container).length).toBe(3)
    })
    const nameCell = bodyRows(container)[0]!.querySelector('[data-iris-table-cell="name"]')!
    await fireEvent.dblClick(nameCell)
    await fireEvent.input(container.querySelector('[data-iris-table-editor]')!, {
      target: { value: 'Zed' },
    })
    await fireEvent.keyDown(container.querySelector('[data-iris-table-editor]')!, { key: 'Enter' })
    await waitFor(() => {
      expect(bodyRows(container)[0]!.textContent).toContain('Zed')
    })
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    // No refetch happened — only the initial autoLoad query.
    expect(query).toHaveBeenCalledTimes(1)
  })
})

describe('IrisTable batch AC — multiSort', () => {
  const multiData = [
    { id: 1, name: 'Alice', age: 40 },
    { id: 2, name: 'Bob', age: 30 },
    { id: 3, name: 'Alice', age: 30 },
    { id: 4, name: 'Bob', age: 25 },
  ]
  const sortCols = [
    { key: 'name', title: 'Name', sortable: true },
    { key: 'age', title: 'Age', sortable: true },
  ]

  it('appends, cycles and removes columns in click order with the chained comparator', async () => {
    const { container } = render(IrisTable, {
      props: { columns: sortCols, data: multiData, multiSort: true },
    })
    const names = () =>
      bodyRows(container).map((r) =>
        r.querySelector('[data-iris-table-cell="name"]')!.textContent!.trim(),
      )

    const click = (key: string) =>
      fireEvent.click(container.querySelector(`[data-iris-table-header="${key}"]`)!)
    const expectOrder = async (key: string, order: string[]) => {
      await click(key)
      expect(names()).toEqual(order)
    }

    // age asc
    await expectOrder('age', ['Bob', 'Bob', 'Alice', 'Alice'])
    // append name asc (secondary): the 30-tie resolves by name asc
    await expectOrder('name', ['Bob', 'Alice', 'Bob', 'Alice'])
    // name cycles to desc: the 30-tie now resolves Bob first
    await expectOrder('name', ['Bob', 'Bob', 'Alice', 'Alice'])
    // age cycles to desc
    await expectOrder('age', ['Alice', 'Bob', 'Alice', 'Bob'])
    // age REMOVED → name desc only
    await expectOrder('age', ['Bob', 'Bob', 'Alice', 'Alice'])
    // name REMOVED → original (unsorted) order
    await expectOrder('name', ['Alice', 'Bob', 'Alice', 'Bob'])
    // re-clicking name APPENDS fresh asc (proves the list was emptied)
    await expectOrder('name', ['Alice', 'Alice', 'Bob', 'Bob'])
  })

  it('shows click-order sequence badges on non-primary sort columns', async () => {
    const { container } = render(IrisTable, {
      props: { columns: sortCols, data: multiData, multiSort: true },
    })
    await fireEvent.click(container.querySelector('[data-iris-table-header="age"]')!)
    await fireEvent.click(container.querySelector('[data-iris-table-header="name"]')!)
    const badges = [...container.querySelectorAll('[data-iris-sort-seq]')]
    expect(badges.length).toBe(1)
    expect(badges[0]!.textContent?.trim()).toBe('2')
    // aria-sort reflects the multi state per column.
    expect(
      container.querySelector('[data-iris-table-header="age"]')!.getAttribute('aria-sort'),
    ).toBe('ascending')
    expect(
      container.querySelector('[data-iris-table-header="name"]')!.getAttribute('aria-sort'),
    ).toBe('ascending')
  })

  it('remoteSort multi mode passes the full sorts list to the query', async () => {
    const query = pageQuery()
    const { container } = render(IrisTable, {
      props: { columns: sortCols, proxyConfig: { query, remoteSort: true }, multiSort: true },
    })
    await waitFor(() => {
      expect(query).toHaveBeenCalled()
    })
    await fireEvent.click(container.querySelector('[data-iris-table-header="age"]')!)
    await fireEvent.click(container.querySelector('[data-iris-table-header="name"]')!)
    await waitFor(() => {
      const last = query.mock.calls[query.mock.calls.length - 1]![0] as ProxyParams
      expect(last.sorts).toEqual([
        { key: 'age', direction: 'asc' },
        { key: 'name', direction: 'asc' },
      ])
    })
  })
})

describe('IrisTable batch AC — formConfig', () => {
  const formFields = [{ key: 'name', label: 'Name' }]

  it('local mode: submit filters rows, reset restores them', async () => {
    const onSearch = vi.fn()
    const onReset = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns, data, formConfig: { fields: formFields, onSearch, onReset } },
    })
    const input = container.querySelector('[data-iris-table-form-field="name"] input')!
    await fireEvent.input(input, { target: { value: 'Ali' } })
    await fireEvent.click(container.querySelector('[data-iris-table-form-submit]')!)
    await waitFor(() => {
      expect(bodyRows(container).length).toBe(1)
    })
    expect(bodyRows(container)[0]!.textContent).toContain('Alice')
    expect(onSearch).toHaveBeenCalledWith({ name: 'Ali' })
    await fireEvent.click(container.querySelector('[data-iris-table-form-reset]')!)
    await waitFor(() => {
      expect(bodyRows(container).length).toBe(3)
    })
    expect(onReset).toHaveBeenCalledWith({})
  })

  it('proxy mode: submit re-queries with merged filters and page 1', async () => {
    const query = pageQuery()
    const { container } = render(IrisTable, {
      props: {
        columns,
        proxyConfig: { query, remoteFilter: true, pageSize: 2 },
        formConfig: { fields: formFields },
      },
    })
    await waitFor(() => {
      expect(query).toHaveBeenCalled()
    })
    const input = container.querySelector('[data-iris-table-form-field="name"] input')!
    await fireEvent.input(input, { target: { value: 'Ali' } })
    await fireEvent.click(container.querySelector('[data-iris-table-form-submit]')!)
    await waitFor(() => {
      const last = query.mock.calls[query.mock.calls.length - 1]![0] as ProxyParams
      expect(last.filters).toEqual({ name: 'Ali' })
      expect(last.page).toBe(1)
    })
  })
})

describe('IrisTable batch AC — toolbar', () => {
  it('renders title, custom buttons, export and batch (when rows are selected)', async () => {
    const onExport = vi.fn()
    const onAdd = vi.fn()
    const onBatch = vi.fn()
    const { container } = render(IrisTable, {
      props: {
        columns,
        data,
        selectable: 'multi',
        toolbar: {
          title: 'Users',
          onExport,
          buttons: [{ key: 'add', label: 'Add', onClick: onAdd }],
          batch: { label: 'Delete', onClick: onBatch },
        },
      },
    })
    expect(container.querySelector('[data-iris-table-toolbar]')?.textContent).toContain('Users')
    expect(container.querySelector('[data-iris-table-toolbar-batch]')).toBeNull()
    await fireEvent.click(container.querySelector('[data-iris-table-toolbar-export]')!)
    expect(onExport).toHaveBeenCalledTimes(1)
    await fireEvent.click(container.querySelector('[data-iris-table-toolbar-button="add"]')!)
    expect(onAdd).toHaveBeenCalledTimes(1)

    // Batch appears only once rows are selected; it receives the selected keys.
    const checkbox = bodyRows(container)[0]!.querySelector('input[type="checkbox"]')!
    await fireEvent.click(checkbox)
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-toolbar-batch]')).not.toBeNull()
    })
    await fireEvent.click(container.querySelector('[data-iris-table-toolbar-batch]')!)
    expect(onBatch).toHaveBeenCalledWith([1])
  })
})
