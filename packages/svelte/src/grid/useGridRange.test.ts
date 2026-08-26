import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import type { GridCore, GridRangeChange, GridRangeModel } from '@iris-ui-kit/core/grid'
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
})
