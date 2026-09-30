import { fireEvent, render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { get } from 'svelte/store'
import {
  GRID_COLUMNS_CHANGE_EVENT,
  type GridColumnsChange,
  type GridCore,
} from '@iris-ui-kit/core/grid'
import GridColumnsBridgeHarness from './GridColumnsBridgeHarness.svelte'
import GridColumnsControlledBatchHandoffHarness from './GridColumnsControlledBatchHandoffHarness.svelte'
import { useGridColumns } from './useGrid'

describe('Svelte Grid columns state', () => {
  it('restores the uncontrolled visibility snapshot across rejected control handoff', async () => {
    const view = render(GridColumnsBridgeHarness, {
      props: { visibility: { hidden: false }, defaultVisibility: { hidden: false } },
    })
    const readVisibility = (): boolean | undefined =>
      JSON.parse(view.getByTestId('column-state').textContent ?? '{}').visibility?.hidden

    expect(readVisibility()).toBe(false)
    await fireEvent.click(view.getByTestId('toggle-visibility'))
    expect(readVisibility()).toBe(false)

    await view.rerender({ visibility: undefined })
    expect(readVisibility()).toBe(false)

    await view.rerender({ visibility: { hidden: true } })
    expect(readVisibility()).toBe(true)
    await view.rerender({ visibility: undefined })
    expect(readVisibility()).toBe(false)
    view.unmount()
  })

  it('isolates all column snapshots and restores each uncontrolled channel after handoff', async () => {
    let columns!: ReturnType<typeof useGridColumns>
    const controlled = {
      visibility: { hidden: false },
      order: ['name'],
      widths: { name: 310 },
      pinned: { name: 'right' as const },
    }
    const view = render(GridColumnsBridgeHarness, {
      props: {
        defaultVisibility: { hidden: false },
        defaultOrder: ['name', 'age'],
        defaultWidths: { name: 100 },
        defaultPinned: { name: 'left' },
        onColumns: (value) => (columns = value),
      },
    })

    await fireEvent.click(view.getByTestId('edit-columns'))
    expect(columns.model.get()).toMatchObject({
      visibility: { hidden: true },
      order: ['age', 'name'],
      widths: { name: 116 },
      pinned: { name: null },
    })

    await view.rerender(controlled)
    expect(columns.model.get()).toMatchObject(controlled)
    const snapshot = get(columns.state)
    snapshot.visibility.hidden = true
    snapshot.order.push('mutated')
    snapshot.widths.name = 999
    snapshot.pinned.name = 'left'
    expect(columns.model.get()).toMatchObject(controlled)

    controlled.visibility.hidden = true
    controlled.order.push('mutated-input')
    controlled.widths.name = 998
    controlled.pinned.name = 'left'
    expect(columns.model.get()).toMatchObject({
      visibility: { hidden: false },
      order: ['name'],
      widths: { name: 310 },
      pinned: { name: 'right' },
    })

    await view.rerender({
      visibility: undefined,
      order: undefined,
      widths: undefined,
      pinned: undefined,
    })
    expect(columns.model.get()).toMatchObject({
      visibility: { hidden: true },
      order: ['age', 'name'],
      widths: { name: 116 },
      pinned: { name: null },
    })
    view.unmount()
  })

  it('rebases controlled column proposals without losing uncontrolled snapshots', async () => {
    let core!: GridCore<{ id: string }>
    let columns!: ReturnType<typeof useGridColumns>
    const onOrderChange = vi.fn()
    const onWidthsChange = vi.fn()
    const onPinnedChange = vi.fn()
    const events: GridColumnsChange[] = []
    const view = render(GridColumnsBridgeHarness, {
      props: {
        defaultOrder: ['name', 'age'],
        defaultWidths: { name: 100, age: 200 },
        defaultPinned: { name: 'left', age: 'right' },
        onCore: (value) => (core = value),
        onColumns: (value) => (columns = value),
        onOrderChange,
        onWidthsChange,
        onPinnedChange,
      },
    })
    await tick()

    core.on<GridColumnsChange>(GRID_COLUMNS_CHANGE_EVENT, (event) => events.push(event))
    columns.setOrder(['age', 'name'])
    columns.setWidths({ name: 116, age: 216 })
    columns.setPinned('name', null)
    await tick()
    expect(columns.model.get()).toEqual({
      visibility: {},
      order: ['age', 'name'],
      widths: { name: 116, age: 216 },
      pinned: { name: null, age: 'right' },
    })

    onOrderChange.mockClear()
    onWidthsChange.mockClear()
    onPinnedChange.mockClear()
    events.length = 0

    const controlledOrder = ['name']
    const controlledWidths = { name: 310, age: 260 }
    const controlledPinned: Record<string, 'left' | 'right' | null> = {
      name: 'right',
      age: 'left',
    }
    await view.rerender({
      order: controlledOrder,
      widths: controlledWidths,
      pinned: controlledPinned,
    })
    await tick()

    const expectControlledState = (): void => {
      expect(get(columns.state).order).toEqual(['name'])
      expect(get(columns.state).widths).toEqual({ name: 310, age: 260 })
      expect(get(columns.state).pinned).toEqual({ name: 'right', age: 'left' })
      expect(columns.model.get().order).toEqual(['name'])
      expect(columns.model.get().widths).toEqual({ name: 310, age: 260 })
      expect(columns.model.get().pinned).toEqual({ name: 'right', age: 'left' })
    }
    expectControlledState()

    const expectAfter = async (write: () => void): Promise<void> => {
      write()
      expectControlledState()
      await tick()
      expectControlledState()
    }

    await expectAfter(() => columns.setOrder(['age', 'name']))
    await expectAfter(() => columns.setWidths({ name: 120 }))
    await expectAfter(() => columns.setWidth('age', 140))
    await expectAfter(() => columns.resetWidths())
    await expectAfter(() => columns.setPinned('name', null))
    await expectAfter(() => columns.clearOrder())

    expect(controlledOrder).toEqual(['name'])
    expect(controlledWidths).toEqual({ name: 310, age: 260 })
    expect(controlledPinned).toEqual({ name: 'right', age: 'left' })
    expect(onOrderChange.mock.calls).toEqual([[['age', 'name']], [undefined]])
    expect(onWidthsChange.mock.calls).toEqual([[{ name: 120 }], [{ name: 310, age: 140 }], [{}]])
    expect(onPinnedChange).toHaveBeenCalledTimes(1)
    expect(onPinnedChange).toHaveBeenCalledWith('name', null)
    expect(events).toEqual([
      { channel: 'order', order: ['age', 'name'] },
      { channel: 'widths', widths: { name: 120 } },
      { channel: 'widths', widths: { name: 310, age: 140 } },
      { channel: 'widths', widths: {} },
      {
        channel: 'pinned',
        key: 'name',
        side: null,
        pinned: { name: null, age: 'left' },
      },
      { channel: 'order', order: undefined },
    ])

    const callbackCounts = [
      onOrderChange.mock.calls.length,
      onWidthsChange.mock.calls.length,
      onPinnedChange.mock.calls.length,
      events.length,
    ]
    await view.rerender({ order: undefined, widths: undefined, pinned: undefined })
    await tick()

    expect(get(columns.state).order).toEqual(['age', 'name'])
    expect(get(columns.state).widths).toEqual({ name: 116, age: 216 })
    expect(get(columns.state).pinned).toEqual({ name: null, age: 'right' })
    expect(columns.model.get().order).toEqual(['age', 'name'])
    expect(columns.model.get().widths).toEqual({ name: 116, age: 216 })
    expect(columns.model.get().pinned).toEqual({ name: null, age: 'right' })
    expect([
      onOrderChange.mock.calls.length,
      onWidthsChange.mock.calls.length,
      onPinnedChange.mock.calls.length,
      events.length,
    ]).toEqual(callbackCounts)
    view.unmount()
  })

  it('captures a batched uncontrolled visibility write when control enters inside the same core batch', async () => {
    let columns!: ReturnType<typeof useGridColumns>
    const view = render(GridColumnsControlledBatchHandoffHarness, {
      props: { onColumns: (value) => (columns = value) },
    })
    await tick()

    expect(columns.model.get().visibility).toEqual({ hidden: false })
    expect(get(columns.state).visibility).toEqual({ hidden: false })

    await fireEvent.click(view.getByTestId('handoff-visibility'))
    await tick()
    expect(columns.model.get().visibility).toEqual({ hidden: false })
    expect(get(columns.state).visibility).toEqual({ hidden: false })

    await fireEvent.click(view.getByTestId('release-visibility'))
    await tick()
    expect(columns.model.get().visibility).toEqual({ hidden: true })
    expect(get(columns.state).visibility).toEqual({ hidden: true })
    view.unmount()
  })

  it('captures batched uncontrolled writes on all four column channels when control enters inside the same core batch', async () => {
    let columns!: ReturnType<typeof useGridColumns>
    const view = render(GridColumnsControlledBatchHandoffHarness, {
      props: { onColumns: (value) => (columns = value) },
    })
    await tick()

    await fireEvent.click(view.getByTestId('handoff-all'))
    await tick()
    expect(columns.model.get()).toEqual({
      visibility: { hidden: false },
      order: ['name'],
      widths: { name: 310, age: 260 },
      pinned: { name: 'right', age: 'left' },
    })
    expect(get(columns.state)).toEqual({
      visibility: { hidden: false },
      order: ['name'],
      widths: { name: 310, age: 260 },
      pinned: { name: 'right', age: 'left' },
    })

    await fireEvent.click(view.getByTestId('release-all'))
    await tick()
    expect(columns.model.get()).toEqual({
      visibility: { hidden: true },
      order: ['age', 'name'],
      widths: { name: 116, age: 216 },
      pinned: { name: null, age: 'right' },
    })
    expect(get(columns.state)).toEqual({
      visibility: { hidden: true },
      order: ['age', 'name'],
      widths: { name: 116, age: 216 },
      pinned: { name: null, age: 'right' },
    })
    view.unmount()
  })
})
