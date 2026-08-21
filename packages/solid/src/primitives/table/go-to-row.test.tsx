import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn, IrisTableHandle } from './types'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
})

type Row = { id: number; name: string }
const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]
const rows: Row[] = [
  { id: 1, name: 'Alpha' },
  { id: 2, name: 'Beta' },
  { id: 3, name: 'Gamma' },
]

describe('Solid IrisTable goToRow', () => {
  function renderTable() {
    const tableRef: { current: IrisTableHandle<Row> | null } = { current: null }
    const scrollSpy = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollSpy,
    })
    const rendered = render(() => (
      <IrisTable columns={columns} data={rows} rowKey="id" tableRef={tableRef} />
    ))
    return { ...rendered, tableRef, scrollSpy }
  }

  it('scrolls and marks the requested row', () => {
    const { container, tableRef, scrollSpy } = renderTable()

    tableRef.current!.goToRow(2)

    expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest' })
    expect(
      container
        .querySelector('[data-iris-table-row-key="2"]')
        ?.getAttribute('data-iris-row-target'),
    ).toBe('true')
  })

  it('keeps one target, restarts the timer, and ignores unknown rows', () => {
    vi.useFakeTimers()
    const { container, tableRef } = renderTable()
    const row = (key: number) => container.querySelector(`[data-iris-table-row-key="${key}"]`)

    tableRef.current!.goToRow(1)
    vi.advanceTimersByTime(1500)
    tableRef.current!.goToRow(3)
    expect(row(1)?.getAttribute('data-iris-row-target')).toBeNull()
    expect(row(3)?.getAttribute('data-iris-row-target')).toBe('true')

    tableRef.current!.goToRow(999)
    vi.advanceTimersByTime(1999)
    expect(row(3)?.getAttribute('data-iris-row-target')).toBe('true')
    vi.advanceTimersByTime(1)
    expect(row(3)?.getAttribute('data-iris-row-target')).toBeNull()
  })

  it('scrollToRow does not add a target marker', () => {
    const { container, tableRef, scrollSpy } = renderTable()

    tableRef.current!.scrollToRow(2)
    tableRef.current!.scrollToRow(999)

    expect(scrollSpy).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-iris-row-target="true"]')).toBeNull()
  })
})
