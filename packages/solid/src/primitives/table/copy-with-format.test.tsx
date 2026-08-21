import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'clipboard')
})

type Row = { id: number; name: string; amount: number }
const rows: Row[] = [
  { id: 1, name: 'Alpha', amount: 25 },
  { id: 2, name: 'Beta', amount: 32 },
]
const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'amount', title: 'Amount', formatter: (value) => `$${String(value)}` },
]

describe('Solid IrisTable clipConfig.copyWithFormat', () => {
  function renderTable(copyFormat?: 'tsv' | 'csv' | 'html') {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const rendered = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyWithFormat: true, copyFormat }}
      />
    ))
    return { ...rendered, writeText }
  }

  async function selectRange(container: HTMLElement): Promise<void> {
    fireEvent.click(container.querySelector('[data-iris-cell-row="0"][data-iris-cell-col="0"]')!)
    fireEvent.click(container.querySelector('[data-iris-cell-row="1"][data-iris-cell-col="1"]')!, {
      shiftKey: true,
    })
    fireEvent.keyDown(container.querySelector('[data-iris-table]')!, { key: 'c', ctrlKey: true })
    await Promise.resolve()
  }

  it('copies formatted text from the keyboard and range button', async () => {
    const { container, writeText } = renderTable()
    await selectRange(container)
    expect(container.querySelector('[data-iris-table-cell="amount"]')?.textContent).toBe('$25')
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Alpha\t$25\nBeta\t$32'))

    writeText.mockClear()
    fireEvent.click(container.querySelector('[data-iris-table-range-copy]')!)
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Alpha\t$25\nBeta\t$32'))
  })

  it('keeps a mask before the formatter and supports CSV/HTML output', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const masked: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      {
        key: 'amount',
        title: 'Amount',
        mask: (value) => `masked:${String(value)}`,
        exportRaw: true,
        formatter: (value) => `F:${String(value)}`,
      },
    ]
    const { container } = render(() => (
      <IrisTable
        columns={masked}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyWithFormat: true, copyFormat: 'csv' }}
      />
    ))
    fireEvent.click(container.querySelector('[data-iris-cell-row="0"][data-iris-cell-col="0"]')!)
    fireEvent.click(container.querySelector('[data-iris-cell-row="0"][data-iris-cell-col="1"]')!, {
      shiftKey: true,
    })
    fireEvent.keyDown(container.querySelector('[data-iris-table]')!, { key: 'c', metaKey: true })
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Alpha,F:masked:25'))

    cleanup()
    const html = renderTable('html')
    await selectRange(html.container)
    await waitFor(() =>
      expect(html.writeText).toHaveBeenCalledWith(
        '<table><thead><tr><th>Name</th><th>Amount</th></tr></thead><tbody>' +
          '<tr><td>Alpha</td><td>$25</td></tr><tr><td>Beta</td><td>$32</td></tr>' +
          '</tbody></table>',
      ),
    )
  })

  it('requires a live range and honors copy:false', async () => {
    const { container, writeText } = renderTable()
    fireEvent.keyDown(container.querySelector('[data-iris-table]')!, { key: 'c', ctrlKey: true })
    expect(writeText).not.toHaveBeenCalled()
  })
})
