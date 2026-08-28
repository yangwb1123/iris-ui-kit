import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEvent, fireEvent, render, cleanup } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import IrisTable from './IrisTable.svelte'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

type Row = { id: number; a: string; b: number; c: string }

const rows: Row[] = [{ id: 1, a: 'A', b: 2, c: 'C' }]
const columns: IrisTableColumn<Row>[] = [
  { key: 'a', title: 'A' },
  { key: 'b', title: 'B', summary: 'sum' },
  { key: 'c', title: 'C' },
]

function headerKeys(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-iris-table-header]')].map((cell) =>
    cell.getAttribute('data-iris-table-header')!,
  )
}

function firstBodyCellKeys(container: HTMLElement): string[] {
  const row = container.querySelector('[data-iris-table-body] [data-iris-table-row]')
  return row
    ? [...row.querySelectorAll('[data-iris-table-cell]')].map((cell) =>
        cell.getAttribute('data-iris-table-cell')!,
      )
    : []
}

function stubHeaderRects(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    const key = this.getAttribute('data-iris-table-header-drag-target')
    const index = columns.findIndex((column) => column.key === key)
    if (index < 0) {
      return {
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect
    }
    return {
      left: index * 100,
      top: 0,
      width: 100,
      height: 40,
      right: (index + 1) * 100,
      bottom: 40,
      x: index * 100,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
  })
}

async function drag(
  node: Element,
  kind: 'pointerDown' | 'pointerMove' | 'pointerUp',
  clientX: number,
): Promise<void> {
  const event = createEvent[kind](node)
  Object.defineProperty(event, 'clientX', { value: clientX, configurable: true })
  Object.defineProperty(event, 'clientY', { value: 0, configurable: true })
  Object.defineProperty(event, 'button', { value: 0, configurable: true })
  Object.defineProperty(event, 'pointerId', { value: 1, configurable: true })
  await fireEvent(node, event)
}

describe('Svelte IrisTable columnOrder Grid Core bridge', () => {
  it('projects known keys, ignores unknown and duplicate keys, and leaves source columns untouched', () => {
    const { container } = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnOrder: ['c', 'unknown', 'c', 'a'],
      },
    })

    expect(headerKeys(container)).toEqual(['c', 'a', 'b'])
    expect(firstBodyCellKeys(container)).toEqual(['c', 'a', 'b'])
    expect(
      container
        .querySelector('[data-iris-table-summary-cell]')
        ?.getAttribute('data-iris-table-cell'),
    ).toBe('b')
    expect(columns.map((column) => column.key)).toEqual(['a', 'b', 'c'])
  })

  it('keeps controlled replacements silent and restores source order on empty or removal', async () => {
    const onOrder = vi.fn()
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnOrder: ['c'],
        onColumnOrderChange: onOrder,
      },
    })

    expect(headerKeys(view.container)).toEqual(['c', 'a', 'b'])
    await view.rerender({ columnOrder: ['b', 'a'] })
    flushSync()
    expect(headerKeys(view.container)).toEqual(['b', 'a', 'c'])
    await view.rerender({ columnOrder: [] })
    flushSync()
    expect(headerKeys(view.container)).toEqual(['a', 'b', 'c'])
    await view.rerender({ columnOrder: ['c'] })
    flushSync()
    expect(headerKeys(view.container)).toEqual(['c', 'a', 'b'])
    await view.rerender({ columnOrder: undefined })
    flushSync()
    expect(headerKeys(view.container)).toEqual(['a', 'b', 'c'])
    expect(onOrder).not.toHaveBeenCalled()
  })

  it('does not claim order ownership for a callback-only column drag', async () => {
    stubHeaderRects()
    const onReorder = vi.fn()
    const onOrder = vi.fn()
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnDrag: { onReorder },
        onColumnOrderChange: onOrder,
      },
    })
    const root = view.container.querySelector('[data-iris-table]')!
    const header = view.container.querySelector('[data-iris-table-header="a"]')!

    await drag(header, 'pointerDown', 10)
    await drag(root, 'pointerMove', 250)
    await drag(root, 'pointerUp', 250)
    flushSync()

    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onReorder.mock.calls[0]?.[0].map((column: IrisTableColumn<Row>) => column.key)).toEqual([
      'b',
      'c',
      'a',
    ])
    expect(onOrder).not.toHaveBeenCalled()
    expect(headerKeys(view.container)).toEqual(['a', 'b', 'c'])
  })

  it('proposes through Core only for a controlled order and stays non-optimistic on rejection', async () => {
    stubHeaderRects()
    const onReorder = vi.fn()
    const onOrder = vi.fn()
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnOrder: ['a', 'b', 'c'],
        columnDrag: { onReorder },
        onColumnOrderChange: onOrder,
      },
    })
    const root = view.container.querySelector('[data-iris-table]')!
    const header = view.container.querySelector('[data-iris-table-header="a"]')!

    await drag(header, 'pointerDown', 10)
    await drag(root, 'pointerMove', 250)
    await drag(root, 'pointerUp', 250)
    flushSync()

    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onOrder).toHaveBeenCalledTimes(1)
    expect(onOrder).toHaveBeenCalledWith(['b', 'c', 'a'])
    expect(headerKeys(view.container)).toEqual(['a', 'b', 'c'])

    await view.rerender({ columnOrder: undefined })
    flushSync()
    expect(headerKeys(view.container)).toEqual(['a', 'b', 'c'])
  })

  it('orders grouped top-level columns without changing group or leaf declarations', () => {
    const groupedColumns: IrisTableColumn<Row>[] = [
      {
        key: 'first',
        title: 'First',
        children: [
          { key: 'a', title: 'A' },
          { key: 'b', title: 'B' },
        ],
      },
      { key: 'last', title: 'Last', children: [{ key: 'c', title: 'C' }] },
    ]
    const { container } = render(IrisTable, {
      props: {
        columns: groupedColumns,
        data: rows,
        rowKey: 'id',
        columnOrder: ['last', 'unknown', 'last', 'first'],
      },
    })

    expect(headerKeys(container).slice(0, 2)).toEqual(['last', 'first'])
    expect(firstBodyCellKeys(container)).toEqual(['c', 'a', 'b'])
    expect(groupedColumns.map((column) => column.key)).toEqual(['first', 'last'])
    expect(groupedColumns[0]?.children?.map((column) => column.key)).toEqual(['a', 'b'])
  })
})
