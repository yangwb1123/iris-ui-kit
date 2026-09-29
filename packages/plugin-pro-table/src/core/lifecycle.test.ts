import { describe, expect, it, vi } from 'vitest'
import { createProTableStore, type ProTableColumn, type ProTableQuery } from './index'

interface User extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const columns: ProTableColumn<User>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true, editor: 'number' },
]

const data: User[] = [
  { id: 1, name: 'Charlie', age: 30 },
  { id: 2, name: 'Alice', age: 25 },
]

describe('ProTable store lifecycle', () => {
  it('passes an AbortSignal to server onLoad and ignores a late result after destroy', async () => {
    let resolveLoad!: (result: { rows: User[]; total: number }) => void
    let signal: AbortSignal | undefined
    const onLoad = vi.fn((query: ProTableQuery, requestSignal?: AbortSignal) => {
      expect(query).toEqual({ page: 1, pageSize: 10, sort: null, filters: {} })
      signal = requestSignal
      return new Promise<{ rows: User[]; total: number }>((resolve) => {
        resolveLoad = resolve
      })
    })
    const table = createProTableStore<User>({
      columns,
      rowKey: 'id',
      mode: 'server',
      onLoad,
    })

    expect(onLoad).toHaveBeenCalledWith(
      { page: 1, pageSize: 10, sort: null, filters: {} },
      expect.any(AbortSignal),
    )
    expect(signal?.aborted).toBe(false)
    const stateBeforeLateResult = table.getState()

    table.destroy()
    expect(signal?.aborted).toBe(true)

    resolveLoad({ rows: [{ id: 9, name: 'Late', age: 99 }], total: 1 })
    await Promise.resolve()
    await Promise.resolve()

    expect(table.getState()).toBe(stateBeforeLateResult)
    expect(table.getState().rows).toEqual([])
    expect(table.getState().total).toBe(0)
  })

  it('makes destroy idempotent', () => {
    const table = createProTableStore<User>({ columns, rowKey: 'id', data })

    expect(() => {
      table.destroy()
      table.destroy()
    }).not.toThrow()
  })

  it('removes the tree expansion reload subscription on destroy', () => {
    const onLoad = vi.fn((_query: ProTableQuery, _signal?: AbortSignal) =>
      Promise.resolve({ rows: [], total: 0 }),
    )
    const table = createProTableStore<User>({
      columns,
      rowKey: 'id',
      data,
      mode: 'server',
      tree: { getChildren: (row) => (row as User & { children?: User[] }).children },
      onLoad,
    })
    const initialLoadCount = onLoad.mock.calls.length

    table.destroy()
    table.toggleExpand('1')

    expect(onLoad).toHaveBeenCalledTimes(initialLoadCount)
  })

  it('keeps client data, data-source updates, and cell editing working before destroy', () => {
    const onCellEdit = vi.fn()
    const table = createProTableStore<User>({
      columns,
      rowKey: 'id',
      data,
      pageSize: 10,
      onCellEdit,
    })

    expect(table.getState().rows).toEqual(data)
    table.setFilter('name', 'ali')
    expect(table.getState().rows.map((row) => row.id)).toEqual([2])

    table.clearFilters()
    table.startEdit('2', 'name')
    expect(table.getState().editing).toEqual({ rowKey: '2', columnKey: 'name' })
    table.commitEdit('Alicia')

    expect(table.getState().rows.find((row) => row.id === 2)?.name).toBe('Alicia')
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ rowKey: '2', oldValue: 'Alice', newValue: 'Alicia' }),
    )

    const stateBeforeDestroy = table.getState()
    table.destroy()
    table.startEdit('1', 'name')
    expect(table.getState()).toBe(stateBeforeDestroy)
  })
})
