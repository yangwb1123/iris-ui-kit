// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import * as React from 'react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]
const rows: Row[] = [{ id: 1, name: 'A' }]

describe('@iris-ui-kit/react IrisTable persistState SSR guard (batch AG)', () => {
  it('renderToString never touches storage (window guard)', () => {
    const getItem = vi.fn(() => '{"sort":{"key":"name","direction":"asc"}}')
    const setItem = vi.fn()
    // jsdom-less node env: no window / no localStorage — the parse is a
    // strict no-op and effects never run server-side.
    const html = renderToString(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        persistState={{ storage: { getItem, setItem } }}
      />,
    )
    expect(html).toContain('data-iris-table')
    expect(getItem).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
  })
})
