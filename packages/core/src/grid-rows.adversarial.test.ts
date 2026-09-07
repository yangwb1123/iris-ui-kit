import { describe, expect, it } from 'vitest'
import {
  createGridCore,
  createGridRowsFeature,
  createGridRowsModel,
  GRID_ROWS_CHANGE_EVENT,
  type GridRowsModel,
  type GridRowsTransaction,
} from './grid'

type Row = { id: number; name: string }

describe('grid rows adversarial mutation cases', () => {
  it('fails closed for malformed updaters, lists, and patches', () => {
    const model = createGridRowsModel<Row>({ defaultRows: [{ id: 1, name: 'Ada' }] })
    const original = model.get()
    for (const operation of [
      () => model.transact(null as never),
      () => model.transact(() => ({ nope: true }) as never),
      () => model.commit(null as never),
      () => model.loadData({ nope: true } as never),
      () => model.sync({ nope: true } as never),
      () => model.update(1, null as never),
      () => model.insert(null as never),
    ])
      expect(operation()).toBe(false)
    expect(model.get()).toEqual(original)
  })

  it('isolates callback and event list snapshots', () => {
    const observed: number[] = []
    const core = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({
          onBeforeRowsChange: (transaction) => {
            transaction.rows.push({ id: 2, name: 'mutated' })
            observed.push(transaction.rows.length)
          },
          onRowsChange: (transaction) => observed.push(transaction.rows.length),
        }),
      ],
    })
    core.on<GridRowsTransaction<Row>>(GRID_ROWS_CHANGE_EVENT, (transaction) =>
      observed.push(transaction.rows.length),
    )
    core.invoke('setRows', [{ id: 1, name: 'Ada' }])
    expect(observed).toEqual([2, 1, 1])
    expect(core.invoke<Row[]>('getRows')).toEqual([{ id: 1, name: 'Ada' }])
  })

  it('addresses NaN keys in flat row operations', () => {
    const model = createGridRowsModel<Row>({
      defaultRows: [
        { id: Number.NaN, name: 'nan' },
        { id: 2, name: 'two' },
      ],
      getRowKey: (row) => row.id,
    })
    expect(model.find(Number.NaN)?.name).toBe('nan')
    expect(model.update(Number.NaN, { name: 'updated' })).toBe(true)
    expect(model.remove(Number.NaN)).toBe(true)
    expect(model.getData()).toEqual([{ id: 2, name: 'two' }])
  })

  it('prevents reentrant observers from overwriting the active transaction', () => {
    const nestedResults: boolean[] = []
    const core = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({
          defaultRows: [{ id: 1, name: 'Ada' }],
          onBeforeRowsChange: () => nestedResults.push(model.insert({ id: 2, name: 'before' })),
          onRowsChange: () => nestedResults.push(model.insert({ id: 3, name: 'after' })),
        }),
      ],
    })
    const model = core.invoke<GridRowsModel<Row>>('getRowsModel')
    core.on(GRID_ROWS_CHANGE_EVENT, () =>
      nestedResults.push(model.insert({ id: 4, name: 'event' })),
    )
    expect(model.commit([{ id: 9, name: 'outer' }])).toBe(true)
    expect(nestedResults).toEqual([false, false, false])
    expect(model.getData()).toEqual([{ id: 9, name: 'outer' }])
  })
})
