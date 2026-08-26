import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSignal } from 'solid-js'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  status: string
}
const rows: Row[] = [
  { id: 1, name: 'Alice', age: 30, status: 'active' },
  { id: 2, name: 'Bob', age: 25, status: 'paused' },
  { id: 3, name: 'Charlie', age: 28, status: 'active' },
]
const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true, editor: 'number' },
  { key: 'status', title: 'Status' },
]
const bodyRows = (container: HTMLElement): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>('[data-iris-table-row=""]'),
]
const nameCells = (container: HTMLElement): string[] =>
  [...container.querySelectorAll<HTMLElement>('[data-iris-table-cell="name"]')].map(
    (c) => (c.textContent ?? '').replace(/▶/g, ''), // tree caret glyph is chrome, not data
  )
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
const rect = (left: number, top: number, w: number, h: number): DOMRect =>
  ({
    left,
    top,
    right: left + w,
    bottom: top + h,
    width: w,
    height: h,
    x: left,
    y: top,
    toJSON() {},
  }) as DOMRect
/** Stub getBoundingClientRect so closestCenter resolves deterministically:
 * header targets sit side by side (140px each), row handles one per 40px row. */
function stubRects(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const headerId = this.getAttribute('data-iris-table-header')
    if (headerId && headerId !== '__seq' && headerId !== '__drag') {
      const left = headerId === 'name' ? 0 : headerId === 'age' ? 140 : 280
      return rect(left, 0, 140, 40)
    }
    const handleId = this.getAttribute('data-iris-row-drag-handle')
    if (handleId) return rect(0, (Number(handleId) - 1) * 40, 40, 40)
    return rect(0, 0, 0, 0)
  })
}
const toggle = (): HTMLButtonElement | null =>
  document.querySelector('[data-iris-table-tree-toggle]')

describe('IrisTable parity-AD: lazyLoad (vxe lazyLoad parity)', () => {
  const lazyCols: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]

  it('a lazy leaf renders a caret; the first expand loads and expands its children', () => {
    const lazyLoad = vi.fn((_row: Row, load: (children: Row[]) => void) => {
      load([{ id: 11, name: 'A1', age: 1, status: 'child' }])
    })
    const { container } = render(() => (
      <IrisTable columns={lazyCols} data={[rows[0]]} rowKey="id" lazyLoad={lazyLoad} />
    ))
    // No getSubRows children, nothing cached yet → the lazy caret renders.
    expect(toggle()).not.toBeNull()
    fireEvent.click(toggle()!)
    expect(lazyLoad).toHaveBeenCalledWith(rows[0], expect.any(Function))
    // The resolved child is cached, the row expands, and the child renders.
    expect(nameCells(container)).toEqual(['Alice', 'A1'])
    expect(toggle()!.getAttribute('aria-expanded')).toBe('true')
    // Collapse + re-expand uses the cache — the loader is NOT called again.
    fireEvent.click(toggle()!)
    expect(nameCells(container)).toEqual(['Alice'])
    fireEvent.click(toggle()!)
    expect(lazyLoad).toHaveBeenCalledTimes(1)
    expect(nameCells(container)).toEqual(['Alice', 'A1'])
  })

  it('the caret spins while the load is pending; resolving with no children drops the caret', async () => {
    let resolveLoad: (children: Row[]) => void = () => {}
    const lazyLoad = vi.fn((_row: Row, load: (children: Row[]) => void) => {
      resolveLoad = load
    })
    const { container } = render(() => (
      <IrisTable columns={lazyCols} data={[rows[0]]} rowKey="id" lazyLoad={lazyLoad} />
    ))
    fireEvent.click(toggle()!)
    expect(lazyLoad).toHaveBeenCalledTimes(1)
    expect(toggle()!.getAttribute('data-iris-tree-loading')).toBe('')
    // The load resolves with NO children: the loading spinner clears and the
    // row is a plain leaf — no caret, no children.
    resolveLoad([])
    await new Promise((r) => setTimeout(r, 0))
    expect(toggle()).toBeNull()
    expect(nameCells(container)).toEqual(['Alice'])
  })

  it('a throwing load stays retryable (the key is never cached)', () => {
    const lazyLoad = vi.fn((_row: Row, _load: (children: Row[]) => void) => {
      throw new Error('network')
    })
    render(() => <IrisTable columns={lazyCols} data={[rows[0]]} rowKey="id" lazyLoad={lazyLoad} />)
    fireEvent.click(toggle()!)
    // The failed load cleared the spinner and left the caret in place…
    expect(toggle()!.getAttribute('data-iris-tree-loading')).toBeNull()
    // …so a second expand retries the loader.
    fireEvent.click(toggle()!)
    expect(lazyLoad).toHaveBeenCalledTimes(2)
  })

  it('a data-source change drops a stale in-flight result (epoch guard)', async () => {
    let resolveLoad: (children: Row[]) => void = () => {}
    const lazyLoad = vi.fn((_row: Row, load: (children: Row[]) => void) => {
      resolveLoad = load
    })
    const [data, setData] = createSignal<Row[]>([rows[0]])
    const { container } = render(() => (
      <IrisTable columns={lazyCols} data={data()} rowKey="id" lazyLoad={lazyLoad} />
    ))
    fireEvent.click(toggle()!)
    // The parent re-feeds a NEW data reference while the fetch is in flight:
    // the cache + loading set are cleared wholesale.
    setData([rows[2]])
    await new Promise((r) => setTimeout(r, 0))
    expect(toggle()!.getAttribute('data-iris-tree-loading')).toBeNull()
    // The stale resolution must NOT re-seed the cleared cache: no child rows.
    resolveLoad([{ id: 11, name: 'A1', age: 1, status: 'child' }])
    await new Promise((r) => setTimeout(r, 0))
    expect(nameCells(container)).toEqual(['Charlie'])
    // The fresh row's caret loads normally (new epoch).
    fireEvent.click(toggle()!)
    expect(lazyLoad).toHaveBeenCalledTimes(2)
    resolveLoad([{ id: 12, name: 'C1', age: 1, status: 'child' }])
    await new Promise((r) => setTimeout(r, 0))
    expect(nameCells(container)).toEqual(['Charlie', 'C1'])
  })

  it('a lazily loaded key wins over getSubRows; other rows keep getSubRows children', () => {
    const getSubRows = vi.fn((row: Row) =>
      row.id === 2 ? [{ id: 21, name: 'from-sub', age: 1, status: 'x' }] : [],
    )
    const lazyLoad = vi.fn((row: Row, load: (children: Row[]) => void) => {
      if (row.id === 1) load([{ id: 11, name: 'from-lazy', age: 1, status: 'x' }])
    })
    const { container } = render(() => (
      <IrisTable
        columns={lazyCols}
        data={rows}
        rowKey="id"
        getSubRows={getSubRows}
        lazyLoad={lazyLoad}
      />
    ))
    // Alice + Charlie (leaves for getSubRows) get the lazy caret; Bob
    // (getSubRows children) gets the regular caret.
    const toggles = [...document.querySelectorAll<HTMLElement>('[data-iris-table-tree-toggle]')]
    expect(toggles.length).toBe(3)
    fireEvent.click(toggles[0]!)
    expect(lazyLoad).toHaveBeenCalledWith(rows[0], expect.any(Function))
    // The cached lazy children win over getSubRows for the loaded key; the
    // resolved child is itself an uncached lazy leaf (caret parity), so the
    // toggle list shifts — target Bob's caret by row.
    const bobToggle = [...document.querySelectorAll<HTMLElement>('[data-iris-table-row=""]')]
      .find((r) => r.textContent?.includes('Bob'))!
      .querySelector('[data-iris-table-tree-toggle]')!
    fireEvent.click(bobToggle)
    expect(nameCells(container)).toEqual(['Alice', 'from-lazy', 'Bob', 'from-sub', 'Charlie'])
  })
})

describe('IrisTable parity-AD: rowDrag / columnDrag reorder', () => {
  it('rowDrag reorders through the handle (onReorder + onDataChange); a tap cancels', () => {
    stubRects()
    const onReorder = vi.fn()
    const onDataChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        rowDrag={{ onReorder }}
        onDataChange={onDataChange}
      />
    ))
    const root = container.querySelector('[data-iris-table]')!
    pointer(container.querySelector('[data-iris-row-drag-handle="1"]')!, 'pointerdown', 20, 20)
    pointer(root, 'pointermove', 20, 100)
    pointer(root, 'pointerup', 20, 100)
    expect(nameCells(container)).toEqual(['Bob', 'Charlie', 'Alice'])
    expect(onReorder).toHaveBeenCalledWith([rows[1], rows[2], rows[0]])
    expect(onDataChange).toHaveBeenCalledWith([rows[1], rows[2], rows[0]])
    // A tap without threshold movement cancels.
    pointer(container.querySelector('[data-iris-row-drag-handle="2"]')!, 'pointerdown', 20, 60)
    pointer(root, 'pointerup', 20, 60)
    expect(onReorder).toHaveBeenCalledTimes(1)
  })

  it('rowDrag reorders static tree siblings through the Core source tree', () => {
    stubRects()
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    const childA: TreeRow = { id: 2, name: 'A' }
    const childB: TreeRow = { id: 3, name: 'B' }
    const root: TreeRow = { id: 1, name: 'Root', children: [childA, childB] }
    const onReorder = vi.fn()
    const onDataChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={[{ key: 'name', title: 'Name' }]}
        data={[root]}
        rowKey="id"
        getSubRows={(row: TreeRow) => row.children}
        defaultExpandedRowKeys={[1]}
        rowDrag={{ onReorder }}
        onDataChange={onDataChange}
      />
    ))
    const tableRoot = container.querySelector('[data-iris-table]')!
    pointer(container.querySelector('[data-iris-row-drag-handle="2"]')!, 'pointerdown', 20, 60)
    pointer(tableRoot, 'pointermove', 20, 100)
    pointer(tableRoot, 'pointerup', 20, 100)

    expect(nameCells(container)).toEqual(['Root', 'B', 'A'])
    expect(onReorder).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, children: [childB, childA] }),
    ])
    expect(onDataChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, children: [childB, childA] }),
    ])
    expect(root.children).toEqual([childA, childB])
  })

  it('columnDrag reorders leaf columns on drop; a tap does not', () => {
    stubRects()
    const onReorder = vi.fn()
    const { container } = render(() => (
      <IrisTable columns={cols} data={rows} rowKey="id" columnDrag={{ onReorder }} />
    ))
    const root = container.querySelector('[data-iris-table]')!
    pointer(container.querySelector('[data-iris-table-header="name"]')!, 'pointerdown', 70, 10)
    pointer(root, 'pointermove', 350, 10)
    pointer(root, 'pointerup', 350, 10)
    expect(onReorder.mock.calls[0]![0].map((c: IrisTableColumn<Row>) => c.key)).toEqual([
      'age',
      'status',
      'name',
    ])
    pointer(container.querySelector('[data-iris-table-header="age"]')!, 'pointerdown', 210, 10)
    pointer(root, 'pointerup', 210, 10)
    expect(onReorder).toHaveBeenCalledTimes(1)
  })
})

describe('IrisTable parity-AD: row edit mode', () => {
  const bodyCell = (rowIdx: number, key: string): HTMLElement =>
    bodyRows(document.body)[rowIdx]!.querySelector(`[data-iris-table-cell="${key}"]`) as HTMLElement

  it('a click opens every editable column; Escape cancels the whole row', () => {
    const onCellEdit = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        editConfig={{ mode: 'row' }}
        onCellEdit={onCellEdit}
      />
    ))
    const rowEls = bodyRows(container)
    fireEvent.click(bodyCell(0, 'status'))
    expect(rowEls[0]!.querySelectorAll('[data-iris-table-editor]').length).toBe(2)
    expect(rowEls[0]!.getAttribute('data-iris-row-editing')).toBe('true')
    const nameEditor = rowEls[0]!.querySelector(
      '[data-iris-table-cell="name"] [data-iris-table-editor]',
    ) as HTMLInputElement
    fireEvent.input(nameEditor, { target: { value: 'alice2' } })
    fireEvent.keyDown(nameEditor, { key: 'Escape' })
    expect(rowEls[0]!.querySelectorAll('[data-iris-table-editor]').length).toBe(0)
    expect(rowEls[0]!.getAttribute('data-iris-row-editing')).toBeNull()
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(nameCells(container)[0]).toBe('Alice')
  })

  it('Enter commits that column; Enter-then-blur on an async-validated column commits exactly once', async () => {
    const onCellEdit = vi.fn()
    const asyncCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [{ validator: (v) => Promise.resolve(v === 'ok' ? null : 'must be ok') }],
      },
      { key: 'age', title: 'Age', editable: true, editor: 'number' },
    ]
    const { container } = render(() => (
      <IrisTable
        columns={asyncCols}
        data={rows}
        rowKey="id"
        editConfig={{ mode: 'row' }}
        onCellEdit={onCellEdit}
      />
    ))
    const rowEls = bodyRows(container)
    fireEvent.click(bodyCell(0, 'age'))
    const nameEditor = rowEls[0]!.querySelector(
      '[data-iris-table-cell="name"] [data-iris-table-editor]',
    ) as HTMLInputElement
    fireEvent.input(nameEditor, { target: { value: 'ok' } })
    fireEvent.keyDown(nameEditor, { key: 'Enter' })
    // Blur while the async validation is still pending: the second commit
    // supersedes the first (epoch), so exactly ONE onCellEdit lands.
    fireEvent.blur(nameEditor)
    await new Promise((r) => setTimeout(r, 0))
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ column: expect.objectContaining({ key: 'name' }), newValue: 'ok' }),
    )
    // The committed column's editor closed; the other column stays open.
    expect(
      rowEls[0]!.querySelector('[data-iris-table-cell="name"] [data-iris-table-editor]'),
    ).toBeNull()
    expect(
      rowEls[0]!.querySelector('[data-iris-table-cell="age"] [data-iris-table-editor]'),
    ).not.toBeNull()
  })
})
