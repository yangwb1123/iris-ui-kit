import { describe, expect, it } from 'vitest'
import { renderToString } from 'solid-js/web'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]
const rows: Row[] = [{ id: 1, name: 'Charlie' }]

function renderTable(): string {
  return renderToString(() => (
    <IrisTable columns={columns} data={rows} rowKey="id" searchHighlight="li" />
  ))
}

describe('Solid IrisTable searchHighlight SSR', () => {
  it('renders the expected mark deterministically without browser setup', () => {
    const first = renderTable()
    const second = renderTable()

    expect(first).toBe(second)
    expect(first).toContain('data-iris-search-hit')
    expect(first).toContain('>li</mark>')
  })
})
