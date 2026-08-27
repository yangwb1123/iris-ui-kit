import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

enableAutoUnmount(afterEach)

type Row = { id: number; a: string; b: number; c: string }

const rows: Row[] = [{ id: 1, a: 'A', b: 2, c: 'C' }]
const columns: IrisTableColumn<Row>[] = [
  { key: 'a', title: 'A' },
  { key: 'b', title: 'B', summary: 'sum' },
  { key: 'c', title: 'C' },
]

const headerKeys = (wrapper: ReturnType<typeof mount>): string[] =>
  wrapper
    .findAll('[data-iris-table-header]')
    .map((cell) => cell.attributes('data-iris-table-header'))

const firstBodyCellKeys = (wrapper: ReturnType<typeof mount>): string[] =>
  wrapper
    .find('[data-iris-table-row-key]')
    .findAll('[data-iris-table-cell]')
    .map((cell) => cell.attributes('data-iris-table-cell'))

function pointerEvent(type: string, clientX: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { button: 0, clientX, clientY: 0, pointerId: 1 })
  return event
}

function stubHeaderRects(wrapper: ReturnType<typeof mount>): void {
  wrapper.findAll('[data-iris-table-header]').forEach((header, index) => {
    vi.spyOn(header.element, 'getBoundingClientRect').mockReturnValue({
      left: index * 100,
      top: 0,
      width: 100,
      height: 40,
      right: (index + 1) * 100,
      bottom: 40,
      x: index * 100,
      y: 0,
      toJSON: () => ({}),
    })
  })
}

describe('IrisTable columnOrder Grid Core bridge', () => {
  it('projects known order keys, ignores unknown/duplicate keys, and leaves source columns untouched', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnOrder: ['c', 'unknown', 'c', 'a'],
      },
    })

    expect(headerKeys(wrapper)).toEqual(['c', 'a', 'b'])
    expect(firstBodyCellKeys(wrapper)).toEqual(['c', 'a', 'b'])
    expect(columns.map((column) => column.key)).toEqual(['a', 'b', 'c'])
    expect(
      wrapper.findAll('[data-iris-table-summary-cell]')[0]?.attributes('data-iris-table-cell'),
    ).toBe('b')
  })

  it('keeps controlled order authoritative, syncs replacements silently, and restores source order on empty/remove', async () => {
    const order = ref<string[] | undefined>(['c'])
    const updates: Array<string[] | undefined> = []
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisTable, {
            columns,
            data: rows,
            rowKey: 'id',
            columnOrder: order.value,
            'onUpdate:columnOrder': (next: string[] | undefined) => updates.push(next),
          })
      },
    })
    const wrapper = mount(Harness)

    expect(headerKeys(wrapper)).toEqual(['c', 'a', 'b'])
    order.value = ['b', 'a']
    await nextTick()
    expect(headerKeys(wrapper)).toEqual(['b', 'a', 'c'])
    order.value = []
    await nextTick()
    expect(headerKeys(wrapper)).toEqual(['a', 'b', 'c'])
    order.value = ['c']
    await nextTick()
    expect(headerKeys(wrapper)).toEqual(['c', 'a', 'b'])
    order.value = undefined
    await nextTick()
    expect(headerKeys(wrapper)).toEqual(['a', 'b', 'c'])
    expect(updates).toEqual([])
  })

  it('keeps omitted order parent-owned when a no-op drag callback rejects the reorder', async () => {
    const onReorder = vi.fn()
    const onOrder = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnDrag: { onReorder },
        'onUpdate:columnOrder': onOrder,
      },
    })
    stubHeaderRects(wrapper)
    const root = wrapper.element

    wrapper
      .find('[data-iris-table-header="a"]')
      .element.dispatchEvent(pointerEvent('pointerdown', 10))
    root.dispatchEvent(pointerEvent('pointermove', 250))
    root.dispatchEvent(pointerEvent('pointerup', 250))
    await nextTick()

    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onReorder.mock.calls[0]?.[0].map((column: IrisTableColumn<Row>) => column.key)).toEqual([
      'b',
      'c',
      'a',
    ])
    expect(onOrder).not.toHaveBeenCalled()
    expect(headerKeys(wrapper)).toEqual(['a', 'b', 'c'])

    // Re-feeding the source columns must keep the parent's source order; a
    // rejected drag must not leave a stale Core proposal behind.
    await wrapper.setProps({ columns: [...columns] })
    expect(headerKeys(wrapper)).toEqual(['a', 'b', 'c'])
  })

  it('orders grouped top-level columns while preserving each group and its leaf order', () => {
    const groupedColumns: IrisTableColumn<Row>[] = [
      {
        key: 'first',
        title: 'First',
        children: [
          { key: 'a', title: 'A' },
          { key: 'b', title: 'B' },
        ],
      },
      { key: 'last', title: 'Last', children: [{ key: 'c', title: 'C' }] },
    ]
    const wrapper = mount(IrisTable, {
      props: {
        columns: groupedColumns,
        data: rows,
        rowKey: 'id',
        columnOrder: ['last', 'missing', 'last', 'first'],
      },
    })

    expect(headerKeys(wrapper).slice(0, 2)).toEqual(['last', 'first'])
    expect(firstBodyCellKeys(wrapper)).toEqual(['c', 'a', 'b'])
    expect(groupedColumns.map((column) => column.key)).toEqual(['first', 'last'])
    expect(groupedColumns[0]?.children?.map((column) => column.key)).toEqual(['a', 'b'])
  })

  it('emits one flat-drag order proposal without optimistic rendering when the parent rejects it', async () => {
    const onReorder = vi.fn()
    const onOrder = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnOrder: ['a', 'b', 'c'],
        columnDrag: { onReorder },
        'onUpdate:columnOrder': onOrder,
      },
    })
    stubHeaderRects(wrapper)
    const root = wrapper.element

    wrapper
      .find('[data-iris-table-header="a"]')
      .element.dispatchEvent(pointerEvent('pointerdown', 10))
    root.dispatchEvent(pointerEvent('pointermove', 250))
    root.dispatchEvent(pointerEvent('pointerup', 250))
    await nextTick()

    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onReorder.mock.calls[0]?.[0].map((column: IrisTableColumn<Row>) => column.key)).toEqual([
      'b',
      'c',
      'a',
    ])
    expect(onOrder).toHaveBeenCalledTimes(1)
    expect(onOrder).toHaveBeenCalledWith(['b', 'c', 'a'])
    expect(headerKeys(wrapper)).toEqual(['a', 'b', 'c'])

    // Removing the controlled prop must clear the rejected proposal before
    // rendering, rather than leaking the model's stale order.
    await wrapper.setProps({ columnOrder: undefined })
    await nextTick()
    expect(headerKeys(wrapper)).toEqual(['a', 'b', 'c'])
  })
})
