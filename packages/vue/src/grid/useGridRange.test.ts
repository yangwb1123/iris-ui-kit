import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { GridCore, GridRangeChange, GridRangeModel } from '@iris-ui-kit/core/grid'
import { useGridCore } from './index'
import { useGridRange } from './useGridRange'

type Row = { id: number }

describe('useGridRange', () => {
  it('shares the feature-owned model and reacts to imperative range changes', async () => {
    let core: GridCore<Row> | undefined
    let model: GridRangeModel | undefined
    const onChange = vi.fn<(change: GridRangeChange) => void>()
    const Harness = defineComponent({
      setup() {
        core = useGridCore<Row>()
        const range = useGridRange(core, { onChange })
        model = range.model
        return () => h('span', JSON.stringify(range.range.value))
      },
    })

    const wrapper = mount(Harness)
    expect(core?.hasFeature('range')).toBe(true)
    expect(core?.invoke('getRangeModel')).toBe(model)
    expect(wrapper.text()).toBe('null')

    core?.invoke('startCellRange', 3, 2)
    core?.invoke('extendCellRange', 1, 0)
    await nextTick()

    expect(wrapper.text()).toBe('{"start":{"row":1,"col":0},"end":{"row":3,"col":2}}')
    expect(onChange).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('stops feature callbacks after the Grid Core is destroyed', () => {
    let model: GridRangeModel | undefined
    const onChange = vi.fn()
    const Harness = defineComponent({
      setup() {
        const core = useGridCore<Row>()
        model = useGridRange(core, { onChange }).model
        return () => null
      },
    })

    const wrapper = mount(Harness)
    model?.startRange(0, 0)
    expect(onChange).toHaveBeenCalledOnce()
    wrapper.unmount()
    model?.extendRange(1, 1)
    expect(onChange).toHaveBeenCalledOnce()
  })
})
