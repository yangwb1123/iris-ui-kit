import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  delete (document as { elementFromPoint?: unknown }).elementFromPoint
  Reflect.deleteProperty(navigator, 'clipboard')
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  city?: string
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
]

const cell = (rowId: string | number, key: string): HTMLElement =>
  document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
const cellValue = (rowId: string | number, key: string): string =>
  cell(rowId, key)?.textContent ?? ''
const editor = (): HTMLInputElement | null => document.querySelector('[data-iris-table-editor]')
const readonlyAttr = (rowId: string | number, key: string): string | null =>
  cell(rowId, key).getAttribute('data-iris-cell-readonly')
const lockedAttr = (rowId: string | number, key: string): string | null =>
  cell(rowId, key).getAttribute('data-iris-cell-locked')

function focusGridCell(r: number, c: number): HTMLElement {
  const el = document.querySelector(`[data-grid-row="${r}"][data-grid-col="${c}"]`) as HTMLElement
  act(() => {
    el.focus()
    fireEvent.focus(el)
  })
  return el
}

function checkRow(rowId: string | number): void {
  fireEvent.click(
    document.querySelector(
      `[data-iris-table-row="${rowId}"] input[type="checkbox"]`,
    ) as HTMLElement,
  )
}

function openBatchPanel(): HTMLElement {
  fireEvent.click(document.querySelector('[data-iris-table-toolbar-batch]') as HTMLElement)
  const panel = document.querySelector('[data-iris-batch-edit-panel]') as HTMLElement
  expect(panel).not.toBeNull()
  return panel
}

function applyBatch(panel: HTMLElement, column: string, value: string): void {
  fireEvent.change(panel.querySelector('[data-iris-batch-edit-column]')!, {
    target: { value: column },
  })
  fireEvent.change(panel.querySelector('[data-iris-batch-edit-value]')!, {
    target: { value },
  })
  fireEvent.click(panel.querySelector('[data-iris-batch-edit-apply]') as HTMLElement)
}

function pointerEvent(type: string, init: Record<string, unknown> = {}): Event {
  const ev = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(ev, init)
  return ev
}

const firePointer = (el: HTMLElement, type: string, init: Record<string, unknown> = {}): void =>
  act(() => {
    el.dispatchEvent(pointerEvent(type, init))
  })

const rcell = (r: number, c: number): HTMLElement =>
  document.querySelector(`[data-iris-cell-row="${r}"][data-iris-cell-col="${c}"]`) as HTMLElement

// ── Batch BJ: 单元格权限 cellPermission (iris 独有 — vxe has no per-cell permission) ──
describe('IrisTable cellPermission (batch BJ, iris 独有)', () => {
  it('absent → editable (default): dblclick opens the editor', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true },
      { key: 'age', title: 'Age', editable: true },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(readonlyAttr(1, 'name')).toBeNull()
    expect(readonlyAttr(2, 'age')).toBeNull()
    act(() => fireEvent.doubleClick(cell(1, 'name')))
    expect(editor()).not.toBeNull()
    expect(cell(1, 'name').style.cursor).toBe('cell')
    expect(cell(1, 'name').style.backgroundImage).toBe('')
  })

  it("'readonly' cell: dblclick is a no-op (no editor, no onEditStart)", () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, cellPermission: () => 'readonly' },
      { key: 'age', title: 'Age', editable: true },
    ]
    const onEditStart = vi.fn()
    render(<IrisTable columns={cols} data={rows} rowKey="id" onEditStart={onEditStart} />)
    act(() => fireEvent.doubleClick(cell(1, 'name')))
    expect(editor()).toBeNull()
    expect(onEditStart).not.toHaveBeenCalled()
    act(() => fireEvent.doubleClick(cell(1, 'age')))
    expect(editor()).not.toBeNull()
    expect(onEditStart).toHaveBeenCalledTimes(1)
  })

  it('visual distinctness: dotted texture + attr + dropped cursor, vs locked stripes', () => {
    const cols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        cellPermission: (row) => (row.id === 1 ? 'readonly' : 'editable'),
      },
      { key: 'age', title: 'Age', editable: true, locked: true },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(readonlyAttr(1, 'name')).toBe('true')
    expect(lockedAttr(1, 'name')).toBeNull()
    expect(cell(1, 'name').style.backgroundImage).toContain('radial-gradient')
    expect(cell(1, 'name').style.backgroundImage).toContain('--iris-muted-subtle')
    expect(cell(1, 'name').style.cursor).toBe('not-allowed')
    expect(lockedAttr(1, 'age')).toBe('true')
    expect(cell(1, 'age').style.backgroundImage).toContain('repeating-linear-gradient')
    // Reads fail-inert: data-editable (column capability) survives.
    expect(cell(1, 'name').getAttribute('data-editable')).not.toBeNull()
    expect(readonlyAttr(2, 'name')).toBeNull()
    expect(cell(2, 'name').style.cursor).toBe('cell')
    const style = document.getElementById('iris-table-row-styles')
    expect(style?.textContent).toContain('[data-iris-cell-readonly="true"]')
    expect(style?.textContent).toContain('radial-gradient')
    expect(style?.textContent).toContain('8px 8px')
  })

  it('locked wins visually when a cell is both locked and readonly', () => {
    const cols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        locked: true,
        cellPermission: () => 'readonly',
      },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(lockedAttr(1, 'name')).toBe('true')
    expect(readonlyAttr(1, 'name')).toBeNull()
    expect(cell(1, 'name').style.backgroundImage).toContain('repeating-linear-gradient')
    expect(cell(1, 'name').style.backgroundImage).not.toContain('radial-gradient')
  })

  it('a predicate ignoring its column argument is a row-level permission', () => {
    const perRow = (row: Row): 'readonly' | 'editable' => (row.id === 1 ? 'readonly' : 'editable')
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, cellPermission: perRow },
      { key: 'age', title: 'Age', editable: true, cellPermission: perRow },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(readonlyAttr(1, 'name')).toBe('true')
    expect(readonlyAttr(1, 'age')).toBe('true')
    expect(readonlyAttr(2, 'name')).toBeNull()
    expect(readonlyAttr(3, 'age')).toBeNull()
  })

  it('a column-aware predicate grants per-cell permission', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true },
      {
        key: 'age',
        title: 'Age',
        editable: true,
        cellPermission: (row, col) => (row.id === 2 && col.key === 'age' ? 'readonly' : 'editable'),
      },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(readonlyAttr(2, 'age')).toBe('true')
    expect(readonlyAttr(2, 'name')).toBeNull()
    expect(readonlyAttr(1, 'age')).toBeNull()
    expect(readonlyAttr(3, 'age')).toBeNull()
  })

  it('re-evaluates per render — permission is dynamic, unlike locked', () => {
    const cols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        cellPermission: (row) => (row.age > 30 ? 'readonly' : 'editable'),
      },
      { key: 'age', title: 'Age', editable: true },
    ]
    const { rerender } = render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(readonlyAttr(1, 'name')).toBeNull()
    expect(readonlyAttr(2, 'name')).toBe('true')
    // The row's data changes (new object, same id) — the predicate re-runs
    // and the SAME cell flips to readonly without any remount/config change.
    rerender(
      <IrisTable columns={cols} data={[{ ...rows[0], age: 35 }, rows[1], rows[2]]} rowKey="id" />,
    )
    expect(readonlyAttr(1, 'name')).toBe('true')
    act(() => fireEvent.doubleClick(cell(1, 'name')))
    expect(editor()).toBeNull()
    // And back: age 26 → editable again, editor opens.
    rerender(
      <IrisTable columns={cols} data={[{ ...rows[0], age: 26 }, rows[1], rows[2]]} rowKey="id" />,
    )
    expect(readonlyAttr(1, 'name')).toBeNull()
    act(() => fireEvent.doubleClick(cell(1, 'name')))
    expect(editor()).not.toBeNull()
  })

  it('click-trigger editing skips readonly cells', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, cellPermission: () => 'readonly' },
      { key: 'age', title: 'Age', editable: true },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" editConfig={{ trigger: 'click' }} />)
    act(() => fireEvent.click(cell(1, 'name')))
    expect(editor()).toBeNull()
    act(() => fireEvent.click(cell(1, 'age')))
    expect(editor()).not.toBeNull()
  })

  it('F2 on a readonly focused cell does nothing', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, cellPermission: () => 'readonly' },
      { key: 'age', title: 'Age', editable: true },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" keyboardNavigation tableShortcuts />)
    const readonlyCell = focusGridCell(0, 0)
    act(() => fireEvent.keyDown(readonlyCell, { key: 'F2' }))
    expect(editor()).toBeNull()
    const editableCell = focusGridCell(0, 1)
    act(() => fireEvent.keyDown(editableCell, { key: 'F2' }))
    expect(editor()).not.toBeNull()
  })

  it('Delete/Backspace on a readonly cell is a no-op (value + onDataChange untouched)', () => {
    const cols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        cellPermission: (row) => (row.id === 1 ? 'readonly' : 'editable'),
      },
      { key: 'age', title: 'Age', editable: true },
    ]
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        keyboardNavigation
        tableShortcuts
        onDataChange={onDataChange}
      />,
    )
    const readonlyCell = focusGridCell(0, 0)
    act(() => fireEvent.keyDown(readonlyCell, { key: 'Delete' }))
    expect(cellValue(1, 'name')).toContain('Charlie')
    expect(onDataChange).not.toHaveBeenCalled()
    const ageCell = focusGridCell(0, 1)
    act(() => fireEvent.keyDown(ageCell, { key: 'Backspace' }))
    expect(cellValue(1, 'age')).toBe('')
    expect(onDataChange).toHaveBeenCalledTimes(1)
  })

  it('row mode opens editors for permitted columns only; Tab skips readonly columns', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, cellPermission: () => 'readonly' },
      { key: 'age', title: 'Age', editable: true },
      { key: 'city', title: 'City', editable: true },
    ]
    render(
      <IrisTable
        columns={cols}
        data={[{ ...rows[0], city: 'NYC' }, rows[1], rows[2]]}
        rowKey="id"
        editConfig={{ mode: 'row' }}
      />,
    )
    act(() => fireEvent.click(cell(1, 'name')))
    const editors = Array.from(document.querySelectorAll('[data-iris-table-editor]'))
    expect(editors).toHaveLength(2)
    act(() => fireEvent.keyDown(editors[0]!, { key: 'Tab' }))
    const after = Array.from(document.querySelectorAll('[data-iris-table-editor]'))
    expect(after).toHaveLength(1)
    expect(document.activeElement).toBe(after[0])
  })

  it('batch edit skips readonly cells of selected rows (one commit for the rest)', () => {
    const cols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        cellPermission: (row) => (row.id === 2 ? 'readonly' : 'editable'),
      },
      { key: 'age', title: 'Age', editable: true },
    ]
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        selectable="multi"
        toolbar={{ batch: { label: '批量', edit: true } }}
        onDataChange={onDataChange}
      />,
    )
    checkRow(2)
    checkRow(3)
    applyBatch(openBatchPanel(), 'name', 'Shared')
    expect(cellValue(2, 'name')).toContain('Alice')
    expect(cellValue(3, 'name')).toContain('Shared')
    expect(onDataChange).toHaveBeenCalledTimes(1)
  })

  it('batch edit with an all-readonly column commits nothing (panel still closes)', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, cellPermission: () => 'readonly' },
      { key: 'age', title: 'Age', editable: true },
    ]
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        selectable="multi"
        toolbar={{ batch: { label: '批量', edit: true } }}
        onDataChange={onDataChange}
      />,
    )
    fireEvent.click(document.querySelector('input[type="checkbox"]') as HTMLElement)
    expect(document.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(4)
    applyBatch(openBatchPanel(), 'name', 'Shared')
    expect(onDataChange).not.toHaveBeenCalled()
    expect(cellValue(1, 'name')).toContain('Charlie')
    expect(document.querySelector('[data-iris-batch-edit-panel]')).toBeNull()
  })

  it('range clear zeroes permitted cells and skips readonly ones in one commit', () => {
    const cols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        cellPermission: (row) => (row.id === 2 ? 'readonly' : 'editable'),
      },
      { key: 'age', title: 'Age', editable: true },
    ]
    const onDataChange = vi.fn()
    render(
      <IrisTable columns={cols} data={rows} rowKey="id" cellRange onDataChange={onDataChange} />,
    )
    fireEvent.click(rcell(0, 0))
    fireEvent.click(rcell(1, 1), { shiftKey: true })
    fireEvent.click(document.querySelector('[data-iris-table-range-clear]') as HTMLElement)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toMatchObject({ id: 1, name: '', age: '' })
    expect(next[1]).toMatchObject({ id: 2, name: 'Alice', age: '' })
    expect(next[2]).toMatchObject({ id: 3, name: 'Bob', age: 28 })
  })

  it('paste skips readonly cells of the target rectangle', async () => {
    const clipboardRead = vi.fn<() => Promise<string>>()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(), readText: clipboardRead },
    })
    clipboardRead.mockResolvedValue('X\tY\nZ\tW')
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, cellPermission: () => 'readonly' },
      { key: 'age', title: 'Age', editable: true },
    ]
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{}}
        onDataChange={onDataChange}
      />,
    )
    fireEvent.click(rcell(0, 0))
    fireEvent.keyDown(document.querySelector('[data-iris-table]') as HTMLElement, {
      key: 'v',
      ctrlKey: true,
    })
    await waitFor(() => expect(onDataChange).toHaveBeenCalledTimes(1))
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toMatchObject({ id: 1, name: 'Charlie', age: 'Y' })
    expect(next[1]).toMatchObject({ id: 2, name: 'Alice', age: 'W' })
    expect(next[2]).toMatchObject({ id: 3, name: 'Bob', age: 28 })
  })

  it('drag fill skips readonly cells (one commit for the permitted rest)', () => {
    const cols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        cellPermission: (row) => (row.id === 2 ? 'readonly' : 'editable'),
      },
      { key: 'age', title: 'Age', editable: true },
    ]
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        rangeFill
        onDataChange={onDataChange}
      />,
    )
    fireEvent.click(rcell(0, 0))
    fireEvent.click(rcell(0, 1), { shiftKey: true })
    const h = document.querySelector('[data-iris-range-fill]') as HTMLElement
    expect(h).not.toBeNull()
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => rcell(1, 1),
    })
    firePointer(h, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    firePointer(h, 'pointermove', { clientX: 50, clientY: 100, pointerId: 1 })
    firePointer(h, 'pointerup', { clientX: 50, clientY: 100, pointerId: 1 })
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[1]).toMatchObject({ id: 2, name: 'Alice', age: 25 })
    expect(next[2]).toMatchObject({ id: 3, name: 'Bob', age: 28 })
  })

  it('FNR replace/replace-all skip readonly cells; find still matches them (reads fail-inert)', () => {
    const cols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        cellPermission: (row) => (row.id === 1 ? 'readonly' : 'editable'),
      },
      { key: 'age', title: 'Age', editable: true },
    ]
    const onDataChange = vi.fn()
    render(<IrisTable columns={cols} data={rows} rowKey="id" fnr onDataChange={onDataChange} />)
    fireEvent.keyDown(document.querySelector('[data-iris-table]') as HTMLElement, {
      key: 'f',
      ctrlKey: true,
    })
    const find = document.querySelector('[data-iris-fnr-find]') as HTMLInputElement
    expect(find).not.toBeNull()
    fireEvent.change(find, { target: { value: 'a' } })
    expect(document.querySelectorAll('[data-iris-fnr-match="true"]')).toHaveLength(2)
    fireEvent.change(document.querySelector('[data-iris-fnr-replace]')!, {
      target: { value: 'X' },
    })
    fireEvent.click(document.querySelector('[data-iris-fnr-replace-btn]')!)
    expect(cellValue(1, 'name')).toContain('Charlie')
    expect(onDataChange).not.toHaveBeenCalled()
    fireEvent.click(document.querySelector('[data-iris-fnr-replace-all]')!)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toMatchObject({ id: 1, name: 'Charlie' })
    expect(next[1]).toMatchObject({ id: 2, name: 'Xlice' })
    expect(next[2]).toMatchObject({ id: 3, name: 'Bob', age: 28 })
  })
})
