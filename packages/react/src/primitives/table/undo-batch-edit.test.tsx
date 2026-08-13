import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'
import type { IrisTableHandle } from './types'

afterEach(cleanup)

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
  { key: 'age', title: 'Age', editable: true },
]

const baseCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function tableRef(): { current: IrisTableHandle<Row> | null } {
  return { current: null }
}

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

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

function undoBtn(): HTMLButtonElement {
  return document.querySelector('[data-iris-table-undo]') as HTMLButtonElement
}

function redoBtn(): HTMLButtonElement {
  return document.querySelector('[data-iris-table-redo]') as HTMLButtonElement
}

function ctrlZ(): void {
  fireEvent.keyDown(root(), { key: 'z', ctrlKey: true })
}

function ctrlY(): void {
  fireEvent.keyDown(root(), { key: 'y', ctrlKey: true })
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

function checkRow(rowId: string | number): void {
  fireEvent.click(
    document.querySelector(
      `[data-iris-table-row="${rowId}"] input[type="checkbox"]`,
    ) as HTMLElement,
  )
}

// ── Built-in undo/redo (iris 独有, batch AL) ────────────────────────────────
describe('IrisTable built-in undo/redo', () => {
  it('Ctrl+Z reverts a committed cell edit and Ctrl+Y reapplies it', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" undo />)
    editCell(1, 'name', 'Renamed')
    expect(cellValue(1, 'name')).toContain('Renamed')
    act(() => ctrlZ())
    expect(cellValue(1, 'name')).toContain('Charlie')
    act(() => ctrlY())
    expect(cellValue(1, 'name')).toContain('Renamed')
  })

  it('Ctrl+Shift+Z also redoes', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" undo />)
    editCell(1, 'name', 'Renamed')
    act(() => ctrlZ())
    expect(cellValue(1, 'name')).toContain('Charlie')
    act(() => fireEvent.keyDown(root(), { key: 'z', ctrlKey: true, shiftKey: true }))
    expect(cellValue(1, 'name')).toContain('Renamed')
  })

  it('tracks consecutive mutations as separate undo steps', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" undo />)
    editCell(1, 'name', 'First')
    editCell(2, 'name', 'Second')
    expect(cellValue(1, 'name')).toContain('First')
    expect(cellValue(2, 'name')).toContain('Second')
    act(() => ctrlZ())
    expect(cellValue(1, 'name')).toContain('First')
    expect(cellValue(2, 'name')).toContain('Alice')
    act(() => ctrlZ())
    expect(cellValue(1, 'name')).toContain('Charlie')
    expect(cellValue(2, 'name')).toContain('Alice')
  })

  it('does nothing while an inline editor is open', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" undo />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    act(() => {
      fireEvent.change(editor()!, { target: { value: 'Draft' } })
    })
    // Ctrl+Z while editing must not fire (the session owns the shortcut).
    act(() => ctrlZ())
    expect(editor()).not.toBeNull()
    // Commit → the draft IS undoable.
    act(() => {
      fireEvent.keyDown(editor()!, { key: 'Enter' })
    })
    expect(cellValue(1, 'name')).toContain('Draft')
    act(() => ctrlZ())
    expect(cellValue(1, 'name')).toContain('Charlie')
  })

  it('row-mode multi-commit in one event produces per-cell undo steps', () => {
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        undo
        editConfig={{ mode: 'row' }}
      />,
    )
    // Row mode: a plain click opens EVERY editable column's editor.
    act(() => {
      fireEvent.click(cell(1, 'name'))
    })
    const editors = Array.from(document.querySelectorAll('[data-iris-table-editor]'))
    expect(editors).toHaveLength(2)
    act(() => {
      fireEvent.change(editors[0]!, { target: { value: 'X' } })
    })
    act(() => {
      fireEvent.change(editors[1]!, { target: { value: '99' } })
    })
    // Clicking another row commits BOTH open sessions of row 1 in ONE event
    // (switchRowEdit) — the eager ref sync must snapshot the intermediate
    // { name: 'X' } state before the age commit.
    act(() => {
      fireEvent.click(cell(2, 'name'))
    })
    expect(cellValue(1, 'name')).toContain('X')
    expect(cellValue(1, 'age')).toContain('99')
    // Leave row 2's fresh session (Escape) so the undo shortcut is unblocked.
    act(() => {
      const row2 = document.querySelector('[data-iris-table-row="2"] [data-iris-table-editor]')
      fireEvent.keyDown(row2 as HTMLElement, { key: 'Escape' })
    })
    act(() => ctrlZ())
    expect(cellValue(1, 'name')).toContain('X')
    expect(cellValue(1, 'age')).toContain('25')
    act(() => ctrlZ())
    expect(cellValue(1, 'name')).toContain('Charlie')
    expect(cellValue(1, 'age')).toContain('25')
  })

  it('is inert without the undo prop', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" />)
    editCell(1, 'name', 'Renamed')
    act(() => ctrlZ())
    expect(cellValue(1, 'name')).toContain('Renamed')
    expect(document.querySelector('[data-iris-table-undo]')).toBeNull()
  })

  it('toolbar buttons follow canUndo/canRedo (disabled states)', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" undo />)
    expect(undoBtn()).not.toBeNull()
    expect(undoBtn().disabled).toBe(true)
    expect(redoBtn().disabled).toBe(true)
    editCell(1, 'name', 'Renamed')
    expect(undoBtn().disabled).toBe(false)
    expect(redoBtn().disabled).toBe(true)
    act(() => fireEvent.click(undoBtn()))
    expect(cellValue(1, 'name')).toContain('Charlie')
    expect(undoBtn().disabled).toBe(true)
    expect(redoBtn().disabled).toBe(false)
    act(() => fireEvent.click(redoBtn()))
    expect(cellValue(1, 'name')).toContain('Renamed')
    expect(undoBtn().disabled).toBe(false)
    expect(redoBtn().disabled).toBe(true)
  })

  it('replays undo/redo through commitRowList (fires onDataChange)', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable columns={editableCols} data={rows} rowKey="id" undo onDataChange={onDataChange} />,
    )
    editCell(1, 'name', 'Renamed')
    // Cell edits write back through commitValue — onDataChange stays silent
    // (pre-existing behavior); only the undo/redo REPLAY fires it.
    expect(onDataChange).not.toHaveBeenCalled()
    act(() => ctrlZ())
    expect(onDataChange).toHaveBeenCalledTimes(1)
    expect(onDataChange.mock.calls[0]![0]).toEqual([
      { id: 1, name: 'Charlie', age: 25 },
      { id: 2, name: 'Alice', age: 32 },
      { id: 3, name: 'Bob', age: 28 },
    ])
  })

  it('row ops (removeRow via the handle) are undoable', () => {
    const r = tableRef()
    render(<IrisTable columns={baseCols} data={rows} rowKey="id" undo tableRef={r} />)
    act(() => {
      r.current?.removeRow(2)
    })
    expect(cellValue(2, 'name')).toBe('')
    expect(cellValue(1, 'name')).toContain('Charlie')
    act(() => ctrlZ())
    expect(cellValue(2, 'name')).toContain('Alice')
  })

  it('prunes selection keys that no longer exist after undo/redo', () => {
    const r = tableRef()
    render(
      <IrisTable columns={baseCols} data={rows} rowKey="id" selectable="multi" undo tableRef={r} />,
    )
    checkRow(2)
    checkRow(3)
    // loadData replaces the list without pruning the selection (pre-existing
    // behavior) — the redo replay then must drop the vanished keys.
    act(() => {
      r.current?.loadData([{ id: 1, name: 'Only', age: 99 }])
    })
    expect(cellValue(1, 'name')).toContain('Only')
    expect(cellValue(2, 'name')).toBe('')
    act(() => ctrlZ())
    expect(cellValue(2, 'name')).toContain('Alice')
    expect(cellValue(3, 'name')).toContain('Bob')
    // Selection survived the undo (keys still exist)…
    expect(document.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(2)
    act(() => ctrlY())
    expect(cellValue(2, 'name')).toBe('')
    // …and is pruned on the redo (rows 2/3 no longer exist).
    expect(document.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(0)
  })
})

// ── Batch edit panel (iris 独有, batch AL) ──────────────────────────────────
describe('IrisTable toolbar.batch.edit panel', () => {
  function renderBatchEdit(extra: Record<string, unknown> = {}): {
    onDataChange: ReturnType<typeof vi.fn>
  } {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        selectable="multi"
        toolbar={{ batch: { label: '批量', edit: true } }}
        onDataChange={onDataChange}
        {...extra}
      />,
    )
    return { onDataChange }
  }

  function openPanel(): HTMLElement {
    checkRow(2)
    checkRow(3)
    fireEvent.click(document.querySelector('[data-iris-table-toolbar-batch]') as HTMLElement)
    const panel = document.querySelector('[data-iris-batch-edit-panel]') as HTMLElement
    expect(panel).not.toBeNull()
    return panel
  }

  it('opens on the batch button with editable columns only', () => {
    renderBatchEdit()
    // No selection → no batch button (unchanged batch M gating).
    expect(document.querySelector('[data-iris-table-toolbar-batch]')).toBeNull()
    checkRow(2)
    expect(document.querySelector('[data-iris-table-toolbar-batch]')).not.toBeNull()
    fireEvent.click(document.querySelector('[data-iris-table-toolbar-batch]') as HTMLElement)
    const panel = document.querySelector('[data-iris-batch-edit-panel]') as HTMLElement
    expect(panel).not.toBeNull()
    const select = panel.querySelector('[data-iris-batch-edit-column]') as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Name', 'Age'])
  })

  it('apply writes the value into every selected row with ONE onDataChange', () => {
    const { onDataChange } = renderBatchEdit()
    const panel = openPanel()
    const select = panel.querySelector('[data-iris-batch-edit-column]') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'name' } })
    fireEvent.change(panel.querySelector('[data-iris-batch-edit-value]')!, {
      target: { value: 'Shared' },
    })
    fireEvent.click(panel.querySelector('[data-iris-batch-edit-apply]') as HTMLElement)
    expect(cellValue(2, 'name')).toContain('Shared')
    expect(cellValue(3, 'name')).toContain('Shared')
    // Unselected row untouched.
    expect(cellValue(1, 'name')).toContain('Charlie')
    // One batched commitRowList → exactly one onDataChange.
    expect(onDataChange).toHaveBeenCalledTimes(1)
    expect(onDataChange.mock.calls[0]![0]).toEqual([
      { id: 1, name: 'Charlie', age: 25 },
      { id: 2, name: 'Shared', age: 32 },
      { id: 3, name: 'Shared', age: 28 },
    ])
    // Selection unchanged, panel closed on apply.
    expect(document.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(2)
    expect(document.querySelector('[data-iris-batch-edit-panel]')).toBeNull()
  })

  it('a batch edit apply is undoable via Ctrl+Z', () => {
    renderBatchEdit({ undo: true })
    const panel = openPanel()
    const select = panel.querySelector('[data-iris-batch-edit-column]') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'name' } })
    fireEvent.change(panel.querySelector('[data-iris-batch-edit-value]')!, {
      target: { value: 'Shared' },
    })
    fireEvent.click(panel.querySelector('[data-iris-batch-edit-apply]') as HTMLElement)
    expect(cellValue(2, 'name')).toContain('Shared')
    act(() => ctrlZ())
    expect(cellValue(2, 'name')).toContain('Alice')
    expect(cellValue(3, 'name')).toContain('Bob')
    // Selection survives the undo.
    expect(document.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(2)
  })

  it('Escape and outside pointer-down close the panel without applying', () => {
    renderBatchEdit()
    openPanel()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('[data-iris-batch-edit-panel]')).toBeNull()
    expect(cellValue(2, 'name')).toContain('Alice')

    // Reopen, then click outside (pointer-down on the body).
    fireEvent.click(document.querySelector('[data-iris-table-toolbar-batch]') as HTMLElement)
    expect(document.querySelector('[data-iris-batch-edit-panel]')).not.toBeNull()
    fireEvent.pointerDown(document.body)
    expect(document.querySelector('[data-iris-batch-edit-panel]')).toBeNull()
    expect(cellValue(2, 'name')).toContain('Alice')
  })

  it('without edit the batch button keeps the external action', () => {
    const onClick = vi.fn()
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        selectable="multi"
        toolbar={{ batch: { label: 'Delete', onClick } }}
      />,
    )
    checkRow(2)
    checkRow(3)
    fireEvent.click(document.querySelector('[data-iris-table-toolbar-batch]') as HTMLElement)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledWith([2, 3])
    expect(document.querySelector('[data-iris-batch-edit-panel]')).toBeNull()
  })
})
