import { describe, it, expect, vi } from 'vitest'
import { runPlugins } from '@iris-ui/core'
import { createProTableStore, proTablePlugin, proTableTokens, type ProTableColumn } from './index'

interface User extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const columns: ProTableColumn<User>[] = [
  { key: 'name', title: 'Name', sortable: true, filterable: true, editable: true },
  { key: 'age', title: 'Age', sortable: true, editable: true, editor: 'number' },
]

const data: User[] = [
  { id: 1, name: 'Charlie', age: 30 },
  { id: 2, name: 'Alice', age: 25 },
  { id: 3, name: 'Bob', age: 35 },
  { id: 4, name: 'Dave', age: 28 },
]

function make(overrides = {}) {
  return createProTableStore<User>({ columns, rowKey: 'id', data, pageSize: 2, ...overrides })
}

describe('createProTableStore — pagination', () => {
  it('paginates client data', () => {
    const t = make()
    expect(t.getState().rows.map((r) => r.id)).toEqual([1, 2])
    expect(t.getState().total).toBe(4)
    expect(t.pageCount()).toBe(2)
    t.setPage(2)
    expect(t.getState().rows.map((r) => r.id)).toEqual([3, 4])
  })
})

describe('createProTableStore — sorting', () => {
  it('toggles asc → desc → none', () => {
    const t = make({ pageSize: 10 })
    t.toggleSort('age')
    expect(t.getState().rows.map((r) => r.age)).toEqual([25, 28, 30, 35])
    t.toggleSort('age')
    expect(t.getState().rows.map((r) => r.age)).toEqual([35, 30, 28, 25])
    t.toggleSort('age')
    expect(t.getState().sort).toBeNull()
  })
})

describe('createProTableStore — filtering', () => {
  it('filters by substring (case-insensitive)', () => {
    const t = make({ pageSize: 10 })
    t.setFilter('name', 'a')
    const names = t
      .getState()
      .rows.map((r) => r.name)
      .sort()
    expect(names).toEqual(['Alice', 'Charlie', 'Dave'])
    t.clearFilters()
    expect(t.getState().rows).toHaveLength(4)
  })
})

describe('createProTableStore — selection', () => {
  it('toggles rows and select-all over the page', () => {
    const t = make()
    t.toggleRow('1')
    expect(t.isSelected('1')).toBe(true)
    t.toggleAll()
    expect(t.isAllSelected()).toBe(true)
    t.toggleAll()
    expect(t.isAllSelected()).toBe(false)
  })
})

describe('createProTableStore — inline edit', () => {
  it('commits an edit, writes back, and fires onCellEdit', () => {
    const onCellEdit = vi.fn()
    const t = make({ pageSize: 10, onCellEdit })
    t.startEdit('2', 'name')
    expect(t.getState().editing).toEqual({ rowKey: '2', columnKey: 'name' })
    t.commitEdit('Alicia')
    expect(t.getState().editing).toBeNull()
    expect(t.getState().rows.find((r) => r.id === 2)?.name).toBe('Alicia')
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ rowKey: '2', oldValue: 'Alice', newValue: 'Alicia' }),
    )
  })

  it('coerces number editors', () => {
    const t = make({ pageSize: 10 })
    t.startEdit('1', 'age')
    t.commitEdit('99')
    expect(t.getState().rows.find((r) => r.id === 1)?.age).toBe(99)
  })
})

describe('createProTableStore — server mode', () => {
  it('calls onLoad and sets rows/total/loading', async () => {
    const onLoad = vi.fn().mockResolvedValue({ rows: [{ id: 9, name: 'Z', age: 1 }], total: 1 })
    const t = createProTableStore<User>({ columns, rowKey: 'id', mode: 'server', onLoad })
    await Promise.resolve()
    await Promise.resolve()
    expect(onLoad).toHaveBeenCalled()
    expect(t.getState().rows.map((r) => r.id)).toEqual([9])
    expect(t.getState().total).toBe(1)
    expect(t.getState().loading).toBe(false)
  })
})

describe('createProTableStore — export', () => {
  it('exports CSV of filtered+sorted rows', () => {
    const t = make({ pageSize: 2 })
    t.toggleSort('age')
    const csv = t.exportCsv()
    expect(csv.split('\n')[0]).toBe('Name,Age')
    expect(csv).toContain('Alice,25')
    // export covers all pages, not just the current one
    expect(csv).toContain('Bob,35')
  })

  it('exports SpreadsheetML', () => {
    const t = make()
    const xml = t.exportExcelXml('Users')
    expect(xml).toContain('ss:Name="Users"')
    expect(xml).toContain('Charlie')
  })
})

describe('proTablePlugin', () => {
  it('registers table tokens', () => {
    const { tokens } = runPlugins([proTablePlugin])
    expect(tokens['--iris-pro-table-border']).toBe(proTableTokens['--iris-pro-table-border'])
  })
})

describe('visibleColumns', () => {
  it('omits hidden columns', () => {
    const t = createProTableStore<User>({
      columns: [...columns, { key: 'secret', title: 'Secret', hidden: true }],
      rowKey: 'id',
      data,
    })
    expect(t.visibleColumns().map((c) => c.key)).toEqual(['name', 'age'])
  })
})
