import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  name: string
  age: number
}

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true, editor: 'number' },
]

describe('probe: rowId rows multi-commit same event', () => {
  it('switchRowEdit commits all sessions; payload of 2nd commit should carry 1st change', () => {
    const onAutosave = vi.fn<(rows: Row[]) => void>()
    const data = [
      { name: 'A', age: 1 },
      { name: 'B', age: 2 },
    ] as Row[]
    render(
      <IrisTable
        columns={cols}
        data={data}
        rowKey="id"
        rowId={(r, i) => i}
        editConfig={{ mode: 'row' }}
        editAutosave
        onAutosave={onAutosave}
      />,
    )
    // open row-0 editors
    act(() => {
      fireEvent.click(
        document.querySelector('[data-iris-table-row="0"] [data-iris-table-cell="age"]')!,
      )
    })
    const editors = Array.from(
      document.querySelectorAll('[data-iris-table-row="0"] [data-iris-table-editor]'),
    )
    expect(editors).toHaveLength(2)
    // change BOTH columns, then click row 1 → switchRowEdit commits both in one event
    act(() => {
      fireEvent.change(editors[0]!, { target: { value: 'A2' } })
    })
    act(() => {
      fireEvent.change(editors[1]!, { target: { value: '42' } })
    })
    act(() => {
      fireEvent.click(
        document.querySelector('[data-iris-table-row="1"] [data-iris-table-cell="age"]')!,
      )
    })
    expect(onAutosave).toHaveBeenCalledTimes(2)
    const p1 = onAutosave.mock.calls[0]![0]
    const p2 = onAutosave.mock.calls[1]![0]
    // eslint-disable-next-line no-console
    console.log('payload1', JSON.stringify(p1), 'payload2', JSON.stringify(p2))
    expect(p1[0]).toEqual({ name: 'A2', age: 1 })
    // TRUE post-commit list at 2nd commit: name A2 AND age 42
    expect(p2[0]).toEqual({ name: 'A2', age: 42 })
  })
})
