import { cleanup, render, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  GRID_VIRTUAL_RANGE_CHANGE_EVENT,
  type GridCore,
  type GridVirtualRangeChange,
} from '@iris-ui-kit/core/grid'
import { useGridCore, useGridVirtual } from './index'

afterEach(cleanup)

describe('Solid Grid Core bridge', () => {
  it('commits numeric estimate changes as one final virtual window', async () => {
    type Item = { id: number }
    type RangeCallback = (change: GridVirtualRangeChange) => void
    type Props = {
      items: readonly Item[]
      estimateSize: number
      viewportSize: number
      buffer: number
      onRangeChange: RangeCallback
    }
    const items = Array.from({ length: 100 }, (_, id) => ({ id }))
    const rangeChanges = vi.fn<RangeCallback>()
    const eventChanges: GridVirtualRangeChange[] = []
    let core!: GridCore<Item>
    let virtual!: ReturnType<typeof useGridVirtual>
    let setEstimate!: (estimate: number) => void

    const Harness = (props: Props) => {
      core = useGridCore<Item>()
      virtual = useGridVirtual(core, props)
      return (
        <div data-testid="virtual-items">
          {virtual.state().items.map((item) => (
            <span data-index={item.index}>{item.index}</span>
          ))}
        </div>
      )
    }
    const Parent = () => {
      const [estimateSize, updateEstimate] = createSignal(20)
      setEstimate = updateEstimate
      return (
        <Harness
          items={items}
          estimateSize={estimateSize()}
          viewportSize={100}
          buffer={0}
          onRangeChange={rangeChanges}
        />
      )
    }

    const view = render(() => <Parent />)
    const initialModel = virtual.model
    core.on<GridVirtualRangeChange>(GRID_VIRTUAL_RANGE_CHANGE_EVENT, (change) =>
      eventChanges.push(change),
    )

    setEstimate(30)
    await waitFor(() =>
      expect(virtual.state().items.map((item) => item.index)).toEqual([0, 1, 2, 3]),
    )

    expect(virtual.model).toBe(initialModel)
    expect(rangeChanges).toHaveBeenCalledTimes(1)
    expect(rangeChanges).toHaveBeenCalledWith({ start: 0, end: 4, totalSize: 3000 })
    expect(eventChanges).toEqual([{ start: 0, end: 4, totalSize: 3000 }])
    expect(initialModel.getState()).toMatchObject({
      startIndex: 0,
      endIndex: 3,
      totalSize: 3000,
    })
    expect(
      rangeChanges.mock.calls.some(([change]) => change.end === 5 && change.totalSize === 3000),
    ).toBe(false)
    expect(
      [...view.getByTestId('virtual-items').querySelectorAll('[data-index]')].map((element) =>
        Number(element.getAttribute('data-index')),
      ),
    ).toEqual([0, 1, 2, 3])
    view.unmount()
  })
})
