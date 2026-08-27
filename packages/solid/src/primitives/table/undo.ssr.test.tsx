// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { renderToString } from 'solid-js/web'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]
const rows: Row[] = [{ id: 1, name: 'Alpha' }]

describe('Solid IrisTable undo/redo SSR', () => {
  it('renders enabled controls disabled without browser globals', () => {
    const html = renderToString(() => <IrisTable columns={columns} data={rows} rowKey="id" undo />)
    expect(html).toContain('data-iris-table-undo')
    expect(html).toContain('data-iris-table-redo')
    expect(html).toContain('disabled')
    expect(typeof document).toBe('undefined')
  })
})
