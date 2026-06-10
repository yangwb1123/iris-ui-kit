import { describe, expect, it, vi } from 'vitest'
import { get } from 'svelte/store'
import { createStore } from '@iris-ui/core'
import { toStoreSelector } from './useStore'

describe('toStoreSelector (svelte)', () => {
  it('emits only when the selected slice changes', () => {
    const store = createStore({ a: 0, b: 0 })
    const a = toStoreSelector(store, (s) => s.a)
    const seen: number[] = []
    const unsub = a.subscribe((v) => seen.push(v))
    // readable fires once on subscribe with the initial value
    expect(seen).toEqual([0])
    store.setState((s) => ({ ...s, b: 1 })) // unrelated → no emit
    expect(seen).toEqual([0])
    store.setState((s) => ({ ...s, a: 3 }))
    expect(seen).toEqual([0, 3])
    expect(get(a)).toBe(3)
    unsub()
  })

  it('honors a custom equality', () => {
    const store = createStore({ ids: [1, 2] as number[] })
    const shallow = (x: number[], y: number[]) =>
      x.length === y.length && x.every((v, i) => v === y[i])
    const s = toStoreSelector(store, (st) => st.ids, shallow)
    const fn = vi.fn()
    const unsub = s.subscribe(fn)
    fn.mockClear() // ignore the initial emit
    store.setState((st) => ({ ...st, ids: [1, 2] })) // equal contents → no emit
    expect(fn).not.toHaveBeenCalled()
    store.setState((st) => ({ ...st, ids: [1, 2, 3] }))
    expect(fn).toHaveBeenCalledWith([1, 2, 3])
    unsub()
  })
})
