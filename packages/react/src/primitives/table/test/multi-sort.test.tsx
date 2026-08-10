import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableHandle } from '../props'
import type { IrisTableColumn, IrisTableProxyQueryParams } from '../types'

afterEach(() => cleanup())

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

// Ties on `name` so the second sort column's precedence is observable.
const tieRows: Row[] = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 35 },
  { id: 3, name: 'Alice', age: 25 },
]

const sortableColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true },
]

function nameCells(): string[] {
  return Array.from(document.querySelectorAll('[data-iris-table-cell="name"]')).map(
    (c) => c.textContent ?? '',
  )
}

describe('IrisTable multiSort (vxe-grid batch F)', () => {
  it('header clicks append columns in click order; rows sort by comparator precedence', () => {
    const onMulti = vi.fn()
    const { container } = render(
      <IrisTable columns={sortableColumns} data={tieRows} multiSort onMultiSortChange={onMulti} />,
    )
    const nameHeader = container.querySelector('[data-iris-table-header="name"]')!
    const ageHeader = container.querySelector('[data-iris-table-header="age"]')!
    act(() => fireEvent.click(nameHeader))
    expect(onMulti).toHaveBeenLastCalledWith([{ key: 'name', direction: 'asc' }])
    act(() => fireEvent.click(ageHeader))
    expect(onMulti).toHaveBeenLastCalledWith([
      { key: 'name', direction: 'asc' },
      { key: 'age', direction: 'asc' },
    ])
    // name asc first, then age asc breaks the Alice tie: Alice(25), Alice(30), Bob
    expect(nameCells()).toEqual(['Alice', 'Alice', 'Bob'])
    expect(
      Array.from(document.querySelectorAll('[data-iris-table-cell="age"]')).map(
        (c) => c.textContent,
      ),
    ).toEqual(['25', '30', '35'])
  })

  it('renders the click-order sequence number on non-primary sort columns only', () => {
    const { container } = render(<IrisTable columns={sortableColumns} data={rows} multiSort />)
    // One active sort → no sequence badge anywhere
    act(() => fireEvent.click(container.querySelector('[data-iris-table-header="name"]')!))
    expect(container.querySelector('[data-iris-sort-seq]')).toBeNull()
    // Second column joins → badge "2" sits on the AGE header
    act(() => fireEvent.click(container.querySelector('[data-iris-table-header="age"]')!))
    const seq = container.querySelector('[data-iris-sort-seq]')
    expect(seq?.textContent).toBe('2')
    expect(seq?.closest('[data-iris-table-header]')?.getAttribute('data-iris-table-header')).toBe(
      'age',
    )
    // Cycling the second column desc keeps its position; removing it drops the badge
    act(() => fireEvent.click(container.querySelector('[data-iris-table-header="age"]')!))
    expect(container.querySelector('[data-iris-sort-seq]')?.textContent).toBe('2')
    act(() => fireEvent.click(container.querySelector('[data-iris-table-header="age"]')!))
    expect(container.querySelector('[data-iris-sort-seq]')).toBeNull()
  })

  it('proxy remoteSort: multi mode passes `sorts`, single mode keeps `sort`', async () => {
    const query = vi.fn(async (_params: IrisTableProxyQueryParams) => ({
      rows: [rows[0]],
      total: 3,
    }))
    const { container } = render(
      <IrisTable
        columns={sortableColumns}
        data={[]}
        rowKey="id"
        multiSort
        proxyConfig={{ query, remoteSort: true }}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    expect(query).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, sort: null, filters: {} })
    act(() => fireEvent.click(container.querySelector('[data-iris-table-header="name"]')!))
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    expect(query).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      sort: null,
      sorts: [{ key: 'name', direction: 'asc' }],
      filters: {},
    })
    act(() => fireEvent.click(container.querySelector('[data-iris-table-header="age"]')!))
    await waitFor(() => expect(query).toHaveBeenCalledTimes(3))
    expect(query).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      sort: null,
      sorts: [
        { key: 'name', direction: 'asc' },
        { key: 'age', direction: 'asc' },
      ],
      filters: {},
    })
  })

  it('single mode is untouched: header click still replaces via `sort`', async () => {
    const query = vi.fn(async (_params: IrisTableProxyQueryParams) => ({
      rows: [rows[0]],
      total: 3,
    }))
    const { container } = render(
      <IrisTable
        columns={sortableColumns}
        data={[]}
        rowKey="id"
        proxyConfig={{ query, remoteSort: true }}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    act(() => fireEvent.click(container.querySelector('[data-iris-table-header="name"]')!))
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    // No `sorts` key — the single-column channel stays byte-identical.
    expect(query).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      sort: { key: 'name', direction: 'asc' },
      filters: {},
    })
  })

  it('defaultMultiSort seeds the uncontrolled multi sort on mount', () => {
    const { container } = render(
      <IrisTable
        columns={sortableColumns}
        data={tieRows}
        multiSort
        defaultMultiSort={[
          { key: 'name', direction: 'asc' },
          { key: 'age', direction: 'desc' },
        ]}
      />,
    )
    expect(nameCells()).toEqual(['Alice', 'Alice', 'Bob'])
    expect(
      Array.from(document.querySelectorAll('[data-iris-table-cell="age"]')).map(
        (c) => c.textContent,
      ),
    ).toEqual(['30', '25', '35'])
    // Sequence badge on the secondary column reflects the seeded order
    expect(
      container
        .querySelector('[data-iris-sort-seq]')
        ?.closest('[data-iris-table-header]')
        ?.getAttribute('data-iris-table-header'),
    ).toBe('age')
  })
})

describe('IrisTable validConfig (vxe-grid ValidConfig parity, batch F)', () => {
  it('showMessage=false still validates + blocks the commit, but hides the message', async () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, editRules: [{ required: true }] },
    ]
    const onCellEdit = vi.fn()
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        validConfig={{ showMessage: false }}
        onCellEdit={onCellEdit}
      />,
    )
    fireEvent.doubleClick(container.querySelector('[data-iris-table-cell="name"]')!)
    const input = container.querySelector('[data-iris-table-editor]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // editRules validation runs async — the commit stays blocked and the input
    // is flagged invalid…
    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'))
    expect(container.querySelector('[data-iris-table-editor]')).not.toBeNull()
    expect(onCellEdit).not.toHaveBeenCalled()
    // …but the message element is skipped entirely (no dangling describedby).
    expect(container.querySelector('[data-iris-table-editor-error]')).toBeNull()
    expect(input.getAttribute('aria-describedby')).toBeNull()
  })

  it('default (no validConfig) still renders the error message', async () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, editRules: [{ required: true }] },
    ]
    const { container } = render(<IrisTable columns={cols} data={rows} />)
    fireEvent.doubleClick(container.querySelector('[data-iris-table-cell="name"]')!)
    const input = container.querySelector('[data-iris-table-editor]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'))
    expect(container.querySelector('[data-iris-table-editor-error]')).not.toBeNull()
    expect(input.getAttribute('aria-describedby')).not.toBeNull()
  })
})

describe('IrisTable selection handle methods (vxe checkbox parity, batch F)', () => {
  function renderWithRef(checkMethod?: (row: Row, rowIndex: number) => boolean) {
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    const onSelection = vi.fn()
    const utils = render(
      <IrisTable
        columns={sortableColumns}
        data={rows}
        rowKey="id"
        selectable="multi"
        tableRef={ref}
        onSelectionChange={onSelection}
        checkMethod={checkMethod}
      />,
    )
    return { ref, onSelection, ...utils }
  }

  it('selectAll selects every checkMethod-eligible row of the current page', () => {
    const { ref, onSelection } = renderWithRef((row) => (row as Row).age < 30)
    act(() => ref.current!.selectAll())
    // Charlie(25) + Bob(28) eligible; Alice(32) skipped by checkMethod.
    expect(onSelection).toHaveBeenLastCalledWith([1, 3])
  })

  it('toggleRowSelection directly toggles a key, bypassing checkMethod', () => {
    const { ref, onSelection } = renderWithRef((row) => (row as Row).age < 30)
    act(() => ref.current!.selectAll())
    act(() => ref.current!.toggleRowSelection(2)) // Alice — checkMethod would veto
    expect(onSelection).toHaveBeenLastCalledWith([1, 3, 2])
    act(() => ref.current!.toggleRowSelection(2))
    expect(onSelection).toHaveBeenLastCalledWith([1, 3])
  })

  it('clearSelection empties the selection', () => {
    const { ref, onSelection } = renderWithRef()
    act(() => ref.current!.selectAll())
    expect(onSelection).toHaveBeenLastCalledWith([1, 2, 3])
    act(() => ref.current!.clearSelection())
    expect(onSelection).toHaveBeenLastCalledWith([])
  })
})

describe('IrisTable expandAll (vxe expand-config parity, batch F)', () => {
  const treeRows: Row[] = [{ id: 1, name: 'A', age: 1 }]
  const getSubRows = (row: Row): Row[] | undefined => {
    if (row.id === 1) return [{ id: 11, name: 'A1', age: 1 }]
    if (row.id === 11) return [{ id: 111, name: 'A11', age: 1 }]
    return undefined
  }

  it('expandAll seeds every tree parent as expanded (one-shot on first data)', () => {
    const { container } = render(
      <IrisTable
        columns={sortableColumns}
        data={treeRows}
        rowKey="id"
        getSubRows={getSubRows}
        expandAll
      />,
    )
    // A + A1 + A11 all visible, both parents open (deep chain expanded)
    expect(
      container.querySelectorAll('[data-iris-table-row]:not([data-iris-table-row=header])').length,
    ).toBe(3)
    const toggles = Array.from(container.querySelectorAll('[data-iris-table-tree-toggle]'))
    expect(toggles.map((t) => t.getAttribute('aria-expanded'))).toEqual(['true', 'true'])
    // Tree toggle glyph is inside the first cell — strip it for the text check.
    expect(
      Array.from(container.querySelectorAll('[data-iris-table-cell="name"]')).map(
        (c) => c.textContent?.replace('▶', '') ?? '',
      ),
    ).toEqual(['A', 'A1', 'A11'])
  })

  it('without expandAll the tree starts collapsed', () => {
    const { container } = render(
      <IrisTable columns={sortableColumns} data={treeRows} rowKey="id" getSubRows={getSubRows} />,
    )
    expect(
      container.querySelectorAll('[data-iris-table-row]:not([data-iris-table-row=header])').length,
    ).toBe(1)
    expect(
      Array.from(container.querySelectorAll('[data-iris-table-cell="name"]')).map(
        (c) => c.textContent?.replace('▶', '') ?? '',
      ),
    ).toEqual(['A'])
  })
})
