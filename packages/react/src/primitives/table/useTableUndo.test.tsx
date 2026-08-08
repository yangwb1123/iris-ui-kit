import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTableUndo } from './useTableUndo'

describe('useTableUndo (undoRedoHistory composition)', () => {
  it('undo/redo replays snapshots through onDataChange', () => {
    const onChange = vi.fn()
    const initial = [{ id: 1 }, { id: 2 }]
    const edited = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const { result, rerender } = renderHook(
      ({ data }: { data: typeof initial }) => useTableUndo(data, onChange),
      { initialProps: { data: initial } },
    )
    // record initial state, then simulate an edit (new data) + snapshot
    act(() => result.current.pushSnapshot())
    rerender({ data: edited })
    act(() => result.current.pushSnapshot())
    expect(result.current.canUndo()).toBe(true)
    act(() => result.current.undo())
    expect(onChange).toHaveBeenLastCalledWith(initial)
    expect(result.current.canRedo()).toBe(true)
    act(() => result.current.redo())
    expect(onChange).toHaveBeenLastCalledWith(edited)
    expect(result.current.canUndo()).toBe(true)
  })

  it('returns undefined when nothing to undo', () => {
    const { result } = renderHook(() => useTableUndo([], vi.fn()))
    expect(result.current.undo()).toBeUndefined()
    expect(result.current.canUndo()).toBe(false)
    expect(result.current.canRedo()).toBe(false)
  })
})
