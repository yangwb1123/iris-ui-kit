import { describe, it, expect, vi } from 'vitest'
import { createUndoStack } from './undo'

describe('createUndoStack', () => {
  // ─── Basic lifecycle ───────────────────────────────────────────────────

  it('starts empty with no initial snapshot', () => {
    const u = createUndoStack<number>()
    expect(u.depth).toBe(0)
    expect(u.index).toBe(-1)
    expect(u.canUndo()).toBe(false)
    expect(u.canRedo()).toBe(false)
    expect(u.undo()).toBeUndefined()
    expect(u.redo()).toBeUndefined()
  })

  it('starts with initial snapshot when provided', () => {
    const u = createUndoStack<number>({ initial: 42 })
    expect(u.depth).toBe(1)
    expect(u.index).toBe(0)
    // One snapshot is not enough to undo — we need at least two.
    expect(u.canUndo()).toBe(false)
    expect(u.canRedo()).toBe(false)
  })

  // ─── Push / undo / redo  ───────────────────────────────────────────────

  it('records a push and allows undo to the initial', () => {
    const u = createUndoStack<number>({ initial: 0 })
    u.push(1)
    expect(u.depth).toBe(2)
    expect(u.index).toBe(1)
    expect(u.canUndo()).toBe(true)
    expect(u.canRedo()).toBe(false)

    const prev = u.undo()
    expect(prev).toBe(0)
    expect(u.index).toBe(0)
    expect(u.canUndo()).toBe(false)
    expect(u.canRedo()).toBe(true)

    const next = u.redo()
    expect(next).toBe(1)
    expect(u.index).toBe(1)
    expect(u.canUndo()).toBe(true)
    expect(u.canRedo()).toBe(false)
  })

  it('returns undefined when only initial snapshot exists (no mutations)', () => {
    const u = createUndoStack<string>({ initial: 'a' })
    // ptr=0, canUndo = ptr > 0 = false → undo returns undefined
    expect(u.undo()).toBeUndefined()
  })

  it('handles multiple pushes and undos', () => {
    const u = createUndoStack<string>({ initial: 'a' })
    u.push('b')
    u.push('c')
    expect(u.index).toBe(2)

    expect(u.undo()).toBe('b')
    expect(u.undo()).toBe('a')
    expect(u.undo()).toBeUndefined()

    expect(u.redo()).toBe('b')
    expect(u.redo()).toBe('c')
    expect(u.redo()).toBeUndefined()
  })

  // ─── Clear ─────────────────────────────────────────────────────────────

  it('clears all history', () => {
    const u = createUndoStack<number>({ initial: 0 })
    u.push(1)
    u.push(2)
    expect(u.depth).toBe(3)
    u.clear()
    expect(u.depth).toBe(0)
    expect(u.index).toBe(-1)
    expect(u.canUndo()).toBe(false)
    expect(u.canRedo()).toBe(false)
    expect(u.undo()).toBeUndefined()
    expect(u.redo()).toBeUndefined()
  })

  // ─── Push clears redo ──────────────────────────────────────────────────

  it('clears redo history when a new push occurs after undo', () => {
    const u = createUndoStack<number>({ initial: 0 })
    u.push(1)
    u.push(2)
    u.undo() // back to 1
    u.undo() // back to 0
    expect(u.canRedo()).toBe(true)
    u.push(3) // new branch — should clear redo
    expect(u.depth).toBe(2) // only [0, 3]
    expect(u.index).toBe(1)
    expect(u.canUndo()).toBe(true)
    expect(u.canRedo()).toBe(false)
    expect(u.undo()).toBe(0)
  })

  // ─── Skip identical snapshots (equals) ─────────────────────────────────

  it('skips consecutive identical snapshots', () => {
    const u = createUndoStack<number>({ initial: 0 })
    u.push(0) // same as initial
    expect(u.depth).toBe(1) // no new entry
    expect(u.index).toBe(0)

    u.push(1)
    u.push(1) // same as top
    expect(u.depth).toBe(2) // no new entry
    expect(u.index).toBe(1)
  })

  it('uses custom equals to skip duplicates', () => {
    // Track objects by `id` field
    const u = createUndoStack<{ id: number; value: string }>({
      initial: { id: 1, value: 'a' },
      equals: (a, b) => a.id === b.id && a.value === b.value,
    })
    u.push({ id: 1, value: 'a' }) // identical to initial
    expect(u.depth).toBe(1)
  })

  // ─── Merge strategy ────────────────────────────────────────────────────

  it('replaces top when merge returns true', () => {
    // Simulate typing: coalesce consecutive pushes with the same field key
    const u = createUndoStack<{ field: string; value: string }>({
      initial: { field: '', value: '' },
      // Merge when the same field is being edited
      merge: (prev, next) => prev.field === next.field,
    })

    u.push({ field: 'name', value: 'J' })
    u.push({ field: 'name', value: 'Jo' })
    u.push({ field: 'name', value: 'Joh' })

    expect(u.depth).toBe(2) // initial + one merged entry for 'name'
    expect(u.index).toBe(1)

    // Now switch to a different field — should create a new entry
    u.push({ field: 'email', value: 'j@' })
    expect(u.depth).toBe(3)
    expect(u.index).toBe(2)

    // Undo should skip all 'name' typing and go back to initial
    expect(u.undo()?.field).toBe('name')
    expect(u.undo()?.field).toBe('')
  })

  it('merge is not called when equals returns true (skip takes precedence)', () => {
    const merge = vi.fn(() => true)
    const u = createUndoStack<number>({
      initial: 0,
      equals: (a, b) => a === b,
      merge,
    })
    u.push(0) // equals → skip, merge never called
    expect(merge).not.toHaveBeenCalled()
    expect(u.depth).toBe(1)
  })

  // ─── Bounded stack (maxHistory) ────────────────────────────────────────

  it('trims to maxHistory from the oldest end', () => {
    const u = createUndoStack<number>({ maxHistory: 3, initial: 0 })
    u.push(1)
    u.push(2)
    u.push(3) // should evict 0
    expect(u.depth).toBe(3)
    expect(u.index).toBe(2)
    expect(u.undo()).toBe(2)
    expect(u.undo()).toBe(1)
    expect(u.undo()).toBeUndefined() // 0 was evicted
  })

  it('maxHistory=0 disables undo', () => {
    const u = createUndoStack<number>({ maxHistory: 0, initial: 0 })
    u.push(1)
    u.push(2)
    // maxHistory=0 means snapshots are never recorded
    expect(u.depth).toBe(0)
    expect(u.index).toBe(-1)
    expect(u.canUndo()).toBe(false)
    expect(u.canRedo()).toBe(false)
    expect(u.undo()).toBeUndefined()
    expect(u.redo()).toBeUndefined()
  })

  // ─── Integration: object snapshots ─────────────────────────────────────

  it('handles object snapshots correctly (spread-based restore)', () => {
    interface State {
      count: number
      label: string
    }
    const u = createUndoStack<State>({ initial: { count: 0, label: '' } })

    u.push({ count: 1, label: 'a' })
    u.push({ count: 2, label: 'b' })

    const mid = u.undo()
    expect(mid).toEqual({ count: 1, label: 'a' })

    const start = u.undo()
    expect(start).toEqual({ count: 0, label: '' })

    expect(u.undo()).toBeUndefined()
  })

  // ─── Edge cases ────────────────────────────────────────────────────────

  it('push without initial works correctly', () => {
    const u = createUndoStack<number>()
    expect(u.depth).toBe(0)
    expect(u.index).toBe(-1)
    expect(u.undo()).toBeUndefined()

    u.push(1)
    expect(u.depth).toBe(1)
    expect(u.index).toBe(0)
    expect(u.canUndo()).toBe(false) // only one snapshot
    expect(u.canRedo()).toBe(false)

    u.push(2)
    expect(u.depth).toBe(2)
    expect(u.index).toBe(1)
    expect(u.undo()).toBe(1)
    expect(u.undo()).toBeUndefined() // no earlier snapshot
  })

  it('undo after push without initial returns the previous snapshot', () => {
    const u = createUndoStack<number>()
    u.push(1)
    u.push(2)
    // stack=[1,2], ptr=1
    expect(u.undo()).toBe(1) // go back to ptr=0: stack[0]=1
    expect(u.undo()).toBeUndefined() // ptr=0, canUndo=false
    expect(u.redo()).toBe(2) // go forward to ptr=1: stack[1]=2
    expect(u.redo()).toBeUndefined() // ptr=1, canRedo=(1<1)=false
  })

  it('push returns the stored value (merged or new)', () => {
    const u = createUndoStack<number>({ initial: 0, merge: (a, b) => b === a + 1 })
    // Merged: top is 0, next is 1, and merge returns true → replace
    expect(u.push(1)).toBe(1)
    expect(u.depth).toBe(1) // replaced, not pushed
    // Distinct: no merge
    expect(u.push(10)).toBe(10)
    expect(u.depth).toBe(2)
  })

  it('preserves reference stability for identical pushes', () => {
    const obj = { x: 1 }
    const u = createUndoStack<typeof obj>({ initial: obj })
    const result = u.push(obj)
    expect(result).toBe(obj) // same reference returned when identical
  })
})
