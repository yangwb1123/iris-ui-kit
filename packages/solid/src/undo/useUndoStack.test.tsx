import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import type { UndoStackOptions } from '@iris-ui/core/undo'
import { useUndoStack } from './useUndoStack'

afterEach(cleanup)

function probe<T>(options?: UndoStackOptions<T>) {
  let api!: ReturnType<typeof useUndoStack<T>>
  const Probe = () => {
    api = useUndoStack<T>(options)
    return (
      <div>
        <span data-can-undo="">{String(api.state().canUndo)}</span>
        <span data-can-redo="">{String(api.state().canRedo)}</span>
        <span data-depth="">{api.state().depth}</span>
        <span data-index="">{api.state().index}</span>
      </div>
    )
  }
  const utils = render(() => <Probe />)
  return { ...utils, api }
}

describe('@iris-ui/solid useUndoStack', () => {
  it('returns a stable stack reference', () => {
    const { api } = probe<number>()
    const stack1 = api.stack
    expect(api.stack).toBe(stack1)
  })

  it('starts empty with no initial snapshot', () => {
    const { container } = probe<number>()
    expect(container.querySelector('[data-can-undo]')!.textContent).toBe('false')
    expect(container.querySelector('[data-can-redo]')!.textContent).toBe('false')
    expect(container.querySelector('[data-depth]')!.textContent).toBe('0')
    expect(container.querySelector('[data-index]')!.textContent).toBe('-1')
  })

  it('starts with initial snapshot when provided', () => {
    const { container } = probe<number>({ initial: 42 })
    expect(container.querySelector('[data-depth]')!.textContent).toBe('1')
    expect(container.querySelector('[data-index]')!.textContent).toBe('0')
    expect(container.querySelector('[data-can-undo]')!.textContent).toBe('false')
    expect(container.querySelector('[data-can-redo]')!.textContent).toBe('false')
  })

  it('pushes a snapshot and can undo/redo', () => {
    const { container, api } = probe<number>({ initial: 0 })

    api.push(1)
    expect(container.querySelector('[data-can-undo]')!.textContent).toBe('true')
    expect(container.querySelector('[data-can-redo]')!.textContent).toBe('false')
    expect(container.querySelector('[data-depth]')!.textContent).toBe('2')

    const value = api.undo()
    expect(value).toBe(0)
    expect(container.querySelector('[data-can-undo]')!.textContent).toBe('false')
    expect(container.querySelector('[data-can-redo]')!.textContent).toBe('true')

    const value2 = api.redo()
    expect(value2).toBe(1)
    expect(container.querySelector('[data-can-undo]')!.textContent).toBe('true')
    expect(container.querySelector('[data-can-redo]')!.textContent).toBe('false')
  })

  it('undo is a no-op when nothing to undo (returns undefined)', () => {
    const { api } = probe<number>()
    expect(api.undo()).toBeUndefined()
  })

  it('clear resets the stack', () => {
    const { container, api } = probe<number>({ initial: 0 })

    api.push(1)
    api.push(2)
    expect(container.querySelector('[data-depth]')!.textContent).toBe('3')

    api.clear()
    expect(container.querySelector('[data-depth]')!.textContent).toBe('0')
    expect(container.querySelector('[data-index]')!.textContent).toBe('-1')
    expect(container.querySelector('[data-can-undo]')!.textContent).toBe('false')
    expect(container.querySelector('[data-can-redo]')!.textContent).toBe('false')
  })

  it('push after undo clears redo history', () => {
    const { container, api } = probe<number>({ initial: 0 })

    api.push(1)
    api.push(2)
    api.undo()
    api.undo()
    expect(container.querySelector('[data-can-redo]')!.textContent).toBe('true')

    api.push(3)
    expect(container.querySelector('[data-depth]')!.textContent).toBe('2')
    expect(container.querySelector('[data-can-redo]')!.textContent).toBe('false')
  })

  it('works with object snapshots', () => {
    interface State {
      count: number
      label: string
    }
    const { container, api } = probe<State>({ initial: { count: 0, label: '' } })

    api.push({ count: 1, label: 'a' })
    expect(container.querySelector('[data-depth]')!.textContent).toBe('2')

    const mid = api.undo()
    expect(mid).toEqual({ count: 0, label: '' })
  })

  it('supports merge strategy for coalescing', () => {
    const { container, api } = probe<{ field: string; value: string }>({
      initial: { field: '', value: '' },
      merge: (prev, next) => prev.field === next.field,
    })

    api.push({ field: 'name', value: 'J' })
    api.push({ field: 'name', value: 'Jo' })
    api.push({ field: 'name', value: 'Joh' })
    api.push({ field: 'email', value: 'j@' })

    expect(container.querySelector('[data-depth]')!.textContent).toBe('3') // initial + name (merged) + email
  })

  it('re-renders when state changes (canUndo flips)', () => {
    const { container, api } = probe<number>({ initial: 0 })
    expect(container.querySelector('[data-can-undo]')!.textContent).toBe('false')

    api.push(1)
    expect(container.querySelector('[data-can-undo]')!.textContent).toBe('true')
  })
})
