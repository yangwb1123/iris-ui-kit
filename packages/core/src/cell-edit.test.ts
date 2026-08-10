import { describe, it, expect, vi } from 'vitest'
import { createCellEdit, setCellValue, type CellEditState } from './cell-edit'

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
    expect(seen.at(-1)).toMatchObject({ editing: null })
    expect(seen.some((s) => s.editing?.rowKey === '1')).toBe(true)
  })
})
// 追加：draft/validate/coerce 会话测试

describe('createCellEdit draft session (advancement)', () => {
  it('tracks draft + live validation errors', () => {
    const ce = createCellEdit({
      validate: (d) => (d === '' || d == null ? 'required' : null),
      coerce: (d) => Number(d),
    })
    ce.startEdit('r1', 'c1', '')
    expect(ce.getDraft()).toBe('')
    expect(ce.getError()).toBe('required')
    ce.setDraft('42')
    expect(ce.getError()).toBeNull()
    expect(ce.getValidated()).toBeUndefined()
  })

  it('rejects invalid commit, keeps session open with error', () => {
    const commit = vi.fn()
    const ce = createCellEdit({
      validate: (d) => (d === '' ? 'required' : null),
      coerce: (d) => Number(d),
      onCommit: commit,
    })
    ce.startEdit('r1', 'c1', '')
    expect(ce.commitEdit()).toBe(false)
    expect(ce.getError()).toBe('required')
    expect(commit).not.toHaveBeenCalled()
    expect(ce.getEditing()).toEqual({ rowKey: 'r1', columnKey: 'c1' })
  })

  it('coerces + commits clean drafts and stores validated value', () => {
    const commit = vi.fn()
    const ce = createCellEdit({
      validate: (d) => (Number.isNaN(Number(d)) ? 'not a number' : null),
      coerce: (d) => Number(d),
      onCommit: commit,
    })
    ce.startEdit('r1', 'c1', '12')
    expect(ce.commitEdit()).toBe(true)
    expect(commit).toHaveBeenCalledWith({ rowKey: 'r1', columnKey: 'c1' }, 12)
    expect(ce.getValidated()).toBe(12)
    expect(ce.getEditing()).toBeNull()
  })

  it('cancelEdit discards draft and error', () => {
    const ce = createCellEdit({ validate: () => 'nope' })
    ce.startEdit('r1', 'c1', 'x')
    ce.setDraft('y')
    expect(ce.getError()).toBe('nope')
    ce.cancelEdit()
    expect(ce.getEditing()).toBeNull()
    expect(ce.getDraft()).toBe('')
    expect(ce.getError()).toBeNull()
  })
})

describe('setCellValue (edit write-back)', () => {
  it('replaces the matching row immutably', () => {
    const rows = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]
    const next = setCellValue(rows, 'id', 2, 'name', 'B')
    expect(next[1]?.name).toBe('B')
    expect(next[0]).toBe(rows[0])
    expect(rows[1]?.name).toBe('b')
  })

  it('missing key leaves rows untouched', () => {
    const rows = [{ id: 1, name: 'a' }]
    expect(setCellValue(rows, 'id', 99, 'name', 'x')).toBe(rows)
  })
})
