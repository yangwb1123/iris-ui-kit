import { describe, it, expect } from 'vitest'
import {
  applyOptimisticLayer,
  republishPendingLayers,
  rowsAfterRemovingLayer,
  rowsWithPendingLayers,
  type OptimisticLayerApi,
} from './data-source-optimistic'
import type { DataSourceMutationRecord } from './data-source-mutation-types'

interface Row {
  id: number
  name: string
}

const canonical: Row[] = [
  { id: 1, name: 'one' },
  { id: 2, name: 'two' },
]

function makeApi(initial: Row[] = canonical) {
  const published: Row[][] = []
  const api: OptimisticLayerApi<Row> = {
    getCanonicalRows: () => initial,
    publish: (rows) => published.push(rows),
  }
  return { api, published }
}

function record(overrides: Partial<DataSourceMutationRecord<Row>>): DataSourceMutationRecord<Row> {
  return {
    lifecycle: 0,
    sequence: 1,
    snapshot: canonical,
    optimistic: true,
    skipReload: false,
    ...overrides,
  } as DataSourceMutationRecord<Row>
}

const rename = (name: string) => (rows: Row[]) =>
  rows.map((row) => (row.id === 1 ? { ...row, name } : row))

describe('optimistic layer arithmetic', () => {
  it('applies a layer to a copy, never to the caller snapshot', () => {
    const rows = [{ id: 1, name: 'one' }]
    const next = applyOptimisticLayer(rename('x'), rows)
    expect(next[0]!.name).toBe('x')
    expect(rows[0]!.name).toBe('one')
    expect(next[0]).not.toBe(rows[0])
  })

  it('republishes canonical + every pending layer, last sequence winning', () => {
    const { api, published } = makeApi()
    const records = new Map<string, DataSourceMutationRecord<Row>>([
      ['b', record({ id: 'b', sequence: 2, optimisticApply: rename('second') })],
      ['a', record({ id: 'a', sequence: 1, optimisticApply: rename('first') })],
    ])

    republishPendingLayers(api, records, 0)

    expect(published).toHaveLength(1)
    // Sequence order decides, not map insertion order: the newest layer wins.
    expect(published[0]!.map((row) => row.name)).toEqual(['second', 'two'])
  })

  it('publishes nothing when no layer is pending (no duplicate load emission)', () => {
    const { api, published } = makeApi()
    republishPendingLayers(api, new Map(), 0)
    // A record without an optimistic layer is not a pending layer either.
    republishPendingLayers(
      api,
      new Map([['x', record({ id: 'x', optimistic: false, optimisticApply: undefined })]]),
      0,
    )
    expect(published).toHaveLength(0)
  })

  it('ignores records from another lifecycle (destroy/recreate)', () => {
    const { api, published } = makeApi()
    const records = new Map<string, DataSourceMutationRecord<Row>>([
      ['old', record({ id: 'old', lifecycle: 7, optimisticApply: rename('stale') })],
    ])

    republishPendingLayers(api, records, 0)
    expect(published).toHaveLength(0)
    expect(rowsWithPendingLayers(api, records, 0).map((row) => row.name)).toEqual(['one', 'two'])
  })

  it('removes one layer while keeping the others, and reports nothing to undo', () => {
    const { api } = makeApi()
    const kept = record({ id: 'kept', sequence: 1, optimisticApply: rename('kept') })
    const dropped = record({
      id: 'dropped',
      sequence: 2,
      rowKey: '1',
      optimisticApply: rename('x'),
    })
    const records = new Map<string, DataSourceMutationRecord<Row>>([
      ['kept', kept],
      ['dropped', dropped],
    ])

    expect(rowsAfterRemovingLayer(api, records, 0, dropped)!.map((row) => row.name)).toEqual([
      'kept',
      'two',
    ])
    expect(
      rowsAfterRemovingLayer(api, records, 0, record({ id: 'plain', optimistic: false })),
    ).toBe(undefined)
  })
})
