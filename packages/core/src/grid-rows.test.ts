import { describe, expect, it, vi } from 'vitest'
import {
  createGridCore,
  createGridRowsFeature,
  GRID_ROWS_CHANGE_EVENT,
  type GridRowKey,
  type GridRowsModel,
  type GridRowsTransaction,
} from './grid'

describe('createGridRowsFeature', () => {
  type Row = { id: number; name: string }
  type Meta = { persist: boolean }

  it('skips equivalent array updater transactions', () => {
    const before = vi.fn()
    const after = vi.fn()
    const event = vi.fn()
    const core = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({
          defaultRows: [
            { id: 1, name: 'Ada' },
            { id: 2, name: 'Lin' },
          ],
          onBeforeRowsChange: before,
          onRowsChange: after,
        }),
      ],
    })
    core.on(GRID_ROWS_CHANGE_EVENT, event)
    const model = core.invoke<GridRowsModel<Row>>('getRowsModel')
    const storeState = model.store.getState()
    const storeChange = vi.fn()
    model.store.subscribe(storeChange)

    expect(core.invoke<boolean>('transactRows', (rows) => [...rows])).toBe(false)
    expect(core.invoke<boolean>('transactRows', (rows) => rows.slice())).toBe(false)
    expect(model.commit([...storeState])).toBe(false)
    expect(model.loadData([...storeState])).toBe(false)

    expect(model.store.getState()).toBe(storeState)
    expect(storeChange).not.toHaveBeenCalled()
    expect(before).not.toHaveBeenCalled()
    expect(after).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
  })

  it('funnels commits through before/store/after/event in a stable order', () => {
    const order: string[] = []
    const events: Array<GridRowsTransaction<Row, Meta>> = []
    const core = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row, Meta>({
          defaultRows: [{ id: 1, name: 'Ada' }],
          onBeforeRowsChange: ({ previousRows, rows }) =>
            order.push(`before:${previousRows.length}->${rows.length}`),
          onRowsChange: () => order.push('after'),
        }),
      ],
    })
    core.on<GridRowsTransaction<Row, Meta>>(GRID_ROWS_CHANGE_EVENT, (transaction) => {
      order.push('event')
      events.push(transaction)
    })

    const changed = core.invoke<boolean>('setRows', [{ id: 2, name: 'Bob' }], {
      reason: 'load',
      meta: { persist: true },
    })

    expect(changed).toBe(true)
    expect(order).toEqual(['before:1->1', 'after', 'event'])
    expect(core.invoke<Row[]>('getRows')).toEqual([{ id: 2, name: 'Bob' }])
    expect(events[0]).toMatchObject({ reason: 'load', meta: { persist: true } })
  })

  it('supports updater transactions and skips identity no-ops', () => {
    const event = vi.fn()
    const first: Row[] = [{ id: 1, name: 'Ada' }]
    const core = createGridCore<Row>({ features: [createGridRowsFeature({ defaultRows: first })] })
    core.on(GRID_ROWS_CHANGE_EVENT, event)

    expect(core.invoke<boolean>('transactRows', (rows: readonly Row[]) => rows)).toBe(false)
    expect(
      core.invoke<boolean>('transactRows', (rows: readonly Row[]) => [
        ...rows,
        { id: 2, name: 'Bob' },
      ]),
    ).toBe(true)

    expect(core.invoke<Row[]>('getRows')).toHaveLength(2)
    expect(event).toHaveBeenCalledOnce()
  })

  it('silently synchronizes controlled or remote rows', () => {
    const before = vi.fn()
    const after = vi.fn()
    const event = vi.fn()
    const core = createGridCore<Row>({
      features: [createGridRowsFeature({ onBeforeRowsChange: before, onRowsChange: after })],
    })
    core.on(GRID_ROWS_CHANGE_EVENT, event)

    core.invoke('syncRows', [{ id: 3, name: 'Cora' }])

    expect(core.invoke('getRows')).toEqual([{ id: 3, name: 'Cora' }])
    expect(before).not.toHaveBeenCalled()
    expect(after).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
  })

  it('owns row-list snapshots and exposes key-addressed mutations', () => {
    const source: Row[] = [{ id: 1, name: 'Ada' }]
    const events: Array<GridRowsTransaction<Row>> = []
    const core = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({
          defaultRows: source,
          rowKeyField: 'id',
        }),
      ],
    })
    core.on<GridRowsTransaction<Row>>(GRID_ROWS_CHANGE_EVENT, (transaction) =>
      events.push(transaction),
    )

    const replacement: Row[] = [{ id: 9, name: 'replacement' }]
    core.invoke('setRows', replacement)
    replacement.push({ id: 99, name: 'outside' })
    expect(core.invoke<Row[]>('getData')).toEqual([{ id: 9, name: 'replacement' }])

    expect(core.invoke<boolean>('insertRow', { id: 2, name: 'Lin' })).toBe(true)
    expect(core.invoke<boolean>('updateRow', 9, { name: 'Alicia' })).toBe(true)
    expect(core.invoke<boolean>('removeRow', 2)).toBe(true)
    expect(core.invoke<Row[]>('getRows')).toEqual([{ id: 9, name: 'Alicia' }])

    const rowsFromEvent = events[0]!.rows as Row[]
    rowsFromEvent.push({ id: 100, name: 'listener mutation' })
    expect(core.invoke<Row[]>('getRows')).toEqual([{ id: 9, name: 'Alicia' }])
  })

  it('removes multiple computed-key rows in one transaction', () => {
    type ComputedRow = { id: number; code: string }
    const event = vi.fn()
    const core = createGridCore<ComputedRow>({
      features: [
        createGridRowsFeature<ComputedRow>({
          defaultRows: [
            { id: 1, code: 'a' },
            { id: 2, code: 'b' },
            { id: 3, code: 'c' },
          ],
          getRowKey: (row) => row.code,
        }),
      ],
    })
    core.on(GRID_ROWS_CHANGE_EVENT, event)

    expect(core.invoke<readonly GridRowKey[]>('removeRows', ['b', 'missing', 'c'])).toEqual([
      'b',
      'c',
    ])
    expect(core.invoke<ComputedRow[]>('getData')).toEqual([{ id: 1, code: 'a' }])
    expect(event).toHaveBeenCalledOnce()
  })

  it('resolves a computed key batch against the original row indexes', () => {
    type IndexedRow = { id: number; code: string }
    const core = createGridCore<IndexedRow>({
      features: [
        createGridRowsFeature<IndexedRow>({
          defaultRows: [
            { id: 1, code: 'a' },
            { id: 2, code: 'b' },
            { id: 3, code: 'c' },
          ],
          getRowKey: (row, index) => `${row.code}:${index}`,
        }),
      ],
    })

    expect(core.invoke<readonly GridRowKey[]>('removeRows', ['b:1', 'c:2'])).toEqual(['b:1', 'c:2'])
    expect(core.invoke<IndexedRow[]>('getRows')).toEqual([{ id: 1, code: 'a' }])
  })

  it('keeps the seed and updater arrays outside the feature-owned state', () => {
    const seed = [{ id: 1, name: 'Ada' }]
    const core = createGridCore<Row>({ features: [createGridRowsFeature({ defaultRows: seed })] })
    seed.push({ id: 2, name: 'Lin' })
    expect(core.invoke<Row[]>('getRows')).toEqual([{ id: 1, name: 'Ada' }])

    core.invoke<boolean>('transactRows', (rows) => {
      ;(rows as Row[]).push({ id: 2, name: 'Lin' })
      return rows
    })
    expect(core.invoke<Row[]>('getRows')).toEqual([
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Lin' },
    ])
  })

  it('keeps lookups and mutations correct while legacy mode aliases the seed array', () => {
    const seed: Row[] = [
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Lin' },
    ]
    const core = createGridCore<Row>({
      features: [createGridRowsFeature({ defaultRows: seed, cloneDefaultRows: false })],
    })
    const model = core.invoke<GridRowsModel<Row>>('getRowsModel')
    expect(model.find(2)).toBe(seed[1]) // materialize any lazy index before the external edit

    seed.unshift({ id: 0, name: 'Grace' })
    seed.push({ id: 3, name: 'Katherine' })
    seed[2]!.id = 4

    expect(model.find(3)).toBe(seed[3])
    expect(model.find(4)).toBe(seed[2])
    expect(model.update(4, { name: 'Updated' })).toBe(true)
    expect(model.removeMany([3])).toEqual([3])
    expect(model.get()).toEqual([
      { id: 0, name: 'Grace' },
      { id: 1, name: 'Ada' },
      { id: 4, name: 'Updated' },
    ])
  })

  it('uses live row positions for remove operations on a legacy aliased seed', () => {
    const singleSeed: Row[] = [
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Lin' },
    ]
    const singleCore = createGridCore<Row>({
      features: [createGridRowsFeature({ defaultRows: singleSeed, cloneDefaultRows: false })],
    })
    const singleModel = singleCore.invoke<GridRowsModel<Row>>('getRowsModel')
    expect(singleModel.find(2)).toBe(singleSeed[1])
    singleSeed.unshift({ id: 0, name: 'Grace' })
    expect(singleModel.remove(2)).toBe(true)
    expect(singleModel.get().map((row) => row.id)).toEqual([0, 1])

    const batchSeed: Row[] = [
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Lin' },
    ]
    const batchCore = createGridCore<Row>({
      features: [createGridRowsFeature({ defaultRows: batchSeed, cloneDefaultRows: false })],
    })
    const batchModel = batchCore.invoke<GridRowsModel<Row>>('getRowsModel')
    expect(batchModel.find(2)).toBe(batchSeed[1])
    batchSeed.unshift({ id: 0, name: 'Grace' })
    expect(batchModel.removeMany([2])).toEqual([2])
    expect(batchModel.get().map((row) => row.id)).toEqual([0, 1])
  })

  it('updates and removes nested rows through one immutable root transaction', () => {
    type TreeRow = Row & { children?: TreeRow[] }
    const source: TreeRow[] = [
      { id: 1, name: 'Root', children: [{ id: 2, name: 'Child' }] },
      { id: 3, name: 'Sibling' },
    ]
    const events: Array<GridRowsTransaction<TreeRow>> = []
    const core = createGridCore<TreeRow>({
      features: [
        createGridRowsFeature<TreeRow>({
          defaultRows: source,
          getRowKey: (row) => row.id,
          getChildren: (row) => row.children,
        }),
      ],
    })
    core.on<GridRowsTransaction<TreeRow>>(GRID_ROWS_CHANGE_EVENT, (transaction) =>
      events.push(transaction),
    )

    expect(core.invoke<boolean>('update', 2, { name: 'Updated' })).toBe(true)
    expect(core.invoke<TreeRow[]>('getData')[0]?.children?.[0]?.name).toBe('Updated')
    expect(source[0]?.children?.[0]?.name).toBe('Child')
    expect(core.invoke<TreeRow | undefined>('findRow', 2)).toMatchObject({
      id: 2,
      name: 'Updated',
    })
    const model = core.invoke<GridRowsModel<TreeRow>>('getRowsModel')
    expect(model.find(1)).toBe(core.invoke<TreeRow[]>('getRows')[0])
    expect(core.invoke<TreeRow | undefined>('findRow', 99)).toBeUndefined()

    expect(core.invoke<readonly GridRowKey[]>('removeMany', [2])).toEqual([2])
    expect(core.invoke<TreeRow[]>('getData')[0]?.children).toEqual([])
    expect(source[0]?.children).toHaveLength(1)
    expect(events).toHaveLength(2)
  })

  it('reports every key removed with a tree parent in one transaction', () => {
    type TreeRow = Row & { children?: TreeRow[] }
    const child: TreeRow = { id: 2, name: 'Child', children: [{ id: 3, name: 'Grandchild' }] }
    const root: TreeRow = { id: 1, name: 'Root', children: [child] }
    const core = createGridCore<TreeRow>({
      features: [
        createGridRowsFeature<TreeRow>({
          defaultRows: [root, { id: 4, name: 'Sibling' }],
          getRowKey: (row) => row.id,
          getChildren: (row) => row.children,
        }),
      ],
    })

    expect(core.invoke<readonly GridRowKey[]>('removeRows', [1])).toEqual([1, 2, 3])
    // The requested key remains first in the public operation order; descendant
    // keys are also reported because they disappeared with the parent.
    expect(core.invoke<TreeRow[]>('getRows')).toEqual([{ id: 4, name: 'Sibling' }])
    expect(core.invoke<readonly GridRowKey[]>('removeRows', [2, 3])).toEqual([])
  })

  it('reorders flat rows through one transaction and preserves placement semantics', () => {
    type FlatRow = { id: number; name: string }
    const events: Array<GridRowsTransaction<FlatRow>> = []
    const core = createGridCore<FlatRow>({
      features: [
        createGridRowsFeature<FlatRow>({
          defaultRows: [
            { id: 1, name: 'A' },
            { id: 2, name: 'B' },
            { id: 3, name: 'C' },
          ],
        }),
      ],
    })
    core.on<GridRowsTransaction<FlatRow>>(GRID_ROWS_CHANGE_EVENT, (transaction) =>
      events.push(transaction),
    )
    const model = core.invoke<GridRowsModel<FlatRow>>('getRowsModel')

    expect(model.reorder(1, 3, { reason: 'row-drag', position: 'after' })).toBe(true)
    expect(model.getData().map((row) => row.id)).toEqual([2, 3, 1])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ reason: 'row-drag', previousRows: expect.any(Array) })
    expect(model.reorder(1, 1, { reason: 'row-drag' })).toBe(false)
    expect(events).toHaveLength(1)
  })

  it('reorders a same-parent tree through the rows transaction and blocks cross-parent moves', () => {
    type TreeRow = { id: number; children?: TreeRow[] }
    const childA: TreeRow = { id: 2 }
    const childB: TreeRow = { id: 3 }
    const first: TreeRow = { id: 1, children: [childA, childB] }
    const second: TreeRow = { id: 4, children: [{ id: 5 }] }
    const core = createGridCore<TreeRow>({
      features: [
        createGridRowsFeature<TreeRow>({
          defaultRows: [first, second],
          getRowKey: (row) => row.id,
          getChildren: (row) => row.children,
        }),
      ],
    })
    const model = core.invoke<GridRowsModel<TreeRow>>('getRowsModel')

    expect(model.reorder(2, 3, { position: 'after', reason: 'row-drag' })).toBe(true)
    const next = model.getData()
    expect(next[0]?.children?.map((row) => row.id)).toEqual([3, 2])
    expect(next[0]).not.toBe(first)
    expect(next[0]?.children).not.toBe(first.children)
    expect(first.children).toEqual([childA, childB])

    expect(model.reorder(2, 5, { reason: 'row-drag' })).toBe(false)
    expect(model.getData()[0]).toBe(next[0])
  })
})
