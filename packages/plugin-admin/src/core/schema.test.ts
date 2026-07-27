import { describe, expect, it } from 'vitest'
import {
  AdminSchemaError,
  assertAdminSchema,
  hasAdminPermission,
  normalizeAdminSchema,
  resolveAdminMessage,
  validateAdminSchema,
  type AdminAppSchema,
} from './index'

const valid: AdminAppSchema = {
  nav: [{ key: 'users', title: 'Users' }],
  pages: [
    {
      type: 'data',
      key: 'users',
      data: [{ id: 1, name: 'Ada' }],
      columns: [{ key: 'name', title: 'Name' }],
    },
  ],
}

describe('admin schema validation', () => {
  it('accepts and normalizes a legacy client-data schema', () => {
    expect(validateAdminSchema(valid)).toEqual([])
    const normalized = normalizeAdminSchema(valid)
    const page = normalized.pages[0]
    expect(page?.type).toBe('data')
    if (page?.type !== 'data') throw new Error('expected data page')
    expect(page.pageSize).toBe(10)
    expect(page.rowKey).toBe('id')
    expect(page.columns[0]).toMatchObject({
      dataIndex: 'name',
      type: 'text',
      sortable: false,
      filterable: false,
    })
    expect(page.data).not.toBe(
      valid.pages[0] && valid.pages[0].type === 'data' ? valid.pages[0].data : [],
    )
  })

  it('reports malformed sources, duplicate keys, invalid fields and missing pages', () => {
    const issues = validateAdminSchema({
      nav: [
        { key: 'users', title: 'Users' },
        { key: 'orphan', title: 'Orphan' },
      ],
      pages: [
        {
          type: 'data',
          key: 'users',
          columns: [
            { key: 'role', title: 'Role', type: 'select', options: [] },
            { key: 'role', title: 'Duplicate' },
          ],
        },
        { type: 'custom', key: 'users' },
      ],
    })
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['duplicate-key', 'missing-source', 'invalid-field', 'missing-page']),
    )
    expect(issues.find((issue) => issue.code === 'missing-page')?.severity).toBe('warning')
  })

  it('requires a stable row key for editable server data', () => {
    const issues = validateAdminSchema({
      nav: [{ key: 'users', title: 'Users' }],
      pages: [
        {
          type: 'data',
          key: 'users',
          columns: [{ key: 'name', title: 'Name' }],
          fetcher: async () => ({ rows: [], total: 0 }),
          editable: true,
        },
      ],
    })
    expect(issues.some((issue) => issue.code === 'missing-row-key')).toBe(true)
  })

  it('throws a typed aggregate error only for blocking issues', () => {
    expect(() => assertAdminSchema({ nav: [], pages: [] })).not.toThrow()
    expect(() => assertAdminSchema({ nav: [] })).toThrow(AdminSchemaError)
  })

  it('never throws while inspecting malformed nested input', () => {
    const malformed = {
      nav: [null, { key: 'broken', title: 'Broken', children: 'not-an-array' }],
      pages: [null, { type: 'data', key: 'users' }],
    }
    expect(() => validateAdminSchema(malformed)).not.toThrow()
    expect(
      validateAdminSchema(malformed).filter((issue) => issue.severity === 'error').length,
    ).toBe(4)
  })
})

describe('admin permissions and messages', () => {
  it('supports boolean, single and all-of permission requirements', () => {
    expect(hasAdminPermission(undefined, [])).toBe(true)
    expect(hasAdminPermission(false, ['admin'])).toBe(false)
    expect(hasAdminPermission('users.write', ['users.write'])).toBe(true)
    expect(hasAdminPermission(['users.write', 'users.delete'], ['users.write'])).toBe(false)
  })

  it('resolves per-app override, i18n dictionary and English fallback in order', () => {
    expect(resolveAdminMessage('create', {}, { create: 'Add row' })).toBe('Add row')
    expect(resolveAdminMessage('delete', {}, undefined, () => 'Remove')).toBe('Remove')
    expect(resolveAdminMessage('page', { page: 2, pages: 4 })).toBe('Page 2 of 4')
  })
})
