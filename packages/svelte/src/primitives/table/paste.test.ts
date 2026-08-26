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
  { key: 'amount', title: 'Amount' },
]

describe('Svelte IrisTable clipboard paste', () => {
  it('reads text in the adapter and commits the range through Grid Core', async () => {
    const readText = vi.fn().mockResolvedValue('Grace\t40\nHeidi\t41')
    const onDataChange = vi.fn()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText },
    })
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        cellRange: true,
        clipConfig: { paste: true },
        onDataChange,
      },
    })

    fireEvent.click(
      view.container.querySelector('[data-iris-cell-row="0"][data-iris-cell-col="0"]')!,
    )
    fireEvent.keyDown(view.container.querySelector('[data-iris-table]')!, {
      key: 'v',
      ctrlKey: true,
    })

    await waitFor(() => expect(onDataChange).toHaveBeenCalledTimes(1))
    expect(readText).toHaveBeenCalledTimes(1)
    expect(onDataChange).toHaveBeenCalledWith([
      { id: 1, name: 'Grace', amount: '40' },
      { id: 2, name: 'Heidi', amount: '41' },
    ])
  })

  it('does not read or commit when paste is disabled or targets a formula column', async () => {
    const readText = vi.fn().mockResolvedValue('999')
    const onDataChange = vi.fn()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText },
    })
    const view = render(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'total', title: 'Total', formula: 'amount * 2' },
        ],
        data: rows,
        rowKey: 'id',
        cellRange: true,
        clipConfig: { paste: false },
        onDataChange,
      },
    })

    fireEvent.click(
      view.container.querySelector('[data-iris-cell-row="0"][data-iris-cell-col="1"]')!,
    )
    fireEvent.keyDown(view.container.querySelector('[data-iris-table]')!, {
      key: 'v',
      ctrlKey: true,
    })

    await Promise.resolve()
    expect(readText).not.toHaveBeenCalled()
    expect(onDataChange).not.toHaveBeenCalled()
  })
})
