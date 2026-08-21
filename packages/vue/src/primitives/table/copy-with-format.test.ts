import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
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
  { key: 'amount', title: 'Amount', formatter: (value) => `$${String(value)}` },
]

describe('Vue IrisTable clipConfig.copyWithFormat', () => {
  let writeText: ReturnType<typeof vi.fn>

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard')
  })

  function mountTable(copyFormat?: 'tsv' | 'csv' | 'html') {
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    return mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        cellRange: true,
        clipConfig: { copyWithFormat: true, copyFormat },
      },
    })
  }

  async function selectAndCopy(wrapper: ReturnType<typeof mount>): Promise<void> {
    await wrapper.find('[data-iris-cell-row="0"][data-iris-cell-col="0"]').trigger('click')
    await wrapper.find('[data-iris-cell-row="1"][data-iris-cell-col="1"]').trigger('click', {
      shiftKey: true,
    })
    await wrapper.find('[data-iris-table]').trigger('keydown', { key: 'c', ctrlKey: true })
    await nextTick()
    await Promise.resolve()
  }

  it('copies formatter output through the TSV keyboard path and exposes the same button throat', async () => {
    const wrapper = mountTable()
    await selectAndCopy(wrapper)
    expect(wrapper.find('[data-iris-table-cell="amount"]').text()).toBe('$25')
    expect(writeText).toHaveBeenCalledWith('Alpha\t$25\nBeta\t$32')

    writeText.mockClear()
    await wrapper.find('[data-iris-table-range-copy]').trigger('click')
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith('Alpha\t$25\nBeta\t$32')
  })

  it('applies the mask before formatter and keeps CSV/HTML serializers safe', async () => {
    const maskedColumns: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      {
        key: 'amount',
        title: 'Amount',
        mask: (value) => `masked:${String(value)}`,
        exportRaw: true,
        formatter: (value) => `F:${String(value)}`,
      },
    ]
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mount(IrisTable, {
      props: {
        columns: maskedColumns,
        data: rows,
        rowKey: 'id',
        cellRange: true,
        clipConfig: { copyWithFormat: true, copyFormat: 'csv' },
      },
    })
    await wrapper.find('[data-iris-cell-row="0"][data-iris-cell-col="0"]').trigger('click')
    await wrapper.find('[data-iris-cell-row="0"][data-iris-cell-col="1"]').trigger('click', {
      shiftKey: true,
    })
    await wrapper.find('[data-iris-table]').trigger('keydown', { key: 'c', metaKey: true })
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith('Alpha,F:masked:25')

    const htmlWrapper = mountTable('html')
    await selectAndCopy(htmlWrapper)
    expect(writeText).toHaveBeenCalledWith(
      '<table><thead><tr><th>Name</th><th>Amount</th></tr></thead><tbody>' +
        '<tr><td>Alpha</td><td>$25</td></tr><tr><td>Beta</td><td>$32</td></tr>' +
        '</tbody></table>',
    )
  })

  it('does not copy when there is no live range or copy is disabled', async () => {
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, cellRange: true, clipConfig: { copyWithFormat: true } },
    })
    await wrapper.find('[data-iris-table]').trigger('keydown', { key: 'c', ctrlKey: true })
    expect(writeText).not.toHaveBeenCalled()
    await wrapper.setProps({ clipConfig: { copy: false, copyWithFormat: true } })
    await wrapper.find('[data-iris-cell-row="0"][data-iris-cell-col="0"]').trigger('click')
    await wrapper.find('[data-iris-table]').trigger('keydown', { key: 'c', ctrlKey: true })
    expect(writeText).not.toHaveBeenCalled()
  })
})
