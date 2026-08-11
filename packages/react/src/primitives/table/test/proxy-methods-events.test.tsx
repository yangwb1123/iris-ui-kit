import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn, IrisTableProxyQueryParams } from '../types'
import type { IrisTableHandle } from '../props'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
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
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function tableRef(): { current: IrisTableHandle<Row> | null } {
  return { current: null }
}

function names(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-iris-table-cell="name"]')).map(
    (n) => n.textContent ?? '',
  )
}

describe('IrisTable proxy methods (vxe loadData/reloadData/commitProxy/getProxyInfo parity, batch V)', () => {
  it('loadData replaces the live rows without firing a query', async () => {
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 1 }))
    const r = tableRef()
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={[]}
        rowKey="id"
        proxyConfig={{ query }}
        tableRef={r}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    act(() => r.current!.loadData([rows[1], rows[2]]))
    await waitFor(() => {
      expect(names(container)).toEqual(['Alice', 'Bob'])
    })
    // The push went through the write-back channel — no second query.
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('reloadData refetches the current page (query called again)', async () => {
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 1 }))
    const r = tableRef()
    render(
      <IrisTable
        columns={baseColumns}
        data={[]}
        rowKey="id"
        proxyConfig={{ query }}
        tableRef={r}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    act(() => r.current!.reloadData())
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    expect(query).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, sort: null, filters: {} })
  })

  it('commitProxy merges overrides into the query and fires the request', async () => {
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 25 }))
    const r = tableRef()
    render(
      <IrisTable
        columns={baseColumns}
        data={[]}
        rowKey="id"
        proxyConfig={{ query, pageSize: 10 }}
        tableRef={r}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    act(() => r.current!.commitProxy({ page: 3, pageSize: 5 }))
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    const last = query.mock.lastCall![0] as IrisTableProxyQueryParams
    expect(last.page).toBe(3)
    expect(last.pageSize).toBe(5)
    expect(last.sort).toBeNull()
    expect(last.filters).toEqual({})
  })

  it('getProxyInfo returns page/pageSize/total; null without a proxy', async () => {
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 25 }))
    const r = tableRef()
    render(
      <IrisTable
        columns={baseColumns}
        data={[]}
        rowKey="id"
        proxyConfig={{ query, pageSize: 5, defaultPage: 2 }}
        tableRef={r}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    expect(r.current!.getProxyInfo()).toEqual({ page: 2, pageSize: 5, total: 25 })

    // Without a proxy the handle returns null and never throws.
    const r2 = tableRef()
    render(<IrisTable columns={baseColumns} data={rows} rowKey="id" tableRef={r2} />)
    expect(r2.current!.getProxyInfo()).toBeNull()
  })
})

describe('IrisTable edit events (vxe edit-activated/edit-closed parity, batch V)', () => {
  const editableColumns: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Name', editable: true },
    { key: 'age', title: 'Age', editable: true },
  ]

  it('onEditStart fires when an editor opens', () => {
    const onEditStart = vi.fn()
    const { container } = render(
      <IrisTable columns={editableColumns} data={rows} rowKey="id" onEditStart={onEditStart} />,
    )
    fireEvent.doubleClick(container.querySelector('[data-iris-table-cell="name"]')!)
    expect(onEditStart).toHaveBeenCalledTimes(1)
    expect(onEditStart).toHaveBeenLastCalledWith({
      row: rows[0],
      column: editableColumns[0],
      rowIndex: 0,
    })
  })

  it('onEditClosed fires with the committed value on commit and cancelled on Escape', () => {
    const onEditClosed = vi.fn()
    const { container } = render(
      <IrisTable columns={editableColumns} data={rows} rowKey="id" onEditClosed={onEditClosed} />,
    )
    // Commit path: Enter commits with the coerced value.
    fireEvent.doubleClick(container.querySelector('[data-iris-table-cell="name"]')!)
    const input = container.querySelector('[data-iris-table-editor]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Zoe' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onEditClosed).toHaveBeenCalledTimes(1)
    expect(onEditClosed).toHaveBeenLastCalledWith({
      row: rows[0],
      column: editableColumns[0],
      rowIndex: 0,
      value: 'Zoe',
      cancelled: false,
    })
    // Cancel path: Escape discards the draft (cancelled: true, no value).
    // The reopened editor runs against the LIVE row — the first commit
    // already wrote 'Zoe' back through the write-back channel.
    fireEvent.doubleClick(container.querySelector('[data-iris-table-cell="name"]')!)
    const input2 = container.querySelector('[data-iris-table-editor]') as HTMLInputElement
    fireEvent.change(input2, { target: { value: 'discarded' } })
    fireEvent.keyDown(input2, { key: 'Escape' })
    expect(onEditClosed).toHaveBeenCalledTimes(2)
    expect(onEditClosed).toHaveBeenLastCalledWith({
      row: { ...rows[0], name: 'Zoe' },
      column: editableColumns[0],
      rowIndex: 0,
      cancelled: true,
    })
  })

  it('a rejected commit (validation error) does not fire onEditClosed', () => {
    const columns: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, validate: (v) => (v === 'no' ? 'bad' : null) },
      { key: 'age', title: 'Age' },
    ]
    const onEditClosed = vi.fn()
    const { container } = render(
      <IrisTable columns={columns} data={rows} rowKey="id" onEditClosed={onEditClosed} />,
    )
    fireEvent.doubleClick(container.querySelector('[data-iris-table-cell="name"]')!)
    const input = container.querySelector('[data-iris-table-editor]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'no' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // Session stays open — no close event.
    expect(onEditClosed).not.toHaveBeenCalled()
    expect(container.querySelector('[data-iris-table-editor]')).not.toBeNull()
  })
})

describe('IrisTable onSelectAllChange (additive header select-all event, batch V)', () => {
  it('fires from the header checkbox with the pre-toggle state and current selection', () => {
    const onSelectAllChange = vi.fn()
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        selectable="multi"
        onSelectAllChange={onSelectAllChange}
      />,
    )
    const headerBox = container.querySelector(
      '[data-iris-table-row="header"] input[type="checkbox"]',
    )!
    // Nothing selected → pre-toggle state false + empty selection.
    fireEvent.click(headerBox)
    expect(onSelectAllChange).toHaveBeenLastCalledWith(false, [])
    // The toggle selected every row → a second click pre-toggle state true
    // with every key (the click itself then clears the page selection).
    fireEvent.click(headerBox)
    expect(onSelectAllChange).toHaveBeenLastCalledWith(true, [1, 2, 3])
    // Select only row 1 → header is indeterminate → pre-toggle 'indeterminate'
    // with the current selection.
    fireEvent.click(container.querySelector('[data-iris-table-row="1"] input[type="checkbox"]')!)
    fireEvent.click(headerBox)
    expect(onSelectAllChange).toHaveBeenLastCalledWith('indeterminate', [1])
  })
})

describe('IrisTable onScroll (vxe scroll parity, batch V)', () => {
  it('fires with scrollTop/scrollLeft in column-virtualization mode', () => {
    const onScroll = vi.fn()
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        columnVirtualization
        onScroll={onScroll}
      />,
    )
    const root = container.querySelector('[data-iris-table]') as HTMLElement
    root.scrollLeft = 120
    root.scrollTop = 40
    fireEvent.scroll(root)
    expect(onScroll).toHaveBeenCalledTimes(1)
    expect(onScroll).toHaveBeenLastCalledWith({ scrollTop: 40, scrollLeft: 120 })
  })

  it('fires via the native listener when not virtualized', () => {
    const onScroll = vi.fn()
    const { container } = render(
      <IrisTable columns={baseColumns} data={rows} rowKey="id" onScroll={onScroll} />,
    )
    const root = container.querySelector('[data-iris-table]') as HTMLElement
    root.scrollLeft = 30
    root.scrollTop = 10
    fireEvent.scroll(root)
    expect(onScroll).toHaveBeenCalledTimes(1)
    expect(onScroll).toHaveBeenLastCalledWith({ scrollTop: 10, scrollLeft: 30 })
    // Cleanup detaches the listener (a later scroll no longer fires).
    cleanup()
    fireEvent.scroll(root)
    expect(onScroll).toHaveBeenCalledTimes(1)
  })
})
