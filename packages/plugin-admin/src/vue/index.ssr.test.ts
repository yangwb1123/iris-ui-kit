// @vitest-environment node
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'
import { IrisAdminApp } from './index'
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

describe('IrisAdminApp (vue) SSR', () => {
  it('uses the server renderer without loading data during render', async () => {
    expect(typeof document).toBe('undefined')
    expect(typeof window).toBe('undefined')

    const html = await renderToString(createSSRApp({ render: () => h(IrisAdminApp, { schema }) }))

    expect(html).toContain('data-iris-admin-data-page="users"')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
