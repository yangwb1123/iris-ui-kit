import { describe, expect, it, vi } from 'vitest'
import {
  createGridCore,
  createGridExpansionFeature,
  createGridSelectionFeature,
  GRID_EXPANSION_CHANGE_EVENT,
  GRID_SELECTION_CHANGE_EVENT,
  type GridExpansionChange,
  type GridExpansionMethods,
  type GridSelectionChange,
  type GridSelectionMethods,
} from './grid'

describe('createGridSelectionFeature', () => {
  it('composes selection state, methods, callback, and event as one capability', () => {
    const onChange = vi.fn()
    const events: Array<GridSelectionChange<number>> = []
    const core = createGridCore({
      features: [
        createGridSelectionFeature<Record<string, unknown>, number>({
          defaultSelected: [1],
          getKeys: () => [1, 2, 3],
          onChange,
        }),
      ],
    })
    core.on<GridSelectionChange<number>>(GRID_SELECTION_CHANGE_EVENT, (event) => events.push(event))
    expect(core.invoke('getSelectionModel')).toBeDefined()
    const selection =
      core.getMethod<GridSelectionMethods<number>['toggleRowSelection']>('toggleRowSelection')

    selection?.(2)
    core.invoke('selectAll')

    expect(core.invoke<number[]>('getSelection')).toEqual([1, 2, 3])
    expect(core.invoke<boolean>('isRowSelected', 3)).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(events).toEqual([{ selectedKeys: [1, 2] }, { selectedKeys: [1, 2, 3] }])
  })

  it('supports controlled sync without emitting a change event', () => {
    const onChange = vi.fn()
    const core = createGridCore({
      features: [createGridSelectionFeature({ onChange })],
    })
    const event = vi.fn()
    core.on(GRID_SELECTION_CHANGE_EVENT, event)

    core.invoke('syncSelection', ['external'])

    expect(core.invoke('getSelection')).toEqual(['external'])
    expect(onChange).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
  })

  it('silences a retained selection model after core disposal', () => {
    const onChange = vi.fn()
    const core = createGridCore({ features: [createGridSelectionFeature({ onChange })] })
    const model = core.invoke<import('./selection').SelectionModel>('getSelectionModel')
    core.destroy()

    model.select('late')

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('createGridExpansionFeature', () => {
  it('composes expansion state, methods, callback, and event as one capability', () => {
    const onChange = vi.fn()
    const events: Array<GridExpansionChange<number>> = []
    const core = createGridCore({
      features: [
        createGridExpansionFeature<Record<string, unknown>, number>({
          defaultExpanded: [1],
          getKeys: () => [1, 2, 3],
          onChange,
        }),
      ],
    })
    core.on<GridExpansionChange<number>>(GRID_EXPANSION_CHANGE_EVENT, (event) => events.push(event))
    expect(core.invoke('getExpansionModel')).toBeDefined()
    const toggle =
      core.getMethod<GridExpansionMethods<number>['toggleRowExpansion']>('toggleRowExpansion')

    toggle?.(2)
    core.invoke('expandAllRows')

    expect(core.invoke<number[]>('getExpandedKeys')).toEqual([1, 2, 3])
    expect(core.invoke<boolean>('isRowExpanded', 3)).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(events).toEqual([{ expandedKeys: [1, 2] }, { expandedKeys: [1, 2, 3] }])
  })

  it('supports collapse-all and does not emit for an already empty model', () => {
    const event = vi.fn()
    const core = createGridCore({ features: [createGridExpansionFeature()] })
    core.on(GRID_EXPANSION_CHANGE_EVENT, event)

    core.invoke('collapseAllRows')
    core.invoke('expandRow', 'a')
    core.invoke('collapseAllRows')

    expect(core.invoke('getExpandedKeys')).toEqual([])
    expect(event).toHaveBeenCalledTimes(2)
  })

  it('silences a retained expansion model after core disposal', () => {
    const onChange = vi.fn()
    const core = createGridCore({ features: [createGridExpansionFeature({ onChange })] })
    const model = core.invoke<import('./expansion').ExpansionModel>('getExpansionModel')
    core.destroy()

    model.expand('late')

    expect(onChange).not.toHaveBeenCalled()
  })
})
