import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IrisTable } from '../Table'
import type { IrisTableColumn, IrisTableHandle } from '../types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

const rows: Row[] = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
  { id: 3, name: 'Charlie', age: 35 },
]

function tableRef(): { current: IrisTableHandle<Row> | null } {
  return { current: null }
}

function rowKeys(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-iris-table-row]')]
    .map((el) => el.getAttribute('data-iris-table-row'))
    .filter((key): key is string => key !== null && key !== 'header')
}

function cell(container: HTMLElement, rowId: string | number, key: string): HTMLElement | null {
  return container.querySelector(`[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`)
}

function editCell(
  container: HTMLElement,
  rowId: string | number,
  colKey: string,
  value: string,
): void {
  const target = cell(container, rowId, colKey)!
  act(() => fireEvent.doubleClick(target))
  const editor = container.querySelector('[data-iris-table-editor]') as HTMLInputElement
  act(() => {
    fireEvent.change(editor, { target: { value } })
    fireEvent.keyDown(editor, { key: 'Enter' })
  })
}

describe('IrisTable handle.cloneRow (iris 独有 — vxe-grid has no clone-row API)', () => {
  it('克隆内容: clone copies ALL field values onto a fresh row with a new auto id', () => {
    const r = tableRef()
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" tableRef={r} />)
    act(() => r.current?.cloneRow(2))
    // 新 key = max(1,2,3) + 1 = 4；字段值全部复制
    expect(cell(container, 4, 'name')?.textContent).toBe('Bob')
    expect(cell(container, 4, 'age')?.textContent).toBe('25')
    // 源行保持原 key 与值
    expect(cell(container, 2, 'name')?.textContent).toBe('Bob')
  })

  it('克隆内容: clone of a non-max row still gets max+1, not a duplicate key', () => {
    const r = tableRef()
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" tableRef={r} />)
    act(() => r.current?.cloneRow(1))
    expect(cell(container, 4, 'name')?.textContent).toBe('Alice')
    expect(cell(container, 1, 'name')?.textContent).toBe('Alice')
  })

  it('插入位置: default insert is right AFTER the source row', () => {
    const r = tableRef()
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" tableRef={r} />)
    act(() => r.current?.cloneRow(2))
    expect(rowKeys(container)).toEqual(['1', '2', '4', '3'])
  })

  it('插入位置: explicit index places the clone there', () => {
    const r = tableRef()
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" tableRef={r} />)
    act(() => r.current?.cloneRow(2, 0))
    expect(rowKeys(container)).toEqual(['4', '1', '2', '3'])
    expect(cell(container, 4, 'name')?.textContent).toBe('Bob')
  })

  it('插入位置: clone of the last row appends at the end', () => {
    const r = tableRef()
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" tableRef={r} />)
    act(() => r.current?.cloneRow(3))
    expect(rowKeys(container)).toEqual(['1', '2', '3', '4'])
    expect(cell(container, 4, 'name')?.textContent).toBe('Charlie')
  })

  it('missing key is a silent no-op: no row, no onDataChange', () => {
    const r = tableRef()
    const onDataChange = vi.fn()
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" tableRef={r} onDataChange={onDataChange} />,
    )
    act(() => r.current?.cloneRow(99))
    expect(rowKeys(container)).toEqual(['1', '2', '3'])
    expect(onDataChange).not.toHaveBeenCalled()
  })

  it('fires onDataChange exactly once with the full new list', () => {
    const r = tableRef()
    const onDataChange = vi.fn()
    render(
      <IrisTable columns={cols} data={rows} rowKey="id" tableRef={r} onDataChange={onDataChange} />,
    )
    act(() => r.current?.cloneRow(1))
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next.map((row) => row.id)).toEqual([1, 4, 2, 3])
    expect(next[1]).toMatchObject({ name: 'Alice', age: 30 })
  })

  it('selection is untouched: the clone is NOT selected, source keeps its state', () => {
    const r = tableRef()
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" selectable="multi" tableRef={r} />,
    )
    const rowBox = container.querySelector('[data-iris-table-row="2"] input[type=checkbox]')!
    act(() => fireEvent.click(rowBox)) // select row id=2
    expect(container.querySelectorAll('[data-iris-table-row-selected="true"]').length).toBe(1)
    act(() => r.current?.cloneRow(2))
    expect(container.querySelectorAll('[data-iris-table-row-selected="true"]').length).toBe(1)
    expect(
      container
        .querySelector('[data-iris-table-row-selected="true"]')
        ?.getAttribute('data-iris-table-row'),
    ).toBe('2')
  })

  it('undo reverts the clone (one ctrl+z removes the inserted copy)', () => {
    const r = tableRef()
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" undo tableRef={r} />,
    )
    act(() => r.current?.cloneRow(2))
    expect(rowKeys(container)).toEqual(['1', '2', '4', '3'])
    act(() =>
      fireEvent.keyDown(container.querySelector('[data-iris-table]')!, { key: 'z', ctrlKey: true }),
    )
    expect(rowKeys(container)).toEqual(['1', '2', '3'])
  })

  it('audit log records ONE insert entry with the clone rowKey', () => {
    const r = tableRef()
    render(<IrisTable columns={cols} data={rows} rowKey="id" auditLog tableRef={r} />)
    act(() => r.current?.cloneRow(2))
    const log = r.current!.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ type: 'insert', rowKey: 4 })
    expect(log[0]!.column).toBeUndefined()
  })

  it('dirty-point semantics: a dirty source row keeps its dot, the clone renders clean', () => {
    const editableCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true },
      { key: 'age', title: 'Age' },
    ]
    const r = tableRef()
    const { container } = render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        editDirtyConfig={{ indicator: true }}
        tableRef={r}
      />,
    )
    editCell(container, 2, 'name', 'Bobby')
    expect(
      container.querySelector('[data-iris-table-row="2"] [data-iris-cell-dirty]'),
    ).not.toBeNull()
    act(() => r.current?.cloneRow(2))
    // 脏点按行 key 寻址 → 源行脏点不动
    expect(
      container.querySelector('[data-iris-table-row="2"] [data-iris-cell-dirty]'),
    ).not.toBeNull()
    // 克隆新身份渲染干净
    expect(container.querySelector('[data-iris-table-row="4"] [data-iris-cell-dirty]')).toBeNull()
    // 克隆内容含已提交的脏点值（浅拷贝全部字段）
    expect(cell(container, 4, 'name')?.textContent).toBe('Bobby')
  })

  it('integration: the clone is addressable by its new key (updateRow + removeRow)', () => {
    const r = tableRef()
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" tableRef={r} />)
    act(() => r.current?.cloneRow(2))
    act(() => r.current?.updateRow(4, { name: 'Bobby' }))
    expect(cell(container, 4, 'name')?.textContent).toBe('Bobby')
    expect(cell(container, 2, 'name')?.textContent).toBe('Bob')
    act(() => r.current?.removeRow(2)) // 删源行 → 克隆存活
    expect(container.querySelector('[data-iris-table-row="2"]')).toBeNull()
    expect(cell(container, 4, 'name')?.textContent).toBe('Bobby')
    expect(rowKeys(container)).toEqual(['1', '4', '3'])
  })

  it('repeated clones keep unique auto ids (max+1 advances every time)', () => {
    const r = tableRef()
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" tableRef={r} />)
    act(() => r.current?.cloneRow(2))
    act(() => r.current?.cloneRow(2))
    act(() => r.current?.cloneRow(2))
    // 每次克隆都在源行之后插入 max+1 的新 key
    expect(rowKeys(container)).toEqual(['1', '2', '6', '5', '4', '3'])
    expect(cell(container, 6, 'name')?.textContent).toBe('Bob')
    expect(cell(container, 5, 'name')?.textContent).toBe('Bob')
    expect(cell(container, 4, 'name')?.textContent).toBe('Bob')
  })

  it('getData reflects the cloned list; the source data array is untouched', () => {
    const r = tableRef()
    const original = rows.map((row) => ({ ...row }))
    render(<IrisTable columns={cols} data={rows} rowKey="id" tableRef={r} />)
    act(() => r.current?.cloneRow(1))
    expect(r.current!.getData().map((row) => row.id)).toEqual([1, 4, 2, 3])
    expect(rows).toEqual(original)
    expect(rows).toHaveLength(3)
  })
})
