import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
}

const columns: IrisTableColumn<Row>[] = [
  { key: 'a', title: 'A' },
  { key: 'b', title: 'B' },
  { key: 'c', title: 'C' },
]

const rows: Row[] = [{ id: 1, a: 'x', b: 'y', c: 'z' }]

const headerKeys = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('[data-iris-table-header]')].map((el) =>
    el.getAttribute('data-iris-table-header'),
  )

const openPanel = (container: HTMLElement): HTMLElement => {
  fireEvent.click(container.querySelector('[data-iris-table-toolbar-columns]')!)
  return container.querySelector('[data-iris-table-column-settings]') as HTMLElement
}

/** Native pointer construction like the batch-2 drag tests (jsdom may lack PointerEvent). */
const makePointer = (type: string, init: Record<string, unknown>): Event => {
  const PointerCtor = (globalThis as Record<string, unknown>).PointerEvent
  if (typeof PointerCtor === 'function') {
    return new (PointerCtor as new (t: string, i?: EventInit) => Event)(type, {
      bubbles: true,
      ...(init as EventInit),
    })
  }
  const event = new Event(type, { bubbles: true })
  Object.assign(event, init)
  return event
}

const stubRowRects = (panel: HTMLElement): void => {
  ;[...panel.querySelectorAll('[data-iris-table-column-settings-row]')].forEach((el, i) => {
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: i * 40,
      width: 200,
      height: 40,
      right: 200,
      bottom: (i + 1) * 40,
      x: 0,
      y: i * 40,
      toJSON: () => ({}),
    })
  })
}

describe('IrisTable columnOrder (vxe customConfig parity)', () => {
  it('sorts displayColumns by columnOrder; unknown keys ignored; unnamed keys keep relative order after the ordered ones', () => {
    const { container } = render(
      <IrisTable
        columns={[
          { key: 'a', title: 'A' },
          { key: 'b', title: 'B' },
          { key: 'c', title: 'C' },
          { key: 'd', title: 'D' },
        ]}
        data={rows}
        rowKey="id"
        columnOrder={['c', 'zzz', 'a']}
      />,
    )
    expect(headerKeys(container)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('keeps the source order without columnOrder and re-sorts when the parent updates it', () => {
    const Harness = ({ order }: { order?: string[] }) => (
      <IrisTable columns={columns} data={rows} rowKey="id" columnOrder={order} />
    )
    const { container, rerender } = render(<Harness />)
    expect(headerKeys(container)).toEqual(['a', 'b', 'c'])
    rerender(<Harness order={['b']} />)
    expect(headerKeys(container)).toEqual(['b', 'a', 'c'])
    rerender(<Harness order={['c', 'a']} />)
    expect(headerKeys(container)).toEqual(['c', 'a', 'b'])
    rerender(<Harness />)
    expect(headerKeys(container)).toEqual(['a', 'b', 'c'])
  })

  it('an empty columnOrder behaves as no order', () => {
    const { container } = render(
      <IrisTable columns={columns} data={rows} rowKey="id" columnOrder={[]} />,
    )
    expect(headerKeys(container)).toEqual(['a', 'b', 'c'])
  })
})

describe('IrisTable custom column panel (vxe customConfig parity)', () => {
  it('opens from the toolbar button and toggles closed on a second click', () => {
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        toolbar={{ columnSettings: true }}
        columnVisibility={{}}
        onColumnVisibilityChange={vi.fn()}
      />,
    )
    const panel = openPanel(container)
    expect(panel).not.toBeNull()
    expect(panel.querySelectorAll('[data-iris-table-column-settings-row]').length).toBe(3)
    expect(panel.querySelector('[data-iris-table-column-settings-search]')).not.toBeNull()
    expect(panel.querySelector('[data-iris-table-column-settings-reset]')).not.toBeNull()
    expect(panel.querySelector('[data-iris-table-column-settings-confirm]')).not.toBeNull()
    fireEvent.click(container.querySelector('[data-iris-table-toolbar-columns]')!)
    expect(container.querySelector('[data-iris-table-column-settings]')).toBeNull()
  })

  it('search filters the panel list (case-insensitive) and restores on empty query', () => {
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        toolbar={{ columnSettings: true }}
        columnVisibility={{}}
        onColumnVisibilityChange={vi.fn()}
      />,
    )
    const panel = openPanel(container)
    const search = panel.querySelector('[data-iris-table-column-settings-search]')!
    fireEvent.change(search, { target: { value: 'b' } })
    expect(
      [...panel.querySelectorAll('[data-iris-table-column-settings-row]')].map((el) =>
        el.getAttribute('data-iris-table-column-settings-row'),
      ),
    ).toEqual(['b'])
    fireEvent.change(search, { target: { value: '' } })
    expect(panel.querySelectorAll('[data-iris-table-column-settings-row]').length).toBe(3)
  })

  it('visibility toggles update columnVisibility immediately (and hidden columns stay listed, unchecked)', () => {
    const onVis = vi.fn()
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        toolbar={{ columnSettings: true }}
        columnVisibility={{ b: false }}
        onColumnVisibilityChange={onVis}
      />,
    )
    const panel = openPanel(container)
    const rowEls = [...panel.querySelectorAll('[data-iris-table-column-settings-row]')]
    // Hidden column is still listed with an unchecked box.
    expect(rowEls.length).toBe(3)
    expect((rowEls[1]!.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(
      false,
    )
    // Toggle column a off → callback with the merged map.
    fireEvent.click(rowEls[0]!.querySelector('input[type="checkbox"]')!)
    expect(onVis).toHaveBeenLastCalledWith({ b: false, a: false })
  })

  it('drag reorder edits the draft; confirm fires onColumnOrderChange with the new order and closes', () => {
    const onOrder = vi.fn()
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        toolbar={{ columnSettings: true }}
        columnVisibility={{}}
        onColumnVisibilityChange={vi.fn()}
        onColumnOrderChange={onOrder}
      />,
    )
    const panel = openPanel(container)
    stubRowRects(panel)
    const rowEls = [...panel.querySelectorAll('[data-iris-table-column-settings-row]')]
    // Press row 0 (a), move past the 4px threshold, drop over row 2 (center y = 100).
    act(() => {
      rowEls[0]!
        .querySelector('[data-iris-table-column-settings-handle]')!
        .dispatchEvent(makePointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }))
      panel.dispatchEvent(makePointer('pointermove', { clientX: 12, clientY: 14 }))
      panel.dispatchEvent(makePointer('pointermove', { clientX: 12, clientY: 100 }))
      panel.dispatchEvent(makePointer('pointerup', { clientX: 12, clientY: 100 }))
    })
    // Draft reordered (row order reflects it before confirm).
    expect(
      [...panel.querySelectorAll('[data-iris-table-column-settings-row]')].map((el) =>
        el.getAttribute('data-iris-table-column-settings-row'),
      ),
    ).toEqual(['b', 'c', 'a'])
    fireEvent.click(panel.querySelector('[data-iris-table-column-settings-confirm]')!)
    expect(onOrder).toHaveBeenCalledWith(['b', 'c', 'a'])
    expect(container.querySelector('[data-iris-table-column-settings]')).toBeNull()
  })

  it('confirm without dragging commits the current draft order and closes', () => {
    const onOrder = vi.fn()
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        toolbar={{ columnSettings: true }}
        columnVisibility={{}}
        onColumnVisibilityChange={vi.fn()}
        onColumnOrderChange={onOrder}
      />,
    )
    const panel = openPanel(container)
    fireEvent.click(panel.querySelector('[data-iris-table-column-settings-confirm]')!)
    expect(onOrder).toHaveBeenCalledWith(['a', 'b', 'c'])
    expect(container.querySelector('[data-iris-table-column-settings]')).toBeNull()
  })

  it('reset restores the first-open visibility snapshot, clears the order and re-seeds the draft', () => {
    const onVis = vi.fn()
    const onOrder = vi.fn()
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        toolbar={{ columnSettings: true }}
        columnVisibility={{ b: false }}
        onColumnVisibilityChange={onVis}
        onColumnOrderChange={onOrder}
      />,
    )
    const panel = openPanel(container)
    // Toggle a off (visibility drifts from the initial map).
    fireEvent.click(panel.querySelectorAll('input[type="checkbox"]')[0]!)
    expect(onVis).toHaveBeenLastCalledWith({ b: false, a: false })
    // Reset → snapshot { b: false } restored + order cleared (undefined).
    fireEvent.click(panel.querySelector('[data-iris-table-column-settings-reset]')!)
    expect(onVis).toHaveBeenLastCalledWith({ b: false })
    expect(onOrder).toHaveBeenLastCalledWith(undefined)
    // Panel stays open with the default order re-seeded.
    expect(container.querySelector('[data-iris-table-column-settings]')).not.toBeNull()
    expect(
      [...container.querySelectorAll('[data-iris-table-column-settings-row]')].map((el) =>
        el.getAttribute('data-iris-table-column-settings-row'),
      ),
    ).toEqual(['a', 'b', 'c'])
  })

  it('Esc closes the panel without applying the draft', () => {
    const onOrder = vi.fn()
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        toolbar={{ columnSettings: true }}
        columnVisibility={{}}
        onColumnVisibilityChange={vi.fn()}
        onColumnOrderChange={onOrder}
      />,
    )
    const panel = openPanel(container)
    stubRowRects(panel)
    const rowEls = [...panel.querySelectorAll('[data-iris-table-column-settings-row]')]
    act(() => {
      rowEls[0]!
        .querySelector('[data-iris-table-column-settings-handle]')!
        .dispatchEvent(makePointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }))
      panel.dispatchEvent(makePointer('pointermove', { clientX: 12, clientY: 14 }))
      panel.dispatchEvent(makePointer('pointermove', { clientX: 12, clientY: 100 }))
      panel.dispatchEvent(makePointer('pointerup', { clientX: 12, clientY: 100 }))
    })
    fireEvent.keyDown(panel.querySelector('[data-iris-table-column-settings-search]')!, {
      key: 'Escape',
    })
    expect(container.querySelector('[data-iris-table-column-settings]')).toBeNull()
    expect(onOrder).not.toHaveBeenCalled()
  })

  it('toolbar.customConfig.resetText overrides the reset label', () => {
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        toolbar={{ columnSettings: true, customConfig: { resetText: '恢复默认' } }}
        columnVisibility={{}}
        onColumnVisibilityChange={vi.fn()}
      />,
    )
    const panel = openPanel(container)
    expect(panel.querySelector('[data-iris-table-column-settings-reset]')!.textContent).toBe(
      '恢复默认',
    )
  })
})
