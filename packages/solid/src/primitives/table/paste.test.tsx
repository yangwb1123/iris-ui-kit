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
  { key: 'amount', title: 'Amount' },
]

describe('Solid IrisTable clipboard paste', () => {
  it('reads text in the adapter and commits the range through Grid Core', async () => {
    const readText = vi.fn().mockResolvedValue('Grace\t40\nHeidi\t41')
    const onDataChange = vi.fn()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText },
    })
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ paste: true }}
        onDataChange={onDataChange}
      />
    ))

    fireEvent.click(container.querySelector('[data-iris-cell-row="0"][data-iris-cell-col="0"]')!)
    fireEvent.keyDown(container.querySelector('[data-iris-table]')!, { key: 'v', ctrlKey: true })

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
    const { container } = render(() => (
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'total', title: 'Total', formula: 'amount * 2' },
        ]}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ paste: false }}
        onDataChange={onDataChange}
      />
    ))

    fireEvent.click(container.querySelector('[data-iris-cell-row="0"][data-iris-cell-col="1"]')!)
    fireEvent.keyDown(container.querySelector('[data-iris-table]')!, { key: 'v', ctrlKey: true })

    await Promise.resolve()
    expect(readText).not.toHaveBeenCalled()
    expect(onDataChange).not.toHaveBeenCalled()
  })
})
