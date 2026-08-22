import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from '../Table'
import type { IrisTableColumn, IrisTableHandle } from '../types'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  city: string
  amount: number
}

const rows: Row[] = [
  { id: 1, name: 'alice', city: 'Paris', amount: 1.2 },
  { id: 2, name: 'bob', city: 'Paris', amount: 2.5 },
  { id: 3, name: 'cara', city: 'Berlin', amount: 4 },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'city', title: 'City', editable: true },
  { key: 'amount', title: 'Amount', editor: 'number' },
]

function cell(id: number, key: string): HTMLElement {
  return document.querySelector(`[data-iris-table-row="${id}"] [data-iris-table-cell="${key}"]`)!
}

function focusCell(id: number, key: string): HTMLElement {
  const el = cell(id, key)
  act(() => {
    el.focus()
    fireEvent.focus(el)
  })
  return el
}

function pointerEvent(type: string, init: Record<string, unknown> = {}): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { button: 0, pointerId: 1, clientX: 0, clientY: 0 }, init)
  return event
}

function dispatchPointer(el: Element | Window, type: string, init: Record<string, unknown>): void {
  el.dispatchEvent(pointerEvent(type, init))
}

describe('IrisTable batches DL–DT', () => {
  it('DL patternFill aliases the live matching-value hint', () => {
    render(<IrisTable columns={columns} data={rows} rowKey="id" patternFill />)
    act(() => fireEvent.doubleClick(cell(1, 'city')))
    expect(cell(2, 'city').getAttribute('data-iris-input-hint')).toBe('true')
    expect(cell(3, 'city').getAttribute('data-iris-input-hint')).toBeNull()
  })

  it('DM restores and periodically writes a separate full state snapshot', () => {
    vi.useFakeTimers()
    const data = new Map<string, string>([
      ['grid-auto', JSON.stringify({ columnWidths: { name: 144 } })],
    ])
    const storage = {
      getItem: vi.fn((key: string) => data.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => data.set(key, value)),
    }
    function Harness(): React.ReactElement {
      const [widths, setWidths] = React.useState<Record<string, number>>({})
      return (
        <IrisTable
          columns={columns}
          data={rows}
          rowKey="id"
          columnWidths={widths}
          onColumnWidthsChange={setWidths}
          autoSaveState={{ intervalMs: 50, storage, key: 'grid-auto' }}
        />
      )
    }
    render(<Harness />)
    expect(
      (document.querySelector('[data-iris-table-row="header"]') as HTMLElement).style
        .gridTemplateColumns,
    ).toContain('144px')
    act(() => vi.advanceTimersByTime(50))
    expect(storage.setItem).toHaveBeenCalledWith(
      'grid-auto',
      expect.stringContaining('"columnWidths":{"name":144}'),
    )
  })

  it('DN renders count/average only for numeric header columns', () => {
    render(<IrisTable columns={columns} data={rows} rowKey="id" headerStats />)
    expect(
      document.querySelector('[data-iris-table-header="name"] [data-iris-header-stats]'),
    ).toBeNull()
    expect(
      document.querySelector('[data-iris-table-header="amount"] [data-iris-header-stats]')
        ?.textContent,
    ).toBe('n=3 · avg=2.57')
  })

  it('DN shows stats on numeric leaf headers inside a grouped header (never on the group row)', () => {
    const grouped: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      {
        key: 'info',
        title: 'Info',
        children: [
          { key: 'city', title: 'City' },
          { key: 'amount', title: 'Amount' },
        ],
      },
    ]
    render(<IrisTable columns={grouped} data={rows} rowKey="id" headerStats />)
    expect(
      document.querySelector('[data-iris-table-header="info"] [data-iris-header-stats]'),
    ).toBeNull()
    expect(
      document.querySelector('[data-iris-table-header="city"] [data-iris-header-stats]'),
    ).toBeNull()
    expect(
      document.querySelector('[data-iris-table-header="amount"] [data-iris-header-stats]')
        ?.textContent,
    ).toBe('n=3 · avg=2.57')
  })

  it('DO applies numeric formatting to the selected region through one write-back', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        cellRange
        onDataChange={onDataChange}
        contextMenu={{ items: () => [], onSelect: vi.fn(), formatActions: true }}
      />,
    )
    act(() => {
      fireEvent.click(cell(1, 'amount'))
      fireEvent.click(cell(2, 'amount'), { shiftKey: true })
    })
    fireEvent.contextMenu(cell(1, 'amount'), { clientX: 10, clientY: 10 })
    act(() =>
      fireEvent.click(
        document.querySelector('[data-iris-table-context-menu-item="__iris-format-number"]')!,
      ),
    )
    expect(cell(1, 'amount').textContent).toBe('1.20')
    expect(cell(2, 'amount').textContent).toBe('2.50')
    expect(onDataChange).toHaveBeenCalledTimes(1)
  })

  it('DO keeps format keys out of the user onSelect callback', () => {
    const onSelect = vi.fn()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        contextMenu={{
          items: () => [{ key: 'custom', label: 'Custom' }],
          onSelect,
          formatActions: true,
        }}
      />,
    )
    fireEvent.contextMenu(cell(1, 'amount'), { clientX: 10, clientY: 10 })
    act(() =>
      fireEvent.click(
        document.querySelector('[data-iris-table-context-menu-item="__iris-format-number"]')!,
      ),
    )
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.contextMenu(cell(1, 'amount'), { clientX: 10, clientY: 10 })
    act(() =>
      fireEvent.click(document.querySelector('[data-iris-table-context-menu-item="custom"]')!),
    )
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0]![0]).toBe('custom')
  })

  it('DO commits nothing when no cell matches the requested format', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        onDataChange={onDataChange}
        contextMenu={{ items: () => [], onSelect: vi.fn(), formatActions: true }}
      />,
    )
    fireEvent.contextMenu(cell(1, 'name'), { clientX: 10, clientY: 10 })
    act(() =>
      fireEvent.click(
        document.querySelector('[data-iris-table-context-menu-item="__iris-format-number"]')!,
      ),
    )
    expect(onDataChange).not.toHaveBeenCalled()
    fireEvent.contextMenu(cell(1, 'amount'), { clientX: 10, clientY: 10 })
    act(() =>
      fireEvent.click(
        document.querySelector('[data-iris-table-context-menu-item="__iris-format-upper"]')!,
      ),
    )
    expect(onDataChange).not.toHaveBeenCalled()
  })

  it('DO applies uppercase formatting to the clicked text cell', () => {
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        contextMenu={{ items: () => [], onSelect: vi.fn(), formatActions: true }}
      />,
    )
    fireEvent.contextMenu(cell(1, 'name'), { clientX: 10, clientY: 10 })
    act(() =>
      fireEvent.click(
        document.querySelector('[data-iris-table-context-menu-item="__iris-format-upper"]')!,
      ),
    )
    expect(cell(1, 'name').textContent).toBe('ALICE')
  })

  it('DP marks the root and injects custom thumb rules', () => {
    render(<IrisTable columns={columns} data={rows} scrollbarThumb />)
    expect(document.querySelector('[data-iris-scrollbar-thumb="true"]')).not.toBeNull()
    const css = document.getElementById('iris-table-row-styles')?.textContent ?? ''
    expect(css).toContain('data-iris-scrollbar-thumb')
    // style properties: slim 8px webkit bars + rounded, token-colored thumb
    // with the hover ramp (rest: translucent primary → hover: full primary)
    expect(css).toContain('width: 8px')
    expect(css).toContain('border-radius: var(--iris-radius-sm, 4px)')
    expect(css).toContain('color-mix(in srgb, var(--iris-primary) 60%, transparent)')
    expect(css).toContain('::-webkit-scrollbar-thumb:hover')
  })

  it('DP leaves native scrollbars untouched by default', () => {
    render(<IrisTable columns={columns} data={rows} />)
    expect(document.querySelector('[data-iris-scrollbar-thumb]')).toBeNull()
  })

  it('DQ drops a row on a matching external zone', () => {
    const onDrop = vi.fn()
    const { container } = render(
      <>
        <IrisTable
          columns={columns}
          data={rows}
          rowKey="id"
          rowDragBetween={[{ key: 'archive', onDrop }]}
        />
        <div data-iris-drop-zone="archive" />
      </>,
    )
    const zone = container.querySelector('[data-iris-drop-zone="archive"]')!
    const originalElementFromPoint = document.elementFromPoint
    const elementFromPoint = vi.fn(() => zone)
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint,
    })
    const handle = container.querySelector('[data-iris-table-cell="__drag"]')!
    const root = container.querySelector('[data-iris-table]')!
    act(() => dispatchPointer(handle, 'pointerdown', { button: 0, clientX: 10, clientY: 10 }))
    act(() => dispatchPointer(root, 'pointermove', { clientX: 20, clientY: 20 }))
    act(() => dispatchPointer(window, 'pointerup', { clientX: 30, clientY: 30 }))
    expect(onDrop).toHaveBeenCalledWith(rows[0])
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: originalElementFromPoint,
    })
  })

  it('DQ ignores a zone whose key does not match any rowDragBetween target', () => {
    const onDrop = vi.fn()
    const onReorder = vi.fn()
    const { container } = render(
      <>
        <IrisTable
          columns={columns}
          data={rows}
          rowKey="id"
          rowDrag={{ onReorder }}
          rowDragBetween={[{ key: 'archive', onDrop }]}
        />
        <div data-iris-drop-zone="trash" />
      </>,
    )
    const zone = container.querySelector('[data-iris-drop-zone="trash"]')!
    const originalElementFromPoint = document.elementFromPoint
    const elementFromPoint = vi.fn(() => zone)
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint,
    })
    const handle = container.querySelector('[data-iris-table-cell="__drag"]')!
    const root = container.querySelector('[data-iris-table]')!
    act(() => dispatchPointer(handle, 'pointerdown', { button: 0, clientX: 10, clientY: 10 }))
    act(() => dispatchPointer(root, 'pointermove', { clientX: 20, clientY: 20 }))
    act(() => dispatchPointer(window, 'pointerup', { clientX: 30, clientY: 30 }))
    expect(onDrop).not.toHaveBeenCalled()
    expect(onReorder).not.toHaveBeenCalled()
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: originalElementFromPoint,
    })
  })

  it('DQ fires onDrop exactly once and never reorders through onReorder', () => {
    const onDrop = vi.fn()
    const onReorder = vi.fn()
    const { container } = render(
      <>
        <IrisTable
          columns={columns}
          data={rows}
          rowKey="id"
          rowDrag={{ onReorder }}
          rowDragBetween={[{ key: 'archive', onDrop }]}
        />
        <div data-iris-drop-zone="archive" />
      </>,
    )
    const zone = container.querySelector('[data-iris-drop-zone="archive"]')!
    const originalElementFromPoint = document.elementFromPoint
    const elementFromPoint = vi.fn(() => zone)
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint,
    })
    const handle = container.querySelector('[data-iris-table-cell="__drag"]')!
    const root = container.querySelector('[data-iris-table]')!
    act(() => dispatchPointer(handle, 'pointerdown', { button: 0, clientX: 10, clientY: 10 }))
    act(() => dispatchPointer(root, 'pointermove', { clientX: 20, clientY: 20 }))
    act(() => dispatchPointer(window, 'pointerup', { clientX: 30, clientY: 30 }))
    expect(onDrop).toHaveBeenCalledTimes(1)
    expect(onDrop).toHaveBeenCalledWith(rows[0])
    expect(onReorder).not.toHaveBeenCalled()
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: originalElementFromPoint,
    })
  })

  it('DQ stays table-internal when elementFromPoint is unavailable', () => {
    const onDrop = vi.fn()
    const onReorder = vi.fn()
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        rowDrag={{ onReorder }}
        rowDragBetween={[{ key: 'archive', onDrop }]}
      />,
    )
    const originalElementFromPoint = document.elementFromPoint
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: undefined,
    })
    const handle = container.querySelector('[data-iris-table-cell="__drag"]')!
    const root = container.querySelector('[data-iris-table]')!
    act(() => dispatchPointer(handle, 'pointerdown', { button: 0, clientX: 10, clientY: 10 }))
    act(() => dispatchPointer(root, 'pointermove', { clientX: 20, clientY: 20 }))
    act(() => dispatchPointer(window, 'pointerup', { clientX: 30, clientY: 30 }))
    expect(onDrop).not.toHaveBeenCalled()
    expect(onReorder).not.toHaveBeenCalled()
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: originalElementFromPoint,
    })
  })

  it('DR starts editing on a configured key while retaining F2', () => {
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        keyboardNavigation
        editKeys={['Enter']}
      />,
    )
    const el = focusCell(1, 'name')
    act(() => fireEvent.keyDown(el, { key: 'Enter' }))
    expect(document.querySelector('[data-iris-table-editor]')).not.toBeNull()
  })

  it('DR keeps F2 available when editKeys are configured', () => {
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        keyboardNavigation
        editKeys={['Enter']}
      />,
    )
    const el = focusCell(1, 'city')
    act(() => fireEvent.keyDown(el, { key: 'F2' }))
    expect(document.querySelector('[data-iris-table-editor]')).not.toBeNull()
  })

  it('DR starts editing on Space (key + code three-way match)', () => {
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        keyboardNavigation
        editKeys={['Space']}
      />,
    )
    const el = focusCell(1, 'name')
    act(() => fireEvent.keyDown(el, { key: ' ', code: 'Space' }))
    expect(document.querySelector('[data-iris-table-editor]')).not.toBeNull()
  })

  it('DR with an empty editKeys list keeps only F2 (Enter inert)', () => {
    render(<IrisTable columns={columns} data={rows} rowKey="id" keyboardNavigation editKeys={[]} />)
    const el = focusCell(1, 'name')
    act(() => fireEvent.keyDown(el, { key: 'Enter' }))
    expect(document.querySelector('[data-iris-table-editor]')).toBeNull()
    act(() => fireEvent.keyDown(el, { key: 'F2' }))
    expect(document.querySelector('[data-iris-table-editor]')).not.toBeNull()
  })

  it('DR is inert without keyboardNavigation and on non-editable columns', () => {
    const { rerender } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        keyboardNavigation={false}
        editKeys={['Enter', 'Space', 'F2']}
      />,
    )
    act(() => fireEvent.keyDown(focusCell(1, 'name'), { key: 'Enter' }))
    expect(document.querySelector('[data-iris-table-editor]')).toBeNull()
    rerender(
      <IrisTable
        columns={[{ key: 'age', title: 'Age' }]}
        data={rows}
        rowKey="id"
        keyboardNavigation
        editKeys={['Enter', 'Space', 'F2']}
      />,
    )
    act(() => fireEvent.keyDown(focusCell(1, 'age'), { key: 'F2' }))
    expect(document.querySelector('[data-iris-table-editor]')).toBeNull()
  })

  it('DS shows and clears the live width hint during a resize drag', () => {
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        resizableColumns
        widthHint
        defaultColumnWidths={{ name: 100 }}
      />,
    )
    const handle = document.querySelector(
      '[data-iris-table-resize-handle][data-column-key="name"]',
    )!
    act(() => dispatchPointer(handle, 'pointerdown', { button: 0, clientX: 20, clientY: 40 }))
    act(() => dispatchPointer(handle, 'pointermove', { clientX: 36, clientY: 40 }))
    expect(document.querySelector('[data-iris-width-hint]')?.textContent).toBe('116px')
    act(() => dispatchPointer(handle, 'pointerup', { clientX: 36, clientY: 40 }))
    expect(document.querySelector('[data-iris-width-hint]')).toBeNull()
  })

  it('DT exports rows by explicit keys in current body order', () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    render(<IrisTable columns={columns} data={rows} rowKey="id" tableRef={ref} />)
    expect(ref.current!.exportRowsCsv([3, 1])).toBe(
      'Name,City,Amount\nalice,Paris,1.2\ncara,Berlin,4',
    )
  })
})
