import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { setFileSaveHandler } from '@iris-ui/core'
import { downloadCsv } from './exportCsv'
import { downloadExcel } from './exportExcel'

const BOM = String.fromCharCode(0xfeff)

describe('@iris-ui/react table download → file-save handler', () => {
  beforeEach(() => {
    // jsdom doesn't implement these; stub so the browser-download path is observable.
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => setFileSaveHandler(null))

  it('downloadCsv routes to the host handler and skips the browser download', async () => {
    const handler = vi.fn()
    setFileSaveHandler(handler)
    await downloadCsv('data.csv', 'a,b\n1,2')
    expect(handler).toHaveBeenCalledWith({
      filename: 'data.csv',
      content: `${BOM}a,b\n1,2`,
      mimeType: 'text/csv;charset=utf-8;',
    })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('downloadCsv falls through to the browser download when the handler declines', async () => {
    setFileSaveHandler(() => false)
    await downloadCsv('data.csv', 'a,b')
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('downloadExcel routes to the host handler and skips the browser download', async () => {
    const handler = vi.fn()
    setFileSaveHandler(handler)
    await downloadExcel('data.xls', '<xml/>')
    expect(handler).toHaveBeenCalledWith({
      filename: 'data.xls',
      content: '<xml/>',
      mimeType: 'application/vnd.ms-excel',
    })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('downloadExcel falls through to the browser download with no handler', async () => {
    await downloadExcel('data.xls', '<xml/>')
    expect(URL.createObjectURL).toHaveBeenCalled()
  })
})
