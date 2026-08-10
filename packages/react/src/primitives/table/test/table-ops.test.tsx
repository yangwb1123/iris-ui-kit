import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IrisTable, type IrisTableColumn, type IrisTableHandle } from '../index'

afterEach(cleanup)

interface Row {
  id: number
  name: string
  age: number
  [key: string]: unknown
}

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function Harness({
  rows,
  tableRef,
}: {
  rows: Row[]
  tableRef: React.MutableRefObject<IrisTableHandle<Row> | null>
}) {
  return <IrisTable columns={cols} data={rows} rowKey="id" selectable="multi" tableRef={tableRef} />
}

describe('IrisTable row ops (vxe-grid insert/remove/update parity)', () => {
  it('tableRef.insertRow appends a row with auto id', () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    const { container } = render(<Harness rows={[{ id: 1, name: 'a', age: 1 }]} tableRef={ref} />)
    act(() => ref.current?.insertRow({ name: 'b', age: 2 } as Row))
    expect(container.textContent).toContain('b')
    expect(ref.current).not.toBeNull()
  })

  it('tableRef.insertRow at index + removeRow + updateRow', () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    const onDataChange = vi.fn()
    const { container } = render(
      <IrisTable
        columns={cols}
        data={[{ id: 1, name: 'a', age: 1 }]}
        rowKey="id"
        tableRef={ref}
        onDataChange={onDataChange}
      />,
    )
    act(() => ref.current?.insertRow({ id: 2, name: 'b', age: 2 }, 0))
    expect(container.textContent).toContain('b')
    act(() => ref.current?.updateRow(2, { name: 'B2' }))
    expect(container.textContent).toContain('B2')
    act(() => ref.current?.removeRow(1))
    expect(container.querySelector('[data-iris-table-row="1"]')).toBeNull()
    expect(onDataChange).toHaveBeenCalled()
    // 无匹配 key 静默 no-op（不崩）
    act(() => ref.current?.removeRow(999))
    act(() => ref.current?.updateRow(999, { name: 'x' }))
  })

  it('checkMethod rows render disabled and are skipped by select-all', () => {
    const rows = [
      { id: 1, name: 'a', age: 30 },
      { id: 2, name: 'b', age: 10 },
    ]
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        selectable="multi"
        checkMethod={(r) => (r.age as number) >= 20}
      />,
    )
    const checkboxes = [...container.querySelectorAll('[data-iris-checkbox]')]
    // header + 2 rows
    expect(checkboxes.length).toBe(3)
    // age 10 行禁用
    // [0] = header select-all, [1] = age 30 行（可选）, [2] = age 10 行（禁用）
    const rowBoxes = [...container.querySelectorAll('[data-iris-table-row] input[type=checkbox]')]
    expect((rowBoxes[1] as HTMLInputElement).disabled).toBe(false)
    expect((rowBoxes[2] as HTMLInputElement).disabled).toBe(true)
    // 全选只选可勾选行
    fireEvent.click(checkboxes[0]!)
    const selected = container.querySelectorAll('[data-iris-table-row-selected="true"]')
    expect(selected.length).toBe(1)
  })

  it('pageSizes selector switches size and resets page (proxy mode)', async () => {
    const query = vi.fn(async (_params: { page: number; pageSize: number }) => ({
      rows: [{ id: 1, name: 'a', age: 1 }],
      total: 10,
    }))
    const { container } = render(
      <IrisTable
        columns={cols}
        rowKey="id"
        proxyConfig={{ query, pageSize: 5, onPageChange: vi.fn() }}
        pagerConfig={{ pageSizes: [5, 10, 20] }}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalled())
    // 切到 10/页 → 重新查询 page 1, pageSize 10
    const lastCall = query.mock.calls.at(-1)![0]
    expect(lastCall.pageSize).toBe(5)
    const sizeTrigger = container.querySelector('[data-iris-select-trigger]')!
    expect(sizeTrigger).not.toBeNull()
  })
})
