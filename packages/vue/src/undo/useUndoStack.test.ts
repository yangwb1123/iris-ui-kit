import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, watch } from 'vue'
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

  it('regression: syncs reactive state when undefined is a legal snapshot value', async () => {
    // T = number | undefined: `undefined` is a valid snapshot. undo() returns
    // undefined both for a legal snapshot AND for a no-op, so the bridge must
    // not use the return value as a proxy for "pointer moved".
    const { w, api } = probe<number | undefined>()

    api.push(undefined) // baseline snapshot [undefined]
    api.push(1) // stack [undefined, 1], index 1
    await w.vm.$nextTick()
    expect(w.find('[data-can-undo]').text()).toBe('true')
    expect(w.find('[data-can-redo]').text()).toBe('false')
    expect(w.find('[data-index]').text()).toBe('1')

    // undo() returns undefined (the legal baseline snapshot), but the pointer
    // HAS advanced — reactive state must follow (pre-fix it stayed stale).
    const value = api.undo()
    await w.vm.$nextTick()
    expect(value).toBeUndefined()
    expect(w.find('[data-can-undo]').text()).toBe('false')
    expect(w.find('[data-can-redo]').text()).toBe('true')
    expect(w.find('[data-depth]').text()).toBe('2')
    expect(w.find('[data-index]').text()).toBe('0')

    // redo() returns 1 and state follows back.
    const value2 = api.redo()
    await w.vm.$nextTick()
    expect(value2).toBe(1)
    expect(w.find('[data-can-undo]').text()).toBe('true')
    expect(w.find('[data-can-redo]').text()).toBe('false')
    expect(w.find('[data-index]').text()).toBe('1')
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

  it('regression: raw stack direct mutations keep reactive state in sync', async () => {
    // `api.stack` is documented as a stable, modifiable reference. Mutating it
    // directly (including through a held reference) must refresh `state` —
    // pre-fix it bypassed sync() and left the reactive state permanently stale.
    const { w, api } = probe<number>({ initial: 0 })
    const s = api.stack // consumer pattern: hold the reference, then mutate it

    s.push(1)
    await w.vm.$nextTick()
    expect(w.find('[data-can-undo]').text()).toBe('true')
    expect(w.find('[data-can-redo]').text()).toBe('false')
    expect(w.find('[data-depth]').text()).toBe('2')
    expect(w.find('[data-index]').text()).toBe('1')

    s.undo()
    await w.vm.$nextTick()
    expect(w.find('[data-can-undo]').text()).toBe('false')
    expect(w.find('[data-can-redo]').text()).toBe('true')
    expect(w.find('[data-index]').text()).toBe('0')

    s.redo()
    await w.vm.$nextTick()
    expect(w.find('[data-can-undo]').text()).toBe('true')
    expect(w.find('[data-can-redo]').text()).toBe('false')
    expect(w.find('[data-index]').text()).toBe('1')

    s.clear()
    await w.vm.$nextTick()
    expect(w.find('[data-depth]').text()).toBe('0')
    expect(w.find('[data-index]').text()).toBe('-1')
    expect(w.find('[data-can-undo]').text()).toBe('false')
    expect(w.find('[data-can-redo]').text()).toBe('false')
  })

  it('regression: direct stack mutation of an undefined snapshot still syncs', async () => {
    // T = number | undefined: raw undo() returns undefined (a legal snapshot)
    // while the pointer DID move — sync must fire regardless of return value.
    const { w, api } = probe<number | undefined>()

    api.stack.push(undefined) // baseline [undefined]
    api.stack.push(1) // [undefined, 1], index 1
    await w.vm.$nextTick()
    expect(w.find('[data-can-undo]').text()).toBe('true')
    expect(w.find('[data-index]').text()).toBe('1')

    const value = api.stack.undo()
    await w.vm.$nextTick()
    expect(value).toBeUndefined()
    expect(w.find('[data-can-undo]').text()).toBe('false')
    expect(w.find('[data-can-redo]').text()).toBe('true')
    expect(w.find('[data-index]').text()).toBe('0')
  })

  it('wrapped stack methods are stable identities; read-only members pass through', () => {
    const { api } = probe<number>({ initial: 0 })
    expect(api.stack.push).toBe(api.stack.push)
    expect(api.stack.undo).toBe(api.stack.undo)
    expect(api.stack.redo).toBe(api.stack.redo)
    expect(api.stack.clear).toBe(api.stack.clear)
    // Reads are pure: they pass through without mutating or syncing.
    expect(api.stack.canUndo()).toBe(false)
    expect(api.stack.canRedo()).toBe(false)
    expect(api.stack.depth).toBe(1)
    expect(api.stack.index).toBe(0)
  })

  // ─── No-op guard: state.value is only reassigned on real metadata moves ───

  it('regression: equals-dedup push preserves the state reference (identical value)', () => {
    const { push, state } = useUndoStack<number>({ initial: 42 })
    const before = state.value
    expect(push(42)).toBe(42) // Object.is(42, 42) → core skips the push
    expect(state.value).toBe(before) // metadata unchanged → no reassignment
  })

  it('regression: merge-coalesced push preserves the state reference', () => {
    const { push, state } = useUndoStack<{ field: string; value: string }>({
      initial: { field: '', value: '' },
      merge: (prev, next) => prev.field === next.field,
    })
    push({ field: 'name', value: 'J' }) // real push — metadata legitimately updates
    const before = state.value
    expect(push({ field: 'name', value: 'Jo' })).toEqual({ field: 'name', value: 'Jo' })
    // Merge replaced the top: depth/index/canUndo/canRedo are all unchanged.
    expect(state.value).toBe(before)
  })

  it('regression: undo and redo on an empty stack preserve the state reference', () => {
    const { undo, redo, state } = useUndoStack<number>()
    const before = state.value
    expect(undo()).toBeUndefined()
    expect(state.value).toBe(before)
    expect(redo()).toBeUndefined()
    expect(state.value).toBe(before)
  })

  it('regression: clear on an empty stack preserves the state reference', () => {
    const { clear, state } = useUndoStack<number>()
    const before = state.value
    clear()
    expect(state.value).toBe(before)
  })

  it('regression: bounded-stack trim preserves the state reference when metadata is unchanged', () => {
    const { push, state } = useUndoStack<number>({ initial: 0, maxHistory: 3 })
    push(1) // depth 2, index 1
    push(2) // depth 3, index 2
    const before = state.value
    push(3) // push then trim: [0,1,2,3] → [1,2,3], ptr 2 → same depth/index/canUndo/canRedo
    expect(state.value).toBe(before)
    expect(state.value).toEqual({ canUndo: true, canRedo: false, depth: 3, index: 2 })
  })

  it('regression: direct stack.* no-op calls get the same guard (identity preserved)', () => {
    const { stack, state } = useUndoStack<number>()
    const before = state.value
    expect(stack.undo()).toBeUndefined()
    expect(state.value).toBe(before)
    expect(stack.redo()).toBeUndefined()
    expect(state.value).toBe(before)
    stack.clear()
    expect(state.value).toBe(before)
  })

  it('regression: direct stack.push dedup preserves the reference; real pushes reassign', () => {
    const { stack, state } = useUndoStack<number>({ initial: 1 })
    const before = state.value
    stack.push(1) // Object.is dedup → no-op
    expect(state.value).toBe(before)
    stack.push(2) // real move
    expect(state.value).not.toBe(before)
    expect(state.value).toEqual({ canUndo: true, canRedo: false, depth: 2, index: 1 })
  })

  it('regression: watchers on state.value fire only for real metadata moves', async () => {
    const { push, undo, redo, clear, state } = useUndoStack<number>()
    const spy = vi.fn()
    watch(() => state.value, spy)

    undo() // empty-stack no-op
    await nextTick()
    redo() // empty-stack no-op
    await nextTick()
    clear() // empty-stack no-op
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(0) // zero triggers from no-ops

    push(1) // real mutation
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1) // exactly one trigger
    expect(spy.mock.calls[0]![0]).toBe(state.value)
  })

  it('regression: merge no-op adds no trigger; undo/redo fire exactly once each', async () => {
    const { push, undo, redo, state } = useUndoStack<{ field: string; value: string }>({
      initial: { field: '', value: '' },
      merge: (prev, next) => prev.field === next.field,
    })
    const spy = vi.fn()
    watch(() => state.value, spy)

    push({ field: 'name', value: 'J' }) // real push
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)

    push({ field: 'name', value: 'Jo' }) // merge-coalesced → metadata unchanged
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1) // still 1 — no extra trigger

    undo() // pointer moves back
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(2)

    redo() // pointer moves forward
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(3)
  })
})
