import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IrisTable, type IrisTableColumn } from '../index'

afterEach(cleanup)

interface Row {
  id: number
  name: string
  age: number
  children?: Row[]
  [key: string]: unknown
}

/** Two editable columns (text + number) and one plain column. */
const rowCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true, editor: 'number' },
  { key: 'note', title: 'Note' }, // not editable — never gets an editor
]
const rows: Row[] = [{ id: 1, name: 'alice', age: 30, note: 'x' }]

function cellEl(id: number, colKey: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${id}"] [data-iris-table-cell="${colKey}"]`,
  ) as HTMLElement
}
function editorIn(id: number, colKey: string): HTMLElement | null {
  return document.querySelector(
    `[data-iris-table-row="${id}"] [data-iris-table-cell="${colKey}"] [data-iris-table-editor]`,
  )
}

describe('@iris-ui-kit/react IrisTable row edit mode (vxe editConfig.mode="row", batch K)', () => {
  it('a stale blur from a closed editor cannot commit a reopened session', () => {
    const onCellEdit = vi.fn()
    render(
      <IrisTable
        columns={rowCols}
        data={rows}
        rowKey="id"
        editConfig={{ mode: 'row' }}
        onCellEdit={onCellEdit}
      />,
    )
    act(() => fireEvent.click(cellEl(1, 'name')))
    const oldEditor = editorIn(1, 'name')!

    // Close the first projection without a change, then reopen the same cell.
    act(() => fireEvent.keyDown(oldEditor, { key: 'Enter' }))
    act(() => fireEvent.click(cellEl(1, 'name')))
    const reopened = editorIn(1, 'name')!
    act(() => fireEvent.change(reopened, { target: { value: 'reopened' } }))

    // The old DOM node still has its blur handler, but it must not address the
    // newly-created Core session with the same `${rowKey}::${column}` id.
    act(() => fireEvent.blur(oldEditor))
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(editorIn(1, 'name')).toBe(reopened)

    act(() => fireEvent.keyDown(reopened, { key: 'Enter' }))
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'reopened' }))
  })

  it('rechecks dynamic row editability at commit time', () => {
    let readonly = false
    const onCellEdit = vi.fn()
    const permissionCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        cellPermission: () => (readonly ? 'readonly' : 'editable'),
      },
      { key: 'age', title: 'Age', editable: true, editor: 'number' },
    ]
    render(
      <IrisTable
        columns={permissionCols}
        data={rows}
        rowKey="id"
        editConfig={{ mode: 'row' }}
        onCellEdit={onCellEdit}
      />,
    )
    act(() => fireEvent.click(cellEl(1, 'name')))
    act(() => {
      fireEvent.change(editorIn(1, 'name')!, { target: { value: 'changed' } })
    })
    readonly = true
    act(() => fireEvent.keyDown(editorIn(1, 'name')!, { key: 'Enter' }))

    expect(onCellEdit).not.toHaveBeenCalled()
    expect(editorIn(1, 'name')).not.toBeNull()
    expect(document.querySelector('[data-iris-table-editor-error]')?.textContent).toContain(
      'not editable',
    )
  })
})
