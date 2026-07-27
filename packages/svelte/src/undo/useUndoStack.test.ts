import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import type { UndoStackOptions } from '@iris-ui-kit/core/undo'
import type { useUndoStack } from './useUndoStack.svelte'
import UndoStackHarness from './UndoStackHarness.svelte'

afterEach(cleanup)

function probe<T>(options?: UndoStackOptions<T>) {
  let api!: ReturnType<typeof useUndoStack<T>>
  const utils = render(UndoStackHarness, {
    props: {
      options,
      onready: (a: ReturnType<typeof useUndoStack<T>>) => {
        api = a
      },
    },
  })
  return { ...utils, api }
}

describe('@iris-ui-kit/svelte useUndoStack', () => {
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
    flushSync()
    expect(container.querySelector('[data-can-undo]')!.textContent).toBe('true')
    expect(container.querySelector('[data-can-redo]')!.textContent).toBe('false')
    expect(container.querySelector('[data-depth]')!.textContent).toBe('2')

    const value = api.undo()
    flushSync()
    expect(value).toBe(0)
    expect(container.querySelector('[data-can-undo]')!.textContent).toBe('false')
    expect(container.querySelector('[data-can-redo]')!.textContent).toBe('true')

    const value2 = api.redo()
    flushSync()
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
    flushSync()
    expect(container.querySelector('[data-depth]')!.textContent).toBe('3')

    api.clear()
    flushSync()
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
    flushSync()
    expect(container.querySelector('[data-can-redo]')!.textContent).toBe('true')

    api.push(3)
    flushSync()
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
    flushSync()
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
    flushSync()

    expect(container.querySelector('[data-depth]')!.textContent).toBe('3') // initial + name (merged) + email
  })

  it('re-renders when state changes (canUndo flips)', () => {
    const { container, api } = probe<number>({ initial: 0 })
    expect(container.querySelector('[data-can-undo]')!.textContent).toBe('false')

    api.push(1)
    flushSync()
    expect(container.querySelector('[data-can-undo]')!.textContent).toBe('true')
  })
})
