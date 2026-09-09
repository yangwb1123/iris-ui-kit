import { cleanup, renderHook } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GridCore, GridRangeChange, GridRangeModel } from '@iris-ui-kit/core/grid'
import { useGridCore } from './index'
import { useGridRange } from './useGridRange'

afterEach(cleanup)

type Row = { id: number }

describe('useGridRange', () => {
  it('shares the feature-owned model and reacts to imperative range changes', () => {
    const onChange = vi.fn<(change: GridRangeChange) => void>()
    const { result } = renderHook(() => {
      const core = useGridCore<Row>()
      return { core, range: useGridRange(core, { onChange }) }
    })

    expect(result.core.hasFeature('range')).toBe(true)
    expect(result.core.invoke('getRangeModel')).toBe(result.range.model)
    expect(result.range.range()).toBeNull()

    result.core.invoke('startCellRange', 3, 2)
    result.core.invoke('extendCellRange', 1, 0)

    expect(result.range.range()).toEqual({
      start: { row: 1, col: 0 },
      end: { row: 3, col: 2 },
    })
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('isolates mutable bridge snapshots from the model and later range events', () => {
    const onChange = vi.fn<(change: GridRangeChange) => void>()
    const { result } = renderHook(() => {
      const core = useGridCore<Row>()
      return { core, range: useGridRange(core, { onChange }) }
    })

    result.core.invoke('startCellRange', 3, 2)
    result.core.invoke('extendCellRange', 1, 0)
    const exposed = result.range.state()
    exposed.anchor!.row = 99
    exposed.active!.col = 99

    expect(result.range.model.getState()).toEqual({
      anchor: { row: 3, col: 2 },
      active: { row: 1, col: 0 },
    })
    expect(result.range.model.getRange()).toEqual({
      start: { row: 1, col: 0 },
      end: { row: 3, col: 2 },
    })
    expect(onChange).toHaveBeenCalledTimes(2)

    result.range.model.extendRange(4, 4)
    expect(result.range.state()).toEqual({
      anchor: { row: 3, col: 2 },
      active: { row: 4, col: 4 },
    })
    expect(result.range.range()).toEqual({
      start: { row: 3, col: 2 },
      end: { row: 4, col: 4 },
    })
    expect(onChange).toHaveBeenLastCalledWith({
      state: { anchor: { row: 3, col: 2 }, active: { row: 4, col: 4 } },
      range: { start: { row: 3, col: 2 }, end: { row: 4, col: 4 } },
    })

    result.range.model.clearRange()
    expect(result.range.state()).toEqual({ anchor: null, active: null })
    expect(result.range.range()).toBeNull()
  })

  it('stops feature callbacks after the Grid Core is destroyed', () => {
    let core: GridCore<Row> | undefined
    let model: GridRangeModel | undefined
    const onChange = vi.fn()
    renderHook(() => {
      core = useGridCore<Row>()
      model = useGridRange(core, { onChange }).model
    })

    model?.startRange(0, 0)
    expect(onChange).toHaveBeenCalledOnce()
    core?.destroy()
    model?.extendRange(1, 1)
    expect(onChange).toHaveBeenCalledOnce()
  })
})
