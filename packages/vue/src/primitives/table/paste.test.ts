import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

enableAutoUnmount(afterEach)

type Row = { id: number; name: string; amount: number }
const rows: Row[] = [
  { id: 1, name: 'Alpha', amount: 25 },
  { id: 2, name: 'Beta', amount: 32 },
]
const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'amount', title: 'Amount' },
]

describe('Vue IrisTable clipboard paste', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard')
  })

  it('reads text in the adapter and commits the range through Grid Core', async () => {
    const readText = vi.fn().mockResolvedValue('Grace\t40\nHeidi\t41')
    const onDataChange = vi.fn()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText },
    })
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        cellRange: true,
        clipConfig: { paste: true },
        onDataChange,
      },
    })

    await wrapper.find('[data-iris-cell-row="0"][data-iris-cell-col="0"]').trigger('click')
    await wrapper.find('[data-iris-table]').trigger('keydown', { key: 'v', ctrlKey: true })
    await flushPromises()

    expect(readText).toHaveBeenCalledTimes(1)
    expect(onDataChange).toHaveBeenCalledTimes(1)
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
    const wrapper = mount(IrisTable, {
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

    await wrapper.find('[data-iris-cell-row="0"][data-iris-cell-col="1"]').trigger('click')
    await wrapper.find('[data-iris-table]').trigger('keydown', { key: 'v', ctrlKey: true })
    await flushPromises()

    expect(readText).not.toHaveBeenCalled()
    expect(onDataChange).not.toHaveBeenCalled()
  })
})
