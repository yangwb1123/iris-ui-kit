import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

enableAutoUnmount(afterEach)

type Row = { id: number; a: string; b: string; c: string }

const rows: Row[] = [{ id: 1, a: 'A', b: 'B', c: 'C' }]
const columns: IrisTableColumn<Row>[] = [
  { key: 'a', title: 'A', width: 100, pinned: 'left' },
  { key: 'b', title: 'B', width: 80 },
  { key: 'c', title: 'C', width: 90, pinned: 'right' },
]

describe('IrisTable controlled pinnedColumns', () => {
  it('uses explicit entries over static pins and keeps absent entries on the static fallback', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, pinnedColumns: { a: null } },
    })

    expect(wrapper.find('[data-iris-table-header="a"]').attributes('data-iris-table-pinned')).toBe(
      undefined,
    )
    expect(wrapper.find('[data-iris-table-header="c"]').attributes('data-iris-table-pinned')).toBe(
      'right',
    )
    expect((columns[0] as IrisTableColumn<Row>).pinned).toBe('left')

    await wrapper.setProps({ pinnedColumns: { b: 'left' } })
    await nextTick()
    expect(wrapper.find('[data-iris-table-header="a"]').attributes('data-iris-table-pinned')).toBe(
      'left',
    )
    expect(wrapper.find('[data-iris-table-header="b"]').attributes('data-iris-table-pinned')).toBe(
      'left',
    )
    expect(wrapper.find('[data-iris-table-header="c"]').attributes('data-iris-table-pinned')).toBe(
      'right',
    )
  })

  it('syncs replacements silently and does not optimistically render a rejected drag', async () => {
    const onPinned = vi.fn()
    const onCount = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        pinnedDrag: true,
        pinnedColumns: { a: 'left' },
        onColumnPinnedChange: onPinned,
        onPinnedCountChange: onCount,
      },
    })

    await wrapper.find('[data-iris-pinned-drag-handle]').trigger('keydown', { key: 'ArrowRight' })
    expect(onPinned).toHaveBeenCalledTimes(1)
    expect(onPinned).toHaveBeenCalledWith('b', 'left')
    expect(onCount).toHaveBeenCalledWith(2)
    expect(wrapper.find('[data-iris-table-header="b"]').attributes('data-iris-table-pinned')).toBe(
      undefined,
    )
    expect(wrapper.find('[data-iris-pinned-drag-handle]').attributes('data-column-key')).toBe('a')

    // A second rejected proposal must start from the unchanged controlled map,
    // not the model state from the first rejected proposal.
    await wrapper.find('[data-iris-pinned-drag-handle]').trigger('keydown', { key: 'ArrowRight' })
    expect(onPinned).toHaveBeenCalledTimes(2)
    expect(onPinned).toHaveBeenLastCalledWith('b', 'left')
    expect(wrapper.find('[data-iris-table-header="b"]').attributes('data-iris-table-pinned')).toBe(
      undefined,
    )

    await wrapper.setProps({ pinnedColumns: { a: 'left', b: 'left' } })
    await nextTick()
    expect(onPinned).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-iris-table-header="b"]').attributes('data-iris-table-pinned')).toBe(
      'left',
    )
    expect(wrapper.find('[data-iris-pinned-drag-handle]').attributes('data-column-key')).toBe('b')
  })

  it('restores static pins when control is removed and drops a rejected model proposal', async () => {
    const onPinned = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        pinnedDrag: true,
        pinnedColumns: { a: 'left' },
        onColumnPinnedChange: onPinned,
      },
    })

    await wrapper.find('[data-iris-pinned-drag-handle]').trigger('keydown', { key: 'ArrowRight' })
    await wrapper.setProps({ pinnedColumns: undefined })
    await nextTick()

    expect(wrapper.find('[data-iris-table-header="a"]').attributes('data-iris-table-pinned')).toBe(
      'left',
    )
    expect(wrapper.find('[data-iris-table-header="b"]').attributes('data-iris-table-pinned')).toBe(
      undefined,
    )
    expect(wrapper.find('[data-iris-pinned-drag-handle]').attributes('data-column-key')).toBe('a')
  })

  it('resolves controlled pins in grouped headers without changing declarations', () => {
    const grouped: IrisTableColumn<Row>[] = [
      {
        key: 'group',
        title: 'Group',
        children: [columns[0]!, columns[1]!],
      },
      columns[2]!,
    ]
    const wrapper = mount(IrisTable, {
      props: { columns: grouped, data: rows, pinnedColumns: { a: null, b: 'left' } },
    })

    expect(wrapper.find('[data-iris-table-header="a"]').attributes('data-iris-table-pinned')).toBe(
      undefined,
    )
    expect(wrapper.find('[data-iris-table-header="b"]').attributes('data-iris-table-pinned')).toBe(
      'left',
    )
    expect(wrapper.find('[data-iris-table-header="c"]').attributes('data-iris-table-pinned')).toBe(
      'right',
    )
    expect(columns[0]!.pinned).toBe('left')
    expect(columns[2]!.pinned).toBe('right')
  })
})
