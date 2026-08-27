import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

enableAutoUnmount(afterEach)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  status: string
  note?: string
  children?: Row[]
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25, status: 'active' },
  { id: 2, name: 'Alice', age: 32, status: 'paused' },
  { id: 3, name: 'Bob', age: 28, status: 'active' },
]

/** Two editable columns (text + number) and one plain column. */
const filterCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  {
    key: 'status',
    title: 'Status',
    sortable: true,
    filterable: true,
    filterOptions: [
      { value: 'active', label: 'Active' },
      { value: 'paused', label: 'Paused' },
    ],
  },
]

const treeCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

/** Flush microtasks (promise resolutions — floating positioning, async
 * validation) then the Vue render queue. */
async function settle(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 0))
  await nextTick()
}

/** Body rows only (the summary/loading/error/empty state rows carry named
 * `data-iris-table-row` values; real rows carry an empty value). */
function bodyRows(wrapper: ReturnType<typeof mount>) {
  return wrapper
    .findAll('[data-iris-table-row]')
    .filter((r) => r.attributes('data-iris-table-row') === '')
}

function filterActive(wrapper: ReturnType<typeof mount>): string | null {
  return (
    wrapper.find('[data-iris-filter-trigger="status"]').attributes('data-iris-filter-active') ??
    null
  )
}

describe('IrisTable batch Z — filterValues panel (vxe filterConfig parity)', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => {
    host.remove()
    vi.restoreAllMocks()
  })

  function panel(): HTMLElement | null {
    return document.querySelector('[data-iris-table-filter-panel]')
  }

  function trigger(wrapper: ReturnType<typeof mount>): ReturnType<typeof wrapper.find> {
    return wrapper.find('[data-iris-filter-trigger="status"]')
  }

  /** Controlled filterValues harness — onFilterValuesChange feeds the prop
   * back (the pair is controlled-only, React parity). */
  function mountHarness(initial: Record<string, string[]> = {}) {
    let applied: Record<string, string[]> = { ...initial }
    const wrapper = mount(IrisTable, {
      props: {
        columns: filterCols,
        data: rows,
        rowKey: 'id',
        filterValues: { ...initial },
        onFilterValuesChange: (next: Record<string, string[]>) => {
          applied = next
          void wrapper.setProps({ filterValues: { ...next } })
        },
      },
      attachTo: host,
    })
    return { wrapper, applied: () => applied }
  }

  it('a filterable header shows the trigger; clicking it opens the panel WITHOUT sorting', async () => {
    const { wrapper } = mountHarness()
    const trg = trigger(wrapper)
    expect(trg.exists()).toBe(true)
    expect(trg.attributes('aria-label')).toBe('Filter')
    // The status column is sortable too — the trigger click must not sort.
    await trg.trigger('click')
    await nextTick()
    expect(panel()).not.toBeNull()
    expect(panel()!.parentElement).toBe(document.body)
    expect(panel()!.getAttribute('role')).toBe('dialog')
    expect(panel()!.getAttribute('data-iris-table-filter-column')).toBe('status')
    const options = panel()!.querySelectorAll('[data-iris-filter-option]')
    expect(options.length).toBe(2)
    expect(options[0]!.textContent).toContain('Active')
    expect(options[1]!.textContent).toContain('Paused')
    expect(wrapper.find('[data-iris-table-header="status"]').attributes('aria-sort')).toBe('none')
  })

  it('checking options + confirm filters rows (OR-match) and highlights the trigger', async () => {
    const { wrapper, applied } = mountHarness()
    await trigger(wrapper).trigger('click')
    await nextTick()
    const activeBox = panel()!.querySelector('[data-iris-filter-option="active"] input')!
    ;(activeBox as HTMLInputElement).click()
    await nextTick()
    ;(panel()!.querySelector('[data-iris-filter-confirm]') as HTMLElement).click()
    await nextTick()
    // OR-match: only 'active' rows survive.
    expect(applied()).toEqual({ status: ['active'] })
    expect(bodyRows(wrapper).map((r) => r.find('[data-iris-table-cell="name"]').text())).toEqual([
      'Charlie',
      'Bob',
    ])
    expect(trigger(wrapper).attributes('data-iris-filter-active')).toBe('true')

    // A second open pre-checks the applied set; adding 'paused' widens to all.
    await trigger(wrapper).trigger('click')
    await nextTick()
    expect(
      (panel()!.querySelector('[data-iris-filter-option="active"] input') as HTMLInputElement)
        .checked,
    ).toBe(true)
    ;(
      panel()!.querySelector('[data-iris-filter-option="paused"] input') as HTMLInputElement
    ).click()
    await nextTick()
    ;(panel()!.querySelector('[data-iris-filter-confirm]') as HTMLElement).click()
    await nextTick()
    expect(applied()).toEqual({ status: ['active', 'paused'] })
    expect(bodyRows(wrapper).length).toBe(3)
  })

  it('clear removes the filter immediately', async () => {
    const { wrapper, applied } = mountHarness({ status: ['active'] })
    expect(trigger(wrapper).attributes('data-iris-filter-active')).toBe('true')
    await trigger(wrapper).trigger('click')
    await nextTick()
    ;(panel()!.querySelector('[data-iris-filter-clear]') as HTMLElement).click()
    await nextTick()
    expect(applied()).toEqual({})
    expect(filterActive(wrapper)).toBeNull()
    expect(bodyRows(wrapper).length).toBe(3)
  })

  it('a text filter AND the checked set combine (both must pass)', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: filterCols,
        data: rows,
        rowKey: 'id',
        filters: { name: 'a' },
        filterValues: { status: ['active'] },
      },
      attachTo: host,
    })
    // name contains 'a' AND status in {active}: only row 1 ('Charlie')
    // ('Alice' is paused; 'Bob' has no 'a').
    expect(bodyRows(wrapper).map((r) => r.find('[data-iris-table-cell="name"]').text())).toEqual([
      'Charlie',
    ])
  })

  it('remote mode: comma-joins the checked sets into the proxy query filters', async () => {
    const query = vi.fn(async () => ({ rows, total: rows.length }))
    const wrapper = mount(IrisTable, {
      props: {
        columns: filterCols,
        data: [],
        rowKey: 'id',
        filterValues: { status: ['active', 'paused'] },
        proxyConfig: { query, remoteFilter: true },
      },
      attachTo: host,
    })
    await settle()
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { status: 'active,paused' } }),
    )
    // Confirming a filter re-queries with the comma-joined set.
    await wrapper.find('[data-iris-filter-trigger="status"]').trigger('click')
    await nextTick()
    ;(
      panel()!.querySelector('[data-iris-filter-option="active"] input') as HTMLInputElement
    ).click()
    await nextTick()
    ;(panel()!.querySelector('[data-iris-filter-confirm]') as HTMLElement).click()
    await wrapper.setProps({ filterValues: { status: ['active'] } })
    await settle()
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: { status: 'active' }, page: 1 }),
    )
  })
})

describe('IrisTable batch Z — lazy tree (vxe lazyLoad parity)', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => {
    host.remove()
    vi.restoreAllMocks()
  })

  const lazyRoots: Row[] = [{ id: 1, name: 'root', age: 1 }]

  function caret(wrapper: ReturnType<typeof mount>): ReturnType<typeof wrapper.find> {
    return bodyRows(wrapper)[0]!.find('[data-iris-table-tree-toggle]')
  }

  it('a childless row renders a caret only when lazyLoad is configured', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: treeCols,
        data: lazyRoots,
        rowKey: 'id',
        getSubRows: (r) => r.children,
        lazyLoad: () => {},
      },
      attachTo: host,
    })
    expect(caret(wrapper).exists()).toBe(true)
    expect(caret(wrapper).attributes('aria-expanded')).toBe('false')
    expect(caret(wrapper).attributes('data-iris-tree-loading') ?? null).toBeNull()

    const plain = mount(IrisTable, {
      props: {
        columns: treeCols,
        data: lazyRoots,
        rowKey: 'id',
        getSubRows: (r) => r.children,
      },
      attachTo: host,
    })
    expect(caret(plain).exists()).toBe(false)
  })

  it('click calls lazyLoad with the row; load(children) renders them expanded', async () => {
    const lazyLoad = vi.fn((_row: Row, load: (children: Row[]) => void) => {
      load([
        { id: 2, name: 'child', age: 2 },
        { id: 3, name: 'child2', age: 3 },
      ])
    })
    const wrapper = mount(IrisTable, {
      props: {
        columns: treeCols,
        data: lazyRoots,
        rowKey: 'id',
        getSubRows: (r) => r.children,
        lazyLoad,
      },
      attachTo: host,
    })
    await caret(wrapper).trigger('click')
    await nextTick()
    expect(lazyLoad).toHaveBeenCalledTimes(1)
    expect(lazyLoad.mock.calls[0]![0]).toEqual(lazyRoots[0])
    // Loaded children render, expanded.
    expect(bodyRows(wrapper).length).toBe(3)
    expect(bodyRows(wrapper)[1]!.find('[data-iris-table-cell="name"]').text()).toContain('child')
    expect(caret(wrapper).attributes('aria-expanded')).toBe('true')
  })

  it('after load the caret toggles collapse / expand like a normal parent', async () => {
    const lazyLoad = vi.fn((_row: Row, load: (children: Row[]) => void) => {
      load([{ id: 2, name: 'child', age: 2 }])
    })
    const wrapper = mount(IrisTable, {
      props: {
        columns: treeCols,
        data: lazyRoots,
        rowKey: 'id',
        getSubRows: (r) => r.children,
        lazyLoad,
      },
      attachTo: host,
    })
    await caret(wrapper).trigger('click')
    await nextTick()
    expect(bodyRows(wrapper).length).toBe(2)
    // Collapse.
    await caret(wrapper).trigger('click')
    await nextTick()
    expect(bodyRows(wrapper).length).toBe(1)
    expect(caret(wrapper).attributes('aria-expanded')).toBe('false')
    // Expand again — no second lazyLoad (children are cached).
    await caret(wrapper).trigger('click')
    await nextTick()
    expect(bodyRows(wrapper).length).toBe(2)
    expect(lazyLoad).toHaveBeenCalledTimes(1)
  })

  it('loading state prevents double-load and resolves into an expanded tree', async () => {
    let resolve!: (children: Row[]) => void
    const lazyLoad = vi.fn((_row: Row, load: (children: Row[]) => void) => {
      resolve = load
    })
    const wrapper = mount(IrisTable, {
      props: {
        columns: treeCols,
        data: lazyRoots,
        rowKey: 'id',
        getSubRows: (r) => r.children,
        lazyLoad,
      },
      attachTo: host,
    })
    await caret(wrapper).trigger('click')
    await nextTick()
    expect(caret(wrapper).attributes('data-iris-tree-loading')).toBe('')
    // Second click while loading is a no-op.
    await caret(wrapper).trigger('click')
    await nextTick()
    expect(lazyLoad).toHaveBeenCalledTimes(1)
    resolve([{ id: 2, name: 'child', age: 2 }])
    await nextTick()
    expect(caret(wrapper).attributes('data-iris-tree-loading') ?? null).toBeNull()
    expect(bodyRows(wrapper).length).toBe(2)
    expect(caret(wrapper).attributes('aria-expanded')).toBe('true')
  })

  it('a new data reference drops cached lazy children so they reload on expand', async () => {
    const lazyLoad = vi.fn((_row: Row, load: (children: Row[]) => void) => {
      load([{ id: 2, name: 'child', age: 2 }])
    })
    const wrapper = mount(IrisTable, {
      props: {
        columns: treeCols,
        data: [{ ...lazyRoots[0] }],
        rowKey: 'id',
        getSubRows: (r) => r.children,
        lazyLoad,
      },
      attachTo: host,
    })
    await caret(wrapper).trigger('click')
    await nextTick()
    expect(bodyRows(wrapper).length).toBe(2)
    expect(lazyLoad).toHaveBeenCalledTimes(1)
    // The parent re-feeds a NEW data array (same childless shape) — the cache
    // is gone, so the row is a lazy leaf again with a caret.
    await wrapper.setProps({ data: [{ ...lazyRoots[0] }] })
    await nextTick()
    expect(bodyRows(wrapper).length).toBe(1)
    expect(caret(wrapper).exists()).toBe(true)
    // React parity: the row's expand state survives the refresh, so the first
    // expand re-fetches and TOGGLES it closed again; a second click expands
    // the freshly cached children.
    await caret(wrapper).trigger('click')
    await nextTick()
    expect(lazyLoad).toHaveBeenCalledTimes(2)
    await caret(wrapper).trigger('click')
    await nextTick()
    expect(bodyRows(wrapper).length).toBe(2)
  })

  it('an in-flight lazyLoad resolving after a data refresh does not re-seed the cache', async () => {
    let pending: ((children: Row[]) => void) | null = null
    const lazyLoad = vi.fn((_row: Row, load: (children: Row[]) => void) => {
      pending = load
    })
    const wrapper = mount(IrisTable, {
      props: {
        columns: treeCols,
        data: [{ ...lazyRoots[0] }],
        rowKey: 'id',
        getSubRows: (r) => r.children,
        lazyLoad,
      },
      attachTo: host,
    })
    await caret(wrapper).trigger('click')
    await nextTick()
    expect(pending).not.toBeNull()
    // The parent refreshes the data WHILE the fetch is in flight.
    await wrapper.setProps({ data: [{ ...lazyRoots[0] }] })
    await nextTick()
    // The stale fetch resolves AFTER the refresh — it must not re-seed the
    // cleared cache with its old children.
    pending!([{ id: 2, name: 'stale child', age: 2 }])
    await nextTick()
    expect(bodyRows(wrapper).length).toBe(1)
    expect(caret(wrapper).attributes('data-iris-tree-loading') ?? null).toBeNull()
  })

  it('cascades selection through loaded lazy children without a getSubRows accessor', async () => {
    const selection = ref<Array<string | number>>([])
    const lazyLoad = vi.fn((_row: Row, load: (children: Row[]) => void) => {
      load([{ id: 11, name: 'lazy child', age: 11, status: 'active' }])
    })
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisTable, {
            columns: treeCols,
            data: lazyRoots,
            rowKey: 'id',
            lazyLoad,
            selectable: 'multi',
            treeSelectionCascade: true,
            selection: selection.value,
            'onUpdate:selection': (keys: Array<string | number>) => {
              selection.value = keys
            },
          })
      },
    })
    const wrapper = mount(Harness, { attachTo: host })
    await caret(wrapper).trigger('click')
    await nextTick()
    await bodyRows(wrapper)[0]!.find('[data-iris-checkbox] input').setValue(true)
    await nextTick()
    expect(new Set(selection.value)).toEqual(new Set([1, 11]))
  })
})
