import { afterEach, describe, expect, it } from 'vitest'
import * as React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { useGroupedView } from './useGroupedView'
import { useStore } from '../useStore'

afterEach(() => cleanup())

interface Item {
  category: string
  value: number
}

const data: Item[] = [
  { category: 'fruit', value: 10 },
  { category: 'fruit', value: 15 },
  { category: 'veg', value: 5 },
]

describe('useGroupedView (react)', () => {
  it('bridges the composed expansion model store like IrisTable (useStore(expansion.store))', () => {
    let gv!: ReturnType<typeof useGroupedView<Item>>
    let expandedKeys: string[] = []
    function Probe() {
      gv = useGroupedView<Item>({ keyOf: (r) => r.category })
      // Mirrors Table.tsx: `const expandedKeys = useStore(expansion.store)`.
      expandedKeys = useStore(gv.expansion.store)
      return <div data-testid="count">{expandedKeys.length}</div>
    }
    const { getByTestId } = render(<Probe />)
    act(() => gv.setRows(data))
    expect(getByTestId('count').textContent).toBe('0')

    act(() => gv.expandGroup('fruit'))
    expect(expandedKeys).toEqual(['fruit'])
    expect(getByTestId('count').textContent).toBe('1')
    expect(gv.state.expanded.has('fruit')).toBe(true)

    // Direct model call (additive API) stays in sync with the view state.
    act(() => gv.expansion.toggle('veg'))
    expect(expandedKeys).toEqual(['fruit', 'veg'])
    expect(gv.state.expanded.has('veg')).toBe(true)
  })
})
