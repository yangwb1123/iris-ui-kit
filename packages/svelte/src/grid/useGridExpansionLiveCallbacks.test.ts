import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import type { ExpansionModel, GridCore } from '@iris-ui-kit/core/grid'
import GridExpansionLiveCallbacksHarness from './GridExpansionLiveCallbacksHarness.svelte'

type Row = { id: string }

describe('useGridExpansion', () => {
  it('uses replacement callbacks and key providers without replacing the model', async () => {
    let core!: GridCore<Row>
    let model!: ExpansionModel<string>
    const initialOnChange = vi.fn<(keys: string[]) => void>()
    const replacementOnChange = vi.fn<(keys: string[]) => void>()
    const initialGetKeys = vi.fn(() => ['initial-provider-key'])
    const replacementGetKeys = vi.fn(() => ['replacement-provider-key'])

    const view = render(GridExpansionLiveCallbacksHarness, {
      props: {
        onChange: initialOnChange,
        getKeys: initialGetKeys,
        onReady: (nextCore: GridCore<Row>, nextModel: ExpansionModel<string>) => {
          core = nextCore
          model = nextModel
        },
      },
    })
    await tick()

    expect(model).toBeDefined()
    const initialModel = model
    expect(initialGetKeys).not.toHaveBeenCalled()

    model.toggle('first-toggle')
    expect(initialOnChange).toHaveBeenCalledTimes(1)
    expect(initialOnChange).toHaveBeenCalledWith(['first-toggle'])

    await view.rerender({
      onChange: replacementOnChange,
      getKeys: replacementGetKeys,
    })
    await tick()

    expect(model).toBe(initialModel)
    expect(initialGetKeys).not.toHaveBeenCalled()
    expect(replacementGetKeys).not.toHaveBeenCalled()

    model.toggle('second-toggle')
    expect(initialOnChange).toHaveBeenCalledTimes(1)
    expect(replacementOnChange).toHaveBeenCalledTimes(1)
    expect(replacementOnChange).toHaveBeenCalledWith(['first-toggle', 'second-toggle'])

    core.invoke('expandAllRows')
    expect(initialGetKeys).not.toHaveBeenCalled()
    expect(replacementGetKeys).toHaveBeenCalledTimes(1)
    expect(model.get()).toEqual(['first-toggle', 'second-toggle', 'replacement-provider-key'])

    await view.rerender({ onChange: undefined, getKeys: undefined })
    await tick()
    expect(() => model.toggle('without-callback')).not.toThrow()
    expect(replacementOnChange).toHaveBeenCalledTimes(2)
    expect(() => core.invoke('expandAllRows')).not.toThrow()
    expect(replacementGetKeys).toHaveBeenCalledTimes(1)

    view.unmount()
  })
})
