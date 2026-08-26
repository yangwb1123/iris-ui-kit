import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTableExpose } from './types'

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

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age', summary: 'sum' },
  { key: 'status', title: 'Status' },
]

/** Flush microtasks (promise resolutions) then the Vue render queue. */
async function settle(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 0))
  await nextTick()
}

function nameCells(wrapper: ReturnType<typeof mount>): string[] {
  return bodyRows(wrapper).flatMap((r) =>
    r.findAll('[data-iris-table-cell="name"]').map((c) => c.text()),
  )
}

/** Body rows only (the summary/loading/error/empty state rows carry named
 * `data-iris-table-row` values; real rows carry an empty value). */
function bodyRows(wrapper: ReturnType<typeof mount>) {
  return wrapper
    .findAll('[data-iris-table-row]')
    .filter((r) => r.attributes('data-iris-table-row') === '')
}

function bodyCellCount(wrapper: ReturnType<typeof mount>, key: string): number {
  return bodyRows(wrapper).reduce(
    (n, r) => n + r.findAll(`[data-iris-table-cell="${key}"]`).length,
    0,
  )
}

function exposed(wrapper: ReturnType<typeof mount>): IrisTableExpose<Row> {
  return wrapper.vm as unknown as IrisTableExpose<Row>
}

/** Dispatch a pointer-shaped plain Event (jsdom has no PointerEvent). */
function pointer(el: Element, type: string, x: number, y: number): void {
  const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    clientX: number
    clientY: number
    button: number
  }
  Object.assign(ev, { clientX: x, clientY: y, button: 0 })
  el.dispatchEvent(ev)
}

/** Stub getBoundingClientRect so closestCenter resolves deterministically:
 * header targets sit side by side, row handles one per 40px row. */
function stubHeaderRects(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const id = this.getAttribute('data-iris-table-header')
    const left = id === 'name' ? 0 : id === 'age' ? 140 : 280
    return {
      left,
      top: 0,
      width: 140,
      height: 40,
      right: left + 140,
      bottom: 40,
      x: left,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
  })
}

function stubRowRects(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const id = this.getAttribute('data-iris-row-drag-handle')
    const top = id === '1' ? 0 : id === '2' ? 40 : 80
    return {
      left: 0,
      top,
      width: 40,
      height: 40,
      right: 40,
      bottom: top + 40,
      x: 0,
      y: top,
      toJSON: () => ({}),
    } as DOMRect
  })
}

describe('IrisTable batch Y — columnVisibility / filters / seq / spanMethod / drag / proxy methods', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => {
    host.remove()
    vi.restoreAllMocks()
  })

  it('columnVisibility hides columns from header, body, and summary; unfiltered renders all', async () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnVisibility: { age: false },
      },
      attachTo: host,
    })
    // Header: age placeholder gone, real columns remain.
    expect(wrapper.find('[data-iris-table-header="age"]').exists()).toBe(false)
    expect(wrapper.find('[data-iris-table-header="name"]').exists()).toBe(true)
    expect(wrapper.find('[data-iris-table-header="status"]').exists()).toBe(true)
    // Body: age cells gone; name/status intact.
    expect(nameCells(wrapper)).toEqual(['Charlie', 'Alice', 'Bob'])
    expect(bodyCellCount(wrapper, 'age')).toBe(0)
    // Summary: the hidden column's aggregate is gone too (no summary row).
    expect(wrapper.findAll('[data-iris-table-summary-cell]').length).toBe(0)
    // Reference-preserving: without the prop every column renders.
    await wrapper.setProps({ columnVisibility: undefined })
    await nextTick()
    expect(bodyCellCount(wrapper, 'age')).toBe(3)
    expect(wrapper.findAll('[data-iris-table-summary-cell]').length).toBe(1)
  })

  it('filters prop: substring case-insensitive matching over visible columns; "" ignored', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', filters: { name: 'a' } },
      attachTo: host,
    })
    expect(nameCells(wrapper)).toEqual(['Charlie', 'Alice'])
    // Case-insensitive.
    await wrapper.setProps({ filters: { name: 'ALI' } })
    await nextTick()
    expect(nameCells(wrapper)).toEqual(['Alice'])
    // Empty entries are ignored → all rows.
    await wrapper.setProps({ filters: { name: '', age: '' } })
    await nextTick()
    expect(nameCells(wrapper).length).toBe(3)
    // Unknown keys never hide rows.
    await wrapper.setProps({ filters: { nope: 'x' } })
    await nextTick()
    expect(nameCells(wrapper).length).toBe(3)
  })

  it('filters combine with formConfig values (AND): both must match', async () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        filters: { name: 'a' },
        formConfig: {
          fields: [{ key: 'age', label: 'Age' }],
        },
      },
      attachTo: host,
    })
    expect(nameCells(wrapper).length).toBe(2)
    await wrapper.find('[data-iris-table-form-field="age"] input').setValue('25')
    await wrapper.find('[data-iris-table-form]').trigger('submit')
    await nextTick()
    // name contains "a" AND age contains "25" → only Charlie.
    expect(nameCells(wrapper)).toEqual(['Charlie'])
  })

  it('seq renders a leading sequence column (before selection) with seqStartIndex', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        seq: true,
        seqStartIndex: 5,
        selectable: 'multi',
      },
      attachTo: host,
    })
    const seqCells = bodyRows(wrapper).flatMap((r) =>
      r.findAll('[data-iris-table-cell="__seq"]').map((c) => c.text()),
    )
    expect(seqCells).toEqual(['5', '6', '7'])
    // The seq track leads the row, before the selection track.
    const first = wrapper
      .find('[data-iris-table-row]:not([data-iris-table-row="loading"])')
      .find('[data-iris-table-cell]')
    expect(first.attributes('data-iris-table-cell')).toBe('__seq')
    // Header placeholder aligns with the body track.
    expect(wrapper.find('[data-iris-table-header="__seq"]').exists()).toBe(true)
  })

  it('spanMethod merges rowspan+colspan and skips occupied cells (clear per pass)', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        spanMethod: ({ rowIndex, columnIndex }) =>
          rowIndex === 0 && columnIndex === 0 ? { rowspan: 2, colspan: 2 } : null,
      },
      attachTo: host,
    })
    // (0,0) covers (1,0) and (0,1); the rest render normally.
    expect(bodyCellCount(wrapper, 'name')).toBe(2)
    expect(bodyCellCount(wrapper, 'age')).toBe(2)
    expect(bodyCellCount(wrapper, 'status')).toBe(3)
    const spanCell = wrapper.find('[data-iris-table-cell="name"]')
    expect(spanCell.element.style.gridRowEnd).toBe('span 2')
    expect(spanCell.element.style.gridColumnEnd).toBe('span 2')
  })

  it('spanMethod rowspan alone covers later rows; the pass clears between renders', async () => {
    const spanMethod = vi.fn(
      ({ rowIndex, columnIndex }: { rowIndex: number; columnIndex: number }) =>
        rowIndex === 0 && columnIndex === 0 ? { rowspan: 2 } : null,
    )
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', spanMethod },
      attachTo: host,
    })
    expect(bodyCellCount(wrapper, 'name')).toBe(2)
    // Row 1's name cell was skipped (covered), so spanMethod never saw (1,0).
    expect(spanMethod.mock.calls.some(([p]) => p.rowIndex === 1 && p.columnIndex === 0)).toBe(false)
    // A re-render (here: new data) starts a fresh occupy set — no stale skips.
    await wrapper.setProps({ data: [rows[0]] })
    await nextTick()
    expect(bodyCellCount(wrapper, 'name')).toBe(1)
  })

  it('columnDrag reorders columns on drop; a tap without movement does not', async () => {
    stubHeaderRects()
    let fed: IrisTableColumn<Row>[] = columns
    const onReorder = vi.fn((next: IrisTableColumn<Row>[]) => {
      fed = next
      void wrapper.setProps({ columns: next })
    })
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnDrag: { onReorder },
      },
      attachTo: host,
    })
    const root = wrapper.element
    // Press the "name" header, drag past the threshold onto "status", drop.
    pointer(wrapper.find('[data-iris-table-header="name"]').element, 'pointerdown', 70, 10)
    pointer(root, 'pointermove', 350, 10)
    pointer(root, 'pointerup', 350, 10)
    await nextTick()
    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onReorder.mock.calls[0][0].map((c: IrisTableColumn) => c.key)).toEqual([
      'age',
      'status',
      'name',
    ])
    // The parent re-feed lands: the header renders in the new order.
    await nextTick()
    expect(fed.map((c) => c.key)).toEqual(['age', 'status', 'name'])
    expect(
      wrapper
        .findAll('[data-iris-table-header]')
        .map((c) => c.attributes('data-iris-table-header')),
    ).toEqual(['age', 'status', 'name'])
    // The body follows the new column order.
    expect(
      bodyRows(wrapper)[0]
        .findAll('[data-iris-table-cell]')
        .map((c) => c.attributes('data-iris-table-cell')),
    ).toEqual(['age', 'status', 'name'])
    // A plain tap (no threshold movement) cancels instead of reordering.
    pointer(wrapper.find('[data-iris-table-header="age"]').element, 'pointerdown', 210, 10)
    pointer(root, 'pointerup', 210, 10)
    await nextTick()
    expect(onReorder).toHaveBeenCalledTimes(1)
  })

  it('rowDrag reorders rows through the local rows ref, reporting onDataChange + onReorder', async () => {
    stubRowRects()
    const onReorder = vi.fn()
    const onDataChange = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        rowDrag: { onReorder },
        onDataChange,
      },
      attachTo: host,
    })
    // Drag row 1's handle onto row 3 (row 1's rect is the first target).
    pointer(wrapper.find('[data-iris-row-drag-handle="1"]').element, 'pointerdown', 20, 20)
    pointer(wrapper.element, 'pointermove', 20, 100)
    pointer(wrapper.element, 'pointerup', 20, 100)
    await nextTick()
    expect(nameCells(wrapper)).toEqual(['Alice', 'Bob', 'Charlie'])
    expect(onReorder).toHaveBeenCalledWith([rows[1], rows[2], rows[0]])
    expect(onDataChange).toHaveBeenCalledWith([rows[1], rows[2], rows[0]])
  })

  it('rowDrag reorders static tree siblings through the Core source tree', async () => {
    stubRowRects()
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    const childA: TreeRow = { id: 2, name: 'A' }
    const childB: TreeRow = { id: 3, name: 'B' }
    const root: TreeRow = { id: 1, name: 'Root', children: [childA, childB] }
    const onReorder = vi.fn()
    const onDataChange = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns: [{ key: 'name', title: 'Name' }],
        data: [root],
        rowKey: 'id',
        getSubRows: (row: TreeRow) => row.children,
        defaultExpandedRowKeys: [1],
        rowDrag: { onReorder },
        onDataChange,
      },
      attachTo: host,
    })

    pointer(wrapper.find('[data-iris-row-drag-handle="2"]').element, 'pointerdown', 20, 60)
    pointer(wrapper.element, 'pointermove', 20, 100)
    pointer(wrapper.element, 'pointerup', 20, 100)
    await nextTick()

    expect(nameCells(wrapper)).toEqual(['▶Root', 'B', 'A'])
    expect(onReorder).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, children: [childB, childA] }),
    ])
    expect(onDataChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, children: [childB, childA] }),
    ])
    expect(root.children).toEqual([childA, childB])
  })

  it('expose.loadData replaces rows without a query; a parent data re-feed wins again', async () => {
    const onDataChange = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        onDataChange,
      },
      attachTo: host,
    })
    const nova: Row = { id: 9, name: 'Nova', age: 1, status: 'new' }
    exposed(wrapper).loadData([nova])
    await nextTick()
    expect(nameCells(wrapper)).toEqual(['Nova'])
    expect(onDataChange).toHaveBeenCalledWith([nova])
    // The parent re-feed (NEW reference) clears the override (controlled prop
    // wins again); a same-reference setProps would keep the live rows.
    await wrapper.setProps({ data: [...rows] })
    await nextTick()
    expect(nameCells(wrapper)).toEqual(['Charlie', 'Alice', 'Bob'])
  })

  it('expose proxy methods: loadData without query, reloadData re-queries, commitProxy merges, getProxyInfo snapshots', async () => {
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 25 }))
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: [],
        rowKey: 'id',
        proxyConfig: { query },
      },
      attachTo: host,
    })
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
    expect(nameCells(wrapper)).toEqual(['Charlie'])
    // loadData: replaces the live list, NO new query.
    exposed(wrapper).loadData([rows[1]])
    await nextTick()
    expect(nameCells(wrapper)).toEqual(['Alice'])
    expect(query).toHaveBeenCalledTimes(1)
    // reloadData: re-fetches the current page.
    exposed(wrapper).reloadData()
    await settle()
    expect(query).toHaveBeenCalledTimes(2)
    expect(nameCells(wrapper)).toEqual(['Charlie'])
    // commitProxy: merges params and re-requests.
    exposed(wrapper).commitProxy({ page: 2 })
    await settle()
    expect(query).toHaveBeenLastCalledWith({ page: 2, pageSize: 10, sort: null, filters: {} })
    // getProxyInfo: page/pageSize/total snapshot; null without a proxy.
    expect(exposed(wrapper).getProxyInfo()).toEqual({ page: 2, pageSize: 10, total: 25 })
    const local = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id' },
      attachTo: host,
    })
    expect(exposed(local).getProxyInfo()).toBeNull()
  })
})
