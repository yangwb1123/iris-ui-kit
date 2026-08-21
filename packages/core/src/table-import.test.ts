import { describe, expect, it } from 'vitest'
import { previewColumnsFromRows, rowsFromCsv } from './table-import'

describe('table import helpers', () => {
  it('maps RFC-4180 records to header-keyed rows', () => {
    expect(rowsFromCsv('Name,Note\nAda,"a,b"\nBob,"line 1\nline 2"')).toEqual([
      { Name: 'Ada', Note: 'a,b' },
      { Name: 'Bob', Note: 'line 1\nline 2' },
    ])
  })

  it('fails closed for empty/header-only payloads and preserves missing cells', () => {
    expect(rowsFromCsv('')).toEqual([])
    expect(rowsFromCsv('Name,Score\nAda')).toEqual([{ Name: 'Ada', Score: '' }])
    expect(rowsFromCsv('Name,Score')).toEqual([])
  })

  it('returns first-row key order for the preview', () => {
    const rows = rowsFromCsv('b,a\n2,1')
    expect(previewColumnsFromRows(rows)).toEqual(['b', 'a'])
    expect(previewColumnsFromRows(null)).toEqual([])
  })
})
