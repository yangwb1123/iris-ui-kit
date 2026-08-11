import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

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
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true },
  { key: 'status', title: 'Status' },
]

const editableColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true, editable: true },
  { key: 'age', title: 'Age' },
]

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

/** Flush microtasks (promise resolutions) then the Vue render queue. */
async function settle(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 0))
  await nextTick()
}

function nameCells(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll('[data-iris-table-cell="name"]').map((c) => c.text())
}

function form(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('[data-iris-table-form]')
}

function nameInput(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('[data-iris-table-form-field="name"] input')
}

describe('IrisTable proxyConfig (vxe-grid proxyConfig parity, batch X)', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => host.remove())

  it('renders the loading state, then the rows once the query resolves', async () => {
    const d = deferred<{ rows: Row[]; total: number }>()
    const query = vi.fn(() => d.promise)
    const wrapper = mount(IrisTable, {
      props: { columns, data: [], rowKey: 'id', proxyConfig: { query } },
      attachTo: host,
    })
    // The first fetch kicks from onMounted (React effect parity) — the
    // loading row appears after the mount tick, not on the first render.
    await nextTick()
    expect(wrapper.find('[data-iris-table-row="loading"]').exists()).toBe(true)
    d.resolve({ rows: [rows[0]], total: 1 })
    await settle()
    expect(nameCells(wrapper)).toEqual(['Charlie'])
    expect(query).toHaveBeenCalledWith({ page: 1, pageSize: 10, sort: null, filters: {} })
    // The pager renders below the body (proxy mode).
    expect(wrapper.find('[data-iris-table-pager]').exists()).toBe(true)
  })

  it('renders the error UI when the query rejects and Retry refetches', async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ rows: [rows[1]], total: 1 })
    const wrapper = mount(IrisTable, {
      props: { columns, data: [], rowKey: 'id', proxyConfig: { query } },
      attachTo: host,
    })
    await settle()
    expect(wrapper.find('[data-iris-table-row="error"]').exists()).toBe(true)
    await wrapper.find('[data-iris-table-retry]').trigger('click')
    await settle()
    expect(nameCells(wrapper)).toEqual(['Alice'])
    expect(query).toHaveBeenCalledTimes(2)
  })

  it('remoteSort: clicking a sortable header re-queries with the sort param', async () => {
    const query = vi.fn(async () => ({ rows: [rows[1]], total: 3 }))
    const wrapper = mount(IrisTable, {
      props: { columns, data: [], rowKey: 'id', proxyConfig: { query, remoteSort: true } },
      attachTo: host,
    })
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
    await wrapper.find('[data-iris-table-header="name"]').trigger('click')
    await settle()
    expect(query).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      sort: { key: 'name', direction: 'asc' },
      filters: {},
    })
    // Remote sort cycles asc → desc on further clicks.
    await wrapper.find('[data-iris-table-header="name"]').trigger('click')
    await settle()
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: { key: 'name', direction: 'desc' } }),
    )
  })

  it('page change re-queries with page=2 and fires onPageChange', async () => {
    const onPageChange = vi.fn()
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 25 }))
    const wrapper = mount(IrisTable, {
      props: { columns, data: [], rowKey: 'id', proxyConfig: { query, onPageChange } },
      attachTo: host,
    })
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
    await wrapper.find('[data-iris-pagination-item="next"]').trigger('click')
    await settle()
    expect(query).toHaveBeenLastCalledWith({ page: 2, pageSize: 10, sort: null, filters: {} })
    expect(onPageChange).toHaveBeenCalledWith(2, 10)
  })

  it('autoLoad=false does not query on mount; the first setParams loads', async () => {
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 25 }))
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: [],
        rowKey: 'id',
        proxyConfig: { query, autoLoad: false, remoteSort: true },
      },
      attachTo: host,
    })
    await settle()
    expect(query).not.toHaveBeenCalled()
    // A remote sort is the first setParams — it fires the first request.
    await wrapper.find('[data-iris-table-header="name"]').trigger('click')
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      sort: { key: 'name', direction: 'asc' },
      filters: {},
    })
  })

  it('edit write-back coexists with proxyConfig: local edit survives until the next refetch', async () => {
    const query = vi.fn(async () => ({ rows: [{ id: 1, name: 'Alice', age: 32 }], total: 1 }))
    const wrapper = mount(IrisTable, {
      props: {
        columns: editableColumns,
        data: [],
        rowKey: 'id',
        proxyConfig: { query, remoteSort: true },
      },
      attachTo: host,
    })
    await settle()
    expect(nameCells(wrapper)).toEqual(['Alice'])
    // Commit an inline edit — the table owns a live copy, so it sticks locally.
    await wrapper.find('[data-iris-table-cell="name"]').trigger('dblclick')
    const input = wrapper.find('[data-iris-table-editor]')
    await input.setValue('Zoe')
    await input.trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(nameCells(wrapper)).toEqual(['Zoe'])
    // The next refetch (here: a remote sort) replaces the local edit.
    query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Server', age: 32 }], total: 1 })
    await wrapper.find('[data-iris-table-header="name"]').trigger('click')
    await settle()
    expect(nameCells(wrapper)).toEqual(['Server'])
  })

  it('without remoteSort, the local sort behavior stays (no re-query)', async () => {
    const query = vi.fn(async () => ({ rows: [rows[2], rows[1], rows[0]], total: 3 }))
    const wrapper = mount(IrisTable, {
      props: { columns, data: [], rowKey: 'id', proxyConfig: { query } },
      attachTo: host,
    })
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
    await wrapper.find('[data-iris-table-header="name"]').trigger('click')
    await nextTick()
    expect(query).toHaveBeenCalledTimes(1)
    // Sorted client-side (Bob, Alice, Charlie → Alice, Bob, Charlie).
    expect(nameCells(wrapper)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('controlled `sort` prop change re-queries with the new sort and resets to page 1', async () => {
    // A parent driving v-model:sort with remoteSort must re-query (review
    // finding: Vue previously only pushed on internal state change — the
    // header indicator and server rows diverged). Sort changes reset the page
    // to 1, vxe behavior.
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 25 }))
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: [],
        rowKey: 'id',
        sort: { key: 'name', direction: 'asc' },
        proxyConfig: { query, remoteSort: true },
      },
      attachTo: host,
    })
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
    await wrapper.find('[data-iris-pagination-item="next"]').trigger('click')
    await settle()
    expect(query).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    await wrapper.setProps({ sort: { key: 'name', direction: 'desc' } })
    await settle()
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, sort: { key: 'name', direction: 'desc' } }),
    )
  })

  it('same-value controlled sort with fresh identity does not re-query or reset the page', async () => {
    // The parent re-renders with a NEW inline sort object of the SAME value:
    // core setParams dedupes — no re-query, page stays on 2 (React parity).
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 25 }))
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: [],
        rowKey: 'id',
        sort: { key: 'name', direction: 'asc' },
        proxyConfig: { query, remoteSort: true },
      },
      attachTo: host,
    })
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
    await wrapper.find('[data-iris-pagination-item="next"]').trigger('click')
    await settle()
    expect(query).toHaveBeenCalledTimes(2)
    await wrapper.setProps({ sort: { key: 'name', direction: 'asc' } })
    await settle()
    expect(query).toHaveBeenCalledTimes(2)
  })

  it('proxyConfig arriving after the first render still auto-loads', async () => {
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 1 }))
    const wrapper = mount(IrisTable, {
      props: { columns, data: [rows[0]], rowKey: 'id' },
      attachTo: host,
    })
    expect(query).not.toHaveBeenCalled()
    await wrapper.setProps({ proxyConfig: { query } })
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
    expect(nameCells(wrapper)).toEqual(['Charlie'])
  })
})

describe('IrisTable formConfig (vxe-grid formConfig parity, batch X)', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => host.remove())

  const formProps = {
    fields: [
      { key: 'name', label: 'Name', placeholder: 'Filter by name' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'paused', label: 'Paused' },
        ],
      },
    ],
  }

  it('renders the form above the toolbar with labels + text/select controls', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        formConfig: {
          fields: [
            { key: 'name', label: 'Name', defaultValue: 'Ada' },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: [{ value: 'active', label: 'Active' }],
            },
          ],
          submitText: 'Go',
          resetText: 'Clear',
        },
        toolbar: { title: 'Users' },
      },
      attachTo: host,
    })
    const formEl = form(wrapper).element as HTMLElement
    const toolbarEl = wrapper.find('[data-iris-table-toolbar]').element as HTMLElement
    // The form renders ABOVE the toolbar.
    expect(
      formEl.compareDocumentPosition(toolbarEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // Text field: label + input seeded from defaultValue.
    const nameField = wrapper.find('[data-iris-table-form-field="name"]')
    expect(nameField.find('[data-iris-form-field-label]').text()).toBe('Name')
    expect((nameField.find('input').element as HTMLInputElement).value).toBe('Ada')
    // Select field: label + trigger button.
    const statusField = wrapper.find('[data-iris-table-form-field="status"]')
    expect(statusField.find('[data-iris-form-field-label]').text()).toBe('Status')
    expect(statusField.find('[data-iris-select-trigger]').exists()).toBe(true)
    // Button labels come from formConfig.
    expect(wrapper.find('[data-iris-table-form-submit]').text()).toBe('Go')
    expect(wrapper.find('[data-iris-table-form-reset]').text()).toBe('Clear')
  })

  it('submit builds stripped values, fires onSearch, and re-queries with merged filters (proxy, page reset to 1)', async () => {
    const onSearch = vi.fn()
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 3 }))
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: [],
        rowKey: 'id',
        formConfig: { ...formProps, onSearch },
        proxyConfig: { query },
      },
      attachTo: host,
    })
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
    await nameInput(wrapper).setValue('Cha')
    // Untouched select field: empty string is stripped from the submitted values.
    await form(wrapper).trigger('submit')
    expect(onSearch).toHaveBeenCalledWith({ name: 'Cha' })
    await settle()
    expect(query).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      sort: null,
      filters: { name: 'Cha' },
    })
  })

  it('local mode: submit filters rows client-side; draft keystrokes do not; reset clears', async () => {
    const onReset = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        formConfig: { ...formProps, onReset },
      },
      attachTo: host,
    })
    expect(nameCells(wrapper).length).toBe(3)
    // Keystrokes before submit do NOT filter (draft/applied two-state).
    await nameInput(wrapper).setValue('Cha')
    await nextTick()
    expect(nameCells(wrapper).length).toBe(3)
    await form(wrapper).trigger('submit')
    await nextTick()
    expect(nameCells(wrapper)).toEqual(['Charlie'])
    // Reset clears the draft, restores all rows, and notifies the parent.
    await form(wrapper).trigger('reset')
    await nextTick()
    expect((nameInput(wrapper).element as HTMLInputElement).value).toBe('')
    expect(nameCells(wrapper).length).toBe(3)
    expect(onReset).toHaveBeenCalledWith({})
  })

  it('reset re-queries with cleared filters in proxy mode (refetch fallback on no-op)', async () => {
    const onReset = vi.fn()
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 3 }))
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: [],
        rowKey: 'id',
        formConfig: { ...formProps, onReset },
        proxyConfig: { query },
      },
      attachTo: host,
    })
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
    await nameInput(wrapper).setValue('Cha')
    await form(wrapper).trigger('submit')
    await settle()
    expect(query).toHaveBeenCalledTimes(2)
    await form(wrapper).trigger('reset')
    await settle()
    // filters value change ({name:'Cha'} → {}) re-queries; the parent is told
    // the reset values (defaults re-applied) and the draft is cleared.
    expect(query.mock.calls.length).toBe(3)
    expect(query).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, sort: null, filters: {} })
    expect(onReset).toHaveBeenCalledWith({})
    expect((nameInput(wrapper).element as HTMLInputElement).value).toBe('')
  })

  it('no formConfig renders no form', () => {
    const wrapper = mount(IrisTable, { props: { columns, data: rows, rowKey: 'id' } })
    expect(wrapper.find('[data-iris-table-form]').exists()).toBe(false)
  })
})
