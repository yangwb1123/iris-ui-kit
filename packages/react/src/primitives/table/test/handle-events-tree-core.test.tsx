import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
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

const baseColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true, align: 'right' },
]

describe('IrisTable handle methods (vxe parity, batch T)', () => {
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
})
