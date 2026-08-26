import * as React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import type { GridCore, GridVirtualModel } from '@iris-ui-kit/core/grid'
import { IrisVirtualScroll } from '../primitives/virtual-scroll/VirtualScroll'
import { useGridCore } from './useGridCore'
import { useGridVirtual } from './useGridVirtual'

afterEach(cleanup)

interface Row {
  id: number
}

describe('useGridVirtual', () => {
  it('shares one feature-owned controller with the viewport bridge', () => {
    let core: GridCore<Row> | undefined
    let model: GridVirtualModel | undefined
    const items = Array.from({ length: 50 }, (_, id) => ({ id }))

    function Harness(): React.ReactElement {
      core = useGridCore<Row>()
      model = useGridVirtual(core, {
        items,
        estimateSize: 20,
        viewportSize: 100,
        buffer: 1,
        getItemKey: (item) => item.id,
      }).model
      return (
        <IrisVirtualScroll
          items={items}
          itemHeight={20}
          height={100}
          buffer={1}
          keyOf={(item) => item.id}
          virtualizer={model}
          renderItem={(item) => <span>{item.id}</span>}
        />
      )
    }

    render(<Harness />)

    expect(core?.hasFeature('virtual')).toBe(true)
    expect(core?.invoke('getVirtualModel')).toBe(model)
    expect(document.querySelectorAll('[data-iris-virtual-item]').length).toBeLessThan(50)

    act(() => {
      core?.invoke('setVirtualScroll', 400)
    })
    expect(model?.getState().startIndex).toBe(19)
    expect(document.querySelector('[data-iris-virtual-index="20"]')).not.toBeNull()
  })

  it('re-seats the controller when the item list changes', () => {
    let model: GridVirtualModel | undefined

    function Harness({ items }: { items: Row[] }): null {
      const core = useGridCore<Row>()
      model = useGridVirtual(core, {
        items,
        estimateSize: 10,
        viewportSize: 20,
        getItemKey: (item) => item.id,
      }).model
      return null
    }

    const { rerender } = render(<Harness items={[{ id: 1 }, { id: 2 }, { id: 3 }]} />)
    expect(model?.totalSize()).toBe(30)
    rerender(<Harness items={[{ id: 2 }, { id: 1 }]} />)
    expect(model?.totalSize()).toBe(20)
  })
})
