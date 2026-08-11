import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import { buildMultiSortComparator } from './useTableSort'
import type { IrisTableColumn, IrisTableProxyQueryParams, IrisTableSortState } from './types'

enableAutoUnmount(afterEach)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  status: string
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25, status: 'active' },
  { id: 2, name: 'Alice', age: 32, status: 'paused' },
  { id: 3, name: 'Bob', age: 28, status: 'active' },
]

// Ties on `name` so a second sort column's precedence is observable.
const tieRows: Row[] = [
  { id: 1, name: 'Alice', age: 30, status: 'active' },
  { id: 2, name: 'Bob', age: 35, status: 'active' },
  { id: 3, name: 'Alice', age: 25, status: 'paused' },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true },
  { key: 'status', title: 'Status' },
]

/** Flush microtasks (promise resolutions) then the Vue render queue. */
async function settle(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 0))
  await nextTick()
}

function nameCells(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll('[data-iris-table-cell="name"]').map((c) => c.text())
}

describe('IrisTable multiSort (vxe sort-config.multiple parity, batch X)', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => host.remove())

  it('header clicks append columns in click order; rows sort by comparator precedence', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: tieRows, rowKey: 'id', multiSort: true },
      attachTo: host,
    })
    await wrapper.find('[data-iris-table-header="name"]').trigger('click')
    await wrapper.find('[data-iris-table-header="age"]').trigger('click')
    await nextTick()
    // name asc first, then age asc breaks the Alice tie: Alice(25), Alice(30), Bob.
    expect(nameCells(wrapper)).toEqual(['Alice', 'Alice', 'Bob'])
    expect(wrapper.findAll('[data-iris-table-cell="age"]').map((c) => c.text())).toEqual([
      '25',
      '30',
      '35',
    ])
    const emitted = wrapper.emitted('multiSortChange') as Array<[IrisTableSortState[]]>
    expect(emitted[0]).toEqual([[{ key: 'name', direction: 'asc' }]])
    expect(emitted[1]).toEqual([
      [
        { key: 'name', direction: 'asc' },
        { key: 'age', direction: 'asc' },
      ],
    ])
  })

  it('renders the click-order sequence number on non-primary sort columns only', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', multiSort: true },
      attachTo: host,
    })
    // One active sort → no sequence badge anywhere.
    await wrapper.find('[data-iris-table-header="name"]').trigger('click')
    expect(wrapper.find('[data-iris-sort-seq]').exists()).toBe(false)
    // Second column joins → badge "2" sits on the AGE header.
    await wrapper.find('[data-iris-table-header="age"]').trigger('click')
    const seq = wrapper.find('[data-iris-sort-seq]')
    expect(seq.text()).toBe('2')
    expect(
      seq.element.closest('[data-iris-table-header]')?.getAttribute('data-iris-table-header'),
    ).toBe('age')
    // Cycling the second column desc keeps its position; removing it drops the badge.
    await wrapper.find('[data-iris-table-header="age"]').trigger('click')
    expect(wrapper.find('[data-iris-sort-seq]').text()).toBe('2')
    await wrapper.find('[data-iris-table-header="age"]').trigger('click')
    expect(wrapper.find('[data-iris-sort-seq]').exists()).toBe(false)
  })

  it('proxy remoteSort: multi mode passes `sorts`, single mode keeps `sort`', async () => {
    const query = vi.fn(async (_params: IrisTableProxyQueryParams) => ({
      rows: [rows[0]],
      total: 3,
    }))
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: [],
        rowKey: 'id',
        multiSort: true,
        proxyConfig: { query, remoteSort: true },
      },
      attachTo: host,
    })
    await settle()
    expect(query).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, sort: null, filters: {} })
    await wrapper.find('[data-iris-table-header="name"]').trigger('click')
    await settle()
    expect(query).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      sort: null,
      sorts: [{ key: 'name', direction: 'asc' }],
      filters: {},
    })
    await wrapper.find('[data-iris-table-header="age"]').trigger('click')
    await settle()
    expect(query).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      sort: null,
      sorts: [
        { key: 'name', direction: 'asc' },
        { key: 'age', direction: 'asc' },
      ],
      filters: {},
    })
  })

  it('single mode is untouched: header click still replaces via `sort`', async () => {
    const query = vi.fn(async (_params: IrisTableProxyQueryParams) => ({
      rows: [rows[0]],
      total: 3,
    }))
    const wrapper = mount(IrisTable, {
      props: { columns, data: [], rowKey: 'id', proxyConfig: { query, remoteSort: true } },
      attachTo: host,
    })
    await settle()
    await wrapper.find('[data-iris-table-header="name"]').trigger('click')
    await settle()
    // No `sorts` key — the single-column channel stays byte-identical.
    expect(query).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      sort: { key: 'name', direction: 'asc' },
      filters: {},
    })
  })

  it('controlled `multiSortState` prop change re-queries with the full sort list', async () => {
    // A parent driving v-model:multiSortState must push the new list to the
    // server (review finding: Vue previously only pushed on internal clicks).
    const query = vi.fn(async (_params: IrisTableProxyQueryParams) => ({
      rows: [rows[0]],
      total: 3,
    }))
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: [],
        rowKey: 'id',
        multiSort: true,
        multiSortState: [{ key: 'name', direction: 'asc' }],
        proxyConfig: { query, remoteSort: true },
      },
      attachTo: host,
    })
    await settle()
    expect(query).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      sort: null,
      sorts: [{ key: 'name', direction: 'asc' }],
      filters: {},
    })
    await wrapper.setProps({
      multiSortState: [
        { key: 'name', direction: 'asc' },
        { key: 'age', direction: 'desc' },
      ],
    })
    await settle()
    expect(query).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      sort: null,
      sorts: [
        { key: 'name', direction: 'asc' },
        { key: 'age', direction: 'desc' },
      ],
      filters: {},
    })
  })

  it('defaultMultiSort seeds the uncontrolled multi sort on mount', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: tieRows,
        rowKey: 'id',
        multiSort: true,
        defaultMultiSort: [
          { key: 'name', direction: 'asc' },
          { key: 'age', direction: 'desc' },
        ],
      },
      attachTo: host,
    })
    expect(nameCells(wrapper)).toEqual(['Alice', 'Alice', 'Bob'])
    expect(wrapper.findAll('[data-iris-table-cell="age"]').map((c) => c.text())).toEqual([
      '30',
      '25',
      '35',
    ])
    // Sequence badge on the secondary column reflects the seeded order.
    expect(
      wrapper
        .find('[data-iris-sort-seq]')
        .element.closest('[data-iris-table-header]')
        ?.getAttribute('data-iris-table-header'),
    ).toBe('age')
  })

  describe('buildMultiSortComparator (pure)', () => {
    it('returns null for an empty list', () => {
      expect(buildMultiSortComparator(columns, [])).toBeNull()
    })

    it('chains comparators in click order, first non-zero wins', () => {
      const cmp = buildMultiSortComparator(columns, [
        { key: 'name', direction: 'asc' },
        { key: 'age', direction: 'asc' },
      ])!
      const sorted = [...tieRows].sort(cmp)
      expect(sorted.map((r) => r.name)).toEqual(['Alice', 'Alice', 'Bob'])
      expect(sorted.map((r) => r.age)).toEqual([25, 30, 35])
    })

    it('a desc step inverts only its own column', () => {
      const cmp = buildMultiSortComparator(columns, [
        { key: 'name', direction: 'asc' },
        { key: 'age', direction: 'desc' },
      ])!
      const sorted = [...tieRows].sort(cmp)
      expect(sorted.map((r) => r.age)).toEqual([30, 25, 35])
    })

    it('unknown sort keys are skipped; a fully-unknown list returns null', () => {
      expect(buildMultiSortComparator(columns, [{ key: 'nope', direction: 'asc' }])).toBeNull()
      const cmp = buildMultiSortComparator(columns, [
        { key: 'nope', direction: 'asc' },
        { key: 'name', direction: 'asc' },
      ])!
      expect([...tieRows].sort(cmp).map((r) => r.name)).toEqual(['Alice', 'Alice', 'Bob'])
    })
  })
})

describe('IrisTable toolbar (vxe toolbarConfig parity, batch X)', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => host.remove())

  it('buttons render after the built-ins and fire onClick', async () => {
    const onClick = vi.fn()
    const onRefresh = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        toolbar: {
          title: 'Users',
          onRefresh,
          buttons: [
            { key: 'export', label: 'Export', icon: '⇓', onClick },
            { key: 'clear', label: 'Clear filters', onClick: vi.fn() },
          ],
        },
      },
      attachTo: host,
    })
    const exportBtn = wrapper.find('[data-iris-table-toolbar-button-export]')
    expect(exportBtn.exists()).toBe(true)
    expect(exportBtn.text()).toContain('Export')
    expect(exportBtn.text()).toContain('⇓')
    // Custom buttons come AFTER the built-in refresh button.
    const refreshEl = wrapper.find('[data-iris-table-toolbar-refresh]').element as HTMLElement
    const exportEl = exportBtn.element as HTMLElement
    expect(
      refreshEl.compareDocumentPosition(exportEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(wrapper.find('[data-iris-table-toolbar-button-clear]').text()).toContain('Clear filters')
    await exportBtn.trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('batch appears with a multi selection, delivers the selected keys, hides when empty', async () => {
    const onClick = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        selectable: 'multi',
        toolbar: { batch: { label: 'Delete', icon: '✕', onClick } },
      },
      attachTo: host,
    })
    expect(wrapper.find('[data-iris-table-toolbar-batch]').exists()).toBe(false)
    const boxes = wrapper.findAll('[data-iris-table-row] input[type="checkbox"]')
    await boxes[1]!.trigger('click') // row id=2
    await boxes[2]!.trigger('click') // row id=3
    const btn = wrapper.find('[data-iris-table-toolbar-batch]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('Delete')
    expect(btn.text()).toContain('✕')
    await btn.trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledWith([2, 3])
    // Un-selecting one row keeps the batch; emptying the selection hides it.
    await boxes[2]!.trigger('click')
    expect(wrapper.find('[data-iris-table-toolbar-batch]').exists()).toBe(true)
    await boxes[1]!.trigger('click')
    expect(wrapper.find('[data-iris-table-toolbar-batch]').exists()).toBe(false)
  })

  it('never renders in single-select mode', async () => {
    const onClick = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        selectable: 'single',
        toolbar: { batch: { label: 'Delete', onClick } },
      },
      attachTo: host,
    })
    const radio = wrapper.find('[data-iris-table-row] input[type="checkbox"]')
    await radio.trigger('click')
    expect(wrapper.find('[data-iris-table-toolbar-batch]').exists()).toBe(false)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('export fires and refresh re-queries in proxy mode', async () => {
    const onExport = vi.fn()
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 1 }))
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: [],
        rowKey: 'id',
        toolbar: { onExport, onRefresh: vi.fn() },
        proxyConfig: { query },
      },
      attachTo: host,
    })
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
    await wrapper.find('[data-iris-table-toolbar-export]').trigger('click')
    expect(onExport).toHaveBeenCalledTimes(1)
    await wrapper.find('[data-iris-table-toolbar-refresh]').trigger('click')
    await settle()
    expect(query).toHaveBeenCalledTimes(2)
  })

  it('no toolbar config renders no toolbar', () => {
    const wrapper = mount(IrisTable, { props: { columns, data: rows, rowKey: 'id' } })
    expect(wrapper.find('[data-iris-table-toolbar]').exists()).toBe(false)
  })
})
