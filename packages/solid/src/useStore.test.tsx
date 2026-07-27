import { describe, expect, it } from 'vitest'
import { createRoot } from 'solid-js'
import { createStore } from '@iris-ui-kit/core'
import { useStoreSelector } from './useStore'

describe('useStoreSelector (solid)', () => {
  it('the accessor updates only when the selected slice changes', () => {
    createRoot((dispose) => {
      const store = createStore({ a: 0, b: 0 })
      const a = useStoreSelector(store, (s) => s.a)
      expect(a()).toBe(0)
      store.setState((s) => ({ ...s, b: 1 })) // unrelated
      expect(a()).toBe(0)
      store.setState((s) => ({ ...s, a: 7 }))
      expect(a()).toBe(7)
      dispose()
    })
  })

  it('honors a custom equality and stops after dispose', () => {
    let disposed!: () => void
    const store = createStore({ ids: [1, 2] as number[] })
    const shallow = (x: number[], y: number[]) =>
      x.length === y.length && x.every((v, i) => v === y[i])
    const a = createRoot((dispose) => {
      disposed = dispose
      return useStoreSelector(store, (s) => s.ids, shallow)
    })
    store.setState((s) => ({ ...s, ids: [1, 2] })) // equal → unchanged
    expect(a()).toEqual([1, 2])
    store.setState((s) => ({ ...s, ids: [9] }))
    expect(a()).toEqual([9])
    disposed()
    store.setState((s) => ({ ...s, ids: [0] })) // after dispose → no update
    expect(a()).toEqual([9])
  })
})
