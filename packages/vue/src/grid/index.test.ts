import { defineComponent, h, nextTick, type PropType } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import {
  GRID_SELECTION_CHANGE_EVENT,
  GRID_SORTING_CHANGE_EVENT,
  type GridCore,
  type SortState,
} from '@iris-ui-kit/core/grid'
import { useGridCore, useGridSelection, useGridSorting } from './index'

describe('Vue Grid Core bridge', () => {
  it('preserves initial controlled selection and single-sort baselines across a no-op handoff detour', async () => {
    const selectionA = ['a']
    const selectionB = ['b']
    const sortA: SortState = { key: 'name', direction: 'asc' }
    const sortB: SortState = { key: 'age', direction: 'desc' }
    const onChange = vi.fn()
    const onSortChange = vi.fn()
    const selectionEvent = vi.fn()
    const sortingEvent = vi.fn()
    let selection!: ReturnType<typeof useGridSelection>
    let sorting!: ReturnType<typeof useGridSorting>
    let core!: GridCore
    const Harness = defineComponent({
      props: {
        value: Array as PropType<string[]>,
        sort: Object as PropType<SortState>,
        onChange: Function as PropType<(keys: string[]) => void>,
        onSortChange: Function as PropType<(sort: SortState | null) => void>,
      },
      setup(props) {
        core = useGridCore()
        selection = useGridSelection(core, props)
        sorting = useGridSorting(core, props)
        core.on(GRID_SELECTION_CHANGE_EVENT, selectionEvent)
        core.on(GRID_SORTING_CHANGE_EVENT, sortingEvent)
        return () => h('div')
      },
    })

    const wrapper = mount(Harness, {
      props: { value: selectionA, sort: sortA, onChange, onSortChange },
    })
    expect(selection.selection.value).toEqual(selectionA)
    expect(selection.model.get()).toEqual(selectionA)
    expect(sorting.sort.value).toEqual(sortA)
    expect(sorting.model.get().sort).toEqual(sortA)
    vi.clearAllMocks()

    await wrapper.setProps({ value: undefined, sort: undefined })
    await nextTick()
    expect(selection.selection.value).toEqual(selectionA)
    expect(selection.model.get()).toEqual(selectionA)
    expect(sorting.sort.value).toEqual(sortA)
    expect(sorting.model.get().sort).toEqual(sortA)

    await wrapper.setProps({ value: selectionB, sort: sortB })
    await nextTick()
    expect(selection.selection.value).toEqual(selectionB)
    expect(selection.model.get()).toEqual(selectionB)
    expect(sorting.sort.value).toEqual(sortB)
    expect(sorting.model.get().sort).toEqual(sortB)

    await wrapper.setProps({ value: undefined, sort: undefined })
    await nextTick()
    expect(selection.selection.value).toEqual(selectionA)
    expect(selection.model.get()).toEqual(selectionA)
    expect(sorting.sort.value).toEqual(sortA)
    expect(sorting.model.get().sort).toEqual(sortA)
    expect(onChange).not.toHaveBeenCalled()
    expect(onSortChange).not.toHaveBeenCalled()
    expect(selectionEvent).not.toHaveBeenCalled()
    expect(sortingEvent).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
