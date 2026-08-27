import { cleanup, render, renderHook } from '@solidjs/testing-library'
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  GRID_COLUMNS_CHANGE_EVENT,
  type GridColumnsChange,
  type GridColumnsModel,
  type GridCore,
} from '@iris-ui-kit/core/grid'
import {
  useGridColumns,
  useGridCore,
  useGridRows,
  useGridSelection,
  useGridVirtual,
} from './index'

afterEach(cleanup)

describe('Solid Grid Core bridge', () => {
  it('uses one core instance for rows + selection through Solid signals', () => {
    const { result } = renderHook(() => {
      const core = useGridCore<{ id: string }>()
      const rows = useGridRows(core, [{ id: 'a' }, { id: 'b' }])
      const selection = useGridSelection<{ id: string }, string>(core, { defaultValue: ['a'] })
      const virtual = useGridVirtual(core, {
        items: rows.rows(),
        estimateSize: 20,
        viewportSize: 20,
        getItemKey: (item) => item.id,
      })
      return { core, rows, selection, virtual }
    })

    expect(result.core.status).toBe('ready')
    expect(result.rows.rows()).toHaveLength(2)
    expect(result.selection.selection()).toEqual(['a'])
    expect(result.virtual.state().totalSize).toBe(40)
    result.selection.model.toggle('b')
    expect(result.selection.selection()).toEqual(['a', 'b'])
  })

  it('routes nested row mutations through tree accessors', () => {
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    const { result } = renderHook(() => {
      const core = useGridCore<TreeRow>()
      const rows = useGridRows(
        core,
        [{ id: 1, name: 'Root', children: [{ id: 2, name: 'Child' }] }],
        { getChildren: (row) => row.children },
      )
      return rows
    })

    expect(result.rows()[0]?.children?.[0]?.name).toBe('Child')
    expect(result.model.update(2, { name: 'Updated' })).toBe(true)
    expect(result.rows()[0]?.children?.[0]?.name).toBe('Updated')
    expect(result.model.remove(2)).toBe(true)
    expect(result.rows()[0]?.children).toEqual([])
  })

  it('installs one columns model, keeps inbound sync silent, and routes writes', () => {
    let core: GridCore<{ id: string }> | undefined
    let columns: ReturnType<typeof useGridColumns> | undefined
    const onVisibilityChange = vi.fn()
    const onWidthsChange = vi.fn()
    const events: GridColumnsChange[] = []

    const Harness = () => {
      core = useGridCore<{ id: string }>()
      columns = useGridColumns(core, { onVisibilityChange, onWidthsChange })
      return <div />
    }

    const view = render(() => <Harness />)
    const feature = columns!
    core!.on<GridColumnsChange>(GRID_COLUMNS_CHANGE_EVENT, (event) => events.push(event))
    expect(core!.features.filter((name) => name === 'columns')).toHaveLength(1)
    expect(feature.model).toBe(core!.invoke<GridColumnsModel>('getColumnsModel'))

    feature.model.syncVisibility({ hidden: false })
    feature.model.syncWidths({ name: 120 })
    expect(onVisibilityChange).not.toHaveBeenCalled()
    expect(onWidthsChange).not.toHaveBeenCalled()
    expect(events).toEqual([])

    feature.setVisibility({ hidden: true })
    feature.setWidths({ name: 140 })
    expect(onVisibilityChange).toHaveBeenCalledWith({ hidden: true })
    expect(onWidthsChange).toHaveBeenCalledWith({ name: 140 })

    feature.resetWidths()
    expect(onWidthsChange).toHaveBeenLastCalledWith({})
    view.unmount()
    expect(core!.status).toBe('destroyed')
  })
})
