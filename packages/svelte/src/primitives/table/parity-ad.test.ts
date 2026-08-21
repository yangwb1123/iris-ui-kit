import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEvent, fireEvent, render, cleanup } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const columns = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
  { key: 'city', title: 'City' },
]

const data = [
  { id: 1, name: 'Alice', age: 30, city: 'NYC' },
  { id: 2, name: 'Bob', age: 25, city: 'LA' },
  { id: 3, name: 'Charlie', age: 35, city: 'SF' },
]

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON() {},
  }) as DOMRect

function stubDragRects(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    const rowId = this.getAttribute('data-iris-row-drag-handle')
    if (rowId) return rect(0, (Number(rowId) - 1) * 40, 40, 40)
    const columnKey = this.getAttribute('data-iris-table-header-drag-target')
    if (columnKey) {
      const index = columns.findIndex((column) => column.key === columnKey)
      return rect(index * 140, 0, 140, 40)
    }
    return rect(0, 0, 0, 0)
  })
}

async function pointer(
  node: Element,
  kind: 'pointerDown' | 'pointerMove' | 'pointerUp',
  clientX: number,
  clientY: number,
): Promise<void> {
  const event = createEvent[kind](node)
  Object.defineProperty(event, 'clientX', { value: clientX, configurable: true })
  Object.defineProperty(event, 'clientY', { value: clientY, configurable: true })
  Object.defineProperty(event, 'button', { value: 0, configurable: true })
  await fireEvent(node, event)
}

function bodyNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-iris-table-body] [data-iris-table-row]')].map(
    (row) => row.querySelector('[data-iris-table-cell="name"]')?.textContent?.trim() ?? '',
  )
}

describe('IrisTable batch AD — Svelte row/column drag', () => {
  it('keeps drag handles disabled by default', () => {
    const { container } = render(IrisTable, { props: { columns, data } })
    expect(container.querySelectorAll('[data-iris-row-drag-handle]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-iris-table-header-drag-target]')).toHaveLength(0)
  })

  it('reorders rows after crossing the shared drag threshold', async () => {
    stubDragRects()
    const onReorder = vi.fn()
    const onDataChange = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns, data, rowDrag: { onReorder }, onDataChange },
    })
    const root = container.querySelector('[data-iris-table]')!
    const firstHandle = container.querySelector('[data-iris-row-drag-handle="1"]')!

    await pointer(firstHandle, 'pointerDown', 0, 0)
    await pointer(root, 'pointerMove', 0, 85)
    await pointer(root, 'pointerUp', 0, 85)

    expect(onReorder).toHaveBeenCalledWith([data[1], data[2], data[0]])
    expect(onDataChange).toHaveBeenCalledWith([data[1], data[2], data[0]])
    expect(bodyNames(container)).toEqual(['Bob', 'Charlie', 'Alice'])
  })

  it('does not reorder on a press-and-release tap', async () => {
    stubDragRects()
    const onReorder = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns, data, rowDrag: { onReorder } },
    })
    const root = container.querySelector('[data-iris-table]')!
    const firstHandle = container.querySelector('[data-iris-row-drag-handle="1"]')!

    await pointer(firstHandle, 'pointerDown', 0, 0)
    await pointer(root, 'pointerUp', 0, 0)

    expect(onReorder).not.toHaveBeenCalled()
    expect(bodyNames(container)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('reorders leaf columns and leaves grouped headers fail-closed', async () => {
    stubDragRects()
    const onReorder = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns, data, columnDrag: { onReorder } },
    })
    const root = container.querySelector('[data-iris-table]')!
    const nameHeader = container.querySelector('[data-iris-table-header-drag-target="name"]')!

    await pointer(nameHeader, 'pointerDown', 0, 0)
    await pointer(root, 'pointerMove', 300, 20)
    await pointer(root, 'pointerUp', 300, 20)

    expect(onReorder).toHaveBeenCalledWith([columns[1], columns[2], columns[0]])
  })
})
