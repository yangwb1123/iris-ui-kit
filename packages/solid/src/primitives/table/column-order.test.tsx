import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

type Row = { id: number; name: string; age: number; status: string }

const rows: Row[] = [{ id: 1, name: 'Alice', age: 32, status: 'active' }]
const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age', summary: 'sum' },
  { key: 'status', title: 'Status' },
]
const headerKeys = (container: HTMLElement): string[] =>
  [...container.querySelectorAll<HTMLElement>('[data-iris-table-header]')].map((cell) =>
    cell.getAttribute('data-iris-table-header')!,
  )
const bodyCellKeys = (container: HTMLElement): string[] =>
  [
    ...container.querySelectorAll<HTMLElement>('[data-iris-table-row=""] [data-iris-table-cell]'),
  ].map((cell) => cell.getAttribute('data-iris-table-cell')!)
const pointer = (element: Element, type: string, clientX: number): void => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    button: number
    clientX: number
    clientY: number
  }
  Object.assign(event, { button: 0, clientX, clientY: 0 })
  element.dispatchEvent(event)
}
const rect = (left: number): DOMRect =>
  ({
    left,
    top: 0,
    right: left + 100,
    bottom: 40,
    width: 100,
    height: 40,
    x: left,
    y: 0,
    toJSON: () => ({}),
  }) as DOMRect
const stubHeaderRects = (): void => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const key = this.getAttribute('data-iris-table-header')
    const index = key === 'a' ? 0 : key === 'b' ? 1 : key === 'c' ? 2 : -1
    return index >= 0 ? rect(index * 100) : rect(0)
  })
}

describe('IrisTable Solid columnOrder', () => {
  it('orders known top-level columns, ignores unknown/duplicate keys, and preserves projections', () => {
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnOrder={['status', 'unknown', 'status', 'name']}
      />
    ))

    expect(headerKeys(container)).toEqual(['status', 'name', 'age'])
    expect(bodyCellKeys(container)).toEqual(['status', 'name', 'age'])
    expect(
      [...container.querySelectorAll('[data-iris-table-summary-cell]')].map((cell) =>
        cell.getAttribute('data-iris-table-cell'),
      ),
    ).toEqual(['age'])
    expect(columns.map((column) => column.key)).toEqual(['name', 'age', 'status'])
  })

  it('keeps controlled replacements silent and restores source order for empty or removed order', async () => {
    const [order, setOrder] = createSignal<string[] | undefined>(['status'])
    const onOrderChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnOrder={order()}
        onColumnOrderChange={onOrderChange}
      />
    ))

    expect(headerKeys(container)).toEqual(['status', 'name', 'age'])
    setOrder(['age', 'name'])
    await waitFor(() => expect(headerKeys(container)).toEqual(['age', 'name', 'status']))
    setOrder([])
    await waitFor(() => expect(headerKeys(container)).toEqual(['name', 'age', 'status']))
    setOrder(['status'])
    await waitFor(() => expect(headerKeys(container)).toEqual(['status', 'name', 'age']))
    setOrder(undefined)
    await waitFor(() => expect(headerKeys(container)).toEqual(['name', 'age', 'status']))
    expect(onOrderChange).not.toHaveBeenCalled()
    expect(columns.map((column) => column.key)).toEqual(['name', 'age', 'status'])
  })

  it('orders grouped top-level columns without changing group or leaf declarations', () => {
    const groupedColumns: IrisTableColumn<Row>[] = [
      {
        key: 'first',
        title: 'First',
        children: [
          { key: 'name', title: 'Name' },
          { key: 'age', title: 'Age' },
        ],
      },
      { key: 'last', title: 'Last', children: [{ key: 'status', title: 'Status' }] },
    ]
    const { container } = render(() => (
      <IrisTable
        columns={groupedColumns}
        data={rows}
        rowKey="id"
        columnOrder={['last', 'missing', 'last', 'first']}
      />
    ))

    expect(
      [...container.querySelectorAll<HTMLElement>('[data-iris-table-header-group]')].map((cell) =>
        cell.getAttribute('data-iris-table-header'),
      ),
    ).toEqual(['last', 'first'])
    expect(bodyCellKeys(container)).toEqual(['status', 'name', 'age'])
    expect(groupedColumns.map((column) => column.key)).toEqual(['first', 'last'])
    expect(groupedColumns[0]!.children!.map((column) => column.key)).toEqual(['name', 'age'])
  })

  it('does not create a local order proposal when order is not explicitly controlled', () => {
    stubHeaderRects()
    const onReorder = vi.fn()
    const onOrderChange = vi.fn()
    const dragColumns: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ]
    const { container } = render(() => (
      <IrisTable
        columns={dragColumns}
        data={rows}
        rowKey="id"
        columnDrag={{ onReorder }}
        onColumnOrderChange={onOrderChange}
      />
    ))
    const root = container.querySelector('[data-iris-table]')!
    pointer(container.querySelector('[data-iris-table-header="a"]')!, 'pointerdown', 10)
    pointer(root, 'pointermove', 250)
    pointer(root, 'pointerup', 250)

    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onOrderChange).not.toHaveBeenCalled()
    expect(headerKeys(container)).toEqual(['a', 'b', 'c'])
  })

  it('proposes controlled drag order through the Core columns feature without optimistic rendering', () => {
    stubHeaderRects()
    const onReorder = vi.fn()
    const onOrderChange = vi.fn()
    const dragColumns: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ]
    const { container } = render(() => (
      <IrisTable
        columns={dragColumns}
        data={rows}
        rowKey="id"
        columnOrder={['a', 'b', 'c']}
        columnDrag={{ onReorder }}
        onColumnOrderChange={onOrderChange}
      />
    ))
    const root = container.querySelector('[data-iris-table]')!
    pointer(container.querySelector('[data-iris-table-header="a"]')!, 'pointerdown', 10)
    pointer(root, 'pointermove', 250)
    pointer(root, 'pointerup', 250)

    expect(onReorder).toHaveBeenCalledWith([dragColumns[1], dragColumns[2], dragColumns[0]])
    expect(onOrderChange).toHaveBeenCalledWith(['b', 'c', 'a'])
    expect(headerKeys(container)).toEqual(['a', 'b', 'c'])
  })
})
