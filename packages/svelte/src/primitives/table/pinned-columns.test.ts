import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import IrisTable from './IrisTable.svelte'
import type { IrisTableColumn } from './types'

afterEach(cleanup)

type Row = { id: number; a: string; b: number; c: string }

const rows: Row[] = [{ id: 1, a: 'A', b: 2, c: 'C' }]
const columns: IrisTableColumn<Row>[] = [
  { key: 'a', title: 'A', width: 100, pinned: 'left' },
  { key: 'b', title: 'B', width: 80, summary: 'sum' },
  { key: 'c', title: 'C', width: 60, pinned: 'right' },
]

function header(container: HTMLElement, key: string): HTMLElement {
  return container.querySelector(`[data-iris-table-header="${key}"]`) as HTMLElement
}

function cell(container: HTMLElement, key: string): HTMLElement {
  return container.querySelector(`[data-iris-table-cell="${key}"]`) as HTMLElement
}

describe('Svelte IrisTable controlled pinnedColumns projection', () => {
  it('projects explicit sides and null through header, body, summary, and sticky offsets', () => {
    const { container } = render(IrisTable, {
      props: {
        columns,
        data: rows,
        pinnedColumns: { a: 'left', b: 'left', c: null },
      },
    })

    expect(header(container, 'a').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header(container, 'b').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header(container, 'a').style.position).toBe('sticky')
    expect(header(container, 'a').style.left).toBe('0px')
    expect(header(container, 'b').style.left).toBe('100px')
    expect(header(container, 'c').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(cell(container, 'a').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(cell(container, 'b').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(cell(container, 'c').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(
      container
        .querySelector('[data-iris-table-summary-cell]')
        ?.getAttribute('data-iris-table-pinned'),
    ).toBe('left')
  })

  it('uses absent keys as declaration fallback and treats {} as non-unpinning', async () => {
    const view = render(IrisTable, {
      props: { columns, data: rows, pinnedColumns: {} },
    })
    expect(header(view.container, 'a').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header(view.container, 'c').getAttribute('data-iris-table-pinned')).toBe('right')
    expect(header(view.container, 'c').style.right).toBe('0px')

    await view.rerender({ pinnedColumns: { c: null } })
    flushSync()
    expect(header(view.container, 'a').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header(view.container, 'c').getAttribute('data-iris-table-pinned')).toBeNull()
  })

  it('accepts replacements silently and restores declarations when control is removed', async () => {
    const onPinned = vi.fn()
    const onCount = vi.fn()
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        pinnedColumns: { a: null, c: 'left' },
        onColumnPinnedChange: onPinned,
        onPinnedCountChange: onCount,
      },
    })
    await view.rerender({ pinnedColumns: { b: 'right' } })
    flushSync()
    expect(header(view.container, 'a').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header(view.container, 'b').getAttribute('data-iris-table-pinned')).toBe('right')
    expect(header(view.container, 'c').getAttribute('data-iris-table-pinned')).toBe('right')
    await view.rerender({ pinnedColumns: undefined })
    flushSync()
    expect(header(view.container, 'a').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header(view.container, 'c').getAttribute('data-iris-table-pinned')).toBe('right')
    expect(onPinned).not.toHaveBeenCalled()
    expect(onCount).not.toHaveBeenCalled()
  })

  it('routes a controlled boundary commit through Core without optimistic rendering', async () => {
    const onPinned = vi.fn()
    const onCount = vi.fn()
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        pinnedDrag: true,
        pinnedColumns: { a: 'left', c: 'right' },
        onColumnPinnedChange: onPinned,
        onPinnedCountChange: onCount,
      },
    })
    const handle = view.container.querySelector('[data-iris-pinned-drag-handle]') as HTMLElement
    await fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(onPinned).toHaveBeenCalledTimes(1)
    expect(onPinned).toHaveBeenCalledWith('b', 'left')
    expect(onCount).toHaveBeenCalledWith(2)
    expect(header(view.container, 'b').getAttribute('data-iris-table-pinned')).toBeNull()

    await view.rerender({ pinnedColumns: { a: 'left', b: 'left', c: 'right' } })
    flushSync()
    expect(header(view.container, 'b').getAttribute('data-iris-table-pinned')).toBe('left')
  })
})

describe('Svelte IrisTable grouped pinned columns', () => {
  it('pins grouped leaves but not their presentation group cells', () => {
    const grouped: IrisTableColumn<Row>[] = [
      {
        key: 'group',
        title: 'Group',
        children: [
          { key: 'a', title: 'A', width: 100 },
          { key: 'b', title: 'B', width: 80 },
        ],
      },
      { key: 'c', title: 'C', width: 60 },
    ]
    const { container } = render(IrisTable, {
      props: { columns: grouped, data: rows, pinnedColumns: { a: 'left', c: 'right' } },
    })
    expect(header(container, 'group').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(header(container, 'a').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header(container, 'a').style.position).toBe('sticky')
    expect(header(container, 'c').style.position).toBe('sticky')
    expect(cell(container, 'a').style.left).toBe('0px')
    expect(cell(container, 'c').style.right).toBe('0px')
  })
})
