import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
]

const baseColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true, align: 'right' },
]

function cellAt(r: number, c: number): HTMLElement | null {
  return document.querySelector(`[data-grid-row="${r}"][data-grid-col="${c}"]`)
}

function scroller(): HTMLElement {
  return document.querySelector('[data-iris-virtual-scroll]') as HTMLElement
}

/** Flush the virtual scroll handler (rAF-batched like the real browser).
 * Two frames: frame 1 runs the scroller's rAF (window commit) + a stale poll,
 * frame 2 runs the follow-up poll that lands the focus. */
async function flushScroll(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  })
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  })
}

describe('@iris-ui-kit/react IrisTable grid keyboard batch AV', () => {
  it('exposes logical row/column counts when keyboard grid semantics are active', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        keyboardNavigation
        rowDrag
        seq
        selectable="multi"
      />,
    )
    const root = document.querySelector('[data-iris-table]')!
    expect(root.getAttribute('role')).toBe('grid')
    expect(root.getAttribute('aria-rowcount')).toBe('4')
    expect(root.getAttribute('aria-colcount')).toBe('5')
  })

  it('Tab moves focus right row-major; Shift+Tab moves left', () => {
    render(<IrisTable columns={baseColumns} data={rows} keyboardNavigation />)
    act(() => cellAt(0, 0)!.focus())
    act(() => fireEvent.keyDown(cellAt(0, 0)!, { key: 'Tab' }))
    expect(document.activeElement).toBe(cellAt(0, 1))
    expect(cellAt(0, 1)!.getAttribute('tabindex')).toBe('0')
    expect(cellAt(0, 0)!.getAttribute('tabindex')).toBe('-1')
    // Row-major: last column of row 0 → first column of row 1.
    act(() => fireEvent.keyDown(cellAt(0, 1)!, { key: 'Tab' }))
    expect(document.activeElement).toBe(cellAt(1, 0))
    // Shift+Tab steps back.
    act(() => fireEvent.keyDown(cellAt(1, 0)!, { key: 'Tab', shiftKey: true }))
    expect(document.activeElement).toBe(cellAt(0, 1))
  })

  it('Tab is clamped at the grid bounds (no wrap)', () => {
    render(<IrisTable columns={baseColumns} data={rows} keyboardNavigation />)
    // First cell: Shift+Tab stays put.
    act(() => cellAt(0, 0)!.focus())
    act(() => fireEvent.keyDown(cellAt(0, 0)!, { key: 'Tab', shiftKey: true }))
    expect(document.activeElement).toBe(cellAt(0, 0))
    // Last cell (row 2, col 1): Tab stays put instead of leaving the table.
    act(() => cellAt(2, 1)!.focus())
    act(() => fireEvent.keyDown(cellAt(2, 1)!, { key: 'Tab' }))
    expect(document.activeElement).toBe(cellAt(2, 1))
  })

  it('Home/End jump to the first/last cell of the current row', () => {
    render(<IrisTable columns={baseColumns} data={rows} keyboardNavigation />)
    act(() => cellAt(1, 1)!.focus())
    act(() => fireEvent.keyDown(cellAt(1, 1)!, { key: 'Home' }))
    expect(document.activeElement).toBe(cellAt(1, 0))
    act(() => fireEvent.keyDown(cellAt(1, 0)!, { key: 'End' }))
    expect(document.activeElement).toBe(cellAt(1, 1))
  })

  it('Enter moves down (alias of ArrowDown), clamped at the last row', () => {
    render(<IrisTable columns={baseColumns} data={rows} keyboardNavigation />)
    act(() => cellAt(0, 1)!.focus())
    act(() => fireEvent.keyDown(cellAt(0, 1)!, { key: 'Enter' }))
    expect(document.activeElement).toBe(cellAt(1, 1))
    // Last row: Enter stays put.
    act(() => fireEvent.keyDown(cellAt(2, 1)!, { key: 'Enter' }))
    expect(document.activeElement).toBe(cellAt(2, 1))
  })

  it('without keyboardNavigation every grid key is inert', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    expect(document.querySelector('[data-grid-row]')).toBeNull()
    const cell = document.querySelector('[data-iris-table-cell="name"]') as HTMLElement
    const prevented: string[] = []
    const spy = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) prevented.push(e.key)
    }
    document.addEventListener('keydown', spy)
    fireEvent.keyDown(cell, { key: 'Tab' })
    fireEvent.keyDown(cell, { key: 'Enter' })
    fireEvent.keyDown(cell, { key: 'PageDown' })
    fireEvent.keyDown(cell, { key: 'End' })
    document.removeEventListener('keydown', spy)
    expect(prevented).toEqual([])
  })
})

describe('@iris-ui-kit/react IrisTable virtual PageUp/PageDown batch AV', () => {
  const many: Row[] = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    name: `Row ${i + 1}`,
    age: 20 + i,
  }))

  it('PageDown moves 10 rows and scrolls the virtual viewport', async () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={many}
        keyboardNavigation
        virtualScroll={{ itemHeight: 32, height: 300, buffer: 2 }}
      />,
    )
    expect(cellAt(0, 0)).not.toBeNull() // initial window renders row 0
    expect(cellAt(10, 0)).toBeNull() // target 10 rows away is NOT rendered yet
    act(() => cellAt(0, 0)!.focus())
    act(() => fireEvent.keyDown(cellAt(0, 0)!, { key: 'PageDown' }))
    // The viewport scrolled ±10 × itemHeight (root is overflow:hidden in
    // pure-virtual mode — the virtual viewport is the body scroller).
    expect(scroller().scrollTop).toBe(10 * 32)
    // jsdom fires no native scroll on programmatic scrollTop — emulate it, then
    // the window re-renders around row 10 and the follow-up layout effect
    // re-arms the focus on the now-rendered cell.
    act(() => fireEvent.scroll(scroller()))
    await flushScroll()
    expect(cellAt(10, 0)).not.toBeNull()
    expect(document.activeElement).toBe(cellAt(10, 0))
    expect(cellAt(10, 0)!.getAttribute('tabindex')).toBe('0')
  })

  it('PageUp scrolls back up 10 rows', async () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={many}
        keyboardNavigation
        virtualScroll={{ itemHeight: 32, height: 300, buffer: 2 }}
      />,
    )
    // Pre-scroll the viewport so row 20 is rendered and focusable.
    const viewport = scroller()
    act(() => {
      viewport.scrollTop = 20 * 32
      fireEvent.scroll(viewport)
    })
    await flushScroll()
    act(() => cellAt(20, 0)!.focus())
    act(() => fireEvent.keyDown(cellAt(20, 0)!, { key: 'PageUp' }))
    expect(scroller().scrollTop).toBe(10 * 32)
    act(() => fireEvent.scroll(scroller()))
    await flushScroll()
    expect(document.activeElement).toBe(cellAt(10, 0))
  })
})
