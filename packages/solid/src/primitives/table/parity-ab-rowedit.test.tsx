import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  status: string
}
const rows: Row[] = [
  { id: 1, name: 'Alice', age: 30, status: 'active' },
  { id: 2, name: 'Bob', age: 25, status: 'paused' },
  { id: 3, name: 'Charlie', age: 28, status: 'active' },
]
const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true, editor: 'number' },
  { key: 'status', title: 'Status' },
]
const bodyRows = (container: HTMLElement): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>('[data-iris-table-row=""]'),
]
const nameCells = (container: HTMLElement): string[] =>
  [...container.querySelectorAll<HTMLElement>('[data-iris-table-cell="name"]')].map(
    (c) => c.textContent ?? '',
  )

describe('IrisTable parity-AB: row edit mode (editConfig.mode="row")', () => {
  it('clicking a cell opens every editable column; Enter commits only that column; Escape cancels the row; row switch commits', () => {
    const onCellEdit = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        editConfig={{ mode: 'row' }}
        onCellEdit={onCellEdit}
      />
    ))
    const rowEls = bodyRows(container)
    // A plain click on ANY cell (even a non-editable one) starts row editing.
    fireEvent.click(rowEls[0]!.querySelector('[data-iris-table-cell="status"]')!)
    expect(rowEls[0]!.querySelectorAll('[data-iris-table-editor]').length).toBe(2)
    expect(rowEls[0]!.getAttribute('data-iris-row-editing')).toBe('true')
    expect(
      rowEls[0]!.querySelector('[data-iris-table-cell="status"] [data-iris-table-editor]'),
    ).toBeNull()
    // Typing in one editor and pressing Enter commits THAT column only.
    const nameEditor = rowEls[0]!.querySelector(
      '[data-iris-table-cell="name"] [data-iris-table-editor]',
    ) as HTMLInputElement
    fireEvent.input(nameEditor, { target: { value: 'alice2' } })
    fireEvent.keyDown(nameEditor, { key: 'Enter' })
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        column: expect.objectContaining({ key: 'name' }),
        newValue: 'alice2',
        rowIndex: 0,
      }),
    )
    // The committed column's editor closed; the row is still editing with the
    // other column open (per-cell commit, no auto-commit of the rest).
    expect(
      rowEls[0]!.querySelector('[data-iris-table-cell="name"] [data-iris-table-editor]'),
    ).toBeNull()
    expect(
      rowEls[0]!.querySelector('[data-iris-table-cell="age"] [data-iris-table-editor]'),
    ).not.toBeNull()
    expect(rowEls[0]!.getAttribute('data-iris-row-editing')).toBe('true')
    // Escape cancels the WHOLE row: every remaining editor closes and the
    // discarded draft is never committed.
    const ageEditor = rowEls[0]!.querySelector(
      '[data-iris-table-cell="age"] [data-iris-table-editor]',
    ) as HTMLInputElement
    fireEvent.input(ageEditor, { target: { value: '99' } })
    fireEvent.keyDown(ageEditor, { key: 'Escape' })
    expect(rowEls[0]!.querySelectorAll('[data-iris-table-editor]').length).toBe(0)
    expect(rowEls[0]!.getAttribute('data-iris-row-editing')).toBeNull()
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    // Clicking another row commits the current row edits and opens the new row
    // (vxe click-elsewhere-commits parity).
    fireEvent.click(rowEls[0]!.querySelector('[data-iris-table-cell="name"]')!)
    const reOpened = rowEls[0]!.querySelector(
      '[data-iris-table-cell="name"] [data-iris-table-editor]',
    ) as HTMLInputElement
    fireEvent.input(reOpened, { target: { value: 'alice3' } })
    fireEvent.click(rowEls[1]!.querySelector('[data-iris-table-cell="status"]')!)
    expect(onCellEdit).toHaveBeenCalledTimes(2)
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        column: expect.objectContaining({ key: 'name' }),
        newValue: 'alice3',
      }),
    )
    expect(rowEls[0]!.getAttribute('data-iris-row-editing')).toBeNull()
    expect(rowEls[1]!.getAttribute('data-iris-row-editing')).toBe('true')
    expect(rowEls[1]!.querySelectorAll('[data-iris-table-editor]').length).toBe(2)
  })

  it('a sync validation failure keeps the row open with the error visible', () => {
    const validatedCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        validate: (v) => (String(v).length >= 3 ? null : 'too short'),
      },
      { key: 'age', title: 'Age', editable: true, editor: 'number' },
    ]
    const { container } = render(() => (
      <IrisTable columns={validatedCols} data={rows} rowKey="id" editConfig={{ mode: 'row' }} />
    ))
    const rowEls = bodyRows(container)
    fireEvent.click(rowEls[0]!.querySelector('[data-iris-table-cell="name"]')!)
    const nameEditor = rowEls[0]!.querySelector(
      '[data-iris-table-cell="name"] [data-iris-table-editor]',
    ) as HTMLInputElement
    fireEvent.input(nameEditor, { target: { value: 'x' } })
    // The rejected commit blocks the row switch — the error stays visible.
    fireEvent.click(rowEls[1]!.querySelector('[data-iris-table-cell="age"]')!)
    expect(rowEls[0]!.getAttribute('data-iris-row-editing')).toBe('true')
    expect(document.querySelector('[data-iris-table-editor-error]')?.textContent).toContain(
      'too short',
    )
    expect(rowEls[1]!.getAttribute('data-iris-row-editing')).toBeNull()
  })

  it('Escape cancels a row whose async commit is pending without writing it back', async () => {
    const onCellEdit = vi.fn()
    const asyncCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [{ validator: (v) => Promise.resolve(v === 'ok' ? null : 'must be ok') }],
      },
      { key: 'age', title: 'Age', editable: true, editor: 'number' },
    ]
    const { container } = render(() => (
      <IrisTable
        columns={asyncCols}
        data={rows}
        rowKey="id"
        editConfig={{ mode: 'row' }}
        onCellEdit={onCellEdit}
      />
    ))
    const rowEls = bodyRows(container)
    fireEvent.click(rowEls[0]!.querySelector('[data-iris-table-cell="age"]')!)
    const nameEditor = rowEls[0]!.querySelector(
      '[data-iris-table-cell="name"] [data-iris-table-editor]',
    ) as HTMLInputElement
    fireEvent.input(nameEditor, { target: { value: 'ok' } })
    // Enter starts the async validation commit; it stays pending while the
    // promise is in flight.
    fireEvent.keyDown(nameEditor, { key: 'Enter' })
    // Escape cancels the WHOLE row while the commit is still pending (core
    // sessionGen parity): the settled validation must NOT write back.
    const ageEditor = rowEls[0]!.querySelector(
      '[data-iris-table-cell="age"] [data-iris-table-editor]',
    ) as HTMLInputElement
    fireEvent.keyDown(ageEditor, { key: 'Escape' })
    expect(rowEls[0]!.getAttribute('data-iris-row-editing')).toBeNull()
    // Let the pending validation settle.
    await new Promise((r) => setTimeout(r, 0))
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(nameCells(container)[0]).toContain('Alice')
  })

  it('double-Enter on an async-validated column commits exactly once', async () => {
    const onCellEdit = vi.fn()
    const asyncCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [{ validator: (v) => Promise.resolve(v === 'ok' ? null : 'must be ok') }],
      },
      { key: 'age', title: 'Age', editable: true, editor: 'number' },
    ]
    const { container } = render(() => (
      <IrisTable
        columns={asyncCols}
        data={rows}
        rowKey="id"
        editConfig={{ mode: 'row' }}
        onCellEdit={onCellEdit}
      />
    ))
    const rowEls = bodyRows(container)
    fireEvent.click(rowEls[0]!.querySelector('[data-iris-table-cell="name"]')!)
    const nameEditor = rowEls[0]!.querySelector(
      '[data-iris-table-cell="name"] [data-iris-table-editor]',
    ) as HTMLInputElement
    fireEvent.input(nameEditor, { target: { value: 'ok' } })
    // Two Enters before either validation settles: the second supersedes the
    // first (epoch bump), so only ONE commit lands.
    fireEvent.keyDown(nameEditor, { key: 'Enter' })
    fireEvent.keyDown(nameEditor, { key: 'Enter' })
    await new Promise((r) => setTimeout(r, 0))
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        column: expect.objectContaining({ key: 'name' }),
        newValue: 'ok',
      }),
    )
  })

  it('cell mode: Escape during a pending async commit does not write back', async () => {
    const onCellEdit = vi.fn()
    const asyncCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [{ validator: (v) => Promise.resolve(v === 'ok' ? null : 'must be ok') }],
      },
    ]
    const { container } = render(() => (
      <IrisTable columns={asyncCols} data={rows} rowKey="id" onCellEdit={onCellEdit} />
    ))
    const rowEls = bodyRows(container)
    // Default trigger is dblclick — opens the singleton cell editor.
    fireEvent.dblClick(rowEls[0]!.querySelector('[data-iris-table-cell="name"]')!)
    const editor = rowEls[0]!.querySelector(
      '[data-iris-table-cell="name"] [data-iris-table-editor]',
    ) as HTMLInputElement
    fireEvent.input(editor, { target: { value: 'ok' } })
    fireEvent.keyDown(editor, { key: 'Enter' })
    // Escape while the async commit is pending: the epoch guard drops it.
    fireEvent.keyDown(editor, { key: 'Escape' })
    await new Promise((r) => setTimeout(r, 0))
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(nameCells(container)[0]).toContain('Alice')
  })

  it('dblclick on an editing row re-begins the whole row (vxe parity)', () => {
    const { container } = render(() => (
      <IrisTable columns={cols} data={rows} rowKey="id" editConfig={{ mode: 'row' }} />
    ))
    const rowEls = bodyRows(container)
    fireEvent.click(rowEls[0]!.querySelector('[data-iris-table-cell="name"]')!)
    // Enter commits only the name column; the age editor stays open.
    const nameEditor = rowEls[0]!.querySelector(
      '[data-iris-table-cell="name"] [data-iris-table-editor]',
    ) as HTMLInputElement
    fireEvent.input(nameEditor, { target: { value: 'alice2' } })
    fireEvent.keyDown(nameEditor, { key: 'Enter' })
    expect(
      rowEls[0]!.querySelector('[data-iris-table-cell="name"] [data-iris-table-editor]'),
    ).toBeNull()
    // dblclick re-begins the WHOLE row: every editable column opens again.
    fireEvent.dblClick(rowEls[0]!.querySelector('[data-iris-table-cell="name"]')!)
    expect(rowEls[0]!.querySelectorAll('[data-iris-table-editor]').length).toBe(2)
    expect(rowEls[0]!.getAttribute('data-iris-row-editing')).toBe('true')
  })

  it('with cellRange + row mode both configured, a click starts row editing (rowMode-first)', () => {
    const { container } = render(() => (
      <IrisTable columns={cols} data={rows} rowKey="id" editConfig={{ mode: 'row' }} cellRange />
    ))
    const rowEls = bodyRows(container)
    fireEvent.click(rowEls[0]!.querySelector('[data-iris-table-cell="name"]')!)
    expect(rowEls[0]!.getAttribute('data-iris-row-editing')).toBe('true')
    expect(rowEls[0]!.querySelectorAll('[data-iris-table-editor]').length).toBe(2)
    // Row-mode-first: the click started row editing instead of a range select.
    expect(
      rowEls[0]!
        .querySelector('[data-iris-table-cell="name"]')!
        .getAttribute('data-iris-cell-selected'),
    ).toBeNull()
  })
})
