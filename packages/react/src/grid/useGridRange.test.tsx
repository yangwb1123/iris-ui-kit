import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { GridCore, GridRangeChange, GridRangeModel } from '@iris-ui-kit/core/grid'
import { useGridCore } from './useGridCore'
import { useGridRange, type UseGridRangeResult } from './useGridRange'

afterEach(cleanup)

type Row = { id: number }

describe('useGridRange', () => {
  it('shares the feature-owned model and reacts to imperative range changes', () => {
    let core: GridCore<Row> | undefined
    let model: GridRangeModel | undefined
    const onChange = vi.fn<(change: GridRangeChange) => void>()

    function Harness(): React.ReactElement {
      core = useGridCore<Row>()
      const range = useGridRange(core, { onChange })
      model = range.model
      return <span>{JSON.stringify(range.range)}</span>
    }

    render(<Harness />)
    expect(core?.hasFeature('range')).toBe(true)
    expect(core?.invoke('getRangeModel')).toBe(model)
    expect(screen.getByText('null')).toBeTruthy()

    act(() => {
      core?.invoke('startCellRange', 3, 2)
      core?.invoke('extendCellRange', 1, 0)
    })

    expect(screen.getByText('{"start":{"row":1,"col":0},"end":{"row":3,"col":2}}')).toBeTruthy()
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('isolates mutable bridge snapshots from the model and later range events', () => {
    let core: GridCore<Row> | undefined
    let latest: UseGridRangeResult<Row> | undefined
    const onChange = vi.fn<(change: GridRangeChange) => void>()

    function Harness(): React.ReactElement {
      core = useGridCore<Row>()
      const selection = useGridRange(core, { onChange })
      latest = selection
      return <span>{JSON.stringify({ state: selection.state, range: selection.range })}</span>
    }

    render(<Harness />)
    act(() => {
      core?.invoke('startCellRange', 3, 2)
      core?.invoke('extendCellRange', 1, 0)
    })

    const exposed = latest!.state
    exposed.anchor!.row = 99
    exposed.active!.col = 99

    expect(latest!.model.getState()).toEqual({
      anchor: { row: 3, col: 2 },
      active: { row: 1, col: 0 },
    })
    expect(latest!.model.getRange()).toEqual({
      start: { row: 1, col: 0 },
      end: { row: 3, col: 2 },
    })
    expect(onChange).toHaveBeenCalledTimes(2)

    act(() => core?.invoke('extendCellRange', 4, 4))
    expect(latest!.state).toEqual({
      anchor: { row: 3, col: 2 },
      active: { row: 4, col: 4 },
    })
    expect(latest!.range).toEqual({
      start: { row: 3, col: 2 },
      end: { row: 4, col: 4 },
    })
    expect(onChange).toHaveBeenLastCalledWith({
      state: { anchor: { row: 3, col: 2 }, active: { row: 4, col: 4 } },
      range: { start: { row: 3, col: 2 }, end: { row: 4, col: 4 } },
    })

    act(() => core?.invoke('clearCellRange'))
    expect(latest!.state).toEqual({ anchor: null, active: null })
    expect(latest!.range).toBeNull()
  })

  it('keeps React snapshots stable across rerenders and server renders', () => {
    let latest: UseGridRangeResult<Row> | undefined
    let renders = 0

    function Harness({ label }: { label: string }): React.ReactElement {
      renders++
      const core = useGridCore<Row>()
      latest = useGridRange(core)
      return <span>{label}</span>
    }

    const rendered = render(<Harness label="first" />)
    const initialState = latest!.state
    const beforeUpdate = renders
    rendered.rerender(<Harness label="second" />)
    expect(latest!.state).toBe(initialState)

    // A real update produces one finite reactive pass rather than a snapshot
    // identity loop in useSyncExternalStore.
    act(() => latest!.model.startRange(3, 2))
    expect(renders).toBeGreaterThan(beforeUpdate)
    expect(renders).toBeLessThan(beforeUpdate + 4)

    function ServerHarness(): React.ReactElement {
      const core = useGridCore<Row>()
      const selection = useGridRange(core)
      return <span>{JSON.stringify(selection.state)}</span>
    }

    const firstServerRender = renderToStaticMarkup(<ServerHarness />)
    expect(() => renderToStaticMarkup(<ServerHarness />)).not.toThrow()
    expect(renderToStaticMarkup(<ServerHarness />)).toBe(firstServerRender)
    rendered.unmount()
  })

  it('reads the latest callback without replacing the model', () => {
    let core: GridCore<Row> | undefined
    let model: GridRangeModel | undefined
    const first = vi.fn()
    const second = vi.fn()

    function Harness({ onChange }: { onChange: (change: GridRangeChange) => void }): null {
      core = useGridCore<Row>()
      model = useGridRange(core, { onChange }).model
      return null
    }

    const rendered = render(<Harness onChange={first} />)
    const original = model
    rendered.rerender(<Harness onChange={second} />)
    act(() => core?.invoke('startCellRange', 0, 0))

    expect(model).toBe(original)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })
})
