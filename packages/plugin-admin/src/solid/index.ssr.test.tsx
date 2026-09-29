// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createAdminDataController } from '../core'
import type { AdminAppSchema } from '../core'
import { onCleanup, onMount } from 'solid-js/dist/server.js'
import { renderToString } from 'solid-js/web/dist/server.js'

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

describe('IrisAdminApp (solid) SSR', () => {
  // The plugin-admin Solid config intentionally uses the client compiler, so a
  // real AdminDataPage import touches browser templates even in a node test.
  // Exercise the same server lifecycle with Solid's direct server entries here;
  // the client integration suite covers the actual AdminDataPage renderer.
  it('uses Solid server rendering without loading data during render', () => {
    expect(typeof document).toBe('undefined')
    expect(typeof window).toBe('undefined')

    const html = renderToString(() => {
      const page = schema.pages[0]
      if (page?.type !== 'data') throw new Error('Expected a data page')
      const controller = createAdminDataController(page, { immediate: false })
      onMount(() => void controller.resource.load())
      onCleanup(controller.destroy)
      return 'admin-data-page'
    })

    expect(html).toContain('admin-data-page')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
