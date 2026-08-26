import { describe, expect, it, vi } from 'vitest'
import {
  collectTreeRows,
  createGridCore,
  createGridRowsFeature,
  GRID_ROWS_CHANGE_EVENT,
  reconcileTreeRows,
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

  it('collects reachable tree rows once and stops on cycles or duplicate keys', () => {
    type TreeRow = { id: number; children?: TreeRow[] }
    const root: TreeRow = { id: 1 }
    const child: TreeRow = { id: 2 }
    const duplicate: TreeRow = { id: 2 }
    root.children = [child]
    child.children = [root]

    expect(
      collectTreeRows([root, duplicate], {
        getRowKey: (row) => row.id,
        getChildren: (row) => row.children,
      }),
    ).toEqual([root, child])
  })

  it('reconciles flattened child patches into one immutable root tree', () => {
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    const child: TreeRow = { id: 2, name: 'Child' }
    const root: TreeRow = { id: 1, name: 'Root', children: [child] }
    const source = [root]
    const patchedChild: TreeRow = { ...child, name: 'Updated' }

    const next = reconcileTreeRows(source, new Map([[2, patchedChild]]), {
      getRowKey: (row) => row.id,
      getChildren: (row) => row.children,
    })

    expect(next).not.toBe(source)
    expect(next[0]).not.toBe(root)
    expect(next[0]?.children?.[0]).toBe(patchedChild)
    expect(next[0]?.children?.[0]?.name).toBe('Updated')
    expect(source[0]).toBe(root)
    expect(source[0]?.children?.[0]).toBe(child)
    expect(
      reconcileTreeRows(source, new Map(), {
        getRowKey: (row) => row.id,
        getChildren: (row) => row.children,
      }),
    ).toBe(source)
  })

  it('uses a custom child setter and guards duplicate/cyclic branches', () => {
    type TreeRow = { id: number; name: string; descendants: TreeRow[] }
    const root = { id: 1, name: 'Root', descendants: [] as TreeRow[] }
    const child = { id: 2, name: 'Child', descendants: [] as TreeRow[] }
    root.descendants = [child]
    child.descendants = [root]
    const duplicate = { id: 2, name: 'Duplicate', descendants: [] as TreeRow[] }
    const patched: TreeRow = { ...child, name: 'Patched', descendants: child.descendants }
    const setChildren = vi.fn((row: TreeRow, descendants: TreeRow[]) => ({
      ...row,
      descendants,
    }))

    const next = reconcileTreeRows([root, duplicate], new Map([[2, patched]]), {
      getRowKey: (row) => row.id,
      getChildren: (row) => row.descendants,
      setChildren,
    })

    expect(next).toHaveLength(2)
    expect(next[0]?.descendants[0]).toBe(patched)
    expect(next[1]).toBe(duplicate)
    expect(setChildren).toHaveBeenCalledTimes(1)
  })
})
