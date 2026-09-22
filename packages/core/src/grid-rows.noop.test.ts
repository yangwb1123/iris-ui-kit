import { describe, expect, it, vi } from 'vitest'
import {
  createGridCore,
  createGridRowsFeature,
  GRID_ROWS_CHANGE_EVENT,
  updateTreeRows,
  type GridRowsModel,
} from './grid'

describe('value-identical row updates are silent no-ops', () => {
  type Row = { id: number; name: string }

  function createProbedCore(rows: Row[] = [{ id: 1, name: 'Ada' }]) {
    const before = vi.fn()
    const after = vi.fn()
    const event = vi.fn()
    const core = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({
          defaultRows: rows,
          onBeforeRowsChange: before,
          onRowsChange: after,
        }),
      ],
    })
    core.on(GRID_ROWS_CHANGE_EVENT, event)
    const model = core.invoke<GridRowsModel<Row>>('getRowsModel')
    const storeChange = vi.fn()
    model.store.subscribe(storeChange)
    return { core, model, before, after, event, storeChange }
  }

  it('keeps the store and row identity and stays silent for identical and empty patches', () => {
    const { core, model, before, after, event, storeChange } = createProbedCore()
    const sourceList = model.store.getState()
    const sourceRow = sourceList[0]

    expect(core.invoke<boolean>('updateRow', 1, { name: 'Ada' })).toBe(false)
    expect(model.update(1, {})).toBe(false)

    expect(model.store.getState()).toBe(sourceList)
    expect(model.get()[0]).toBe(sourceRow)
    expect(storeChange).not.toHaveBeenCalled()
    expect(before).not.toHaveBeenCalled()
    expect(after).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
  })

  it('still reports one edit transaction and event for a real change', () => {
    const { model, before, after, event, storeChange } = createProbedCore()

    expect(model.update(1, { name: 'Grace' })).toBe(true)

    expect(before).toHaveBeenCalledOnce()
    expect(after).toHaveBeenCalledOnce()
    expect(event).toHaveBeenCalledOnce()
    expect(storeChange).toHaveBeenCalledOnce()
    expect(after.mock.calls[0]?.[0]).toMatchObject({
      reason: 'edit',
      rows: [{ id: 1, name: 'Grace' }],
    })
    expect(model.get()[0]).toEqual({ id: 1, name: 'Grace' })
  })

  it('treats a NaN value as identical to itself (SameValueZero)', () => {
    const { model, before } = createProbedCore([
      { id: Number.NaN, name: 'nan' },
      { id: 2, name: 'two' },
    ])
    const sourceList = model.store.getState()

    expect(model.update(Number.NaN, { name: 'nan' })).toBe(false)
    expect(model.store.getState()).toBe(sourceList)
    expect(before).not.toHaveBeenCalled()
  })

  it('short-circuits the field-key fallback when the flat index is unusable', () => {
    const before = vi.fn()
    const core = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({
          defaultRows: [{ id: 1, name: 'Ada' }, { name: 'No key' } as Row],
          onBeforeRowsChange: before,
        }),
      ],
    })
    const model = core.invoke<GridRowsModel<Row>>('getRowsModel')
    const sourceList = model.store.getState()

    expect(model.update(1, { name: 'Ada' })).toBe(false)
    expect(model.store.getState()).toBe(sourceList)
    expect(model.get()[0]).toBe(sourceList[0])
    expect(before).not.toHaveBeenCalled()
  })

  it('preserves the child and every ancestor for a value-identical tree patch', () => {
    type TreeRow = Row & { children?: TreeRow[] }
    const leaf: TreeRow = { id: 3, name: 'Leaf' }
    const middle: TreeRow = { id: 2, name: 'Middle', children: [leaf] }
    const root: TreeRow = { id: 1, name: 'Root', children: [middle] }
    const change = vi.fn()
    const core = createGridCore<TreeRow>({
      features: [
        createGridRowsFeature<TreeRow>({
          defaultRows: [root],
          getRowKey: (row) => row.id,
          getChildren: (row) => row.children,
        }),
      ],
    })
    core.on(GRID_ROWS_CHANGE_EVENT, change)
    const model = core.invoke<GridRowsModel<TreeRow>>('getRowsModel')

    expect(model.update(3, { name: 'Leaf' })).toBe(false)
    const nextRoot = model.get()[0]
    expect(nextRoot).toBe(root)
    expect(nextRoot?.children?.[0]).toBe(middle)
    expect(nextRoot?.children?.[0]?.children?.[0]).toBe(leaf)
    expect(change).not.toHaveBeenCalled()

    expect(model.update(3, { name: 'Updated' })).toBe(true)
    expect(change).toHaveBeenCalledOnce()
    expect(model.get()[0]?.children?.[0]?.children?.[0]?.name).toBe('Updated')
  })

  it('reports updateTreeRows no-ops as matched but unchanged without rebuilding ancestors', () => {
    type TreeRow = Row & { children?: TreeRow[] }
    const leaf: TreeRow = { id: 3, name: 'Leaf' }
    const middle: TreeRow = { id: 2, name: 'Middle', children: [leaf] }
    const root: TreeRow = { id: 1, name: 'Root', children: [middle] }

    const result = updateTreeRows(
      [root],
      3,
      { name: 'Leaf' },
      {
        getRowKey: (row) => row.id,
        getChildren: (row) => row.children,
      },
    )

    expect(result).toMatchObject({ matched: true, changed: false, blocked: false })
    expect(result.rows[0]).toBe(root)
    expect(result.rows[0]?.children?.[0]).toBe(middle)
    expect(result.rows[0]?.children?.[0]?.children?.[0]).toBe(leaf)
  })
})
