import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTableColumnWidths } from './types'

enableAutoUnmount(afterEach)

type Row = { id: number; name: string; age: number; status: string }

const rows: Row[] = [
  { id: 1, name: 'Alice', age: 32, status: 'active' },
  { id: 2, name: 'Bob', age: 28, status: 'paused' },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', width: 200 },
  { key: 'age', title: 'Age', width: '96px', summary: 'sum' },
  { key: 'status', title: 'Status' },
]

function headerStyle(wrapper: ReturnType<typeof mount>): string {
  return wrapper.find('[data-iris-table-header-row]').attributes('style') ?? ''
}

function pointerEvent(type: string, clientX: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { button: 0, clientX, clientY: 0, pointerId: 1 })
  return event
}

describe('IrisTable Grid Core columns bridge', () => {
  it('seeds numeric, px, and fallback widths without an update event', () => {
    const onWidthsChange = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        resizableColumns: true,
        'onUpdate:columnWidths': onWidthsChange,
      },
    })

    expect(headerStyle(wrapper)).toContain('200px 96px 140px')
    expect(onWidthsChange).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:columnWidths')).toBeUndefined()
  })

  it('uses the model for uncontrolled keyboard resize and emits one complete map', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', resizableColumns: true },
    })
    const before = headerStyle(wrapper)

    await wrapper
      .find('[data-iris-table-resize-handle][data-column-key="name"]')
      .trigger('keydown', {
        key: 'ArrowRight',
      })
    await nextTick()

    expect(headerStyle(wrapper)).not.toBe(before)
    expect(headerStyle(wrapper)).toContain('216px 96px 140px')
    expect(wrapper.emitted('update:columnWidths')).toEqual([[{ name: 216, age: 96, status: 140 }]])
  })

  it('uses the model-backed map for uncontrolled pointer resize', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', resizableColumns: true },
    })
    await nextTick()
    const handle = wrapper.find('[data-iris-table-resize-handle][data-column-key="name"]')
    handle.element.dispatchEvent(pointerEvent('pointerdown', 0))
    handle.element.dispatchEvent(pointerEvent('pointermove', 12))
    handle.element.dispatchEvent(pointerEvent('pointerup', 12))
    await nextTick()

    expect(wrapper.emitted('update:columnWidths')).toEqual([[{ name: 212, age: 96, status: 140 }]])
    expect(headerStyle(wrapper)).toContain('212px 96px 140px')
  })

  it('keeps controlled widths authoritative while syncing replacements silently', async () => {
    const onWidthsChange = vi.fn()
    const onVisibilityChange = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnWidths: { name: 150, age: 80 },
        columnVisibility: { age: false },
        'onUpdate:columnWidths': onWidthsChange,
        'onUpdate:columnVisibility': onVisibilityChange,
      },
    })

    expect(headerStyle(wrapper)).toContain('150px 140px')
    expect(wrapper.find('[data-iris-table-header="age"]').exists()).toBe(false)
    expect(onWidthsChange).not.toHaveBeenCalled()
    expect(onVisibilityChange).not.toHaveBeenCalled()

    await wrapper.setProps({
      columnWidths: { name: 170, age: 90 },
      columnVisibility: { name: false },
    })
    await nextTick()
    expect(headerStyle(wrapper)).toContain('90px 140px')
    expect(wrapper.find('[data-iris-table-header="name"]').exists()).toBe(false)
    expect(wrapper.find('[data-iris-table-header="age"]').exists()).toBe(true)
    expect(onWidthsChange).not.toHaveBeenCalled()
    expect(onVisibilityChange).not.toHaveBeenCalled()

    // The visibility channel is controlled-only for this adapter: unsetting
    // it restores all columns instead of exposing the model's old map.
    await wrapper.setProps({ columnVisibility: undefined })
    await nextTick()
    expect(wrapper.find('[data-iris-table-header="name"]').exists()).toBe(true)
    expect(wrapper.find('[data-iris-table-header="age"]').exists()).toBe(true)
  })

  it('does not optimistically render a rejected controlled resize', async () => {
    const widths = ref<IrisTableColumnWidths>({ name: 150, age: 80 })
    const proposals: IrisTableColumnWidths[] = []
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisTable, {
            columns,
            data: rows,
            rowKey: 'id',
            columnWidths: widths.value,
            resizableColumns: true,
            'onUpdate:columnWidths': (next: IrisTableColumnWidths) => proposals.push(next),
          })
      },
    })
    const wrapper = mount(Harness)
    const table = wrapper.findComponent(IrisTable)

    await table
      .find('[data-iris-table-resize-handle][data-column-key="name"]')
      .trigger('keydown', { key: 'ArrowRight' })
    await nextTick()

    expect(proposals).toEqual([{ name: 166, age: 80 }])
    expect(headerStyle(wrapper)).toContain('150px 80px')
  })

  it('renders an accepted controlled resize once and does not emit on re-sync', async () => {
    const widths = ref<IrisTableColumnWidths>({ name: 150, age: 80 })
    const proposals: IrisTableColumnWidths[] = []
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisTable, {
            columns,
            data: rows,
            rowKey: 'id',
            columnWidths: widths.value,
            resizableColumns: true,
            'onUpdate:columnWidths': (next: IrisTableColumnWidths) => {
              proposals.push(next)
              widths.value = next
            },
          })
      },
    })
    const wrapper = mount(Harness)

    await wrapper
      .find('[data-iris-table-resize-handle][data-column-key="name"]')
      .trigger('keydown', { key: 'ArrowRight' })
    await nextTick()

    expect(proposals).toEqual([{ name: 166, age: 80 }])
    expect(headerStyle(wrapper)).toContain('166px 80px')
  })

  it('silently adopts control after an uncontrolled render and ignores no-op replacement', async () => {
    const onWidthsChange = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        'onUpdate:columnWidths': onWidthsChange,
      },
    })

    await wrapper.setProps({ columnWidths: { name: 310 } })
    await nextTick()
    expect(headerStyle(wrapper)).toContain('310px 96px 140px')
    await wrapper.setProps({ columnWidths: { name: 310 } })
    await nextTick()
    expect(onWidthsChange).not.toHaveBeenCalled()

    await wrapper.setProps({ columnWidths: undefined })
    await nextTick()
    expect(headerStyle(wrapper)).toContain('200px 96px 140px')
  })

  it('restores the uncontrolled width snapshot when control is removed', async () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnWidths: { name: 310, age: 81 },
      },
    })

    expect(headerStyle(wrapper)).toContain('310px 81px')
    await wrapper.setProps({ columnWidths: undefined })
    await nextTick()

    expect(headerStyle(wrapper)).toContain('200px 96px 140px')
  })

  it('keeps grouped visibility top-level-only and seeds leaf widths only', () => {
    const groupedColumns: IrisTableColumn<Row>[] = [
      {
        key: 'identity',
        title: 'Identity',
        children: [
          { key: 'name', title: 'Name', width: 120 },
          { key: 'age', title: 'Age', width: '90px' },
        ],
      },
      { key: 'status', title: 'Status' },
    ]
    const wrapper = mount(IrisTable, {
      props: {
        columns: groupedColumns,
        data: rows,
        rowKey: 'id',
        columnVisibility: { name: false },
      },
    })

    // A leaf visibility key does not filter its top-level group.
    expect(wrapper.find('[data-iris-table-header="identity"]').exists()).toBe(true)
    expect(wrapper.find('[data-iris-table-cell="name"]').exists()).toBe(true)
    expect(headerStyle(wrapper)).toContain('120px 90px 140px')
    expect(headerStyle(wrapper)).not.toContain('identity')
  })
})
