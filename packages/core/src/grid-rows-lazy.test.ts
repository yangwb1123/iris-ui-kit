import { describe, expect, it, vi } from 'vitest'
import {
  createGridCore,
  createGridRowsFeature,
  GRID_ROWS_CHANGE_EVENT,
  type GridRowsModel,
  type GridRowsTransaction,
} from './grid'

describe('grid rows lazy children', () => {
  it('loads children through the rows transaction and preserves source identity', () => {
    type LazyRow = { id: number; name: string; children?: LazyRow[] }
    const root: LazyRow = { id: 1, name: 'Root' }
    const source = [root]
    const before = vi.fn()
    const after = vi.fn()
    const events: Array<GridRowsTransaction<LazyRow>> = []
    const core = createGridCore<LazyRow>({
      features: [
        createGridRowsFeature<LazyRow>({
          defaultRows: source,
          getRowKey: (row) => row.id,
          getChildren: (row) => row.children,
          setChildren: (row, nextChildren) => ({ ...row, children: nextChildren }),
          onBeforeRowsChange: before,
          onRowsChange: after,
        }),
      ],
    })
    core.on<GridRowsTransaction<LazyRow>>(GRID_ROWS_CHANGE_EVENT, (tx) => events.push(tx))

    const children: LazyRow[] = [{ id: 2, name: 'Child' }]
    expect(core.invoke<boolean>('setChildren', 1, children, { reason: 'lazy-load' })).toBe(true)
    expect(core.invoke<LazyRow | undefined>('findRow', 2)).toMatchObject({ id: 2, name: 'Child' })
    expect(core.invoke<LazyRow[]>('getData')[0]?.children).toEqual(children)
    expect(core.invoke<LazyRow[]>('getData')[0]).not.toBe(root)
    expect(source[0]).toBe(root)
    expect(source[0]?.children).toBeUndefined()
    expect(before).toHaveBeenCalledOnce()
    expect(after).toHaveBeenCalledOnce()
    expect(events).toHaveLength(1)

    const eventRows = events[0]!.rows as LazyRow[]
    eventRows.push({ id: 3, name: 'listener mutation' })
    expect(core.invoke<LazyRow[]>('getData')).toHaveLength(1)
  })

  it('supports silent child hydration and custom child accessors', () => {
    type LazyRow = { id: number; name: string; descendants?: LazyRow[] }
    const root: LazyRow = { id: 1, name: 'Root' }
    const after = vi.fn()
    const core = createGridCore<LazyRow>({
      features: [
        createGridRowsFeature<LazyRow>({
          defaultRows: [root],
          getRowKey: (row) => row.id,
          getChildren: (row) => row.descendants,
          setChildren: (row, children) => ({ ...row, descendants: children }),
          onRowsChange: after,
        }),
      ],
    })
    const model = core.invoke<GridRowsModel<LazyRow>>('getRowsModel')

    const child: LazyRow = { id: 2, name: 'Child', descendants: [] }
    expect(model.syncChildren(1, [child])).toBe(true)
    expect(model.find(2)).toMatchObject({ id: 2 })
    expect(after).not.toHaveBeenCalled()
    expect(core.invoke<LazyRow[]>('getData')[0]?.descendants).toHaveLength(1)
    const hydratedRoot = model.get()[0]
    expect(model.syncChildren(2, [])).toBe(false)
    expect(model.get()[0]).toBe(hydratedRoot)
    expect(model.syncChildren(1, [child])).toBe(false)
    expect(model.setChildren(1, [], { reason: 'lazy-retry' })).toBe(true)
    expect(after).toHaveBeenCalledOnce()
    expect(model.find(2)).toBeUndefined()
  })

  it('fails closed for computed children without a setter', () => {
    type LazyRow = { id: number; name: string }
    const root: LazyRow = { id: 1, name: 'Root' }
    const core = createGridCore<LazyRow>({
      features: [
        createGridRowsFeature<LazyRow>({
          defaultRows: [root],
          getRowKey: (row) => row.id,
          getChildren: () => undefined,
        }),
      ],
    })

    expect(core.invoke<boolean>('setChildren', 1, [{ id: 2, name: 'Child' }])).toBe(false)
    expect(core.invoke<LazyRow[]>('getData')).toEqual([root])
  })
})
