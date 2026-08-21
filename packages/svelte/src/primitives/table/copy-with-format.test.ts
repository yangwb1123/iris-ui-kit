import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'clipboard')
})

const rows = [
  { id: 1, name: 'Alpha', amount: 25 },
  { id: 2, name: 'Beta', amount: 32 },
]
const columns = [
  { key: 'name', title: 'Name' },
  { key: 'amount', title: 'Amount', formatter: (value: unknown) => `$${String(value)}` },
]

describe('Svelte IrisTable clipConfig.copyWithFormat', () => {
  function renderTable(copyFormat?: 'tsv' | 'csv' | 'html') {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const rendered = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        cellRange: true,
        clipConfig: { copyWithFormat: true, copyFormat },
      },
    })
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

  it('copies formatter output and exposes the same range-copy button', async () => {
    const { container, writeText } = renderTable()
    await selectRange(container)
    expect(container.querySelector('[data-iris-table-cell="amount"]')?.textContent?.trim()).toBe(
      '$25',
    )
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Alpha\t$25\nBeta\t$32'))

    writeText.mockClear()
    fireEvent.click(container.querySelector('[data-iris-table-range-copy]')!)
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Alpha\t$25\nBeta\t$32'))
  })

  it('applies mask before formatter and supports CSV/HTML formats', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const masked = [
      { key: 'name', title: 'Name' },
      {
        key: 'amount',
        title: 'Amount',
        mask: (value: unknown) => `masked:${String(value)}`,
        exportRaw: true,
        formatter: (value: unknown) => `F:${String(value)}`,
      },
    ]
    const { container } = render(IrisTable, {
      props: {
        columns: masked,
        data: rows,
        rowKey: 'id',
        cellRange: true,
        clipConfig: { copyWithFormat: true, copyFormat: 'csv' },
      },
    })
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

  it('does nothing without a live range', async () => {
    const { container, writeText } = renderTable()
    fireEvent.keyDown(container.querySelector('[data-iris-table]')!, { key: 'c', ctrlKey: true })
    await Promise.resolve()
    expect(writeText).not.toHaveBeenCalled()
  })
})
