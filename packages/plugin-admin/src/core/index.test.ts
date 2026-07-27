import { describe, it, expect } from 'vitest'
import { runPlugins, type NavNode } from '@iris-ui-kit/core'
import {
  resolveAdminPage,
  adminDataViewColumns,
  firstNavLeafKey,
  adminPlugin,
  adminTokens,
  type AdminAppSchema,
} from './index'

const nav: NavNode[] = [
  { key: 'dash', title: 'Dashboard' },
  { key: 'sys', title: 'System', children: [{ key: 'users', title: 'Users' }] },
]

const schema: AdminAppSchema = {
  title: 'Demo',
  nav,
  pages: [
    {
      type: 'data',
      key: 'users',
      title: 'Users',
      columns: [
        { key: 'name', title: 'Name' },
        { key: 'role', title: 'Role', dataIndex: 'roleName' },
      ],
      data: [{ name: 'Ada', roleName: 'Admin' }],
    },
    { type: 'custom', key: 'dash', title: 'Dashboard' },
  ],
}

describe('plugin-admin core', () => {
  it('resolveAdminPage finds the page by active key', () => {
    expect(resolveAdminPage(schema, 'users')?.type).toBe('data')
    expect(resolveAdminPage(schema, 'dash')?.type).toBe('custom')
    expect(resolveAdminPage(schema, 'missing')).toBeUndefined()
    expect(resolveAdminPage(schema, null)).toBeUndefined()
  })

  it('adminDataViewColumns maps key + dataIndex to value accessors', () => {
    const cols = adminDataViewColumns([
      { key: 'name', title: 'Name' },
      { key: 'role', title: 'Role', dataIndex: 'roleName' },
    ])
    const row = { name: 'Ada', roleName: 'Admin' }
    expect(cols.map((c) => c.getValue(row))).toEqual(['Ada', 'Admin'])
  })

  it('firstNavLeafKey resolves a branch to its first leaf', () => {
    expect(firstNavLeafKey(nav)).toBe('dash')
    expect(
      firstNavLeafKey([{ key: 'sys', title: 'System', children: [{ key: 'a', title: 'A' }] }]),
    ).toBe('a')
    expect(firstNavLeafKey([])).toBeUndefined()
  })

  it('adminPlugin registers its tokens', () => {
    const { tokens, messages } = runPlugins([adminPlugin])
    expect(tokens['--iris-admin-page-gap']).toBe(adminTokens['--iris-admin-page-gap'])
    expect(messages['en-US']?.['admin.create']).toBe('Create')
  })
})
