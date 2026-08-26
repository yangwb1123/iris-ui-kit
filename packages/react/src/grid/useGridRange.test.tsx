import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { GridCore, GridRangeChange, GridRangeModel } from '@iris-ui-kit/core/grid'
import { useGridCore } from './useGridCore'
import { useGridRange } from './useGridRange'

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
