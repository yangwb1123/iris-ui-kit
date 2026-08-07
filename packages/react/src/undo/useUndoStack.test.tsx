import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useUndoStack } from './useUndoStack'

afterEach(cleanup)

describe('useUndoStack', () => {
  it('returns a stable stack ref across renders', () => {
    const { result, rerender } = renderHook(() => useUndoStack<number>())
    const stack1 = result.current.stack
    rerender()
    expect(result.current.stack).toBe(stack1)
  })

  it('starts empty with no initial snapshot', () => {
    const { result } = renderHook(() => useUndoStack<number>())
    expect(result.current.state.canUndo).toBe(false)
    expect(result.current.state.canRedo).toBe(false)
    expect(result.current.state.depth).toBe(0)
    expect(result.current.state.index).toBe(-1)
  })

  it('starts with initial snapshot when provided', () => {
    const { result } = renderHook(() => useUndoStack<number>({ initial: 42 }))
    expect(result.current.state.depth).toBe(1)
    expect(result.current.state.index).toBe(0)
    expect(result.current.state.canUndo).toBe(false)
    expect(result.current.state.canRedo).toBe(false)
  })

  it('pushes a snapshot and can undo/redo', () => {
    const { result } = renderHook(() => useUndoStack<number>({ initial: 0 }))

    act(() => {
      result.current.push(1)
    })
    expect(result.current.state.canUndo).toBe(true)
    expect(result.current.state.canRedo).toBe(false)
    expect(result.current.state.depth).toBe(2)

    let value: number | undefined
    act(() => {
      value = result.current.undo()
    })
    expect(value).toBe(0)
    expect(result.current.state.canUndo).toBe(false)
    expect(result.current.state.canRedo).toBe(true)

    act(() => {
      value = result.current.redo()
    })
    expect(value).toBe(1)
    expect(result.current.state.canUndo).toBe(true)
    expect(result.current.state.canRedo).toBe(false)
  })

  it('undo is a no-op when nothing to undo (returns undefined)', () => {
    const { result } = renderHook(() => useUndoStack<number>())

    let value: number | undefined
    act(() => {
      value = result.current.undo()
    })
    expect(value).toBeUndefined()
    expect(result.current.state.canUndo).toBe(false)
  })

  it('clear resets the stack', () => {
    const { result } = renderHook(() => useUndoStack<number>({ initial: 0 }))

    act(() => {
      result.current.push(1)
      result.current.push(2)
    })
    expect(result.current.state.depth).toBe(3)

    act(() => {
      result.current.clear()
    })
    expect(result.current.state.depth).toBe(0)
    expect(result.current.state.index).toBe(-1)
    expect(result.current.state.canUndo).toBe(false)
    expect(result.current.state.canRedo).toBe(false)
  })

  it('push after undo clears redo history', () => {
    const { result } = renderHook(() => useUndoStack<number>({ initial: 0 }))

    act(() => {
      result.current.push(1)
      result.current.push(2)
      result.current.undo() // back to 1
      result.current.undo() // back to 0
    })
    expect(result.current.state.canRedo).toBe(true)

    act(() => {
      result.current.push(3) // new branch
    })
    expect(result.current.state.depth).toBe(2) // [0, 3]
    expect(result.current.state.canRedo).toBe(false)
  })

  it('works with object snapshots', () => {
    interface State {
      count: number
      label: string
    }
    const { result } = renderHook(() => useUndoStack<State>({ initial: { count: 0, label: '' } }))

    act(() => {
      result.current.push({ count: 1, label: 'a' })
    })
    expect(result.current.state.depth).toBe(2)

    let mid: State | undefined
    act(() => {
      mid = result.current.undo()
    })
    expect(mid).toEqual({ count: 0, label: '' })
  })

  it('supports merge strategy for coalescing', () => {
    // Simulate typing: coalesce edits to the same field
    const { result } = renderHook(() =>
      useUndoStack<{ field: string; value: string }>({
        initial: { field: '', value: '' },
        merge: (prev, next) => prev.field === next.field,
      }),
    )

    act(() => {
      result.current.push({ field: 'name', value: 'J' })
      result.current.push({ field: 'name', value: 'Jo' })
      result.current.push({ field: 'name', value: 'Joh' })
      result.current.push({ field: 'email', value: 'j@' })
    })

    expect(result.current.state.depth).toBe(3) // initial + name (merged) + email
  })

  it('re-renders when state changes (canUndo flips)', () => {
    const { result } = renderHook(() => useUndoStack<number>({ initial: 0 }))
    const initialCanUndo = result.current.state.canUndo

    act(() => {
      result.current.push(1)
    })
    expect(result.current.state.canUndo).toBe(true)
    expect(result.current.state.canUndo).not.toBe(initialCanUndo)
  })
  it('re-renders when state changes (canUndo flips)', () => {
    const { result } = renderHook(() => useUndoStack<number>({ initial: 0 }))
    const initialCanUndo = result.current.state.canUndo

    act(() => {
      result.current.push(1)
    })
    expect(result.current.state.canUndo).toBe(true)
    expect(result.current.state.canUndo).not.toBe(initialCanUndo)
  })

  it('regression: raw stack direct mutations keep reactive state in sync', () => {
    const { result } = renderHook(() => useUndoStack<number>({ initial: 0 }))
    act(() => {
      result.current.stack.push(1)
    })
    expect(result.current.state.canUndo).toBe(true)
    expect(result.current.state.depth).toBe(2)
    act(() => {
      result.current.stack.undo()
    })
    expect(result.current.state.canUndo).toBe(false)
    expect(result.current.state.canRedo).toBe(true)
    act(() => {
      result.current.stack.clear()
    })
    expect(result.current.state.depth).toBe(0)
    expect(result.current.state.canUndo).toBe(false)
  })

  it('regression: undefined is a legal snapshot and still syncs on undo', () => {
    const { result } = renderHook(() => useUndoStack<number | undefined>())
    act(() => {
      result.current.stack.push(undefined)
      result.current.stack.push(1)
    })
    expect(result.current.state.depth).toBe(2)
    act(() => {
      result.current.undo()
    })
    // undo 返回 undefined（合法快照），但指针已推进——state 必须跟随
    expect(result.current.state.canRedo).toBe(true)
    expect(result.current.state.index).toBe(0)
  })

  it('regression: tracked stack keeps stable method identities', () => {
    const { result } = renderHook(() => useUndoStack<number>({ initial: 0 }))
    expect(result.current.stack.push).toBe(result.current.stack.push)
    expect(result.current.stack.undo).toBe(result.current.stack.undo)
    // 纯读取属性透传无副作用
    expect(typeof result.current.stack.depth).toBe('number')
  })
})
