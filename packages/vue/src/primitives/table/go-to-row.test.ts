import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTableExpose } from './types'

enableAutoUnmount(afterEach)

type Row = { id: number; name: string }
const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]
const rows: Row[] = [
  { id: 1, name: 'Alpha' },
  { id: 2, name: 'Beta' },
  { id: 3, name: 'Gamma' },
]

describe('IrisTable expose.goToRow', () => {
  let scrollSpy: ReturnType<typeof vi.fn>

  afterEach(() => {
    vi.useRealTimers()
    delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
  })

  function mountTable() {
    scrollSpy = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollSpy,
    })
    return mount(IrisTable, { props: { columns, data: rows, rowKey: 'id' } })
  }

  it('scrolls a rendered row and applies a transient target marker', () => {
    const wrapper = mountTable()
    const expose = wrapper.vm as unknown as IrisTableExpose<Row>

    expose.goToRow(2)

    expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest' })
    expect(wrapper.find('[data-iris-table-row-key="2"]').attributes('data-iris-row-target')).toBe(
      'true',
    )
  })

  it('replaces the previous target and clears it after two seconds', () => {
    vi.useFakeTimers()
    const wrapper = mountTable()
    const expose = wrapper.vm as unknown as IrisTableExpose<Row>

    expose.goToRow(1)
    expose.goToRow(3)
    expect(wrapper.find('[data-iris-table-row-key="1"]').attributes('data-iris-row-target')).toBe(
      undefined,
    )
    expect(wrapper.find('[data-iris-table-row-key="3"]').attributes('data-iris-row-target')).toBe(
      'true',
    )

    vi.advanceTimersByTime(1999)
    expect(wrapper.find('[data-iris-table-row-key="3"]').attributes('data-iris-row-target')).toBe(
      'true',
    )
    vi.advanceTimersByTime(1)
    expect(wrapper.find('[data-iris-table-row-key="3"]').attributes('data-iris-row-target')).toBe(
      undefined,
    )
  })

  it('keeps scrollToRow as a non-highlighting operation and ignores unknown keys', () => {
    const wrapper = mountTable()
    const expose = wrapper.vm as unknown as IrisTableExpose<Row>

    expose.scrollToRow(2)
    expose.goToRow(999)

    expect(scrollSpy).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-iris-row-target="true"]').exists()).toBe(false)
  })
})
