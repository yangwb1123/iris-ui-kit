import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IrisTable, type IrisTableColumn, type IrisTableHandle } from '../index'

afterEach(cleanup)

interface Row {
  id: number
  name: string
  age: number
  children?: Row[]
  [key: string]: unknown
}

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function caretOf(id: number): HTMLButtonElement | null {
  return document.querySelector(`[data-iris-table-row="${id}"] [data-iris-table-tree-toggle]`)
}

const lazyRoots: Row[] = [{ id: 1, name: 'root', age: 1 }]

describe('@iris-ui-kit/react IrisTable lazy tree (vxe lazyLoad parity, batch J)', () => {
  it('a childless row renders a caret only when lazyLoad is configured', () => {
    const { container } = render(
      <IrisTable
        columns={cols}
        data={lazyRoots}
        rowKey="id"
        getSubRows={(r) => r.children}
        lazyLoad={() => {}}
      />,
    )
    const caret = caretOf(1)
    expect(caret).not.toBeNull()
    expect(caret!.getAttribute('aria-expanded')).toBe('false')
    expect(caret!.getAttribute('data-iris-tree-loading')).toBeNull()
    expect(container.textContent).toContain('root')

    cleanup()
    render(<IrisTable columns={cols} data={lazyRoots} rowKey="id" getSubRows={(r) => r.children} />)
    expect(caretOf(1)).toBeNull()
  })

  it('click calls lazyLoad with the row; load(children) renders them expanded', () => {
    const lazyLoad = vi.fn((_row: Row, load: (children: Row[]) => void) => {
      load([
        { id: 2, name: 'child', age: 2 },
        { id: 3, name: 'child2', age: 3 },
      ])
    })
    render(
      <IrisTable
        columns={cols}
        data={lazyRoots}
        rowKey="id"
        getSubRows={(r) => r.children}
        lazyLoad={lazyLoad}
      />,
    )
    act(() => {
      fireEvent.click(caretOf(1)!)
    })
    expect(lazyLoad).toHaveBeenCalledTimes(1)
    expect(lazyLoad.mock.calls[0]![0]).toEqual(lazyRoots[0])
    // Loaded children render, expanded.
    expect(document.querySelector('[data-iris-table-row="2"]')).not.toBeNull()
    expect(document.querySelector('[data-iris-table-row="3"]')).not.toBeNull()
    expect(caretOf(1)!.getAttribute('aria-expanded')).toBe('true')
  })

  it('after load the caret toggles collapse / expand like a normal parent', () => {
    const lazyLoad = vi.fn((_row: Row, load: (children: Row[]) => void) => {
      load([{ id: 2, name: 'child', age: 2 }])
    })
    render(
      <IrisTable
        columns={cols}
        data={lazyRoots}
        rowKey="id"
        getSubRows={(r) => r.children}
        lazyLoad={lazyLoad}
      />,
    )
    act(() => {
      fireEvent.click(caretOf(1)!)
    })
    expect(document.querySelector('[data-iris-table-row="2"]')).not.toBeNull()
    // Collapse.
    act(() => {
      fireEvent.click(caretOf(1)!)
    })
    expect(document.querySelector('[data-iris-table-row="2"]')).toBeNull()
    expect(caretOf(1)!.getAttribute('aria-expanded')).toBe('false')
    // Expand again — no second lazyLoad (children are cached).
    act(() => {
      fireEvent.click(caretOf(1)!)
    })
    expect(document.querySelector('[data-iris-table-row="2"]')).not.toBeNull()
    expect(lazyLoad).toHaveBeenCalledTimes(1)
  })

  it('loading state prevents double-load and resolves into an expanded tree', () => {
    let resolve!: (children: Row[]) => void
    const lazyLoad = vi.fn((_row: Row, load: (children: Row[]) => void) => {
      resolve = load
    })
    render(
      <IrisTable
        columns={cols}
        data={lazyRoots}
        rowKey="id"
        getSubRows={(r) => r.children}
        lazyLoad={lazyLoad}
      />,
    )
    act(() => {
      fireEvent.click(caretOf(1)!)
    })
    expect(caretOf(1)!.getAttribute('data-iris-tree-loading')).toBe('')
    // Second click while loading is a no-op.
    act(() => {
      fireEvent.click(caretOf(1)!)
    })
    expect(lazyLoad).toHaveBeenCalledTimes(1)
    act(() => {
      resolve([{ id: 2, name: 'child', age: 2 }])
    })
    expect(caretOf(1)!.getAttribute('data-iris-tree-loading')).toBeNull()
    expect(document.querySelector('[data-iris-table-row="2"]')).not.toBeNull()
    expect(caretOf(1)!.getAttribute('aria-expanded')).toBe('true')
  })

  it('a throwing lazyLoad clears the loading caret and stays retryable', () => {
    const lazyLoad = vi.fn(() => {
      throw new Error('boom')
    })
    render(
      <IrisTable
        columns={cols}
        data={lazyRoots}
        rowKey="id"
        getSubRows={(r) => r.children}
        lazyLoad={lazyLoad}
      />,
    )
    act(() => {
      fireEvent.click(caretOf(1)!)
    })
    expect(caretOf(1)!.getAttribute('data-iris-tree-loading')).toBeNull()
    act(() => {
      fireEvent.click(caretOf(1)!)
    })
    expect(lazyLoad).toHaveBeenCalledTimes(2)
  })
})

describe('@iris-ui-kit/react IrisTable handle.removeRows (batch J)', () => {
  const fourRows: Row[] = [
    { id: 1, name: 'a', age: 1 },
    { id: 2, name: 'b', age: 2 },
    { id: 3, name: 'c', age: 3 },
    { id: 4, name: 'd', age: 4 },
  ]

  function Harness({
    tableRef,
    onDataChange,
    onSelectionChange,
  }: {
    tableRef: React.MutableRefObject<IrisTableHandle<Row> | null>
    onDataChange?: (rows: Row[]) => void
    onSelectionChange?: (next: Array<string | number>) => void
  }) {
    return (
      <IrisTable
        columns={cols}
        data={fourRows}
        rowKey="id"
        selectable="multi"
        tableRef={tableRef}
        onDataChange={onDataChange}
        onSelectionChange={onSelectionChange}
      />
    )
  }

  function checkRow(id: number): void {
    fireEvent.click(document.querySelector(`[data-iris-table-row="${id}"] input[type=checkbox]`)!)
  }

  it('removes several keys at once, prunes selection, fires onDataChange once, ignores missing keys', () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    const onDataChange = vi.fn()
    const onSelectionChange = vi.fn()
    render(
      <Harness tableRef={ref} onDataChange={onDataChange} onSelectionChange={onSelectionChange} />,
    )
    act(() => {
      checkRow(1)
      checkRow(3)
    })
    expect(document.querySelectorAll('[data-iris-table-row-selected="true"]').length).toBe(2)

    act(() => {
      ref.current?.removeRows([1, 3, 999])
    })
    expect(document.querySelector('[data-iris-table-row="1"]')).toBeNull()
    expect(document.querySelector('[data-iris-table-row="3"]')).toBeNull()
    expect(document.querySelector('[data-iris-table-row="2"]')).not.toBeNull()
    expect(document.querySelector('[data-iris-table-row="4"]')).not.toBeNull()
    expect(onDataChange).toHaveBeenCalledTimes(1)
    expect(onDataChange).toHaveBeenCalledWith([
      { id: 2, name: 'b', age: 2 },
      { id: 4, name: 'd', age: 4 },
    ])
    // Selection pruned to only the removed keys.
    expect(document.querySelectorAll('[data-iris-table-row-selected="true"]').length).toBe(0)
    expect(onSelectionChange).toHaveBeenLastCalledWith([])
  })

  it('only removes the actually-present keys from a mixed list', () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    const onDataChange = vi.fn()
    render(<Harness tableRef={ref} onDataChange={onDataChange} />)
    act(() => {
      ref.current?.removeRows([2, 99, 4])
    })
    expect(onDataChange).toHaveBeenCalledTimes(1)
    expect(onDataChange).toHaveBeenCalledWith([
      { id: 1, name: 'a', age: 1 },
      { id: 3, name: 'c', age: 3 },
    ])
    expect(document.querySelector('[data-iris-table-row="2"]')).toBeNull()
    expect(document.querySelector('[data-iris-table-row="4"]')).toBeNull()
  })

  it('all-missing keys is a zero side-effect no-op', () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    const onDataChange = vi.fn()
    const onSelectionChange = vi.fn()
    render(
      <Harness tableRef={ref} onDataChange={onDataChange} onSelectionChange={onSelectionChange} />,
    )
    act(() => {
      ref.current?.removeRows([999, 888])
    })
    expect(onDataChange).not.toHaveBeenCalled()
    expect(onSelectionChange).not.toHaveBeenCalled()
    expect(
      document.querySelectorAll('[data-iris-table-row]:not([data-iris-table-row="header"])').length,
    ).toBe(4)
  })
})

describe('@iris-ui-kit/react IrisTable Tab edit navigation (batch J)', () => {
  const editCols: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Name', editable: true },
    { key: 'age', title: 'Age', editable: true, editor: 'number' },
    { key: 'note', title: 'Note' }, // not editable — skipped by Tab
  ]
  const rows: Row[] = [{ id: 1, name: 'Charlie', age: 30, note: 'x' }]

  function editor(): HTMLInputElement | null {
    return document.querySelector('[data-iris-table-editor]')
  }

  function openCell(colKey: string): void {
    fireEvent.doubleClick(
      document.querySelector(`[data-iris-table-row="1"] [data-iris-table-cell="${colKey}"]`)!,
    )
  }

  it('Tab commits the current cell and opens the next editable column', () => {
    const onCellEdit = vi.fn()
    const { container } = render(
      <IrisTable columns={editCols} data={rows} onCellEdit={onCellEdit} />,
    )
    act(() => {
      openCell('name')
    })
    expect(editor()).not.toBeNull()
    act(() => {
      fireEvent.change(editor()!, { target: { value: 'Charlie2' } })
      fireEvent.keyDown(editor()!, { key: 'Tab' })
    })
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        column: expect.objectContaining({ key: 'name' }),
        newValue: 'Charlie2',
      }),
    )
    // The editor moved to the next editable column (age), skipping `note`.
    const next = container.querySelector(
      '[data-iris-table-row="1"] [data-iris-table-cell="age"] [data-iris-table-editor]',
    )
    expect(next).not.toBeNull()
    expect(next).toBe(editor())
  })

  it('Shift+Tab goes back to the previous editable column', () => {
    const onCellEdit = vi.fn()
    const { container } = render(
      <IrisTable columns={editCols} data={rows} onCellEdit={onCellEdit} />,
    )
    act(() => {
      openCell('age')
    })
    expect(editor()).not.toBeNull()
    act(() => {
      fireEvent.change(editor()!, { target: { value: '31' } })
      fireEvent.keyDown(editor()!, { key: 'Tab', shiftKey: true })
    })
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        column: expect.objectContaining({ key: 'age' }),
        newValue: 31,
      }),
    )
    const prev = container.querySelector(
      '[data-iris-table-row="1"] [data-iris-table-cell="name"] [data-iris-table-editor]',
    )
    expect(prev).not.toBeNull()
    expect(prev).toBe(editor())
  })

  it('Tab with no editable neighbor commits and closes the editor', () => {
    const onCellEdit = vi.fn()
    const { container } = render(
      <IrisTable columns={editCols} data={rows} onCellEdit={onCellEdit} />,
    )
    act(() => {
      openCell('age') // last editable column
    })
    act(() => {
      fireEvent.change(editor()!, { target: { value: '31' } })
      fireEvent.keyDown(editor()!, { key: 'Tab' })
    })
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ column: expect.objectContaining({ key: 'age' }) }),
    )
    // Editor closed — no editor anywhere in the table.
    expect(container.querySelector('[data-iris-table-editor]')).toBeNull()
  })

  it('Tab does not move on validation failure (commit rejected, cell stays)', () => {
    const validated: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true },
      {
        key: 'age',
        title: 'Age',
        editable: true,
        editor: 'number',
        validate: (v) => ((v as number) >= 18 ? null : 'too young'),
      },
    ]
    const onCellEdit = vi.fn()
    const { container } = render(
      <IrisTable columns={validated} data={rows} onCellEdit={onCellEdit} />,
    )
    act(() => {
      openCell('age')
    })
    act(() => {
      fireEvent.change(editor()!, { target: { value: '10' } })
      fireEvent.keyDown(editor()!, { key: 'Tab' })
    })
    expect(onCellEdit).not.toHaveBeenCalled()
    // Still editing the same (age) cell with the error shown.
    expect(
      container.querySelector(
        '[data-iris-table-row="1"] [data-iris-table-cell="age"] [data-iris-table-editor]',
      ),
    ).not.toBeNull()
    expect(document.querySelector('[data-iris-table-editor-error]')).not.toBeNull()
  })
})
