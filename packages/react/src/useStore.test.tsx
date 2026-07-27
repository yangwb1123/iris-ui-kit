import { afterEach, describe, expect, it } from 'vitest'
import * as React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { createStore } from '@iris-ui-kit/core'
import { useStoreSelector } from './useStore'

afterEach(() => cleanup())

describe('useStoreSelector', () => {
  it('re-renders only when the selected slice changes', () => {
    const store = createStore({ a: 0, b: 0 })
    let renders = 0
    function Probe() {
      const a = useStoreSelector(store, (s) => s.a)
      renders += 1
      return <div data-testid="a">{a}</div>
    }
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('a').textContent).toBe('0')
    const afterMount = renders

    // Change an unrelated slice → no re-render.
    act(() => store.setState((s) => ({ ...s, b: 1 })))
    expect(renders).toBe(afterMount)

    // Change the selected slice → exactly one re-render.
    act(() => store.setState((s) => ({ ...s, a: 5 })))
    expect(renders).toBe(afterMount + 1)
    expect(getByTestId('a').textContent).toBe('5')
  })

  it('supports a custom equality (shallow array)', () => {
    const store = createStore({ ids: [1, 2] as number[] })
    const shallow = (x: number[], y: number[]) =>
      x.length === y.length && x.every((v, i) => v === y[i])
    let renders = 0
    function Probe() {
      const ids = useStoreSelector(store, (s) => s.ids, shallow)
      renders += 1
      return <div data-testid="n">{ids.length}</div>
    }
    render(<Probe />)
    const afterMount = renders
    act(() => store.setState((s) => ({ ...s, ids: [1, 2] }))) // equal contents → no render
    expect(renders).toBe(afterMount)
    act(() => store.setState((s) => ({ ...s, ids: [1, 2, 3] })))
    expect(renders).toBe(afterMount + 1)
  })
})
