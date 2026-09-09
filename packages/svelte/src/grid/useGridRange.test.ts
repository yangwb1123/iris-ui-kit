import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { get } from 'svelte/store'
import { describe, expect, it, vi } from 'vitest'
import type { GridCore, GridRangeChange, GridRangeModel } from '@iris-ui-kit/core/grid'
import type { UseGridRangeResult } from './useGridRange'
import GridRangeHarness from './GridRangeHarness.svelte'

type Row = { id: number }

describe('useGridRange', () => {
  it('shares the feature-owned model and reacts through Svelte stores', async () => {
    let core: GridCore<Row> | undefined
    let model: GridRangeModel | undefined
    const onChange = vi.fn<(change: GridRangeChange) => void>()
    const view = render(GridRangeHarness, {
      capture: (nextCore, nextModel) => {
        core = nextCore
        model = nextModel
      },
      onChange,
    })
    const button = view.getByRole('button')

    expect(core?.hasFeature('range')).toBe(true)
    expect(core?.invoke('getRangeModel')).toBe(model)
    expect(button.dataset.shared).toBe('true')
    expect(button.textContent?.trim()).toBe('null')

    await button.click()

    expect(button.textContent).toContain('{"start":{"row":1,"col":0},"end":{"row":3,"col":2}}')
    expect(onChange).toHaveBeenCalledTimes(2)

    view.unmount()
    model?.extendRange(4, 4)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('isolates mutable bridge snapshots from the model and later range events', async () => {
    let core!: GridCore<Row>
    let model!: GridRangeModel
    let selection!: UseGridRangeResult
    const onChange = vi.fn<(change: GridRangeChange) => void>()
    const view = render(GridRangeHarness, {
      capture: (nextCore, nextModel, nextSelection) => {
        core = nextCore
        model = nextModel
        selection = nextSelection
      },
      onChange,
    })

    model.startRange(3, 2)
    model.extendRange(1, 0)
    await tick()

    const exposed = get(selection.state)
    exposed.anchor!.row = 99
    exposed.active!.col = 99

    expect(model.getState()).toEqual({
      anchor: { row: 3, col: 2 },
      active: { row: 1, col: 0 },
    })
    expect(model.getRange()).toEqual({
      start: { row: 1, col: 0 },
      end: { row: 3, col: 2 },
    })
    expect(onChange).toHaveBeenCalledTimes(2)

    core.invoke('extendCellRange', 4, 4)
    await tick()
    expect(get(selection.state)).toEqual({
      anchor: { row: 3, col: 2 },
      active: { row: 4, col: 4 },
    })
    expect(get(selection.range)).toEqual({
      start: { row: 3, col: 2 },
      end: { row: 4, col: 4 },
    })
    expect(onChange).toHaveBeenLastCalledWith({
      state: { anchor: { row: 3, col: 2 }, active: { row: 4, col: 4 } },
      range: { start: { row: 3, col: 2 }, end: { row: 4, col: 4 } },
    })

    model.clearRange()
    await tick()
    expect(get(selection.state)).toEqual({ anchor: null, active: null })
    expect(get(selection.range)).toBeNull()
    view.unmount()
  })
})
