import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { IrisTable } from '../Table'
import type { IrisTableHandle } from '../props'
import type { IrisTableColumn } from '../types'

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

afterEach(cleanup)

describe('IrisTable virtual scroll handle', () => {
  it('delegates an off-window row to the virtual feature viewport', () => {
    const data = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      name: `Row ${index + 1}`,
      age: index,
    }))
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    render(
      <IrisTable
        columns={columns}
        data={data}
        rowKey="id"
        tableRef={ref}
        virtualScroll={{ itemHeight: 20, height: 100 }}
      />,
    )
    const viewport = document.querySelector('[data-iris-virtual-scroll]') as HTMLElement
    expect(document.querySelector('[data-iris-table-row="50"]')).toBeNull()

    act(() => ref.current!.scrollToRow(50))
    expect(viewport.scrollTop).toBe(49 * 20)

    act(() => ref.current!.scrollToRow(999))
    expect(viewport.scrollTop).toBe(49 * 20)
  })
})
