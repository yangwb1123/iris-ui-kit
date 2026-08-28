import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

afterEach(cleanup)

type Row = { id: number; a: string; b: string; c: string }

const rows: Row[] = [{ id: 1, a: 'A', b: 'B', c: 'C' }]
const columns: IrisTableColumn<Row>[] = [
  { key: 'a', title: 'A', pinned: 'left', width: 100, summary: 'count' },
  { key: 'b', title: 'B', width: 80 },
  { key: 'c', title: 'C', pinned: 'right', width: 60 },
]

function header(container: HTMLElement, key: string): HTMLElement {
  return container.querySelector(`[data-iris-table-header="${key}"]`) as HTMLElement
}

function cell(container: HTMLElement, key: string): HTMLElement {
  return container.querySelector(
    `[data-iris-table-row=""] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function summaryCell(container: HTMLElement, key: string): HTMLElement {
  return container.querySelector(
    `[data-iris-table-row="summary"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

describe('Solid IrisTable pinnedColumns', () => {
  it('projects static pins to header, body, summary, and sticky geometry', () => {
    const { container } = render(() => <IrisTable columns={columns} data={rows} />)

    expect(header(container, 'a').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(cell(container, 'a').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(summaryCell(container, 'a').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header(container, 'a').style.position).toBe('sticky')
    expect(header(container, 'a').style.insetInlineStart).toBe('0px')
    expect(header(container, 'c').style.insetInlineEnd).toBe('0px')
  })

  it('gives controlled entries authority, while absent keys and {} retain declarations', async () => {
    const [pins, setPins] = createSignal<Record<string, 'left' | 'right' | null>>({ a: null })
    const { container } = render(() => (
      <IrisTable columns={columns} data={rows} pinnedColumns={pins()} />
    ))

    expect(header(container, 'a').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(header(container, 'a').style.position).toBe('relative')
    expect(header(container, 'c').getAttribute('data-iris-table-pinned')).toBe('right')

    setPins({})
    await waitFor(() =>
      expect(header(container, 'a').getAttribute('data-iris-table-pinned')).toBe('left'),
    )
    expect(header(container, 'c').getAttribute('data-iris-table-pinned')).toBe('right')
  })

  it('silently replaces controlled maps and restores declarations when control is removed', async () => {
    const [pins, setPins] = createSignal<Record<string, 'left' | 'right' | null> | undefined>({
      a: null,
      c: null,
    })
    const onPinned = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        pinnedColumns={pins()}
        onColumnPinnedChange={onPinned}
      />
    ))

    setPins({ a: 'right' })
    await waitFor(() =>
      expect(header(container, 'a').getAttribute('data-iris-table-pinned')).toBe('right'),
    )
    expect(header(container, 'c').getAttribute('data-iris-table-pinned')).toBe('right')
    expect(onPinned).not.toHaveBeenCalled()

    setPins(undefined)
    await waitFor(() =>
      expect(header(container, 'a').getAttribute('data-iris-table-pinned')).toBe('left'),
    )
    expect(header(container, 'c').getAttribute('data-iris-table-pinned')).toBe('right')
  })

  it('uses the projection for grouped leaf pins but not group containers', () => {
    const grouped: IrisTableColumn<Row>[] = [
      {
        key: 'group',
        title: 'Group',
        children: [{ key: 'a', title: 'A', pinned: 'left', width: 100 }],
      },
      { key: 'b', title: 'B', width: 80 },
    ]
    const { container } = render(() => (
      <IrisTable columns={grouped} data={rows} pinnedColumns={{ a: null, b: 'right' }} />
    ))

    expect(header(container, 'group').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(header(container, 'a').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(header(container, 'b').getAttribute('data-iris-table-pinned')).toBe('right')
  })

  it('routes controlled boundary commits through Core without optimistic rendering', () => {
    const onPinned = vi.fn()
    const onCount = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        pinnedDrag
        pinnedColumns={{ a: 'left', c: 'right' }}
        onColumnPinnedChange={onPinned}
        onPinnedCountChange={onCount}
      />
    ))
    const handle = container.querySelector('[data-iris-pinned-drag-handle]') as HTMLElement

    fireEvent.keyDown(handle, { key: 'ArrowRight' })

    expect(onPinned).toHaveBeenCalledTimes(1)
    expect(onPinned).toHaveBeenCalledWith('b', 'left')
    expect(onCount).toHaveBeenCalledWith(2)
    expect(header(container, 'b').getAttribute('data-iris-table-pinned')).toBeNull()
  })

  it('updates a controlled render only after the parent accepts the Core proposal', async () => {
    const [pins, setPins] = createSignal<Record<string, 'left' | 'right' | null>>({
      a: 'left',
      c: 'right',
    })
    const onPinned = vi.fn((key: string, side: 'left' | 'right' | null) => {
      setPins((current) => ({ ...current, [key]: side }))
    })
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        pinnedDrag
        pinnedColumns={pins()}
        onColumnPinnedChange={onPinned}
      />
    ))
    const handle = container.querySelector('[data-iris-pinned-drag-handle]') as HTMLElement

    fireEvent.keyDown(handle, { key: 'ArrowRight' })

    await waitFor(() =>
      expect(header(container, 'b').getAttribute('data-iris-table-pinned')).toBe('left'),
    )
    expect(onPinned).toHaveBeenCalledTimes(1)
  })

  it('keeps the uncontrolled boundary callback-only path non-optimistic', () => {
    const onPinned = vi.fn()
    const { container } = render(() => (
      <IrisTable columns={columns} data={rows} pinnedDrag onColumnPinnedChange={onPinned} />
    ))
    const handle = container.querySelector('[data-iris-pinned-drag-handle]') as HTMLElement

    fireEvent.keyDown(handle, { key: 'ArrowRight' })

    expect(onPinned).toHaveBeenCalledWith('b', 'left')
    expect(header(container, 'b').getAttribute('data-iris-table-pinned')).toBeNull()
  })

  it('keeps controlled pins in the column-virtualization union', () => {
    const wide = Array.from({ length: 8 }, (_, index) => ({
      key: `c${index}`,
      title: `C${index}`,
      width: 120,
    })) as IrisTableColumn<Record<string, unknown>>[]
    const data = [Object.fromEntries([['id', 1], ...wide.map((column) => [column.key, 'x'])])]
    const { container } = render(() => (
      <IrisTable columns={wide} data={data} columnVirtualization pinnedColumns={{ c7: 'right' }} />
    ))

    expect(container.querySelector('[data-iris-table-header="c7"]')).not.toBeNull()
  })
})
