import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import {
  GRID_VIRTUAL_RANGE_CHANGE_EVENT,
  type GridCore,
  type GridVirtualModel,
  type GridVirtualRangeChange,
} from '@iris-ui-kit/core/grid'
import { IrisVirtualScroll } from '../primitives/virtual-scroll/VirtualScroll'
import { useGridCore } from './useGridCore'
import { useGridVirtual } from './useGridVirtual'
import { useStore } from '../useStore'

afterEach(cleanup)

interface Row {
  id: number
}

describe('useGridVirtual', () => {
  it('commits numeric estimate changes as one final virtual window', () => {
    type RangeCallback = (change: GridVirtualRangeChange) => void
    const items = Array.from({ length: 100 }, (_, id) => ({ id }))
    const rangeChanges = vi.fn<RangeCallback>()
    const eventChanges: GridVirtualRangeChange[] = []
    let core!: GridCore<Row>
    let model!: GridVirtualModel

    function Harness({ estimateSize }: { estimateSize: number }): React.ReactElement {
      core = useGridCore<Row>()
      model = useGridVirtual(core, {
        items,
        estimateSize,
        viewportSize: 100,
        buffer: 0,
        onRangeChange: rangeChanges,
      }).model
      const state = useStore(model)
      return (
        <div data-testid="virtual-items">
          {state.items.map((item) => (
            <span data-index={item.index} key={item.index}>
              {item.index}
            </span>
          ))}
        </div>
      )
    }

    const view = render(<Harness estimateSize={20} />)
    const initialModel = model
    core.on<GridVirtualRangeChange>(GRID_VIRTUAL_RANGE_CHANGE_EVENT, (change) =>
      eventChanges.push(change),
    )

    act(() => {
      view.rerender(<Harness estimateSize={30} />)
    })

    expect(model).toBe(initialModel)
    expect(rangeChanges).toHaveBeenCalledTimes(1)
    expect(rangeChanges).toHaveBeenCalledWith({ start: 0, end: 4, totalSize: 3000 })
    expect(eventChanges).toEqual([{ start: 0, end: 4, totalSize: 3000 }])
    expect(initialModel.getState()).toMatchObject({
      startIndex: 0,
      endIndex: 3,
      totalSize: 3000,
    })
    expect(initialModel.getState().items.map((item) => item.index)).toEqual([0, 1, 2, 3])
    expect(
      rangeChanges.mock.calls.some(([change]) => change.end === 5 && change.totalSize === 3000),
    ).toBe(false)
    expect(
      [...view.getByTestId('virtual-items').querySelectorAll('[data-index]')].map((element) =>
        Number(element.getAttribute('data-index')),
      ),
    ).toEqual([0, 1, 2, 3])
  })

  it('initializes with normal state when the global process is absent', async () => {
    const processDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process')
    const items = Array.from({ length: 6 }, (_, id) => ({ id }))
    let core: GridCore<Row> | undefined
    let model: GridVirtualModel | undefined
    let view: ReturnType<typeof render> | undefined

    function Harness(): React.ReactElement {
      core = useGridCore<Row>()
      model = useGridVirtual(core, {
        items,
        estimateSize: 20,
        viewportSize: 40,
      }).model
      return <div data-testid="virtual-grid" />
    }

    try {
      expect(Reflect.deleteProperty(globalThis, 'process')).toBe(true)
      expect(() => {
        view = render(<Harness />)
      }).not.toThrow()

      expect(core?.hasFeature('virtual')).toBe(true)
      expect(core?.invoke('getVirtualModel')).toBe(model)
      const state = model!.getState()
      expect(state).toMatchObject({ totalSize: 120, startIndex: 0, endIndex: 1 })
      expect(Number.isFinite(state.totalSize)).toBe(true)
      expect(Number.isFinite(state.startIndex)).toBe(true)
      expect(Number.isFinite(state.endIndex)).toBe(true)
    } finally {
      try {
        if (processDescriptor) {
          Object.defineProperty(globalThis, 'process', processDescriptor)
        } else {
          Reflect.deleteProperty(globalThis, 'process')
        }
      } finally {
        view?.unmount()
      }
    }
    await act(async () => Promise.resolve())
    expect(core?.status).toBe('destroyed')
  })

  it('uses measured offsets for numeric estimate virtualization', () => {
    const items = Array.from({ length: 4 }, (_, id) => ({ id }))
    let model: GridVirtualModel | undefined

    function Harness(): React.ReactElement {
      const core = useGridCore<Row>()
      model = useGridVirtual(core, {
        items,
        estimateSize: 20,
        viewportSize: 30,
        buffer: 0,
        getItemKey: (item) => item.id,
      }).model
      return <div data-testid="virtual-grid" />
    }

    render(<Harness />)

    act(() => {
      model!.measure(0, 40)
    })
    act(() => {
      model!.setScroll(20)
    })
    expect(model!.getState().items.map((item) => item.index)).toEqual(
      expect.arrayContaining([0, 1]),
    )
    expect(model!.getState().items.find((item) => item.index === 0)).toMatchObject({
      start: 0,
      size: 40,
    })

    act(() => {
      model!.setScroll(40)
    })
    expect(model!.getState().items.map((item) => item.index)).toEqual(
      expect.arrayContaining([1, 2]),
    )
  })

  it('updates estimates without dropping measured row sizes', () => {
    let model: GridVirtualModel | undefined

    function Harness({ estimateSize }: { estimateSize: number }): React.ReactElement {
      const core = useGridCore<Row>()
      model = useGridVirtual(core, {
        items: Array.from({ length: 3 }, (_, id) => ({ id })),
        estimateSize,
        viewportSize: 100,
        getItemKey: (item) => item.id,
      }).model
      return <div />
    }

    const view = render(<Harness estimateSize={20} />)
    act(() => model!.measure(0, 40))
    view.rerender(<Harness estimateSize={30} />)

    expect(model!.getState().items.map((item) => item.size)).toEqual([40, 30, 30])
    expect(model!.totalSize()).toBe(100)
    view.unmount()
  })

  it('re-seats keyed measurements when getItemKey changes at the same count', () => {
    type KeyedRow = { id: string }
    const items: KeyedRow[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const oldKey = (item: KeyedRow): string => `old-${item.id}`
    const newKey = (item: KeyedRow): string => `new-${item.id}`
    let model: GridVirtualModel | undefined

    function Harness({ getItemKey }: { getItemKey: typeof oldKey }): React.ReactElement {
      const core = useGridCore<KeyedRow>()
      model = useGridVirtual(core, {
        items,
        estimateSize: 20,
        viewportSize: 100,
        getItemKey,
      }).model
      return <div />
    }

    const view = render(<Harness getItemKey={oldKey} />)
    const initialModel = model!
    act(() => initialModel.measure(0, 50))

    expect(initialModel.getState().items).toEqual([
      { index: 0, key: 'old-a', start: 0, size: 50 },
      { index: 1, key: 'old-b', start: 50, size: 20 },
      { index: 2, key: 'old-c', start: 70, size: 20 },
    ])
    expect(initialModel.totalSize()).toBe(90)

    act(() => {
      view.rerender(<Harness getItemKey={newKey} />)
    })

    expect(model).toBe(initialModel)
    expect(initialModel.getState().items).toEqual([
      { index: 0, key: 'new-a', start: 0, size: 20 },
      { index: 1, key: 'new-b', start: 20, size: 20 },
      { index: 2, key: 'new-c', start: 40, size: 20 },
    ])
    expect(initialModel.totalSize()).toBe(60)
    view.unmount()
  })

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

  it('syncs the virtualizer count for in-place items growth and shrink', () => {
    type KeyedRow = { id: string }
    const items: KeyedRow[] = [{ id: 'a' }]
    const keyOf = (item: KeyedRow): string => item.id
    let model: GridVirtualModel | undefined

    function Harness({ version }: { version: number }): React.ReactElement {
      const core = useGridCore<KeyedRow>()
      model = useGridVirtual(core, {
        items,
        estimateSize: 20,
        viewportSize: 40,
        buffer: 0,
        getItemKey: keyOf,
      }).model
      return <div data-testid="virtual-version">{version}</div>
    }

    const view = render(<Harness version={0} />)
    const virtualModel = model!
    expect(virtualModel.totalSize()).toBe(20)
    const setCount = vi.spyOn(virtualModel, 'setCount')

    items.push({ id: 'b' }, { id: 'c' })
    act(() => {
      view.rerender(<Harness version={1} />)
    })

    expect(model).toBe(virtualModel) // no controller recreation
    expect(setCount).toHaveBeenNthCalledWith(1, 3)
    expect(virtualModel.totalSize()).toBe(60)
    expect(virtualModel.getState().items.map((item) => item.key)).toEqual(['a', 'b'])

    act(() => {
      virtualModel.setScroll(40)
    })
    expect(virtualModel.getState().items.map((item) => item.key)).toEqual(['b', 'c'])

    items.splice(0, 2)
    act(() => {
      view.rerender(<Harness version={2} />)
    })

    expect(setCount).toHaveBeenNthCalledWith(2, 1)
    expect(virtualModel.totalSize()).toBe(20)
    expect(virtualModel.scrollToOffset(40)).toBe(0)
    expect(virtualModel.getState().startIndex).toBe(0)
    expect(virtualModel.getState().items.map((item) => item.key)).toEqual(['c'])
    view.unmount()
  })
})
