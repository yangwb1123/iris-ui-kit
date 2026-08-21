import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn, IrisTableHandle } from './types'

afterEach(cleanup)

type Row = { id: number; name: string }
const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]

describe('IrisTable handle.compareStates', () => {
  function handle(): IrisTableHandle<Row> {
    const tableRef: { current: IrisTableHandle<Row> | null } = { current: null }
    render(() => <IrisTable columns={columns} data={[{ id: 1, name: 'A' }]} tableRef={tableRef} />)
    return tableRef.current!
  }

  it('compares exported-state objects independently of key order', () => {
    const table = handle()
    expect(table.compareStates('{"b":2,"a":1}', '{"a":1,"b":2}')).toBe('')
    expect(
      table.compareStates('{"sort":{"direction":"asc"}}', '{"sort":{"direction":"desc"}}'),
    ).toBe('~ sort.direction: "asc" → "desc"')
  })

  it('reports directional additions and removals', () => {
    const table = handle()
    expect(table.compareStates('{}', '{"pageSize":25}')).toBe('+ pageSize: 25')
    expect(table.compareStates('{"pageSize":25}', '{}')).toBe('- pageSize: 25')
  })

  it('returns the literal fail-closed result for invalid JSON', () => {
    expect(handle().compareStates('{bad', '{}')).toBe('! compareStates: invalid JSON')
  })
})
