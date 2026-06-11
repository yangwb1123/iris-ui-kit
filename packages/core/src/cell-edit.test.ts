import { describe, it, expect, vi } from 'vitest'
import { createCellEdit, type CellEditState } from './cell-edit'

describe('createCellEdit', () => {
  it('starts idle', () => {
    const ce = createCellEdit()
    expect(ce.getEditing()).toBeNull()
    expect(ce.isEditing('1', 'name')).toBe(false)
  })

  it('startEdit opens the editor on a cell', () => {
    const ce = createCellEdit()
    ce.startEdit('1', 'name')
    expect(ce.getEditing()).toEqual({ rowKey: '1', columnKey: 'name' })
    expect(ce.isEditing('1', 'name')).toBe(true)
    expect(ce.isEditing('1', 'age')).toBe(false)
  })

  it('cancelEdit closes without committing', () => {
    const onCommit = vi.fn()
    const ce = createCellEdit({ onCommit })
    ce.startEdit('1', 'name')
    ce.cancelEdit()
    expect(ce.getEditing()).toBeNull()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('commitEdit calls onCommit with the target + value, then clears editing', () => {
    const seen: unknown[] = []
    const ce = createCellEdit({
      onCommit: (target, value) => {
        // editing is still active while onCommit runs
        expect(ce.getEditing()).toEqual(target)
        seen.push([target, value])
      },
    })
    ce.startEdit('2', 'name')
    ce.commitEdit('Alicia')
    expect(seen).toEqual([[{ rowKey: '2', columnKey: 'name' }, 'Alicia']])
    expect(ce.getEditing()).toBeNull()
  })

  it('commitEdit is a no-op when nothing is being edited', () => {
    const onCommit = vi.fn()
    const ce = createCellEdit({ onCommit })
    ce.commitEdit('x')
    expect(onCommit).not.toHaveBeenCalled()
    expect(ce.getEditing()).toBeNull()
  })

  it('exposes a subscribable store of the editing state', () => {
    const ce = createCellEdit()
    const seen: CellEditState[] = []
    ce.store.subscribe((s) => seen.push(s))
    ce.startEdit('1', 'name')
    ce.commitEdit('v')
    expect(seen.at(-1)).toEqual({ editing: null })
    expect(seen.some((s) => s.editing?.rowKey === '1')).toBe(true)
  })
})
