import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

enableAutoUnmount(afterEach)

type Row = { id: number; a: string; b: string; c: string }
const rows: Row[] = [{ id: 1, a: 'A', b: 'B', c: 'C' }]
const columns: IrisTableColumn<Row>[] = [
  { key: 'a', title: 'A', pinned: 'left' },
  { key: 'b', title: 'B' },
  { key: 'c', title: 'C' },
]

describe('IrisTable pinned boundary drag', () => {
  it('renders one boundary handle only when a leading left pin exists', () => {
    const wrapper = mount(IrisTable, { props: { columns, data: rows, pinnedDrag: true } })
    const handle = wrapper.find('[data-iris-pinned-drag-handle]')
    expect(handle.exists()).toBe(true)
    expect(handle.attributes('data-column-key')).toBe('a')
    expect(handle.attributes('role')).toBe('separator')
    expect(handle.find('[data-iris-pinned-drag-line]').exists()).toBe(true)
    expect(wrapper.findAll('[data-iris-table-resize-handle]')).toHaveLength(0)
  })

  it('uses keyboard steps to emit changed columns and the final count', async () => {
    const onPinned = vi.fn()
    const onCount = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        pinnedDrag: true,
        resizableColumns: true,
        onColumnPinnedChange: onPinned,
        onPinnedCountChange: onCount,
      },
    })
    await wrapper.find('[data-iris-pinned-drag-handle]').trigger('keydown', { key: 'ArrowRight' })
    expect(onPinned).toHaveBeenCalledWith('b', 'left')
    expect(onCount).toHaveBeenCalledWith(2)
    expect(wrapper.find('[data-iris-table-resize-handle][data-column-key="a"]').exists()).toBe(
      false,
    )
    expect(wrapper.find('[data-iris-table-resize-handle][data-column-key="b"]').exists()).toBe(true)
  })

  it('fails closed without a left-pinned boundary', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: columns.map(({ pinned: _pinned, ...column }) => column),
        data: rows,
        pinnedDrag: true,
      },
    })
    expect(wrapper.find('[data-iris-pinned-drag-handle]').exists()).toBe(false)
  })
})
