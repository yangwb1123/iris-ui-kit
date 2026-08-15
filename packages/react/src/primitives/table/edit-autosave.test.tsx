import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
]

const editableCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true, editor: 'number' },
]

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function editor(): HTMLInputElement | null {
  return document.querySelector('[data-iris-table-editor]')
}

function commitEdit(value: string): void {
  fireEvent.change(editor()!, { target: { value } })
  fireEvent.keyDown(editor()!, { key: 'Enter' })
}

function editCell(rowId: string | number, colKey: string, value: string): void {
  act(() => {
    fireEvent.doubleClick(cell(rowId, colKey))
  })
  act(() => {
    commitEdit(value)
  })
}

/** Row list helper — reads back the rows the table committed to onAutosave. */
function nameOf(rowsList: Row[], rowId: number): string {
  return rowsList.find((r) => r.id === rowId)?.name as string
}

// ── editAutosave / onAutosave (iris 独有, batch BQ) ─────────────────────────
// After a successful inline-edit commit, the table fires onAutosave with the
// post-commit row list (parent persistence hook). editAutosave is the feature
// switch — onAutosave alone is inert. Orthogonal to onDataChange (inline
// edits never trigger it).
describe('IrisTable editAutosave (batch BQ, iris 独有)', () => {
  it('dblclick → change → Enter fires onAutosave with the post-commit row list', () => {
    const onAutosave = vi.fn<(rowsList: Row[]) => void>()
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        editAutosave
        onAutosave={onAutosave}
      />,
    )
    editCell(1, 'name', 'Renamed')
    expect(onAutosave).toHaveBeenCalledTimes(1)
    const payload = onAutosave.mock.calls[0]![0]
    expect(payload).toHaveLength(3)
    expect(nameOf(payload, 1)).toBe('Renamed')
    expect(nameOf(payload, 2)).toBe('Alice')
    expect(payload[1]).toEqual({ id: 2, name: 'Alice', age: 32 })
  })

  it('onAutosave without editAutosave never fires (feature switch)', () => {
    const onAutosave = vi.fn<(rowsList: Row[]) => void>()
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" onAutosave={onAutosave} />)
    editCell(1, 'name', 'Renamed')
    expect(onAutosave).not.toHaveBeenCalled()
  })

  it('no-op commit (same value) does not fire', () => {
    const onAutosave = vi.fn<(rowsList: Row[]) => void>()
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        editAutosave
        onAutosave={onAutosave}
      />,
    )
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    act(() => {
      commitEdit('Charlie')
    })
    expect(onAutosave).not.toHaveBeenCalled()
  })

  it('a validation-failed commit does not fire; the follow-up valid commit does', async () => {
    const onAutosave = vi.fn<(rowsList: Row[]) => void>()
    const validCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [{ pattern: /^[A-Z]/, message: 'must start uppercase' }],
      },
    ]
    render(
      <IrisTable
        columns={validCols}
        data={rows}
        rowKey="id"
        editAutosave
        onAutosave={onAutosave}
      />,
    )
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    act(() => {
      fireEvent.change(editor()!, { target: { value: 'bad' } })
      fireEvent.keyDown(editor()!, { key: 'Enter' })
    })
    await waitFor(() =>
      expect(document.querySelector('[data-iris-table-editor-error]')).not.toBeNull(),
    )
    expect(onAutosave).not.toHaveBeenCalled()
    act(() => {
      fireEvent.change(editor()!, { target: { value: 'Good' } })
      fireEvent.keyDown(editor()!, { key: 'Enter' })
    })
    await waitFor(() => expect(onAutosave).toHaveBeenCalledTimes(1))
    expect(nameOf(onAutosave.mock.calls[0]![0], 1)).toBe('Good')
  })

  it('Escape-cancelled edits do not fire', () => {
    const onAutosave = vi.fn<(rowsList: Row[]) => void>()
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        editAutosave
        onAutosave={onAutosave}
      />,
    )
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    act(() => {
      fireEvent.change(editor()!, { target: { value: 'Draft' } })
      fireEvent.keyDown(editor()!, { key: 'Escape' })
    })
    expect(onAutosave).not.toHaveBeenCalled()
  })

  it('Tab commit fires once and moves to the next editable column', () => {
    const onAutosave = vi.fn<(rowsList: Row[]) => void>()
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        editAutosave
        onAutosave={onAutosave}
      />,
    )
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    act(() => {
      fireEvent.change(editor()!, { target: { value: 'Tabbed' } })
      fireEvent.keyDown(editor()!, { key: 'Tab' })
    })
    expect(onAutosave).toHaveBeenCalledTimes(1)
    expect(nameOf(onAutosave.mock.calls[0]![0], 1)).toBe('Tabbed')
    expect(editor()).not.toBeNull() // focus moved to the age editor
  })

  it('row edit mode fires per committed column with the accumulated list', () => {
    const onAutosave = vi.fn<(rowsList: Row[]) => void>()
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        editConfig={{ mode: 'row' }}
        editAutosave
        onAutosave={onAutosave}
      />,
    )
    act(() => {
      fireEvent.click(cell(1, 'age'))
    })
    const editors = Array.from(
      document.querySelectorAll('[data-iris-table-row="1"] [data-iris-table-editor]'),
    )
    expect(editors).toHaveLength(2)
    act(() => {
      fireEvent.change(editors[0]!, { target: { value: 'Renamed' } })
      fireEvent.keyDown(editors[0]!, { key: 'Enter' })
    })
    expect(onAutosave).toHaveBeenCalledTimes(1)
    expect(nameOf(onAutosave.mock.calls[0]![0], 1)).toBe('Renamed')
    act(() => {
      fireEvent.change(editors[1]!, { target: { value: '99' } })
      fireEvent.keyDown(editors[1]!, { key: 'Enter' })
    })
    expect(onAutosave).toHaveBeenCalledTimes(2)
    const second = onAutosave.mock.calls[1]![0]
    expect(nameOf(second, 1)).toBe('Renamed')
    expect(second.find((r) => r.id === 1)?.age).toBe(99)
  })

  it('onAutosave is orthogonal to onDataChange — inline edits never fire it', () => {
    const onAutosave = vi.fn<(rowsList: Row[]) => void>()
    const onDataChange = vi.fn<(rowsList: Row[]) => void>()
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        editAutosave
        onAutosave={onAutosave}
        onDataChange={onDataChange}
      />,
    )
    editCell(1, 'name', 'Renamed')
    expect(onAutosave).toHaveBeenCalledTimes(1)
    expect(onDataChange).not.toHaveBeenCalled()
  })

  it('consecutive edits accumulate — every commit payload is the full current list', () => {
    const onAutosave = vi.fn<(rowsList: Row[]) => void>()
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        editAutosave
        onAutosave={onAutosave}
      />,
    )
    editCell(1, 'name', 'First')
    editCell(2, 'name', 'Second')
    expect(onAutosave).toHaveBeenCalledTimes(2)
    const first = onAutosave.mock.calls[0]![0]
    expect(nameOf(first, 1)).toBe('First')
    expect(nameOf(first, 2)).toBe('Alice')
    const second = onAutosave.mock.calls[1]![0]
    expect(nameOf(second, 1)).toBe('First')
    expect(nameOf(second, 2)).toBe('Second')
  })

  it('async-validated commits fire exactly once when the promise lands', async () => {
    const onAutosave = vi.fn<(rowsList: Row[]) => void>()
    const asyncCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [{ validator: (v) => Promise.resolve(v === 'ok' ? null : 'must be ok') }],
      },
    ]
    render(
      <IrisTable
        columns={asyncCols}
        data={rows}
        rowKey="id"
        editAutosave
        onAutosave={onAutosave}
      />,
    )
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    act(() => {
      fireEvent.change(editor()!, { target: { value: 'ok' } })
      fireEvent.keyDown(editor()!, { key: 'Enter' })
    })
    expect(onAutosave).not.toHaveBeenCalled() // pending
    await act(async () => {})
    expect(onAutosave).toHaveBeenCalledTimes(1)
    expect(nameOf(onAutosave.mock.calls[0]![0], 1)).toBe('ok')
  })

  it('rowId rows get the post-commit list located by the computed key', () => {
    const onAutosave = vi.fn<(rowsList: Row[]) => void>()
    const unkeyed = [
      { name: 'A', age: 1 },
      { name: 'B', age: 2 },
    ] as Row[]
    render(
      <IrisTable
        columns={editableCols}
        data={unkeyed}
        rowKey="id"
        rowId={(row, i) => i}
        editAutosave
        onAutosave={onAutosave}
      />,
    )
    act(() => {
      fireEvent.doubleClick(cell(0, 'name'))
    })
    act(() => {
      fireEvent.change(editor()!, { target: { value: 'A Edited' } })
      fireEvent.keyDown(editor()!, { key: 'Enter' })
    })
    expect(onAutosave).toHaveBeenCalledTimes(1)
    const payload = onAutosave.mock.calls[0]![0]
    expect(payload[0]).toEqual({ name: 'A Edited', age: 1 })
    expect(payload[1]).toEqual({ name: 'B', age: 2 })
  })

  it('a late onAutosave prop is honored (ref mirror — no stale closure)', () => {
    const first = vi.fn<(rowsList: Row[]) => void>()
    const second = vi.fn<(rowsList: Row[]) => void>()
    const { rerender } = render(
      <IrisTable columns={editableCols} data={rows} rowKey="id" editAutosave onAutosave={first} />,
    )
    rerender(
      <IrisTable columns={editableCols} data={rows} rowKey="id" editAutosave onAutosave={second} />,
    )
    editCell(1, 'name', 'Renamed')
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
