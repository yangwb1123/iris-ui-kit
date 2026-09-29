// @vitest-environment node
import { render } from 'svelte/server'
import { describe, expect, it, vi } from 'vitest'
import IrisAdminApp from './IrisAdminApp.svelte'
import type { AdminAppSchema } from '../core'

const fetcher = vi.fn(async () => ({
  rows: [{ id: 1, name: 'Ada' }],
  total: 1,
}))

const schema: AdminAppSchema = {
  nav: [{ key: 'users', title: 'Users' }],
  pages: [
    {
      type: 'data',
      key: 'users',
      title: 'Users',
      rowKey: 'id',
      columns: [{ key: 'name', title: 'Name' }],
      fetcher,
    },
  ],
}

describe('IrisAdminApp (svelte) SSR', () => {
  it('uses the server renderer without loading data during render', () => {
    expect(typeof document).toBe('undefined')
    expect(typeof window).toBe('undefined')

    const { body } = render(IrisAdminApp, { props: { schema } })

    expect(body).toContain('data-iris-admin-data-page="users"')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
