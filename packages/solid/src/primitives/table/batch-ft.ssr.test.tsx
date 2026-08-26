import { describe, expect, it } from 'vitest'
import { renderToString } from 'solid-js/web'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]

// This file runs under vitest.ssr.config.ts. Browser-only listener setup lives
// in an effect and the threshold-dependent control is therefore absent from
// the server output, keeping the initial client tree hydration-safe.
describe('Solid IrisTable scrollToTop SSR (batch FT)', () => {
  it('does not render browser-only back-to-top nodes during SSR', () => {
    const html = renderToString(() => (
      <IrisTable
        columns={columns}
        data={[{ id: 1, name: 'Alpha' }]}
        rowKey="id"
        scrollToTop
        virtualScroll={{ height: 160, itemHeight: 40 }}
      />
    ))

    expect(html).not.toContain('data-iris-back-top-table')
    expect(html).not.toContain('data-iris-back-top-anchor')
  })
})
