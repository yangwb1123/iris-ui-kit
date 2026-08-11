import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import type { MutableRefObject } from 'react'
import { IrisTable } from './Table'
import type { IrisTableHandle } from './props'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  MockResizeObserver.instances = []
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
]

const editableCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true },
]

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function editor(): HTMLInputElement | null {
  return document.querySelector('[data-iris-table-editor]')
}

/** Commit a new value into a cell via the editor (dblclick → change → Enter). */
function commitCell(rowId: string | number, key: string, value: string): void {
  act(() => {
    fireEvent.doubleClick(cell(rowId, key))
  })
  act(() => {
    fireEvent.change(editor()!, { target: { value } })
    fireEvent.keyDown(editor()!, { key: 'Enter' })
  })
}

/** ResizeObserver stub: captures the callback so tests can fire sizes. */
class MockResizeObserver {
  static instances: MockResizeObserver[] = []
  callback: ResizeObserverCallback
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    MockResizeObserver.instances.push(this)
  }
}

function fireResize(width: number, height: number): void {
  const inst = MockResizeObserver.instances[0]
  if (!inst) throw new Error('no ResizeObserver instance captured')
  act(() => {
    inst.callback(
      [{ contentRect: { width, height } }] as unknown as ResizeObserverEntry[],
      inst as unknown as ResizeObserver,
    )
  })
}

describe('@iris-ui-kit/react IrisTable scrollbarConfig (batch Q)', () => {
  it('renders data-iris-scrollbar-thin when theme is thin', () => {
    render(<IrisTable columns={editableCols} data={rows} scrollbarConfig={{ theme: 'thin' }} />)
    expect(root().getAttribute('data-iris-scrollbar-thin')).toBe('true')
  })

  it('omits the attr by default and for theme default', () => {
    const { unmount } = render(<IrisTable columns={editableCols} data={rows} />)
    expect(root().getAttribute('data-iris-scrollbar-thin')).toBeNull()
    unmount()
    render(<IrisTable columns={editableCols} data={rows} scrollbarConfig={{ theme: 'default' }} />)
    expect(root().getAttribute('data-iris-scrollbar-thin')).toBeNull()
  })
})

describe('@iris-ui-kit/react IrisTable editDirtyConfig (batch Q)', () => {
  it('marks a committed cell dirty with the data attr', () => {
    render(<IrisTable columns={editableCols} data={rows} editDirtyConfig={{}} />)
    commitCell(1, 'name', 'Charlie Edited')
    expect(cell(1, 'name').getAttribute('data-iris-cell-dirty')).toBe('true')
    // Other cells stay clean.
    expect(cell(2, 'name').getAttribute('data-iris-cell-dirty')).toBeNull()
  })

  it('clears the marker when committing the original value back', () => {
    render(<IrisTable columns={editableCols} data={rows} editDirtyConfig={{}} />)
    commitCell(1, 'name', 'Charlie Edited')
    expect(cell(1, 'name').getAttribute('data-iris-cell-dirty')).toBe('true')
    commitCell(1, 'name', 'Charlie')
    expect(cell(1, 'name').getAttribute('data-iris-cell-dirty')).toBeNull()
  })

  it('keeps the marker when committing another changed value', () => {
    render(<IrisTable columns={editableCols} data={rows} editDirtyConfig={{}} />)
    commitCell(1, 'name', 'Charlie Edited')
    commitCell(1, 'name', 'Charlie Again')
    expect(cell(1, 'name').getAttribute('data-iris-cell-dirty')).toBe('true')
  })

  it('renders no marker without editDirtyConfig', () => {
    render(<IrisTable columns={editableCols} data={rows} />)
    commitCell(1, 'name', 'Charlie Edited')
    expect(cell(1, 'name').getAttribute('data-iris-cell-dirty')).toBeNull()
  })

  it('indicator: false suppresses the data attr', () => {
    render(<IrisTable columns={editableCols} data={rows} editDirtyConfig={{ indicator: false }} />)
    commitCell(1, 'name', 'Charlie Edited')
    expect(cell(1, 'name').getAttribute('data-iris-cell-dirty')).toBeNull()
  })

  it('className: true adds the iris-table-cell-dirty class while keeping the data attr', () => {
    render(<IrisTable columns={editableCols} data={rows} editDirtyConfig={{ className: true }} />)
    commitCell(1, 'name', 'Charlie Edited')
    expect(cell(1, 'name').classList.contains('iris-table-cell-dirty')).toBe(true)
    expect(cell(1, 'name').getAttribute('data-iris-cell-dirty')).toBe('true')
    expect(cell(2, 'name').classList.contains('iris-table-cell-dirty')).toBe(false)
  })

  it("removeRow prunes the removed row's dirty entries (no phantom dots on re-add)", () => {
    const tableRef = { current: null } as MutableRefObject<IrisTableHandle<Row> | null>
    render(
      <IrisTable columns={editableCols} data={rows} editDirtyConfig={{}} tableRef={tableRef} />,
    )
    commitCell(1, 'name', 'Charlie Edited')
    expect(cell(1, 'name').getAttribute('data-iris-cell-dirty')).toBe('true')
    act(() => tableRef.current!.removeRow(1))
    // Re-add a row with the same key: it must render clean, not a phantom dot.
    act(() => tableRef.current!.insertRow({ id: 1, name: 'Charlie', age: 25 }, 0))
    expect(cell(1, 'name').getAttribute('data-iris-cell-dirty')).toBeNull()
  })
})

describe('@iris-ui-kit/react IrisTable autoResize (batch Q)', () => {
  it('renders height: 100% in height-not-set mode; the measure engages fixed-height machinery', () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    render(<IrisTable columns={editableCols} data={rows} autoResize />)
    expect(root().getAttribute('data-iris-auto-resize')).toBe('true')
    // Height-not-set mode: the root is `height: 100%` so it fills AND tracks
    // its parent (a measured-px pin would freeze the root, so the RO — which
    // observes the root — could never see later container growth).
    expect(root().style.height).toBe('100%')
    // The measure only gates `fixedHeight` (sticky header / overflow): off
    // until a positive size lands, engaged afterwards — and the re-measure
    // never changes the height style.
    expect(root().getAttribute('data-iris-table-fixed-height')).toBeNull()
    fireResize(800, 400)
    expect(root().style.height).toBe('100%')
    expect(root().getAttribute('data-iris-table-fixed-height')).toBe('true')
    fireResize(800, 512)
    expect(root().style.height).toBe('100%')
    expect(root().getAttribute('data-iris-table-fixed-height')).toBe('true')
  })

  it('disconnects the observer on unmount', () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    const { unmount } = render(<IrisTable columns={editableCols} data={rows} autoResize />)
    const inst = MockResizeObserver.instances[0]
    expect(inst!.observe).toHaveBeenCalledWith(root())
    unmount()
    expect(inst!.disconnect).toHaveBeenCalled()
  })

  it('no-op without ResizeObserver (jsdom) — renders without crashing', () => {
    render(<IrisTable columns={editableCols} data={rows} autoResize />)
    expect(root().getAttribute('data-iris-auto-resize')).toBe('true')
    // height: 100% is unconditional in height-not-set mode; only the
    // fixed-height scroll engagement needs a measure (stays off here).
    expect(root().style.height).toBe('100%')
    expect(root().getAttribute('data-iris-table-fixed-height')).toBeNull()
    expect(root().querySelectorAll('[role="row"]').length).toBeGreaterThan(0)
  })

  it('keeps the explicit height when height is set (no visible change)', () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    render(<IrisTable columns={editableCols} data={rows} autoResize height={300} />)
    expect(root().style.height).toBe('300px')
    expect(root().getAttribute('data-iris-table-fixed-height')).toBe('true')
    fireResize(800, 400)
    expect(root().style.height).toBe('300px')
  })
})
