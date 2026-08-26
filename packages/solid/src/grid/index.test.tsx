import { cleanup, renderHook } from '@solidjs/testing-library'
import { describe, expect, it, afterEach } from 'vitest'
import { useGridCore, useGridRows, useGridSelection, useGridVirtual } from './index'

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
})
