import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, createEvent, fireEvent, render, waitFor } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import IrisTable from './IrisTable.svelte'
import type { IrisTableColumn, IrisTableColumnWidths } from './types'

afterEach(cleanup)

type Row = { id: number; name: string; age: number; status: string }

const rows: Row[] = [{ id: 1, name: 'Alice', age: 32, status: 'active' }]
const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', width: 200 },
  { key: 'age', title: 'Age', width: '96px' },
  { key: 'status', title: 'Status' },
]

function gridTemplate(container: HTMLElement): string {
  return (container.querySelector('[data-iris-table-header-row]') as HTMLElement).style
    .gridTemplateColumns
}

function handle(container: HTMLElement, key: string): HTMLElement {
  return container.querySelector(
    `[data-iris-table-resize-handle][data-column-key="${key}"]`,
  ) as HTMLElement
}

function header(container: HTMLElement, key: string): Element | null {
  return container.querySelector(`[data-iris-table-header="${key}"]`)
}

async function dragPointer(
  node: Element,
  kind: 'pointerDown' | 'pointerMove' | 'pointerUp',
  clientX: number,
): Promise<void> {
  const event = createEvent[kind](node)
  Object.defineProperty(event, 'clientX', { value: clientX, configurable: true })
  Object.defineProperty(event, 'button', { value: 0, configurable: true })
  Object.defineProperty(event, 'pointerId', { value: 1, configurable: true })
  await fireEvent(node, event)
}

describe('Svelte IrisTable Grid Core columns bridge', () => {
  it('keeps sparse default, declared, and fallback widths without an initial callback', () => {
    const onWidthsChange = vi.fn()
    const { container } = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        defaultColumnWidths: { name: 180 },
        onColumnWidthsChange: onWidthsChange,
      },
    })

    expect(gridTemplate(container)).toContain('180px 96px minmax(0, 1fr)')
    expect(onWidthsChange).not.toHaveBeenCalled()
  })

  it('routes keyboard and pointer resize through Core with one sparse callback each', async () => {
    const onWidthsChange = vi.fn()
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        resizableColumns: true,
        defaultColumnWidths: { name: 100 },
        onColumnWidthsChange: onWidthsChange,
      },
    })

    await fireEvent.keyDown(handle(view.container, 'name'), { key: 'ArrowRight' })
    flushSync()
    expect(gridTemplate(view.container)).toContain('116px 96px minmax(0, 1fr)')
    expect(onWidthsChange).toHaveBeenCalledTimes(1)
    expect(onWidthsChange).toHaveBeenLastCalledWith({ name: 116 })

    cleanup()
    const pointerCallback = vi.fn()
    const pointerView = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        resizableColumns: true,
        defaultColumnWidths: { name: 100 },
        onColumnWidthsChange: pointerCallback,
      },
    })
    const resizeHandle = handle(pointerView.container, 'name')
    await dragPointer(resizeHandle, 'pointerDown', 0)
    await dragPointer(resizeHandle, 'pointerMove', 12)
    await dragPointer(resizeHandle, 'pointerUp', 12)
    flushSync()

    expect(pointerCallback).toHaveBeenCalledTimes(1)
    expect(pointerCallback).toHaveBeenCalledWith({ name: 112 })
    expect(gridTemplate(pointerView.container)).toContain('112px 96px minmax(0, 1fr)')
  })

  it('clamps keyboard resize and does not sort when the handle is clicked', async () => {
    const onUpdateSort = vi.fn()
    const minView = render(IrisTable, {
      props: {
        columns: [{ key: 'name', title: 'Name', minWidth: 90 }, ...columns.slice(1)],
        data: rows,
        rowKey: 'id',
        resizableColumns: true,
        defaultColumnWidths: { name: 100 },
      },
    })
    await fireEvent.keyDown(handle(minView.container, 'name'), { key: 'ArrowLeft' })
    flushSync()
    expect(gridTemplate(minView.container)).toContain('90px')
    cleanup()

    const maxView = render(IrisTable, {
      props: {
        columns: [{ key: 'name', title: 'Name', maxWidth: 110 }, ...columns.slice(1)],
        data: rows,
        rowKey: 'id',
        resizableColumns: true,
        defaultColumnWidths: { name: 100 },
        onUpdateSort,
      },
    })
    await fireEvent.keyDown(handle(maxView.container, 'name'), { key: 'ArrowRight' })
    flushSync()
    expect(gridTemplate(maxView.container)).toContain('110px')
    await fireEvent.click(handle(maxView.container, 'name'))
    expect(onUpdateSort).not.toHaveBeenCalled()
  })

  it('keeps controlled widths authoritative and silently accepts a parent replacement', async () => {
    const widths: IrisTableColumnWidths = { name: 150, age: 80 }
    const onWidthsChange = vi.fn()
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnWidths: widths,
        resizableColumns: true,
        onColumnWidthsChange: onWidthsChange,
      },
    })

    await fireEvent.keyDown(handle(view.container, 'name'), { key: 'ArrowRight' })
    flushSync()
    expect(onWidthsChange).toHaveBeenCalledWith({ name: 166, age: 80 })
    expect(gridTemplate(view.container)).toContain('150px 80px')

    await view.rerender({ columnWidths: { name: 170, age: 90 } })
    flushSync()
    expect(gridTemplate(view.container)).toContain('170px 90px')
    expect(onWidthsChange).toHaveBeenCalledTimes(1)
  })

  it('restores the default or last uncontrolled snapshot across control handoffs', async () => {
    const onWidthsChange = vi.fn()
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        defaultColumnWidths: { name: 100 },
        resizableColumns: true,
        onColumnWidthsChange: onWidthsChange,
      },
    })

    await fireEvent.keyDown(handle(view.container, 'name'), { key: 'ArrowRight' })
    flushSync()
    expect(gridTemplate(view.container)).toContain('116px')

    await view.rerender({ columnWidths: { name: 310 } })
    flushSync()
    expect(gridTemplate(view.container)).toContain('310px')
    await view.rerender({ columnWidths: undefined })
    flushSync()
    expect(gridTemplate(view.container)).toContain('116px')

    await view.rerender({ columnWidths: { name: 330 } })
    flushSync()
    await view.rerender({ columnWidths: undefined })
    flushSync()
    expect(gridTemplate(view.container)).toContain('116px')
    expect(onWidthsChange).toHaveBeenCalledTimes(1)

    const controlledView = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnWidths: { name: 310 },
        defaultColumnWidths: { name: 220 },
      },
    })
    await controlledView.rerender({ columnWidths: undefined })
    flushSync()
    expect(gridTemplate(controlledView.container)).toContain('220px')
  })

  it('renders visibility replacements and restores all columns when control is removed', async () => {
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnVisibility: { age: false },
      },
    })

    expect(header(view.container, 'name')).not.toBeNull()
    expect(header(view.container, 'age')).toBeNull()
    await view.rerender({ columnVisibility: { name: false } })
    flushSync()
    expect(header(view.container, 'name')).toBeNull()
    expect(header(view.container, 'age')).not.toBeNull()
    await view.rerender({ columnVisibility: undefined })
    flushSync()
    expect(header(view.container, 'name')).not.toBeNull()
    expect(header(view.container, 'age')).not.toBeNull()
    expect(header(view.container, 'status')).not.toBeNull()
  })

  it('keeps grouped visibility top-level-only and static pinned descriptors intact', () => {
    const groupedColumns: IrisTableColumn<Row>[] = [
      {
        key: 'identity',
        title: 'Identity',
        children: [
          { key: 'name', title: 'Name', width: 120 },
          { key: 'age', title: 'Age', width: '90px' },
        ],
      },
      { key: 'status', title: 'Status', pinned: 'left' },
    ]
    const { container } = render(IrisTable, {
      props: {
        columns: groupedColumns,
        data: rows,
        rowKey: 'id',
        columnVisibility: { name: false },
      },
    })

    expect(header(container, 'identity')).not.toBeNull()
    expect(container.querySelector('[data-iris-table-cell="name"]')).not.toBeNull()
    expect(
      container
        .querySelector('[data-iris-table-cell="status"]')
        ?.getAttribute('data-iris-table-pinned'),
    ).toBe('left')
  })

  it('keeps effective widths wired to column virtualization and persistence snapshots', async () => {
    const getItem = vi.fn(() => null)
    const setItem = vi.fn()
    const onWidthsChange = vi.fn()
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnVirtualization: true,
        resizableColumns: true,
        columnWidths: { name: 150, age: 80 },
        defaultColumnWidths: { name: 100 },
        onColumnWidthsChange: onWidthsChange,
        persistState: { storage: { getItem, setItem } },
      },
    })

    expect(view.container.querySelector('[data-column-virtualized="true"]')).not.toBeNull()
    expect(gridTemplate(view.container)).toContain('150px 80px minmax(0, 1fr)')
    expect(getItem).toHaveBeenCalled()
    expect(onWidthsChange).not.toHaveBeenCalled()

    await view.rerender({ columnWidths: undefined })
    flushSync()
    await fireEvent.keyDown(handle(view.container, 'name'), { key: 'ArrowRight' })
    flushSync()
    await waitFor(() => {
      const calls = setItem.mock.calls as Array<[string, string]>
      const saved = JSON.parse(calls[calls.length - 1]![1]!) as { columnWidths?: unknown }
      expect(saved.columnWidths).toEqual({ name: 116 })
    })
    expect(onWidthsChange).toHaveBeenCalledTimes(1)
  })
})
