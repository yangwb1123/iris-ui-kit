import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

afterEach(cleanup)

const cols: IrisTableColumn<{ name: string; age: number; city: string }>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age' },
  { key: 'city', title: 'City' },
]

const rows = [
  { name: 'Alice', age: 30, city: 'Berlin' },
  { name: 'Bob', age: 25, city: 'Paris' },
]

const nameCols: IrisTableColumn<{ id: number; name: string }>[] = [
  { key: 'name', title: 'Name', sortable: true },
]

const header = (container: HTMLElement, key: string): HTMLElement | null =>
  container.querySelector(`[data-iris-table-header="${key}"]`)

const cellTexts = (container: HTMLElement, key: string): string[] =>
  [...container.querySelectorAll(`[data-iris-table-cell="${key}"]`)].map(
    (c) => (c as HTMLElement).textContent ?? '',
  )

describe('IrisTable parity-AA: columnVisibility / filters / seq', () => {
  it('columnVisibility hides columns from header, body and summary', () => {
    const summaryCols: IrisTableColumn<{ name: string; age: number }>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age', summary: 'sum' },
    ]
    const { container } = render(() => (
      <IrisTable
        columns={summaryCols}
        data={rows}
        rowKey="name"
        columnVisibility={{ age: false }}
      />
    ))
    expect(header(container, 'name')).not.toBeNull()
    expect(header(container, 'age')).toBeNull()
    expect(container.querySelector('[data-iris-table-cell="age"]')).toBeNull()
    expect(container.textContent).not.toContain('30')
    expect(container.textContent).toContain('Alice')
    // the summary row also skips the hidden column (no 55 = sum of ages)
    expect(container.textContent).not.toContain('55')
  })

  it('filters rows by case-insensitive substring; empty filter keeps all rows', () => {
    const { container } = render(() => (
      <IrisTable columns={cols} data={rows} rowKey="name" filters={{ name: 'AL' }} />
    ))
    expect(cellTexts(container, 'name')).toEqual(['Alice'])
    // empty filter value is inactive → all rows
    const all = render(() => (
      <IrisTable columns={cols} data={rows} rowKey="name" filters={{ name: '' }} />
    ))
    expect(cellTexts(all.container, 'name')).toEqual(['Alice', 'Bob'])
  })

  it('filterMethod overrides the default substring match', () => {
    const withMethod: IrisTableColumn<{ name: string; age: number }>[] = [
      {
        key: 'name',
        title: 'Name',
        filterMethod: (value, _row, filterValue) => String(value).startsWith(filterValue),
      },
    ]
    const { container } = render(() => (
      <IrisTable columns={withMethod} data={rows} rowKey="name" filters={{ name: 'A' }} />
    ))
    expect(cellTexts(container, 'name')).toEqual(['Alice'])
  })

  it('seq renders a leading sequence column honoring seqStartIndex', () => {
    const { container } = render(() => (
      <IrisTable columns={cols} data={rows} rowKey="name" seq seqStartIndex={100} />
    ))
    const seqCells = [...container.querySelectorAll('[data-iris-table-cell="__seq"]')]
    expect(seqCells.map((c) => c.textContent)).toEqual(['100', '101'])
    // header placeholder keeps the grid aligned
    expect(container.querySelector('[data-iris-table-header="__seq"]')).not.toBeNull()
  })

  it('seq aligns with selection and grouped headers (placeholder per track)', () => {
    const grouped: IrisTableColumn<{ name: string; age: number }>[] = [
      {
        key: 'group',
        title: 'Group',
        children: [
          { key: 'name', title: 'Name' },
          { key: 'age', title: 'Age' },
        ],
      },
    ]
    const flat = render(() => (
      <IrisTable columns={cols} data={rows} rowKey="name" seq selectable="multi" />
    ))
    // flat header/body rows: seq + selection + 3 leaf tracks each
    expect(flat.container.querySelectorAll('[role="columnheader"]').length).toBe(5)
    const firstRow = flat.container.querySelectorAll('[data-iris-table-row]')[1] as HTMLElement
    expect(firstRow.querySelectorAll('[role="cell"]').length).toBe(5)
    const g = render(() => (
      <IrisTable columns={grouped} data={rows} rowKey="name" seq selectable="multi" />
    ))
    expect(g.container.querySelector('[data-iris-table-header="__seq"]')).not.toBeNull()
    expect(g.container.querySelectorAll('[data-iris-table-header-grouped]').length).toBe(1)
  })

  it('seqMethod wins over seqStartIndex', () => {
    const { container } = render(() => (
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="name"
        seq
        seqMethod={({ rowIndex }) => `R${rowIndex + 1}`}
      />
    ))
    const seqCells = [...container.querySelectorAll('[data-iris-table-cell="__seq"]')]
    expect(seqCells.map((c) => c.textContent)).toEqual(['R1', 'R2'])
  })
})

describe('IrisTable parity-AA: proxyConfig', () => {
  it('drives loading → rows and renders a pager from the controller state', async () => {
    const query = vi.fn(async (params: { page: number }) => ({
      rows: [{ id: params.page, name: `P${params.page}` }],
      total: 2,
    }))
    const { container } = render(() => (
      <IrisTable columns={nameCols} rowKey="id" proxyConfig={{ query }} />
    ))
    expect(container.querySelector('[data-iris-table-row="loading"]')).not.toBeNull()
    await waitFor(() => {
      expect(cellTexts(container, 'name')).toEqual(['P1'])
    })
    expect(container.querySelector('[data-iris-table-row="loading"]')).toBeNull()
    expect(container.querySelector('[data-iris-table-pager]')).not.toBeNull()
    expect(query).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 10 }))
  })

  it('remoteSort re-queries on header click with the sort param', async () => {
    const query = vi.fn(async () => ({ rows: [{ id: 1, name: 'A' }], total: 1 }))
    const { container } = render(() => (
      <IrisTable columns={nameCols} rowKey="id" proxyConfig={{ query, remoteSort: true }} />
    ))
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    fireEvent.click(header(container, 'name')!)
    await waitFor(() =>
      expect(query).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: { key: 'name', direction: 'asc' } }),
      ),
    )
    expect(query).toHaveBeenCalledTimes(2)
  })

  it('pager click changes the page and re-queries', async () => {
    const query = vi.fn(async (params: { page: number }) => ({
      rows: [{ id: params.page, name: `P${params.page}` }],
      total: 30,
    }))
    const onPageChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={nameCols}
        rowKey="id"
        proxyConfig={{ query, pageSize: 10, onPageChange }}
      />
    ))
    await waitFor(() => expect(cellTexts(container, 'name')).toEqual(['P1']))
    // 30 rows / 10 per page → 3 page buttons; click page 2.
    const pageBtns = [...container.querySelectorAll('[data-iris-pagination-item="page"]')]
    fireEvent.click(pageBtns[1]!)
    await waitFor(() => {
      expect(query).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    })
    expect(cellTexts(container, 'name')).toEqual(['P2'])
    expect(onPageChange).toHaveBeenLastCalledWith(2, 10)
  })

  it('pagerConfig.showTotal renders the total; pageSizes re-queries with the new size', async () => {
    const query = vi.fn(async () => ({ rows: [{ id: 1, name: 'A' }], total: 30 }))
    const { container } = render(() => (
      <IrisTable
        columns={nameCols}
        rowKey="id"
        proxyConfig={{ query, pageSize: 10 }}
        pagerConfig={{ showTotal: true, pageSizes: [10, 20] }}
      />
    ))
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    expect(container.querySelector('[data-iris-table-total]')?.textContent).toContain('30')
    const sizeSelect = container.querySelector('[data-iris-select-trigger]')
    expect(sizeSelect).not.toBeNull()
    fireEvent.click(sizeSelect!)
    await waitFor(() => {
      // the select listbox portals to document.body
      const option = [...document.querySelectorAll('[data-iris-select-option]')].find((o) =>
        o.textContent?.includes('20'),
      )
      expect(option).toBeTruthy()
      fireEvent.click(option!)
    })
    await waitFor(() =>
      expect(query).toHaveBeenLastCalledWith(expect.objectContaining({ pageSize: 20, page: 1 })),
    )
  })

  it('autoLoad false: no initial request, rows stay empty', async () => {
    const query = vi.fn(async () => ({ rows: [{ id: 1, name: 'A' }], total: 1 }))
    const { container } = render(() => (
      <IrisTable columns={nameCols} rowKey="id" proxyConfig={{ query, autoLoad: false }} />
    ))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(query).not.toHaveBeenCalled()
    expect(container.querySelector('[data-iris-table-row="empty"]')).not.toBeNull()
  })

  it('seq renders cumulative numbers across proxy pages', async () => {
    const query = vi.fn(async (params: { page: number }) => ({
      rows: [1, 2, 3, 4, 5].map((n) => ({ id: (params.page - 1) * 5 + n, name: `R${n}` })),
      total: 12,
    }))
    const { container } = render(() => (
      <IrisTable
        columns={nameCols}
        rowKey="id"
        seq
        proxyConfig={{ query, pageSize: 5, seq: true }}
      />
    ))
    const seqTexts = (): string[] =>
      [...container.querySelectorAll('[data-iris-table-cell="__seq"]')].map(
        (c) => c.textContent ?? '',
      )
    await waitFor(() => expect(seqTexts()).toEqual(['1', '2', '3', '4', '5']))
    const pageBtns = [...container.querySelectorAll('[data-iris-pagination-item="page"]')]
    fireEvent.click(pageBtns[1]!)
    await waitFor(() => expect(seqTexts()).toEqual(['6', '7', '8', '9', '10']))
  })
})

describe('IrisTable parity-AA: multiSort', () => {
  const sortCols: IrisTableColumn<{ id: number; name: string; age: number }>[] = [
    { key: 'age', title: 'Age', sortable: true },
    { key: 'name', title: 'Name', sortable: true },
  ]
  const sortRows = [
    { id: 1, name: 'Bob', age: 30 },
    { id: 2, name: 'Alice', age: 30 },
    { id: 3, name: 'Zoe', age: 20 },
  ]

  it('header clicks append/cycle/remove columns and the data follows the chained comparator', () => {
    const { container } = render(() => (
      <IrisTable columns={sortCols} data={sortRows} rowKey="id" multiSort />
    ))
    const names = (): string[] => cellTexts(container, 'name')
    // Age asc → append Name asc: Zoe(20), Alice(30), Bob(30)
    fireEvent.click(header(container, 'age')!)
    fireEvent.click(header(container, 'name')!)
    expect(names()).toEqual(['Zoe', 'Alice', 'Bob'])
    // second click on age → desc: Bob(30), Alice(30), Zoe(20)
    fireEvent.click(header(container, 'age')!)
    expect(names()).toEqual(['Alice', 'Bob', 'Zoe'])
    // third click on age → removed: only name asc remains
    fireEvent.click(header(container, 'age')!)
    expect(names()).toEqual(['Alice', 'Bob', 'Zoe'])
  })

  it('fires onMultiSortChange with the click-order list', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={sortCols}
        data={sortRows}
        rowKey="id"
        multiSort
        onMultiSortChange={onChange}
      />
    ))
    fireEvent.click(header(container, 'age')!)
    expect(onChange).toHaveBeenLastCalledWith([{ key: 'age', direction: 'asc' }])
    fireEvent.click(header(container, 'name')!)
    expect(onChange).toHaveBeenLastCalledWith([
      { key: 'age', direction: 'asc' },
      { key: 'name', direction: 'asc' },
    ])
    fireEvent.click(header(container, 'name')!)
    expect(onChange).toHaveBeenLastCalledWith([
      { key: 'age', direction: 'asc' },
      { key: 'name', direction: 'desc' },
    ])
  })

  it('renders click-order sequence numbers on non-primary sort columns', () => {
    const { container } = render(() => (
      <IrisTable columns={sortCols} data={sortRows} rowKey="id" multiSort />
    ))
    fireEvent.click(header(container, 'age')!)
    fireEvent.click(header(container, 'name')!)
    const seqs = [...container.querySelectorAll('[data-iris-sort-seq]')].map((c) => c.textContent)
    expect(seqs).toEqual(['2'])
  })
})

describe('IrisTable parity-AA: formConfig', () => {
  it('submit applies local filters; reset restores defaults', () => {
    const onSearch = vi.fn()
    const onReset = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="name"
        formConfig={{
          fields: [{ key: 'name', label: 'Name', defaultValue: 'A' }],
          onSearch,
          onReset,
        }}
      />
    ))
    const input = container.querySelector(
      '[data-iris-table-form-field="name"] input',
    ) as HTMLInputElement
    // defaultValue seeds the DRAFT (input value); filtering starts on submit
    expect((input as HTMLInputElement).value).toBe('A')
    expect(cellTexts(container, 'name')).toEqual(['Alice', 'Bob'])
    fireEvent.input(input, { target: { value: 'Bob' } })
    fireEvent.submit(container.querySelector('[data-iris-table-form]')!)
    expect(onSearch).toHaveBeenLastCalledWith({ name: 'Bob' })
    expect(cellTexts(container, 'name')).toEqual(['Bob'])
    fireEvent.reset(container.querySelector('[data-iris-table-form]')!)
    expect(onReset).toHaveBeenLastCalledWith({ name: 'A' })
    // reset re-applies the default filter (A)
    expect(cellTexts(container, 'name')).toEqual(['Alice'])
  })

  it('renders select fields and the i18n submit/reset labels', () => {
    const { container } = render(() => (
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="name"
        formConfig={{
          fields: [
            {
              key: 'city',
              label: 'City',
              type: 'select',
              options: [
                { value: 'Berlin', label: 'Berlin' },
                { value: 'Paris', label: 'Paris' },
              ],
            },
          ],
        }}
      />
    ))
    expect(container.querySelector('[data-iris-table-form-submit]')?.textContent).toBe('Search')
    expect(container.querySelector('[data-iris-table-form-reset]')?.textContent).toBe('Reset')
    expect(
      container.querySelector('[data-iris-table-form-field="city"] [data-iris-select-trigger]'),
    ).not.toBeNull()
  })

  it('proxy mode: submit re-queries with merged filters + page 1; reset re-queries', async () => {
    const query = vi.fn(async () => ({ rows: [{ id: 1, name: 'A' }], total: 1 }))
    const { container } = render(() => (
      <IrisTable
        columns={nameCols}
        rowKey="id"
        proxyConfig={{ query }}
        formConfig={{ fields: [{ key: 'name', label: 'Name' }] }}
      />
    ))
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    const input = container.querySelector(
      '[data-iris-table-form-field="name"] input',
    ) as HTMLInputElement
    fireEvent.input(input, { target: { value: 'A' } })
    fireEvent.submit(container.querySelector('[data-iris-table-form]')!)
    await waitFor(() =>
      expect(query).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: { name: 'A' }, page: 1 }),
      ),
    )
    expect(query).toHaveBeenCalledTimes(2)
    fireEvent.reset(container.querySelector('[data-iris-table-form]')!)
    await waitFor(() => expect(query).toHaveBeenCalledTimes(3))
    expect(query).toHaveBeenLastCalledWith(expect.objectContaining({ filters: {} }))
  })
})

describe('IrisTable parity-AA: toolbar', () => {
  it('renders title / refresh / export / custom buttons and fires them', () => {
    const onRefresh = vi.fn()
    const onExport = vi.fn()
    const onButton = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="name"
        toolbar={{
          title: 'Users',
          onRefresh,
          onExport,
          buttons: [{ key: 'add', label: 'Add', onClick: onButton, icon: '+' }],
        }}
      />
    ))
    const toolbar = container.querySelector('[data-iris-table-toolbar]')
    expect(toolbar).not.toBeNull()
    expect(toolbar!.textContent).toContain('Users')
    fireEvent.click(container.querySelector('[data-iris-table-toolbar-refresh]')!)
    expect(onRefresh).toHaveBeenCalledTimes(1)
    fireEvent.click(container.querySelector('[data-iris-table-toolbar-export]')!)
    expect(onExport).toHaveBeenCalledTimes(1)
    const addBtn = container.querySelector('[data-iris-table-toolbar-button="add"]')
    expect(addBtn).not.toBeNull()
    fireEvent.click(addBtn!)
    expect(onButton).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-iris-table-toolbar-batch]')).toBeNull()
  })

  it('batch action appears with a multi selection and receives the keys', () => {
    const onBatch = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="name"
        selectable="multi"
        toolbar={{ batch: { label: 'Delete', onClick: onBatch } }}
      />
    ))
    expect(container.querySelector('[data-iris-table-toolbar-batch]')).toBeNull()
    const rowCb = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1]!
    fireEvent.click(rowCb)
    const batch = container.querySelector('[data-iris-table-toolbar-batch]')
    expect(batch).not.toBeNull()
    expect(batch!.textContent).toContain('Delete')
    fireEvent.click(batch!)
    expect(onBatch).toHaveBeenLastCalledWith(['Alice'])
  })

  it('refresh re-queries the proxy in proxy mode', async () => {
    const query = vi.fn(async () => ({ rows: [{ id: 1, name: 'A' }], total: 1 }))
    const { container } = render(() => (
      <IrisTable
        columns={nameCols}
        rowKey="id"
        proxyConfig={{ query }}
        toolbar={{ onRefresh: vi.fn() }}
      />
    ))
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    fireEvent.click(container.querySelector('[data-iris-table-toolbar-refresh]')!)
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
  })
})
