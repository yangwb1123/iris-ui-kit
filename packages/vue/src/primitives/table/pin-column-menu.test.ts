import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { IrisI18nProvider } from '../../i18n'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

enableAutoUnmount(afterEach)

type Row = { id: number; name: string; age: number }

const rows: Row[] = [
  { id: 1, name: 'Alexandra', age: 25 },
  { id: 2, name: 'Bob', age: 32 },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

async function settle(): Promise<void> {
  await nextTick()
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

function menu(): HTMLElement | null {
  return document.querySelector('[data-iris-table-context-menu]')
}

function item(key: string): HTMLButtonElement {
  return document.querySelector(`[data-iris-table-context-menu-item="${key}"]`) as HTMLButtonElement
}

async function openHeader(wrapper: ReturnType<typeof mount>, key: string): Promise<void> {
  await wrapper.find(`[data-iris-table-header="${key}"]`).trigger('contextmenu', {
    clientX: 120,
    clientY: 40,
  })
  await settle()
}

describe('IrisTable columnPinMenu', () => {
  it('is opt-in: the default header path has no menu or context handler effect', async () => {
    const wrapper = mount(IrisTable, { props: { columns, data: rows, rowKey: 'id' } })
    await openHeader(wrapper, 'name')
    expect(menu()).toBeNull()
    expect(wrapper.emitted('update:sort')).toBeUndefined()
  })

  it('keeps default-off static pin declarations live after replacing columns', async () => {
    const initial: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', pinned: 'left' },
      { key: 'age', title: 'Age' },
    ]
    const replacement: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age', pinned: 'right' },
    ]
    const wrapper = mount(IrisTable, { props: { columns: initial, data: rows, rowKey: 'id' } })

    expect(
      wrapper.find('[data-iris-table-header="name"]').attributes('data-iris-table-pinned'),
    ).toBe('left')
    await wrapper.setProps({ columns: replacement })
    await settle()

    expect(
      wrapper.find('[data-iris-table-header="name"]').attributes('data-iris-table-pinned'),
    ).toBe(undefined)
    expect(
      wrapper.find('[data-iris-table-header="age"]').attributes('data-iris-table-pinned'),
    ).toBe('right')
  })

  it('pins and unpins through the internal Core channel without mutating columns', async () => {
    const onPinned = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnPinMenu: true,
        onColumnPinnedChange: onPinned,
      },
    })

    await openHeader(wrapper, 'name')
    expect(menu()?.getAttribute('role')).toBe('menu')
    expect(menu()?.style.transform).toContain('translate3d(120px, 40px')
    expect(item('__iris-pin-left').textContent).toBe('Pin left')
    item('__iris-pin-left').click()
    await settle()

    expect(onPinned).toHaveBeenCalledWith('name', 'left')
    expect(
      wrapper.find('[data-iris-table-header="name"]').attributes('data-iris-table-pinned'),
    ).toBe('left')
    expect(wrapper.find('[data-iris-table-header="name"]').element.style.position).toBe('sticky')
    expect(wrapper.find('[data-iris-table-cell="name"]').attributes('data-iris-table-pinned')).toBe(
      'left',
    )
    expect(columns[0]!.pinned).toBeUndefined()

    await openHeader(wrapper, 'name')
    expect(item('__iris-unpin').textContent).toBe('Unpin')
    item('__iris-unpin').click()
    await settle()
    expect(onPinned).toHaveBeenLastCalledWith('name', null)
    expect(
      wrapper.find('[data-iris-table-header="name"]').attributes('data-iris-table-pinned'),
    ).toBe(undefined)
  })

  it('uses Unpin for static left and right pins, including controlled-null semantics', async () => {
    const pinned: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', pinned: 'left' },
      { key: 'age', title: 'Age', pinned: 'right' },
    ]
    const onPinned = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns: pinned,
        data: rows,
        rowKey: 'id',
        columnPinMenu: true,
        onColumnPinnedChange: onPinned,
      },
    })
    await openHeader(wrapper, 'name')
    expect(item('__iris-unpin').textContent).toBe('Unpin')
    item('__iris-unpin').click()
    await settle()
    expect(onPinned).toHaveBeenCalledWith('name', null)
    expect(
      wrapper.find('[data-iris-table-header="name"]').attributes('data-iris-table-pinned'),
    ).toBe(undefined)

    await openHeader(wrapper, 'age')
    expect(item('__iris-unpin').textContent).toBe('Unpin')
    item('__iris-unpin').click()
    await settle()
    expect(onPinned).toHaveBeenCalledWith('age', null)

    const controlled = mount(IrisTable, {
      props: {
        columns: pinned,
        data: rows,
        rowKey: 'id',
        columnPinMenu: true,
        pinnedColumns: { name: null },
      },
    })
    expect(
      controlled.find('[data-iris-table-header="name"]').attributes('data-iris-table-pinned'),
    ).toBe(undefined)
  })

  it('controlled `{}` keeps static pins authoritative until the parent writes an override', async () => {
    const pinned: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', pinned: 'left' },
      { key: 'age', title: 'Age' },
    ]
    const onPinned = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns: pinned,
        data: rows,
        rowKey: 'id',
        columnPinMenu: true,
        pinnedColumns: {},
        onColumnPinnedChange: onPinned,
      },
    })
    await openHeader(wrapper, 'name')
    expect(item('__iris-unpin').textContent).toBe('Unpin')
    item('__iris-unpin').click()
    await settle()
    expect(onPinned).toHaveBeenCalledWith('name', null)
    expect(
      wrapper.find('[data-iris-table-header="name"]').attributes('data-iris-table-pinned'),
    ).toBe('left')
  })

  it('controlled actions emit through Core but never flip the rendered prop optimistically', async () => {
    const onPinned = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnPinMenu: true,
        pinnedColumns: {},
        onColumnPinnedChange: onPinned,
      },
    })
    await openHeader(wrapper, 'name')
    item('__iris-pin-left').click()
    await settle()
    expect(onPinned).toHaveBeenCalledWith('name', 'left')
    expect(
      wrapper.find('[data-iris-table-header="name"]').attributes('data-iris-table-pinned'),
    ).toBe(undefined)

    await wrapper.setProps({ pinnedColumns: { name: 'left' } })
    await settle()
    expect(
      wrapper.find('[data-iris-table-header="name"]').attributes('data-iris-table-pinned'),
    ).toBe('left')
  })

  it('a controlled parent re-render drives the pin visual and the next menu item', async () => {
    const wrapper = mount(
      defineComponent({
        setup() {
          const pinned = ref<Record<string, 'left' | 'right' | null>>({})
          return () =>
            h(IrisTable, {
              columns,
              data: rows,
              rowKey: 'id',
              columnPinMenu: true,
              pinnedColumns: pinned.value,
              onColumnPinnedChange: (key, side) => {
                pinned.value = { ...pinned.value, [key]: side }
              },
            })
        },
      }),
    )
    await openHeader(wrapper, 'name')
    item('__iris-pin-left').click()
    await settle()
    expect(
      wrapper.find('[data-iris-table-header="name"]').attributes('data-iris-table-pinned'),
    ).toBe('left')
    await openHeader(wrapper, 'name')
    expect(item('__iris-unpin').textContent).toBe('Unpin')
  })

  it('stale menu actions are no-ops after the pin projection changes', async () => {
    const onPinned = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnPinMenu: true,
        pinnedColumns: {},
        onColumnPinnedChange: onPinned,
      },
    })
    await openHeader(wrapper, 'name')
    const staleItem = item('__iris-pin-left')
    await wrapper.setProps({ pinnedColumns: { name: 'left' } })
    staleItem.click()
    await settle()
    expect(onPinned).not.toHaveBeenCalled()
  })

  it('turning the feature off closes an open menu and removes its handler path', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', columnPinMenu: true },
    })
    await openHeader(wrapper, 'name')
    expect(menu()).not.toBeNull()
    await wrapper.setProps({ columnPinMenu: false })
    await settle()
    expect(menu()).toBeNull()
    await wrapper.setProps({ columnPinMenu: true })
    await openHeader(wrapper, 'name')
    expect(menu()).not.toBeNull()
  })

  it('swaps independently with the body context menu and closes on Escape, outside, and scroll', async () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnPinMenu: true,
        contextMenu: { items: () => [{ key: 'edit', label: 'Edit' }], onSelect: vi.fn() },
      },
    })
    await wrapper.find('[data-iris-table-cell="name"]').trigger('contextmenu', {
      clientX: 20,
      clientY: 30,
    })
    await settle()
    expect(menu()?.querySelector('[data-iris-table-context-menu-item="edit"]')).not.toBeNull()

    await openHeader(wrapper, 'name')
    expect(document.querySelectorAll('[data-iris-table-context-menu]')).toHaveLength(1)
    expect(item('__iris-pin-left')).not.toBeNull()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await settle()
    expect(menu()).toBeNull()

    await openHeader(wrapper, 'name')
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await settle()
    expect(menu()).toBeNull()

    await openHeader(wrapper, 'name')
    document.dispatchEvent(new Event('scroll', { bubbles: true }))
    await settle()
    expect(menu()).toBeNull()
  })

  it('only leaf grouped headers open the menu and pin visual state reaches the leaf', async () => {
    const grouped: IrisTableColumn<Row>[] = [
      {
        key: 'person',
        title: 'Person',
        children: [
          { key: 'name', title: 'Name' },
          { key: 'age', title: 'Age' },
        ],
      },
      { key: 'extra', title: 'Extra' },
    ]
    const wrapper = mount(IrisTable, {
      props: { columns: grouped, data: rows, rowKey: 'id', columnPinMenu: true },
    })
    await wrapper.find('[data-iris-table-header="person"]').trigger('contextmenu')
    await settle()
    expect(menu()).toBeNull()

    await openHeader(wrapper, 'name')
    item('__iris-pin-left').click()
    await settle()
    expect(
      wrapper.find('[data-iris-table-header="name"]').attributes('data-iris-table-pinned'),
    ).toBe('left')
    expect(
      wrapper.find('[data-iris-table-header="person"]').attributes('data-iris-table-pinned'),
    ).toBe(undefined)
    expect(wrapper.find('[data-iris-table-cell="name"]').attributes('data-iris-table-pinned')).toBe(
      'left',
    )
  })

  it('feeds the same projection to pinned drag after a menu pin', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', columnPinMenu: true, pinnedDrag: true },
    })
    await openHeader(wrapper, 'age')
    item('__iris-pin-left').click()
    await settle()
    expect(wrapper.find('[data-iris-pinned-drag-handle]').attributes('data-column-key')).toBe('age')
  })

  it('uses core i18n labels', async () => {
    const wrapper = mount(IrisI18nProvider, {
      props: { messages: { 'table.pinLeft': '固定左', 'table.unpin': '取消固定' } },
      slots: { default: () => h(IrisTable, { columns, data: rows, columnPinMenu: true }) },
    })
    await openHeader(wrapper, 'name')
    expect(item('__iris-pin-left').textContent).toBe('固定左')
    await wrapper.setProps({ messages: { 'table.pinLeft': '固定到左侧' } })
    await settle()
    expect(item('__iris-pin-left').textContent).toBe('固定到左侧')
    wrapper.unmount()
  })
})
