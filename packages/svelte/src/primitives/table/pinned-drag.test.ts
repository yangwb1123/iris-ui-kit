import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'

afterEach(cleanup)

const rows = [{ id: 1, a: 'A', b: 'B', c: 'C' }]
const columns = [
  { key: 'a', title: 'A', pinned: 'left' as const },
  { key: 'b', title: 'B' },
  { key: 'c', title: 'C' },
]

describe('IrisTable pinned boundary drag', () => {
  it('renders one boundary handle and suppresses the boundary resize grip', () => {
    const { container } = render(IrisTable, {
      props: { columns, data: rows, pinnedDrag: true, resizableColumns: true },
    })
    const handle = container.querySelector('[data-iris-pinned-drag-handle]')
    expect(handle?.getAttribute('data-column-key')).toBe('a')
    expect(handle?.querySelector('[data-iris-pinned-drag-line]')).not.toBeNull()
    expect(
      container.querySelector('[data-iris-table-resize-handle][data-column-key="a"]'),
    ).toBeNull()
    expect(
      container.querySelector('[data-iris-table-resize-handle][data-column-key="b"]'),
    ).not.toBeNull()
  })

  it('uses keyboard steps to emit changed columns and the final count', async () => {
    const onPinned = vi.fn()
    const onCount = vi.fn()
    const { container } = render(IrisTable, {
      props: {
        columns,
        data: rows,
        pinnedDrag: true,
        onColumnPinnedChange: onPinned,
        onPinnedCountChange: onCount,
      },
    })
    const handle = container.querySelector('[data-iris-pinned-drag-handle]') as HTMLElement
    await fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(onPinned).toHaveBeenCalledWith('b', 'left')
    expect(onCount).toHaveBeenCalledWith(2)
  })

  it('fails closed without a left-pinned boundary', () => {
    const unpinned = columns.map(({ pinned: _pinned, ...column }) => column)
    const { container } = render(IrisTable, {
      props: { columns: unpinned, data: rows, pinnedDrag: true },
    })
    expect(container.querySelector('[data-iris-pinned-drag-handle]')).toBeNull()
  })
})
