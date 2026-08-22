// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import * as React from 'react'
import { IrisTable, decodeUrlTableState, readUrlTableState, writeUrlTableState } from '../Table'
import type { IrisTableColumn } from '../types'

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'city', title: 'City', sortable: true },
]
const rows: Row[] = [{ id: 1, name: 'A', city: 'Paris' }]

describe('@iris-ui-kit/react IrisTable urlState (batch DV) — node env', () => {
  it('renderToString with urlState is a strict no-op (no window on the server)', () => {
    const html = renderToString(<IrisTable columns={columns} data={rows} rowKey="id" urlState />)
    expect(html).toContain('data-iris-table')
    // The render must not have touched the URL — helpers are window-guarded.
    expect(typeof window).toBe('undefined')
  })

  it('readUrlTableState returns null and writeUrlTableState is a no-op without window', () => {
    expect(readUrlTableState()).toBeNull()
    expect(() => writeUrlTableState('{"v":1,"page":2}')).not.toThrow()
    expect(() => writeUrlTableState(null)).not.toThrow()
  })

  it('decodeUrlTableState round-trips the full payload (pure codec, no DOM)', () => {
    const payload = {
      v: 1 as const,
      sort: { key: 'name', direction: 'asc' as const },
      filters: { name: 'ali' },
      filterValues: { city: ['北京, 上海', 'a&b=c?d#e'] },
      page: 3,
      pageSize: 20,
    }
    const decoded = decodeUrlTableState(JSON.stringify(payload))
    expect(decoded).toEqual(payload)
  })

  it('decodeUrlTableState is whole-state fail-closed on any violation', () => {
    for (const bad of [
      'corrupt',
      '{"v":2,"sort":{"key":"name","direction":"asc"}}',
      '{"v":1,"sort":null,"sorts":null}', // sorts must be a list
      '{"v":1,"filterValues":{"city":[1]}}', // non-string filter value
      '{"v":1,"page":0,"pageSize":10}', // page must be ≥ 1
      '{"v":1,"pageSize":2.5}', // pageSize must be an integer
      '[]', // not an object
    ]) {
      expect(decodeUrlTableState(bad), `payload ${bad}`).toBeNull()
    }
  })

  it('decodeUrlTableState rejects an object literal without a schema version', () => {
    const decoded = decodeUrlTableState('{"sort":{"key":"name","direction":"asc"}}')
    expect(decoded).toBeNull()
  })
})
