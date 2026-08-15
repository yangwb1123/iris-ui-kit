import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(cleanup)

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

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function cellValue(rowId: string | number, key: string): string {
  return cell(rowId, key)?.textContent ?? ''
}

function editor(): HTMLInputElement | null {
  return document.querySelector('[data-iris-table-editor]')
}

function lockedAttr(rowId: string | number, key: string): string | null {
  return cell(rowId, key).getAttribute('data-iris-cell-locked')
}

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

// ── Batch BE: 列/行级锁定 (iris 独有 — vxe has no cell-lock concept) ────────
describe('IrisTable cell locking (batch BE, iris 独有)', () => {
  it('locked: true renders the locked attr on every cell of the column + drops the cursor', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, locked: true },
      { key: 'age', title: 'Age', editable: true },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    for (const r of rows) {
      expect(lockedAttr(r.id, 'name')).toBe('true')
      expect(cell(r.id, 'name').style.cursor).toBe('not-allowed')
      // Review finding: the stripes must ACTUALLY render — the cell's inline
      // `background` shorthand (fnrCellStyle) resets background-image, so the
      // lock marker re-asserts the image inline after it. Assert the inline
      // value AND the live injected stylesheet rule (a dead-code copy would
      // miss both).
      expect(cell(r.id, 'name').style.backgroundImage).toContain('repeating-linear-gradient')
      expect(cell(r.id, 'name').style.backgroundImage).toContain('--iris-muted-subtle')
      // Unlocked editable column stays clean + keeps the cell cursor.
      expect(lockedAttr(r.id, 'age')).toBeNull()
      expect(cell(r.id, 'age').style.cursor).toBe('cell')
      expect(cell(r.id, 'age').style.backgroundImage).toBe('')
    }
    const style = document.getElementById('iris-table-row-styles')
    expect(style?.textContent).toContain('[data-iris-cell-locked="true"]')
    expect(style?.textContent).toContain('repeating-linear-gradient')
  })

  it('a predicate ignoring its column argument is a row-level lock', () => {
    const rowLock = (row: Row): boolean => row.id === 1
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', locked: rowLock },
      { key: 'age', title: 'Age', locked: rowLock },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    // The whole row locks — every column carrying the predicate.
    expect(lockedAttr(1, 'name')).toBe('true')
    expect(lockedAttr(1, 'age')).toBe('true')
    expect(lockedAttr(2, 'name')).toBeNull()
    expect(lockedAttr(3, 'age')).toBeNull()
  })

  it('a column-aware predicate locks single cells (组合锁)', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age', locked: (row, col) => row.id === 2 && col.key === 'age' },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(lockedAttr(2, 'age')).toBe('true')
    expect(lockedAttr(2, 'name')).toBeNull()
    expect(lockedAttr(1, 'age')).toBeNull()
    expect(lockedAttr(3, 'age')).toBeNull()
  })

  it('dblclick on a locked editable cell is a no-op (no editor, no onEditStart)', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, locked: true },
      { key: 'age', title: 'Age', editable: true },
    ]
    const onEditStart = vi.fn()
    render(<IrisTable columns={cols} data={rows} rowKey="id" onEditStart={onEditStart} />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    expect(editor()).toBeNull()
    expect(onEditStart).not.toHaveBeenCalled()
    // The unlocked column still edits normally.
    act(() => {
      fireEvent.doubleClick(cell(1, 'age'))
    })
    expect(editor()).not.toBeNull()
    expect(onEditStart).toHaveBeenCalledTimes(1)
  })

  it('click-trigger editing skips locked cells', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, locked: true },
      { key: 'age', title: 'Age', editable: true },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" editConfig={{ trigger: 'click' }} />)
    act(() => {
      fireEvent.click(cell(1, 'name'))
    })
    expect(editor()).toBeNull()
    act(() => {
      fireEvent.click(cell(1, 'age'))
    })
    expect(editor()).not.toBeNull()
  })

  it('F2 on a locked focused cell does nothing', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, locked: true },
      { key: 'age', title: 'Age', editable: true },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" keyboardNavigation tableShortcuts />)
    const locked = focusGridCell(0, 0)
    act(() => fireEvent.keyDown(locked, { key: 'F2' }))
    expect(editor()).toBeNull()
    const unlocked = focusGridCell(0, 1)
    act(() => fireEvent.keyDown(unlocked, { key: 'F2' }))
    expect(editor()).not.toBeNull()
  })

  it('Delete/Backspace on a locked cell is a no-op (value + onDataChange untouched)', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, locked: true },
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
    const lockedCell = focusGridCell(0, 0)
    act(() => fireEvent.keyDown(lockedCell, { key: 'Delete' }))
    expect(cellValue(1, 'name')).toContain('Charlie')
    expect(onDataChange).not.toHaveBeenCalled()
    // Unlocked cell still clears.
    const ageCell = focusGridCell(0, 1)
    act(() => fireEvent.keyDown(ageCell, { key: 'Backspace' }))
    expect(cellValue(1, 'age')).toBe('')
    expect(onDataChange).toHaveBeenCalledTimes(1)
  })

  it('row mode opens editors for unlocked columns only; Tab skips locked columns', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, locked: true },
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
    act(() => {
      fireEvent.click(cell(1, 'name'))
    })
    const editors = Array.from(document.querySelectorAll('[data-iris-table-editor]'))
    // age + city only — the locked name column opens no editor.
    expect(editors).toHaveLength(2)
    // Tab from the first unlocked editor (age) skips the locked name column
    // and lands on city — the only editor left, so activeElement is it.
    act(() => {
      fireEvent.keyDown(editors[0]!, { key: 'Tab' })
    })
    const after = Array.from(document.querySelectorAll('[data-iris-table-editor]'))
    expect(after).toHaveLength(1)
    expect(document.activeElement).toBe(after[0])
  })

  it('batch edit skips locked cells of selected rows (one commit for the rest)', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, locked: (row) => row.id === 2 },
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
    // Row 2's name cell is locked → untouched; row 3's name got the value.
    expect(cellValue(2, 'name')).toContain('Alice')
    expect(cellValue(3, 'name')).toContain('Shared')
    expect(onDataChange).toHaveBeenCalledTimes(1)
  })

  it('batch edit with an all-locked column commits nothing (panel still closes)', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, locked: true },
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
    // 全选路径: the header select-all checkbox selects every row.
    fireEvent.click(document.querySelector('input[type="checkbox"]') as HTMLElement)
    expect(document.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(4)
    applyBatch(openBatchPanel(), 'name', 'Shared')
    // Zero commits — every selected row's name cell is locked.
    expect(onDataChange).not.toHaveBeenCalled()
    expect(cellValue(1, 'name')).toContain('Charlie')
    expect(document.querySelector('[data-iris-batch-edit-panel]')).toBeNull()
  })

  it('range clear over an all-locked rectangle commits nothing (selection survives)', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, locked: true },
      { key: 'age', title: 'Age', editable: true },
    ]
    const onDataChange = vi.fn()
    render(
      <IrisTable columns={cols} data={rows} rowKey="id" cellRange onDataChange={onDataChange} />,
    )
    // Anchor the range on a locked cell only (1×1) — every cell of the
    // rectangle is locked → every row patch is empty → zero commits.
    fireEvent.click(cell(1, 'name'))
    fireEvent.click(document.querySelector('[data-iris-table-range-clear]') as HTMLElement)
    expect(onDataChange).not.toHaveBeenCalled()
    expect(cellValue(1, 'name')).toContain('Charlie')
    // The selection survives a no-op clear (only the VALUES would zero).
    expect(document.querySelector('[data-iris-table-range-clear]')).not.toBeNull()
  })

  it('range clear zeroes unlocked cells and skips locked ones in one commit', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, locked: (row) => row.id === 2 },
      { key: 'age', title: 'Age', editable: true },
    ]
    const onDataChange = vi.fn()
    render(
      <IrisTable columns={cols} data={rows} rowKey="id" cellRange onDataChange={onDataChange} />,
    )
    // 2×2 range over rows 1+2, name+age: row 1 fully clearable, row 2's
    // name locked → stays, row 2's age zeroed. ONE commit for the rest.
    fireEvent.click(cell(1, 'name'))
    fireEvent.click(cell(2, 'age'), { shiftKey: true })
    fireEvent.click(document.querySelector('[data-iris-table-range-clear]') as HTMLElement)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toMatchObject({ id: 1, name: '', age: '' })
    expect(next[1]).toMatchObject({ id: 2, name: 'Alice', age: '' })
    expect(next[2]).toMatchObject({ id: 3, name: 'Bob', age: 28 })
  })

  it('paste skips locked cells of the target rectangle', async () => {
    const clipboardRead = vi.fn<() => Promise<string>>()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(), readText: clipboardRead },
    })
    clipboardRead.mockResolvedValue('X\tY\nZ\tW')
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, locked: true },
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
    // Anchor at (0,0): the 2×2 clipboard lands on name/age of rows 1+2.
    fireEvent.click(cell(1, 'name'))
    fireEvent.keyDown(document.querySelector('[data-iris-table]') as HTMLElement, {
      key: 'v',
      ctrlKey: true,
    })
    await waitFor(() => expect(onDataChange).toHaveBeenCalledTimes(1))
    const next = onDataChange.mock.calls[0]![0] as Row[]
    // Locked name cells keep their values; unlocked age cells got the paste.
    expect(next[0]).toMatchObject({ id: 1, name: 'Charlie', age: 'Y' })
    expect(next[1]).toMatchObject({ id: 2, name: 'Alice', age: 'W' })
    expect(next[2]).toMatchObject({ id: 3, name: 'Bob', age: 28 })
  })
})
