import { afterEach, describe, expect, it, vi } from 'vitest'
import { setFileSaveHandler } from '@iris-ui-kit/core'
import { downloadCsv, exportCsv } from './exportCsv'
import { downloadExcel, exportExcel } from './exportExcel'

const rows = [{ name: 'Ada', score: 42 }]
const columns = [
  { key: 'name', title: 'Name' },
  { key: 'score', title: 'Score' },
]

afterEach(() => setFileSaveHandler(null))

describe('Svelte table exports', () => {
  it('shares the safe CSV and SpreadsheetML serializers', () => {
    expect(exportCsv(rows, columns)).toBe('Name,Score\nAda,42')
    expect(exportExcel(rows, columns)).toContain('<Data ss:Type="Number">42</Data>')
  })

  it('routes CSV and Excel downloads through the native host bridge', async () => {
    const handler = vi.fn()
    setFileSaveHandler(handler)
    await downloadCsv('data.csv', 'Name\nAda')
    await downloadExcel('data.xls', '<xml/>')
    expect(handler).toHaveBeenNthCalledWith(1, {
      filename: 'data.csv',
      content: `${String.fromCharCode(0xfeff)}Name\nAda`,
      mimeType: 'text/csv;charset=utf-8;',
    })
    expect(handler).toHaveBeenNthCalledWith(2, {
      filename: 'data.xls',
      content: '<xml/>',
      mimeType: 'application/vnd.ms-excel;charset=utf-8',
    })
  })
})
