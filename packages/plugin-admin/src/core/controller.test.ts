import { describe, expect, it, vi } from 'vitest'
import { createAdminDataController, validateAdminDraft, type AdminDataPage } from './index'

interface User extends Record<string, unknown> {
  id: number
  name: string
  email: string
  age: number
  active: boolean
}

const page = (): AdminDataPage<User> => ({
  type: 'data',
  key: 'users',
  title: 'Users',
  rowKey: 'id',
  editable: true,
  pageSize: 10,
  columns: [
    { key: 'name', title: 'Name', required: true, sortable: true, filterable: true },
    { key: 'email', title: 'Email', type: 'email', required: true },
    { key: 'age', title: 'Age', type: 'number', min: 18, max: 120 },
    { key: 'active', title: 'Active', type: 'boolean' },
  ],
  data: [
    { id: 1, name: 'Ada', email: 'ada@example.test', age: 36, active: true },
    { id: 2, name: 'Linus', email: 'linus@example.test', age: 30, active: false },
  ],
})

describe('createAdminDataController', () => {
  it('shares client filtering, sorting, pagination and stable row keys', async () => {
    const controller = createAdminDataController(page())
    await controller.resource.reload()
    expect(controller.rowKey(controller.resource.getState().rows[0]!)).toBe('1')

    controller.resource.setSort({ key: 'name', direction: 'desc' })
    await Promise.resolve()
    await Promise.resolve()
    expect(controller.resource.getState().rows.map((row) => row.name)).toEqual(['Linus', 'Ada'])

    controller.resource.setFilter('name', 'ada')
    await Promise.resolve()
    await Promise.resolve()
    expect(controller.resource.getState().rows.map((row) => row.name)).toEqual(['Ada'])
    controller.destroy()
  })

  it('validates, creates, edits and deletes local rows through one state machine', async () => {
    const controller = createAdminDataController(page())
    await controller.resource.reload()
    const editorModesWhenGraceAppears: string[] = []
    const unsubscribe = controller.resource.subscribe((state) => {
      if (state.rows.some((row) => row.name === 'Grace')) {
        editorModesWhenGraceAppears.push(controller.editor.getState().mode)
      }
    })

    controller.beginCreate()
    expect(controller.editor.getState().mode).toBe('create')
    expect(await controller.save()).toBe(false)
    expect(controller.editor.getState().errors.name).toContain('required')

    controller.setField('name', 'Grace')
    controller.setField('email', 'grace@example.test')
    controller.setField('age', 40)
    controller.setField('active', true)
    controller.setField('id', 3)
    expect(await controller.save()).toBe(true)
    expect(controller.resource.getState().rows.some((row) => row.name === 'Grace')).toBe(true)
    expect(editorModesWhenGraceAppears).toEqual(['idle'])

    const grace = controller.resource.getState().rows.find((row) => row.name === 'Grace')!
    controller.beginEdit(grace)
    controller.setField('name', 'Grace Hopper')
    expect(await controller.save()).toBe(true)
    const updated = controller.resource.getState().rows.find((row) => row.id === 3)!
    expect(updated.name).toBe('Grace Hopper')
    expect(controller.rowKey(updated)).toBe('3')

    controller.requestDelete(updated)
    expect(controller.editor.getState().deletingKey).toBe('3')
    expect(await controller.confirmDelete()).toBe(true)
    expect(controller.resource.getState().rows.some((row) => row.id === 3)).toBe(false)
    unsubscribe()
    controller.destroy()
  })

  it('validates type, range, pattern and select constraints', () => {
    const errors = validateAdminDraft(
      [
        { key: 'email', title: 'Email', type: 'email' },
        { key: 'age', title: 'Age', type: 'number', min: 18 },
        { key: 'slug', title: 'Slug', pattern: '^[a-z]+$' },
        {
          key: 'role',
          title: 'Role',
          type: 'select',
          options: [{ label: 'Admin', value: 'admin' }],
        },
      ],
      { email: 'bad', age: 10, slug: 'UPPER', role: 'owner' },
    )
    expect(Object.keys(errors)).toEqual(['email', 'age', 'slug', 'role'])
  })

  it('passes server sort/filter queries and delegates mutations before reload', async () => {
    let rows: User[] = page().data!
    const fetcher = vi.fn(
      async ({ sort, filters }: { sort: unknown; filters: Record<string, string> }) => ({
        rows,
        total: rows.length,
        sort,
        filters,
      }),
    )
    const update = vi.fn(async (_key: string, draft: Partial<User>) => {
      rows = rows.map((row) => (row.id === 1 ? { ...row, ...draft } : row))
    })
    const serverPage: AdminDataPage<User> = {
      ...page(),
      data: undefined,
      fetcher,
      editable: false,
      mutations: { update },
    }
    const controller = createAdminDataController(serverPage)
    await controller.resource.reload()
    controller.resource.setSort({ key: 'name', direction: 'asc' })
    controller.resource.setFilter('name', 'Ada')
    await Promise.resolve()
    await Promise.resolve()
    expect(fetcher.mock.calls.at(-1)?.[0]).toMatchObject({
      sort: { key: 'name', direction: 'asc' },
      filters: { name: 'Ada' },
    })

    const ada = controller.resource.getState().rows[0]!
    controller.beginEdit(ada)
    controller.setField('name', 'Ada Lovelace')
    expect(await controller.save()).toBe(true)
    expect(update).toHaveBeenCalledWith('1', expect.objectContaining({ name: 'Ada Lovelace' }), ada)
    controller.destroy()
  })

  it('keeps the editor open and exposes mutation failures for retry', async () => {
    const failing = page()
    failing.mutations = {
      update: async () => {
        throw new Error('server rejected update')
      },
    }
    const controller = createAdminDataController(failing)
    await controller.resource.reload()
    controller.beginEdit(controller.resource.getState().rows[0]!)
    controller.setField('name', 'Rejected')
    expect(await controller.save()).toBe(false)
    expect(controller.editor.getState().mode).toBe('edit')
    expect(controller.editor.getState().actionError).toEqual(
      expect.objectContaining({ message: 'server rejected update' }),
    )
    expect(controller.resource.getState().rows[0]?.name).toBe('Ada')
    controller.destroy()
  })

  it('runs declarative custom actions with page/action/row context', async () => {
    const controller = createAdminDataController(page())
    await controller.resource.reload()
    const handler = vi.fn(async () => undefined)
    const row = controller.resource.getState().rows[0]!
    expect(await controller.runAction('impersonate', row, handler)).toBe(true)
    expect(handler).toHaveBeenCalledWith('users', 'impersonate', row)
    expect(controller.editor.getState().runningAction).toBeNull()
    controller.destroy()
  })
})
