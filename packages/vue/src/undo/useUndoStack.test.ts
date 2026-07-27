import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import type { UndoStackOptions } from '@iris-ui-kit/core/undo'
import { useUndoStack } from './useUndoStack'

/** Mount a probe component that exposes the bridge's reactive state in the DOM. */
function probe<T>(options?: UndoStackOptions<T>) {
  const api: { value?: ReturnType<typeof useUndoStack<T>> } = {}
  const Comp = defineComponent({
    setup() {
      const u = useUndoStack<T>(options)
      api.value = u
      return () =>
        h('div', [
          h('span', { 'data-can-undo': '' }, String(u.state.value.canUndo)),
          h('span', { 'data-can-redo': '' }, String(u.state.value.canRedo)),
          h('span', { 'data-depth': '' }, String(u.state.value.depth)),
          h('span', { 'data-index': '' }, String(u.state.value.index)),
        ])
    },
  })
  const w = mount(Comp)
  return { w, api: api.value! }
}

describe('useUndoStack (vue)', () => {
  it('returns a stable stack ref across renders', async () => {
    const { w, api } = probe<number>()
    const stack1 = api.stack
    await w.vm.$forceUpdate()
    expect(api.stack).toBe(stack1)
  })

  it('starts empty with no initial snapshot', () => {
    const { w } = probe<number>()
    expect(w.find('[data-can-undo]').text()).toBe('false')
    expect(w.find('[data-can-redo]').text()).toBe('false')
    expect(w.find('[data-depth]').text()).toBe('0')
    expect(w.find('[data-index]').text()).toBe('-1')
  })

  it('starts with initial snapshot when provided', () => {
    const { w } = probe<number>({ initial: 42 })
    expect(w.find('[data-depth]').text()).toBe('1')
    expect(w.find('[data-index]').text()).toBe('0')
    expect(w.find('[data-can-undo]').text()).toBe('false')
    expect(w.find('[data-can-redo]').text()).toBe('false')
  })

  it('pushes a snapshot and can undo/redo', async () => {
    const { w, api } = probe<number>({ initial: 0 })

    api.push(1)
    await w.vm.$nextTick()
    expect(w.find('[data-can-undo]').text()).toBe('true')
    expect(w.find('[data-can-redo]').text()).toBe('false')
    expect(w.find('[data-depth]').text()).toBe('2')

    const value = api.undo()
    await w.vm.$nextTick()
    expect(value).toBe(0)
    expect(w.find('[data-can-undo]').text()).toBe('false')
    expect(w.find('[data-can-redo]').text()).toBe('true')

    const value2 = api.redo()
    await w.vm.$nextTick()
    expect(value2).toBe(1)
    expect(w.find('[data-can-undo]').text()).toBe('true')
    expect(w.find('[data-can-redo]').text()).toBe('false')
  })

  it('undo is a no-op when nothing to undo (returns undefined)', () => {
    const { api } = probe<number>()
    expect(api.undo()).toBeUndefined()
  })

  it('clear resets the stack', async () => {
    const { w, api } = probe<number>({ initial: 0 })

    api.push(1)
    api.push(2)
    await w.vm.$nextTick()
    expect(w.find('[data-depth]').text()).toBe('3')

    api.clear()
    await w.vm.$nextTick()
    expect(w.find('[data-depth]').text()).toBe('0')
    expect(w.find('[data-index]').text()).toBe('-1')
    expect(w.find('[data-can-undo]').text()).toBe('false')
    expect(w.find('[data-can-redo]').text()).toBe('false')
  })

  it('push after undo clears redo history', async () => {
    const { w, api } = probe<number>({ initial: 0 })

    api.push(1)
    api.push(2)
    api.undo()
    api.undo()
    await w.vm.$nextTick()
    expect(w.find('[data-can-redo]').text()).toBe('true')

    api.push(3)
    await w.vm.$nextTick()
    expect(w.find('[data-depth]').text()).toBe('2')
    expect(w.find('[data-can-redo]').text()).toBe('false')
  })

  it('works with object snapshots', async () => {
    interface State {
      count: number
      label: string
    }
    const { w, api } = probe<State>({ initial: { count: 0, label: '' } })

    api.push({ count: 1, label: 'a' })
    await w.vm.$nextTick()
    expect(w.find('[data-depth]').text()).toBe('2')

    const mid = api.undo()
    expect(mid).toEqual({ count: 0, label: '' })
  })

  it('supports merge strategy for coalescing', async () => {
    const { w, api } = probe<{ field: string; value: string }>({
      initial: { field: '', value: '' },
      merge: (prev, next) => prev.field === next.field,
    })

    api.push({ field: 'name', value: 'J' })
    api.push({ field: 'name', value: 'Jo' })
    api.push({ field: 'name', value: 'Joh' })
    api.push({ field: 'email', value: 'j@' })
    await w.vm.$nextTick()

    expect(w.find('[data-depth]').text()).toBe('3') // initial + name (merged) + email
  })

  it('re-renders when state changes (canUndo flips)', async () => {
    const { w, api } = probe<number>({ initial: 0 })
    expect(w.find('[data-can-undo]').text()).toBe('false')

    api.push(1)
    await w.vm.$nextTick()
    expect(w.find('[data-can-undo]').text()).toBe('true')
  })
})
