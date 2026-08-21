import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn, IrisTableHandle, IrisTableMergeCell } from '../types'

interface Row extends Record<string, unknown> {
  id: number
  a: string
  b: string
  c: string
  d: string
  e: string
}

const rows: Row[] = [{ id: 1, a: 'A', b: 'B', c: 'C', d: 'D', e: 'E' }]
const columns: IrisTableColumn<Row>[] = [
  { key: 'a', title: 'A', width: 100 },
  { key: 'b', title: 'B', width: 100 },
  { key: 'c', title: 'C', width: 100 },
  { key: 'd', title: 'D', width: 100 },
  { key: 'e', title: 'E', width: 100 },
]

let measuredWidth = 0
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')

class MockResizeObserver {
  static instances: MockResizeObserver[] = []
  callback: ResizeObserverCallback
  observe = vi.fn()
  disconnect = vi.fn()

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    MockResizeObserver.instances.push(this)
  }
}

function installResponsive(width: number): void {
  measuredWidth = width
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => measuredWidth,
  })
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
}

function fireResize(width: number): void {
  measuredWidth = width
  const observer = MockResizeObserver.instances.at(-1)
  if (!observer) throw new Error('no responsive ResizeObserver instance captured')
  act(() => {
    observer.callback([], observer as unknown as ResizeObserver)
  })
}

function fireResizeEntry(entryWidth: number): void {
  const observer = MockResizeObserver.instances.at(-1)
  if (!observer) throw new Error('no responsive ResizeObserver instance captured')
  const entry = { contentRect: { width: entryWidth } } as ResizeObserverEntry
  act(() => {
    observer.callback([entry], observer as unknown as ResizeObserver)
  })
}

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]')!
}

function headerKeys(): string[] {
  return Array.from(document.querySelectorAll('[data-iris-table-header]'))
    .map((el) => el.getAttribute('data-iris-table-header'))
    .filter((key): key is string => key !== null && key !== '' && !key.startsWith('__'))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  MockResizeObserver.instances = []
  if (originalClientWidth) {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth)
  } else {
    delete (HTMLElement.prototype as unknown as { clientWidth?: number }).clientWidth
  }
  measuredWidth = 0
})

describe('@iris-ui-kit/react IrisTable responsive narrow mode (batch CY)', () => {
  it('greedily hides the tail below 480px and keeps the root hint sibling honest', () => {
    installResponsive(479)
    render(<IrisTable columns={columns} data={rows} rowKey="id" responsive />)

    expect(headerKeys()).toEqual(['a', 'b', 'c', 'd'])
    expect(root().nextElementSibling?.getAttribute('data-iris-scroll-hint') ?? null).toBeNull()
    expect(root().style.overflowX).toBe('')
  })

  it('is inert at exactly 480px and above', () => {
    installResponsive(480)
    render(<IrisTable columns={columns} data={rows} rowKey="id" responsive />)
    expect(headerKeys()).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(root().nextElementSibling).toBeNull()

    fireResize(481)
    expect(headerKeys()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('does not change the DOM or observe when the prop is off', () => {
    installResponsive(320)
    render(<IrisTable columns={columns} data={rows} rowKey="id" />)
    expect(MockResizeObserver.instances).toHaveLength(0)
    expect(headerKeys()).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(root().nextElementSibling).toBeNull()
    expect(root().style.overflowX).toBe('')
  })

  it('fails closed without ResizeObserver', () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 320,
    })
    vi.stubGlobal('ResizeObserver', undefined)
    render(<IrisTable columns={columns} data={rows} rowKey="id" responsive />)
    expect(headerKeys()).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(root().nextElementSibling).toBeNull()
  })

  it('uses only root.clientWidth and ignores a stale entry width when the root is zero', () => {
    installResponsive(0)
    render(<IrisTable columns={columns} data={rows} rowKey="id" responsive />)

    // Hidden roots and jsdom report clientWidth=0. A ResizeObserver entry can
    // still carry an old contentRect; it must not opt the table into collapse.
    fireResizeEntry(320)
    expect(headerKeys()).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(root().nextElementSibling).toBeNull()
  })

  it('disconnects the responsive observer on unmount', () => {
    installResponsive(479)
    const { unmount } = render(<IrisTable columns={columns} data={rows} rowKey="id" responsive />)
    const observer = MockResizeObserver.instances.at(-1)!
    unmount()
    expect(observer.disconnect).toHaveBeenCalledTimes(1)
  })

  it('restores hidden columns when the observer reports a wide container', () => {
    installResponsive(479)
    render(<IrisTable columns={columns} data={rows} rowKey="id" responsive />)
    expect(headerKeys()).toHaveLength(4)
    fireResize(600)
    expect(headerKeys()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('preserves pinned columns and shows a hint when the surviving set still overflows', () => {
    installResponsive(250)
    const pinned: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', width: 300, pinned: 'left' },
      { key: 'b', title: 'B', width: 300 },
      { key: 'c', title: 'C', width: 300 },
    ]
    render(<IrisTable columns={pinned} data={rows} rowKey="id" responsive />)

    expect(headerKeys()).toEqual(['a', 'b'])
    const hint = root().nextElementSibling as HTMLElement
    expect(hint.getAttribute('data-iris-scroll-hint')).toBe('')
    expect(hint.textContent).toContain('Scroll horizontally for more columns')
    expect(root().style.overflowX).toBe('auto')
  })

  it('honors the existing column order before tail collapse', () => {
    installResponsive(479)
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnOrder={['c', 'a', 'b', 'd', 'e']}
        responsive
      />,
    )
    expect(headerKeys()).toEqual(['c', 'a', 'b', 'd'])
  })

  it('applies visibility before responsive fitting', () => {
    installResponsive(350)
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnVisibility={{ e: false }}
        responsive
      />,
    )
    expect(headerKeys()).toEqual(['a', 'b', 'c'])
  })

  it('exports the fitted leaf view and excludes collapsed tail columns', () => {
    installResponsive(479)
    const tableRef: { current: IrisTableHandle<Row> | null } = { current: null }
    render(<IrisTable columns={columns} data={rows} rowKey="id" responsive tableRef={tableRef} />)
    expect(tableRef.current?.exportCurrentViewCsv()).toBe('A,B,C,D\nA,B,C,D')
  })

  it('hides a grouped top-level unit as a whole', () => {
    installResponsive(440)
    const grouped: IrisTableColumn<Row>[] = [
      {
        key: 'group',
        title: 'Group',
        children: [
          { key: 'a', title: 'A', width: 120 },
          { key: 'b', title: 'B', width: 120 },
        ],
      },
      { key: 'c', title: 'C', width: 120 },
      { key: 'd', title: 'D', width: 120 },
    ]
    render(<IrisTable columns={grouped} data={rows} rowKey="id" responsive />)
    expect(document.querySelector('[data-iris-table-header-group=""]')).not.toBeNull()
    expect(headerKeys()).toEqual(['group', 'c', 'a', 'b'])
    expect(document.querySelector('[data-iris-table-header="d"]')).toBeNull()
  })

  it('budgets leading detail and selection tracks before fitting', () => {
    installResponsive(479)
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        selectable="multi"
        renderDetail={() => <div>detail</div>}
        responsive
      />,
    )
    // 40px detail + 40px selection leaves 399px, so two tail columns hide.
    expect(headerKeys()).toEqual(['a', 'b', 'c'])
  })

  it('still applies the floor when utility tracks consume the measured width', () => {
    installResponsive(50)
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        seq
        selectable="multi"
        renderDetail={() => <div>detail</div>}
        responsive
      />,
    )
    expect(headerKeys()).toEqual(['a'])
    expect(root().nextElementSibling?.getAttribute('data-iris-scroll-hint')).toBe('')
  })

  it('uses controlled width overrides in the same fit chain', () => {
    installResponsive(479)
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        defaultColumnWidths={{ a: 260, b: 100, c: 100, d: 100, e: 100 }}
        responsive
      />,
    )
    expect(headerKeys()).toEqual(['a', 'b', 'c'])
  })

  it('fails closed to declared widths when a controlled width is invalid', () => {
    installResponsive(479)
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnWidths={{ b: Number.NaN, c: Number.POSITIVE_INFINITY }}
        responsive
      />,
    )
    // Invalid overrides do not turn the responsive natural-width sum into
    // NaN/Infinity; the declared 100px widths still fit four columns.
    expect(headerKeys()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('sanitizes invalid controlled widths before writing layout tracks', () => {
    installResponsive(800)
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnWidths={{ a: Number.NaN, b: Number.POSITIVE_INFINITY, c: -10 }}
        columnVirtualization
      />,
    )
    const header = document.querySelector('[data-iris-table-row="header"]') as HTMLElement
    expect(header.style.gridTemplateColumns).toBe('100px 100px 100px 100px 100px')
    expect(header.style.gridTemplateColumns).not.toMatch(/NaN|Infinity|-10/)
  })

  it('clamps a header merge when responsive fitting hides its tail', () => {
    installResponsive(479)
    const merges: IrisTableMergeCell[] = [{ row: 0, col: 3, colspan: 2 }]
    render(
      <IrisTable columns={columns} data={rows} rowKey="id" mergeHeaderCells={merges} responsive />,
    )
    const header = document.querySelector('[data-iris-table-header="d"]') as HTMLElement | null
    expect(header).not.toBeNull()
    expect(header?.style.gridColumnEnd).toBe('')
    expect(document.querySelector('[data-iris-table-header="e"]')).toBeNull()
  })

  it('hides the hint while zoomed', () => {
    installResponsive(250)
    const pinned: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', width: 300, pinned: 'left' },
      { key: 'b', title: 'B', width: 300 },
      { key: 'c', title: 'C', width: 300 },
    ]
    const { container } = render(
      <IrisTable
        columns={pinned}
        data={rows}
        rowKey="id"
        responsive
        toolbar={{}}
        zoomConfig={{ showButton: true }}
      />,
    )
    expect(root().nextElementSibling?.getAttribute('data-iris-scroll-hint')).toBe('')
    fireEvent.click(container.querySelector('[data-iris-table-zoom]')!)
    expect(root().getAttribute('data-iris-table-zoomed')).toBe('true')
    expect(root().nextElementSibling).toBeNull()
  })

  it('does not render the hint in printable mode', () => {
    installResponsive(250)
    const pinned: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', width: 300, pinned: 'left' },
      { key: 'b', title: 'B', width: 300 },
      { key: 'c', title: 'C', width: 300 },
    ]
    render(<IrisTable columns={pinned} data={rows} rowKey="id" responsive printable />)
    expect(root().nextElementSibling).toBeNull()
    expect(root().getAttribute('data-printable')).toBe('true')
  })
})
