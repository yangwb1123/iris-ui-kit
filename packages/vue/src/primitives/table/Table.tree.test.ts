import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

enableAutoUnmount(afterEach)

describe('IrisTable tree rows', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => host.remove())

  interface TreeRowData extends Record<string, unknown> {
    id: number
    name: string
    children?: TreeRowData[]
  }
  const treeData: TreeRowData[] = [
    {
      id: 1,
      name: 'Root A',
      children: [
        { id: 11, name: 'Child A1' },
        { id: 12, name: 'Child A2' },
      ],
    },
    { id: 2, name: 'Root B' },
  ]
  const treeCols: IrisTableColumn<TreeRowData>[] = [{ key: 'name', title: 'Name' }]
  const getSubRows = (row: Record<string, unknown>) => (row as TreeRowData).children

  // The tree toggle (▶) renders inside the first cell; strip it to read the name.
  function visibleNames(wrapper: ReturnType<typeof mount>): string[] {
    return wrapper
      .findAll('[data-iris-table-cell="name"]')
      .map((c) => c.text().replace('▶', '').trim())
  }
  // Toggle within each rendered body row's first cell, in row order.
  function toggleAt(wrapper: ReturnType<typeof mount>, rowIndex: number) {
    return wrapper.findAll('[data-iris-table-row]')[rowIndex]!.find('[data-iris-table-tree-toggle]')
  }

  it('renders only roots collapsed, with a toggle on parents only + aria-expanded="false"', () => {
    const wrapper = mount(IrisTable, {
      props: { columns: treeCols, data: treeData, rowKey: 'id', getSubRows },
      attachTo: host,
    })
    expect(visibleNames(wrapper)).toEqual(['Root A', 'Root B'])
    // Root A (has children) → toggle; Root B (leaf) → no toggle.
    expect(toggleAt(wrapper, 0).exists()).toBe(true)
    expect(toggleAt(wrapper, 1).exists()).toBe(false)
    expect(toggleAt(wrapper, 0).attributes('aria-expanded')).toBe('false')
  })

  it('applies local filters before projecting tree rows', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: treeCols,
        data: treeData,
        rowKey: 'id',
        getSubRows,
        filters: { name: 'Root B' },
      },
      attachTo: host,
    })
    expect(visibleNames(wrapper)).toEqual(['Root B'])
  })

  it('clicking the toggle reveals children, then hides them', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns: treeCols, data: treeData, rowKey: 'id', getSubRows },
      attachTo: host,
    })
    await toggleAt(wrapper, 0).trigger('click')
    await nextTick()
    expect(visibleNames(wrapper)).toEqual(['Root A', 'Child A1', 'Child A2', 'Root B'])
    expect(toggleAt(wrapper, 0).attributes('aria-expanded')).toBe('true')
    await toggleAt(wrapper, 0).trigger('click')
    await nextTick()
    expect(visibleNames(wrapper)).toEqual(['Root A', 'Root B'])
  })

  it('defaultExpandedRowKeys starts a branch open + emits expandedRowsChange on toggle', async () => {
    const changed = ref<Array<string | number> | null>(null)
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisTable, {
            columns: treeCols,
            data: treeData,
            rowKey: 'id',
            getSubRows,
            defaultExpandedRowKeys: [1],
            onExpandedRowsChange: (keys: Array<string | number>) => (changed.value = keys),
          })
      },
    })
    const wrapper = mount(Harness, { attachTo: host })
    expect(visibleNames(wrapper)).toEqual(['Root A', 'Child A1', 'Child A2', 'Root B'])
    // Collapse Root A (the first toggle).
    await wrapper.findAll('[data-iris-table-tree-toggle]')[0]!.trigger('click')
    await nextTick()
    expect(changed.value).toEqual([])
  })

  it('child rows have greater paddingLeft than their parent', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: treeCols,
        data: treeData,
        rowKey: 'id',
        getSubRows,
        defaultExpandedRowKeys: [1],
      },
      attachTo: host,
    })
    const indents = wrapper.findAll('[data-iris-table-tree-indent]')
    const pad = (i: number): number =>
      parseInt((indents[i]!.element as HTMLElement).style.paddingLeft || '0', 10)
    // Order: Root A (depth 0), Child A1 (depth 1), Child A2 (depth 1), Root B (depth 0).
    expect(pad(1)).toBeGreaterThan(pad(0))
    expect(pad(2)).toBeGreaterThan(pad(0))
  })

  it('no tree toggle/indent when getSubRows is absent (flat mode unchanged)', () => {
    const wrapper = mount(IrisTable, {
      props: { columns: treeCols, data: treeData, rowKey: 'id' },
      attachTo: host,
    })
    expect(wrapper.find('[data-iris-table-tree-toggle]').exists()).toBe(false)
    expect(wrapper.find('[data-iris-table-tree-indent]').exists()).toBe(false)
  })

  it('exposes aria-level/setsize/posinset on tree rows for screen readers', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: treeCols,
        data: treeData,
        rowKey: 'id',
        getSubRows,
        defaultExpandedRowKeys: [1],
      },
      attachTo: host,
    })
    // Visible body rows in order: Root A (depth 0), Child A1 (depth 1),
    // Child A2 (depth 1), Root B (depth 0) → aria-level is depth + 1 (1-based);
    // aria-setsize is the sibling count at that level, aria-posinset the 1-based
    // position among siblings.
    const rows = wrapper.findAll('[data-iris-table-row]')
    const attrsAt = (rowIndex: number) => ({
      level: rows[rowIndex]!.element.getAttribute('aria-level'),
      setsize: rows[rowIndex]!.element.getAttribute('aria-setsize'),
      posinset: rows[rowIndex]!.element.getAttribute('aria-posinset'),
    })
    // Root A: level 1, 2 roots, position 1.
    expect(attrsAt(0)).toEqual({ level: '1', setsize: '2', posinset: '1' })
    // Child A1: level 2, 2 children, position 1.
    expect(attrsAt(1)).toEqual({ level: '2', setsize: '2', posinset: '1' })
    // Child A2: level 2, 2 children, position 2.
    expect(attrsAt(2)).toEqual({ level: '2', setsize: '2', posinset: '2' })
    // Root B: level 1, 2 roots, position 2.
    expect(attrsAt(3)).toEqual({ level: '1', setsize: '2', posinset: '2' })
  })

  it('uses role=treegrid for a keyboard-navigable tree (else grid/table)', async () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: treeCols,
        data: treeData,
        rowKey: 'id',
        getSubRows,
        keyboardNavigation: true,
      },
      attachTo: host,
    })
    const role = () => wrapper.find('[data-iris-table]').element.getAttribute('role')
    expect(role()).toBe('treegrid')
    // Without tree mode it stays a grid; without keyboard nav, a table.
    await wrapper.setProps({ getSubRows: undefined, keyboardNavigation: true })
    expect(role()).toBe('grid')
    await wrapper.setProps({ getSubRows, keyboardNavigation: false })
    expect(role()).toBe('table')
  })

  it('column sort reorders tree siblings hierarchically (roots and children)', async () => {
    const data: TreeRowData[] = [
      {
        id: 1,
        name: 'Root B',
        children: [
          { id: 12, name: 'Child B2' },
          { id: 11, name: 'Child B1' },
        ],
      },
      { id: 2, name: 'Root A' },
    ]
    const sortableCols: IrisTableColumn<TreeRowData>[] = [
      { key: 'name', title: 'Name', sortable: true },
    ]
    const wrapper = mount(IrisTable, {
      props: {
        columns: sortableCols,
        data,
        rowKey: 'id',
        getSubRows,
        defaultExpandedRowKeys: [1],
      },
      attachTo: host,
    })
    // Unsorted: roots and children keep their source order.
    expect(visibleNames(wrapper)).toEqual(['Root B', 'Child B2', 'Child B1', 'Root A'])
    // Sort asc by name: roots reorder (A before B) AND Root B's children reorder.
    await wrapper.find('[data-iris-table-header="name"]').trigger('click')
    await nextTick()
    expect(visibleNames(wrapper)).toEqual(['Root A', 'Root B', 'Child B1', 'Child B2'])
  })

  it('virtualizes tree mode (uniform-height rows) with tree decoration intact', async () => {
    const tree: TreeRowData[] = [
      {
        id: 1,
        name: 'Root',
        children: Array.from({ length: 40 }, (_, i) => ({ id: 100 + i, name: `C${i}` })),
      },
    ]
    const wrapper = mount(IrisTable, {
      props: {
        columns: treeCols,
        data: tree,
        rowKey: 'id',
        getSubRows,
        defaultExpandedRowKeys: [1],
        virtualScroll: { itemHeight: 36, height: 200 },
      },
      attachTo: host,
    })
    await nextTick()
    // Tree mode now uses the virtual scroller (was previously excluded).
    expect(wrapper.find('[data-iris-virtual-scroll]').exists()).toBe(true)
    // Tree meta still flows into the virtualized rows (the parent toggle renders).
    expect(wrapper.find('[data-iris-table-tree-toggle]').exists()).toBe(true)
    // Windowed: far fewer than the 41 total rows are in the DOM.
    expect(wrapper.findAll('[data-iris-table-row]').length).toBeLessThan(41)
  })

  it('does NOT virtualize tree mode when renderDetail is set (variable-height rows)', () => {
    const tree: TreeRowData[] = [{ id: 1, name: 'Root', children: [{ id: 2, name: 'C' }] }]
    const wrapper = mount(IrisTable, {
      props: {
        columns: treeCols,
        data: tree,
        rowKey: 'id',
        getSubRows,
        renderDetail: (row: Record<string, unknown>) => h('div', `d${(row as TreeRowData).id}`),
        virtualScroll: { itemHeight: 36, height: 200 },
      },
      attachTo: host,
    })
    expect(wrapper.find('[data-iris-virtual-scroll]').exists()).toBe(false)
  })
})
