import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

enableAutoUnmount(afterEach)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  status: string
  level: number
}

const rows: Row[] = [
  { id: 1, name: 'ab', status: 'active', level: 1 },
  { id: 2, name: 'bc', status: 'paused', level: 2 },
  { id: 3, name: 'ca', status: 'active', level: 3 },
]

const filterCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
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
  {
    key: 'level',
    title: 'Level',
    filterable: true,
    filterOptions: [
      { value: '1', label: 'One' },
      { value: '2', label: 'Two' },
    ],
  },
]

function panel(): HTMLElement | null {
  return document.querySelector('[data-iris-table-filter-panel]')
}

function recentTitle(): HTMLElement | null {
  return document.querySelector('[data-iris-filter-recent-title]')
}

function recentEntry(index: number): HTMLElement | null {
  return document.querySelector(`[data-iris-filter-recent="${index}"]`)
}

describe('@iris-ui-kit/vue IrisTable recent filters', () => {
  let host: HTMLDivElement

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  afterEach(() => {
    host.remove()
    vi.restoreAllMocks()
  })

  function mountTable(extra: Record<string, unknown> = {}) {
    return mount(IrisTable, {
      props: {
        columns: filterCols,
        data: rows,
        rowKey: 'id',
        recentFilters: true,
        ...extra,
      },
      attachTo: host,
    })
  }

  async function openFilter(wrapper: ReturnType<typeof mount>, key: string): Promise<void> {
    await wrapper.find(`[data-iris-filter-trigger="${key}"]`).trigger('click')
    await nextTick()
  }

  async function confirmFilter(value?: string): Promise<void> {
    if (value !== undefined) {
      ;(
        panel()!.querySelector(`[data-iris-filter-option="${value}"] input`) as HTMLInputElement
      ).click()
      await nextTick()
    }
    ;(panel()!.querySelector('[data-iris-filter-confirm]') as HTMLElement).click()
    await nextTick()
  }

  it('records non-empty confirms only; clear is not recorded', async () => {
    const wrapper = mountTable()
    await openFilter(wrapper, 'status')
    ;(panel()!.querySelector('[data-iris-filter-clear]') as HTMLElement).click()
    await nextTick()
    await openFilter(wrapper, 'status')
    expect(recentTitle()).toBeNull()

    await confirmFilter('active')
    await openFilter(wrapper, 'status')
    expect(recentTitle()!.textContent).toBe('Recent filters')
    expect(recentEntry(0)!.textContent).toBe('Status: Active')
  })

  it('renders recent entries above the ordinary filter options', async () => {
    const wrapper = mountTable()
    await openFilter(wrapper, 'status')
    await confirmFilter('active')
    await openFilter(wrapper, 'level')

    const title = recentTitle()!
    const firstOption = panel()!.querySelector('[data-iris-filter-option]')!
    expect(title.textContent).toBe('Recent filters')
    expect(
      title.compareDocumentPosition(firstOption) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(recentEntry(0)!.textContent).toBe('Status: Active')
  })

  it('applies a recent entry through the ordinary path and closes the panel', async () => {
    const onChange = vi.fn()
    const wrapper = mountTable({ filterValues: {}, onFilterValuesChange: onChange })
    await openFilter(wrapper, 'status')
    await confirmFilter('active')
    await openFilter(wrapper, 'level')
    ;(recentEntry(0) as HTMLElement).click()
    await nextTick()

    expect(onChange).toHaveBeenLastCalledWith({ status: ['active'] })
    expect(panel()).toBeNull()
  })

  it('uses the column title and option labels for recent entries', async () => {
    const wrapper = mountTable()
    await openFilter(wrapper, 'status')
    await confirmFilter('paused')
    await openFilter(wrapper, 'status')
    await confirmFilter('active')
    await openFilter(wrapper, 'level')

    expect(recentEntry(0)!.textContent).toBe('Status: Paused, Active')
  })

  it('re-confirming a set moves it to the MRU top without duplicating it', async () => {
    const wrapper = mountTable()
    await openFilter(wrapper, 'status')
    await confirmFilter('active')
    await openFilter(wrapper, 'level')
    await confirmFilter('1')
    await openFilter(wrapper, 'status')
    await confirmFilter()
    await openFilter(wrapper, 'status')

    expect(recentEntry(0)!.textContent).toBe('Status: Active')
    expect(recentEntry(1)!.textContent).toBe('Level: One')
    expect(panel()!.querySelectorAll('[data-iris-filter-recent]')).toHaveLength(2)
  })

  it('is inert without the recentFilters prop', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns: filterCols, data: rows, rowKey: 'id' },
      attachTo: host,
    })
    await openFilter(wrapper, 'status')
    await confirmFilter('active')
    await openFilter(wrapper, 'status')

    expect(recentTitle()).toBeNull()
    expect(panel()!.querySelector('[data-iris-filter-recent]')).toBeNull()
  })

  it('records without an onFilterValuesChange callback (controlled-irrelevant)', async () => {
    const wrapper = mountTable({ filterValues: {} })
    await openFilter(wrapper, 'status')
    await confirmFilter('active')
    await openFilter(wrapper, 'status')

    expect(recentEntry(0)!.textContent).toBe('Status: Active')
  })
})
