import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'
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
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true, align: 'right' },
]

function headers(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-table-header]'))
}

describe('IrisTable handle methods (vxe parity, batch T)', () => {
  it('scrollToRow finds the row node and scrolls it into view (nearest)', () => {
    const spy = vi.fn()
    Element.prototype.scrollIntoView = spy
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    render(<IrisTable columns={baseColumns} data={rows} rowKey="id" tableRef={ref} />)
    const rowEl = document.querySelector('[data-iris-table-row="2"]')!
    act(() => ref.current!.scrollToRow(2))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.contexts[0]).toBe(rowEl)
    expect(spy).toHaveBeenCalledWith({ block: 'nearest' })
    // Unknown key: no-op, no throw.
    act(() => ref.current!.scrollToRow(99))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('scrollToRow does not throw on keys containing quotes (escaped selector)', () => {
    const spy = vi.fn()
    Element.prototype.scrollIntoView = spy
    const quoted: Row[] = [
      { id: 1, name: 'a"b', age: 1 },
      { id: 2, name: 'B', age: 2 },
    ]
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    render(<IrisTable columns={baseColumns} data={quoted} rowKey="name" tableRef={ref} />)
    // A row whose key contains a double quote would make a raw-interpolated
    // attribute selector throw — the escaped/iteration lookup must still hit it.
    act(() => ref.current!.scrollToRow('a"b'))
    expect(spy).toHaveBeenCalledTimes(1)
    // jsdom's nwsapi rejects a quoted attribute selector, so locate the row
    // node the same way the implementation falls back to (attribute scan).
    const located = Array.from(document.querySelectorAll('[data-iris-table-row]')).find(
      (n) => n.getAttribute('data-iris-table-row') === 'a"b',
    )
    expect(spy.mock.contexts[0]).toBe(located)
    // Unknown key: no-op, no throw.
    act(() => ref.current!.scrollToRow('nope'))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('toggleRowExpand toggles the detail expansion model', () => {
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        renderDetail={(r) => <div>detail-{r.id}</div>}
      />,
    )
    act(() => ref.current!.toggleRowExpand(1))
    expect(document.querySelector('[data-iris-table-row-detail="1"]')).not.toBeNull()
    act(() => ref.current!.toggleRowExpand(1))
    expect(document.querySelector('[data-iris-table-row-detail="1"]')).toBeNull()
  })

  it('toggleRowExpand fires onExpandChange with the new state (detail)', () => {
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    const onExpandChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        renderDetail={(r) => <div>detail-{r.id}</div>}
        onExpandChange={onExpandChange}
      />,
    )
    act(() => ref.current!.toggleRowExpand(1))
    expect(onExpandChange).toHaveBeenCalledTimes(1)
    expect(onExpandChange).toHaveBeenLastCalledWith(rows[0], true)
    act(() => ref.current!.toggleRowExpand(1))
    expect(onExpandChange).toHaveBeenLastCalledWith(rows[0], false)
  })

  it('toggleRowExpand respects the rowExpandable gate (detail)', () => {
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    const onExpandChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        renderDetail={(r) => <div>detail-{r.id}</div>}
        rowExpandable={(r) => r.id !== 1}
        onExpandChange={onExpandChange}
      />,
    )
    // Vetoed row: no expansion, no event. Eligible row: toggles + event.
    act(() => ref.current!.toggleRowExpand(1))
    expect(document.querySelector('[data-iris-table-row-detail="1"]')).toBeNull()
    expect(onExpandChange).not.toHaveBeenCalled()
    act(() => ref.current!.toggleRowExpand(2))
    expect(document.querySelector('[data-iris-table-row-detail="2"]')).not.toBeNull()
    expect(onExpandChange).toHaveBeenCalledTimes(1)
    expect(onExpandChange).toHaveBeenLastCalledWith(rows[1], true)
  })

  it('toggleRowExpand toggles the tree caret (tree mode)', () => {
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        getSubRows={(r) => (r.id === 1 ? [{ id: 11, name: 'child', age: 1 }] : undefined)}
      />,
    )
    const caret = () =>
      document.querySelector('[data-iris-table-row="1"] [data-iris-table-tree-toggle]')!
    expect(caret().getAttribute('aria-expanded')).toBe('false')
    act(() => ref.current!.toggleRowExpand(1))
    expect(caret().getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('[data-iris-table-row="11"]')).not.toBeNull()
    act(() => ref.current!.toggleRowExpand(1))
    expect(caret().getAttribute('aria-expanded')).toBe('false')
  })

  it('toggleRowExpand fires onTreeExpandChange with the new state (tree)', () => {
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    const onTreeExpandChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        getSubRows={(r) => (r.id === 1 ? [{ id: 11, name: 'child', age: 1 }] : undefined)}
        onTreeExpandChange={onTreeExpandChange}
      />,
    )
    act(() => ref.current!.toggleRowExpand(1))
    expect(onTreeExpandChange).toHaveBeenCalledTimes(1)
    expect(onTreeExpandChange).toHaveBeenLastCalledWith(rows[0], true)
    act(() => ref.current!.toggleRowExpand(1))
    expect(onTreeExpandChange).toHaveBeenLastCalledWith(rows[0], false)
  })

  it('tree handle methods resolve nested rows through the Core rows model', () => {
    const child = {
      id: 11,
      name: 'child',
      age: 11,
      children: [{ id: 111, name: 'leaf', age: 111 }],
    }
    const root = { id: 1, name: 'root', age: 1, children: [child] }
    const ref: { current: IrisTableHandle<typeof root> | null } = { current: null }
    const onTreeExpandChange = vi.fn()
    const onCurrentRowChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns as IrisTableColumn<typeof root>[]}
        data={[root]}
        rowKey="id"
        tableRef={ref}
        getSubRows={(row) => row.children}
        onTreeExpandChange={onTreeExpandChange}
        onCurrentRowChange={onCurrentRowChange}
      />,
    )

    // The child is collapsed and therefore absent from the visible body, but
    // setCurrentRow still resolves it from the static tree source.
    act(() => ref.current!.setCurrentRow(11))
    expect(onCurrentRowChange).toHaveBeenCalledWith(11, child)

    // Expanding the root makes the child visible; the second imperative
    // expansion must resolve the child rather than scanning root rows only.
    act(() => ref.current!.toggleRowExpand(1))
    expect(document.querySelector('[data-iris-table-row="11"]')).not.toBeNull()
    act(() => ref.current!.toggleRowExpand(11))
    expect(document.querySelector('[data-iris-table-row="111"]')).not.toBeNull()
    expect(onTreeExpandChange).toHaveBeenLastCalledWith(child, true)
  })

  it('toggleRowExpand is a no-op on a plain table', () => {
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    render(<IrisTable columns={baseColumns} data={rows} rowKey="id" tableRef={ref} />)
    expect(() => act(() => ref.current!.toggleRowExpand(1))).not.toThrow()
  })

  it('clearSort resets the sort indicator (single mode)', () => {
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    const onSortChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        defaultSort={{ key: 'name', direction: 'asc' }}
        onSortChange={onSortChange}
      />,
    )
    const nameHeader = headers().find((h) => h.textContent?.includes('Name'))!
    expect(nameHeader.getAttribute('data-sort-direction')).toBe('asc')
    act(() => ref.current!.clearSort())
    expect(nameHeader.getAttribute('data-sort-direction')).toBeNull()
    expect(onSortChange).toHaveBeenCalledWith(null)
  })

  it('clearSort empties the multi-sort list (multi mode)', () => {
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    const onMultiSortChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        multiSort
        defaultMultiSort={[{ key: 'name', direction: 'asc' }]}
        onMultiSortChange={onMultiSortChange}
      />,
    )
    const nameHeader = headers().find((h) => h.textContent?.includes('Name'))!
    expect(nameHeader.getAttribute('data-sort-direction')).toBe('asc')
    act(() => ref.current!.clearSort())
    expect(nameHeader.getAttribute('data-sort-direction')).toBeNull()
    expect(onMultiSortChange).toHaveBeenCalledWith([])
  })

  it('clearFilter empties both filter channels via their change handlers', () => {
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    render(
      <IrisTable
        columns={[
          { ...baseColumns[0]!, filterable: true, filterOptions: [{ value: 'a', label: 'A' }] },
          baseColumns[1]!,
        ]}
        data={rows}
        rowKey="id"
        tableRef={ref}
        filters={{ name: 'Ali' }}
        onFiltersChange={onFiltersChange}
        filterValues={{ name: ['a'] }}
        onFilterValuesChange={onFilterValuesChange}
      />,
    )
    act(() => ref.current!.clearFilter())
    expect(onFiltersChange).toHaveBeenCalledWith({})
    expect(onFilterValuesChange).toHaveBeenCalledWith({})
  })

  it('setCurrentRow fires onCurrentRowChange with the row; no-op without handler or unknown key', () => {
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    const onCurrentRowChange = vi.fn()
    const before = vi.fn(() => true)
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        onCurrentRowChange={onCurrentRowChange}
        beforeCurrentRowChange={before}
      />,
    )
    act(() => ref.current!.setCurrentRow(2))
    expect(before).toHaveBeenCalledWith(2, rows[1])
    expect(onCurrentRowChange).toHaveBeenCalledWith(2, rows[1])
    act(() => ref.current!.setCurrentRow(99))
    expect(onCurrentRowChange).toHaveBeenCalledTimes(1)
    // No handler: silent no-op.
    const bare: { current: IrisTableHandle<Row> | null } = { current: null }
    render(<IrisTable columns={baseColumns} data={rows} rowKey="id" tableRef={bare} />)
    expect(() => act(() => bare.current!.setCurrentRow(1))).not.toThrow()
  })

  it('setCurrentColumn fires onCurrentColumnChange; no-op without handler or unknown key', () => {
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    const onCurrentColumnChange = vi.fn()
    const before = vi.fn(() => true)
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        onCurrentColumnChange={onCurrentColumnChange}
        beforeCurrentColumnChange={before}
      />,
    )
    act(() => ref.current!.setCurrentColumn('name'))
    expect(before).toHaveBeenCalledWith('name')
    expect(onCurrentColumnChange).toHaveBeenCalledWith('name')
    act(() => ref.current!.setCurrentColumn('nope'))
    expect(onCurrentColumnChange).toHaveBeenCalledTimes(1)
  })
})

describe('IrisTable single-mode radio column + pager total (batch T)', () => {
  it('selectable=single renders native radios (checked/onChange/aria)', () => {
    render(<IrisTable columns={baseColumns} data={rows} rowKey="id" selectable="single" />)
    const radios = Array.from(document.querySelectorAll('input[type=radio]')) as HTMLInputElement[]
    expect(radios.length).toBe(3)
    expect(document.querySelectorAll('[data-iris-table-radio]').length).toBe(3)
    expect(radios.every((r) => !r.checked)).toBe(true)
    expect(radios[0]!.getAttribute('aria-label')).toBe('Select row 1')
    act(() => fireEvent.click(radios[1]!))
    expect((document.querySelector('input[type=radio]') as HTMLInputElement).checked).toBe(false)
    expect((document.querySelectorAll('input[type=radio]')[1] as HTMLInputElement).checked).toBe(
      true,
    )
    // Single mode: clicking a second radio replaces the selection.
    act(() => fireEvent.click(radios[2]!))
    const after = Array.from(document.querySelectorAll('input[type=radio]')) as HTMLInputElement[]
    expect(after[1]!.checked).toBe(false)
    expect(after[2]!.checked).toBe(true)
  })

  it('selectable=multi keeps checkboxes (no radios); none renders no selection cell', () => {
    render(<IrisTable columns={baseColumns} data={rows} rowKey="id" selectable="multi" />)
    expect(document.querySelectorAll('input[type=radio]').length).toBe(0)
    expect(document.querySelectorAll('input[type=checkbox]').length).toBe(4) // 3 rows + select-all
    cleanup()
    render(<IrisTable columns={baseColumns} data={rows} rowKey="id" selectable="none" />)
    expect(document.querySelectorAll('input[type=checkbox]').length).toBe(0)
  })

  it('showTotal renders the i18n total text before the size selector', async () => {
    const query = vi.fn().mockResolvedValue({ rows, total: 3 })
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={[]}
        rowKey="id"
        proxyConfig={{ query }}
        pagerConfig={{ showTotal: true, pageSizes: [5, 10] }}
      />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-cell="name"]')).not.toBeNull()
    })
    const total = container.querySelector('[data-iris-table-total]')!
    expect(total.textContent).toBe('Total 3')
    // Placement: the total span precedes the page-size selector.
    const trigger = container.querySelector('[data-iris-select-trigger]')!
    expect(
      total.compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0)
    expect(container.querySelector('[data-iris-table-pager]')!.textContent).toContain('Total 3')
  })

  it('without showTotal no total span renders', async () => {
    const query = vi.fn().mockResolvedValue({ rows, total: 3 })
    const { container } = render(
      <IrisTable columns={baseColumns} data={[]} rowKey="id" proxyConfig={{ query }} />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-total]')).toBeNull()
    })
  })
})
