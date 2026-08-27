// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { renderToString } from 'solid-js/web'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', width: 100 },
  { key: 'age', title: 'Age', width: 120 },
]
const data: Row[] = [{ id: 1, name: 'Alice', age: 25 }]

function renderTable(): string {
  return renderToString(() => (
    <IrisTable
      columns={columns}
      data={data}
      rowKey="id"
      columnVisibility={{ age: false }}
      columnFade
    />
  ))
}

describe('Solid IrisTable columnFade SSR safety', () => {
  it('keeps the animation overlay inert and the initial hidden state stable', () => {
    const html = renderTable()
    expect(html).toContain('data-iris-table')
    expect(html).not.toContain('data-iris-column-fade-active')
    expect(html).not.toContain('data-iris-column-fade=')
    expect(html).not.toContain('>Age<')
    expect(html).toBe(renderTable())
  })
})
