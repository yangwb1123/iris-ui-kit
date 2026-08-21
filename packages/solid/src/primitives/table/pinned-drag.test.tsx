import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  a: string
  b: string
  c: string
}

const rows: Row[] = [{ id: 1, a: 'A', b: 'B', c: 'C' }]
const columns: IrisTableColumn<Row>[] = [
  { key: 'a', title: 'A', pinned: 'left' },
  { key: 'b', title: 'B' },
  { key: 'c', title: 'C' },
]

describe('IrisTable pinned boundary drag', () => {
  it('renders one boundary handle and suppresses the boundary resize grip', () => {
    const { container } = render(() => (
      <IrisTable columns={columns} data={rows} pinnedDrag resizableColumns />
    ))
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

  it('uses keyboard steps to emit changed columns and the final count', () => {
    const onPinned = vi.fn()
    const onCount = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        pinnedDrag
        onColumnPinnedChange={onPinned}
        onPinnedCountChange={onCount}
      />
    ))
    const handle = container.querySelector('[data-iris-pinned-drag-handle]') as HTMLElement
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(onPinned).toHaveBeenCalledWith('b', 'left')
    expect(onCount).toHaveBeenCalledWith(2)
  })

  it('fails closed without a left-pinned boundary', () => {
    const unpinned = columns.map(({ pinned: _pinned, ...column }) => column)
    const { container } = render(() => <IrisTable columns={unpinned} data={rows} pinnedDrag />)
    expect(container.querySelector('[data-iris-pinned-drag-handle]')).toBeNull()
  })
})
