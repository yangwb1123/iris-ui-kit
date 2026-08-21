import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'
import type { IrisTableHandle } from './types'

afterEach(cleanup)

const columns = [{ key: 'name', title: 'Name' }]

describe('IrisTable tableRef.compareStates', () => {
  async function handle(): Promise<IrisTableHandle> {
    const tableRef: { current: IrisTableHandle | null } = { current: null }
    render(IrisTable, { props: { columns, data: [{ id: 1, name: 'A' }], tableRef } })
    await waitFor(() => expect(tableRef.current).not.toBeNull())
    return tableRef.current!
  }

  it('compares exported-state objects independently of key order', async () => {
    const table = await handle()
    expect(table.compareStates('{"b":2,"a":1}', '{"a":1,"b":2}')).toBe('')
    expect(
      table.compareStates('{"sort":{"direction":"asc"}}', '{"sort":{"direction":"desc"}}'),
    ).toBe('~ sort.direction: "asc" → "desc"')
  })

  it('reports directional additions and removals', async () => {
    const table = await handle()
    expect(table.compareStates('{}', '{"pageSize":25}')).toBe('+ pageSize: 25')
    expect(table.compareStates('{"pageSize":25}', '{}')).toBe('- pageSize: 25')
  })

  it('returns the literal fail-closed result for invalid JSON', async () => {
    expect((await handle()).compareStates('{bad', '{}')).toBe('! compareStates: invalid JSON')
  })
})
