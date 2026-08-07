import { describe, it, expect, vi } from 'vitest'
import { runPlugins } from '@iris-ui-kit/core'
import {
  createProTableStore,
  pinnedStyle,
  proTablePlugin,
  proTableTokens,
  type ProTableColumn,
} from './index'

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

describe('createProTableStore — resource mutations', () => {
  it('creates a client row and exposes the pending mutation lifecycle', async () => {
    let release!: (row: User) => void
    const onCreate = vi.fn(
      () =>
        new Promise<User>((resolve) => {
          release = resolve
        }),
    )
    const table = make({ pageSize: 10, mutations: { create: onCreate } })

    const pending = table.createRow({ id: 5, name: 'Eve', age: 22 })
    expect(table.getState().mutation).toEqual({
      kind: 'create',
      pending: true,
      rowKeys: ['5'],
      error: undefined,
    })

    release({ id: 5, name: 'Eve saved', age: 22 })
    await pending
    expect(table.getState().rows.find((row) => row.id === 5)?.name).toBe('Eve saved')
    expect(table.getState().total).toBe(5)
    expect(table.getState().mutation).toEqual({
      kind: 'create',
      pending: false,
      rowKeys: ['5'],
      error: undefined,
    })
  })

  it('deletes one row and bulk-deletes the current selection', async () => {
    const onDelete = vi.fn(async () => undefined)
    const onBulkDelete = vi.fn(async () => undefined)
    const table = make({
      pageSize: 10,
      mutations: { delete: onDelete, bulkDelete: onBulkDelete },
    })

    await expect(table.deleteRow('2')).resolves.toBe(true)
    expect(onDelete).toHaveBeenCalledWith('2', expect.objectContaining({ id: 2 }))
    expect(table.getState().rows.map((row) => row.id)).toEqual([1, 3, 4])

    table.toggleRow('1')
    table.toggleRow('3')
    await expect(table.bulkDelete()).resolves.toBe(2)
    expect(onBulkDelete).toHaveBeenCalledWith(
      ['1', '3'],
      [expect.objectContaining({ id: 1 }), expect.objectContaining({ id: 3 })],
    )
    expect(table.getState().rows.map((row) => row.id)).toEqual([4])
    expect(table.getState().selectedKeys).toEqual([])
  })

  it('keeps rows and exposes the error when a mutation fails', async () => {
    const failure = new Error('delete rejected')
    const table = make({
      pageSize: 10,
      mutations: { delete: async () => Promise.reject(failure) },
    })
    await expect(table.deleteRow('1')).rejects.toThrow('delete rejected')
    expect(table.getState().rows.some((row) => row.id === 1)).toBe(true)
    expect(table.getState().mutation).toEqual({
      kind: 'delete',
      pending: false,
      rowKeys: ['1'],
      error: failure,
    })
  })

  it('exposes an opt-in generic resource mutation path', async () => {
    const table = make({ pageSize: 10 })
    const action = vi.fn(async () => undefined)
    await table.mutate(action, { kind: 'custom', rowKeys: ['1'], skipReload: true })
    expect(action).toHaveBeenCalledOnce()
    expect(table.getState().mutation).toEqual({
      kind: 'custom',
      pending: false,
      rowKeys: ['1'],
      error: undefined,
    })
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

  it('requires an injected create handler for server mutations', async () => {
    const onLoad = vi.fn().mockResolvedValue({ rows: [], total: 0 })
    const table = createProTableStore<User>({ columns, rowKey: 'id', mode: 'server', onLoad })
    await expect(table.createRow({ id: 9, name: 'Z', age: 1 })).rejects.toThrow(
      'config.mutations.create',
    )
    expect(table.getState().mutation.error).toBeInstanceOf(Error)
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

  it('exports JSON of filtered+sorted rows (visible columns only)', () => {
    const t = make({ pageSize: 2 })
    t.toggleSort('age')
    const data = JSON.parse(t.exportJson()) as { name: string; age: number }[]
    expect(data).toHaveLength(4)
    expect(data[0]).toEqual({ name: 'Alice', age: 25 })
    expect(Object.keys(data[0]!)).toEqual(['name', 'age'])
  })

  it('exports an HTML table', () => {
    const t = make()
    const html = t.exportHtml({ caption: 'Users' })
    expect(html.startsWith('<table>')).toBe(true)
    expect(html).toContain('<caption>Users</caption>')
    expect(html).toContain('<th>Name</th>')
    expect(html).toContain('Charlie')
  })
})

describe('proTablePlugin', () => {
  it('registers table tokens', () => {
    const { tokens } = runPlugins([proTablePlugin])
    // Dead registrations (no render-layer consumer) must not be registered.
    expect(tokens['--iris-pro-table-border']).toBeUndefined()
    expect(tokens['--iris-pro-table-header-bg']).toBeUndefined()
    expect(tokens['--iris-pro-table-row-hover']).toBeUndefined()
    expect(tokens['--iris-pro-table-chip-bg']).toBe(proTableTokens['--iris-pro-table-chip-bg'])
    expect(tokens['--iris-pro-table-selected-bg']).toBe(
      proTableTokens['--iris-pro-table-selected-bg'],
    )
  })
})

describe('pinnedStyle', () => {
  it('uses logical insets so pinned columns follow RTL direction', () => {
    expect(pinnedStyle({ pinned: 'left' })).toEqual({
      position: 'sticky',
      insetInlineStart: 0,
      zIndex: 1,
    })
    expect(pinnedStyle({ pinned: 'right' })).toEqual({
      position: 'sticky',
      insetInlineEnd: 0,
      zIndex: 1,
    })
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
