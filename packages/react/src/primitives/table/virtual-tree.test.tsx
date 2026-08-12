import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable, type IrisTableHandle } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  children?: Row[]
}

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age', align: 'right' },
]

/** Body rows only (excludes the header pseudo-row). */
function rowEls(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll('[data-iris-table-row]:not([data-iris-table-row=header])'),
  )
}

function virtualItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-virtual-item]'))
}

function spacer(): HTMLElement {
  return document.querySelector('[data-iris-virtual-spacer]') as HTMLElement
}

function scroller(): HTMLElement {
  return document.querySelector('[data-iris-virtual-scroll]') as HTMLElement
}

/** Expand/collapse a tree parent row by clicking its caret. */
function clickTreeToggle(index: number): void {
  const toggles = Array.from(document.querySelectorAll('[data-iris-table-tree-toggle]'))
  const el = toggles[index] as HTMLElement | undefined
  if (!el) throw new Error(`tree toggle #${index} not rendered`)
  act(() => fireEvent.click(el))
}

/** Expand/collapse a detail row by clicking its expand button. */
function clickDetailToggle(index: number): void {
  const toggles = Array.from(document.querySelectorAll('[data-iris-table-expand-toggle]'))
  const el = toggles[index] as HTMLElement | undefined
  if (!el) throw new Error(`detail toggle #${index} not rendered`)
  act(() => fireEvent.click(el))
}

/** Scroll the virtual body to `top` (syncs state through the scroll handler + RAF). */
async function scrollTo(top: number): Promise<void> {
  const el = scroller()
  act(() => {
    el.scrollTop = top
    fireEvent.scroll(el)
  })
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  })
}

/**
 * Batch AE: virtualScroll across tree / detail / tree+detail.
 *
 * jsdom note: `clientHeight` is 0, so the viewport collapses to 0 and the fixed
 * window renders `buffer` items (default 4 → indices 0..4). Window assertions
 * use the SPACER height (= items.length × itemHeight) as the virtual itemCount
 * proxy, and DOM row counts for windowing.
 */
describe('@iris-ui-kit/react IrisTable virtual tree + detail (batch AE)', () => {
  const flat: Row[] = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    name: `N${i}`,
    age: i,
  }))

  it('flat virtual mode is unchanged (windowed + exact spacer)', () => {
    render(
      <IrisTable columns={columns} data={flat} virtualScroll={{ itemHeight: 36, height: 200 }} />,
    )
    expect(scroller()).not.toBeNull()
    expect(rowEls().length).toBeGreaterThan(0)
    expect(rowEls().length).toBeLessThan(50)
    // Spacer = itemCount × itemHeight — unchanged from before batch AE.
    expect(spacer().style.height).toBe('1800px')
  })

  it('virtual + tree renders only the visible window (tree decoration intact)', () => {
    const tree: Row[] = [
      {
        id: 1,
        name: 'Root',
        age: 0,
        children: Array.from({ length: 60 }, (_, i) => ({ id: 100 + i, name: `C${i}`, age: i })),
      },
    ]
    render(
      <IrisTable
        columns={columns}
        data={tree}
        rowKey="id"
        getSubRows={(r) => r.children}
        defaultExpandedRowKeys={[1]}
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />,
    )
    // 1 root + 60 children = 61 virtual slots.
    expect(spacer().style.height).toBe(`${61 * 36}px`)
    // Windowed: far fewer than 61 rows in the DOM.
    expect(rowEls().length).toBeGreaterThan(0)
    expect(rowEls().length).toBeLessThan(61)
    // Tree meta flows into the virtualized rows (caret + aria-level).
    expect(document.querySelector('[data-iris-table-tree-toggle]')).not.toBeNull()
    expect(document.querySelector('[data-iris-table-row][aria-level="1"]')).not.toBeNull()
  })

  it('expanding a node increases the virtual itemCount; collapse mid-scroll stays sane', async () => {
    const tree: Row[] = [
      {
        id: 1,
        name: 'A',
        age: 0,
        children: Array.from({ length: 40 }, (_, i) => ({ id: 100 + i, name: `A${i}`, age: i })),
      },
      {
        id: 2,
        name: 'B',
        age: 1,
        children: Array.from({ length: 40 }, (_, i) => ({ id: 200 + i, name: `B${i}`, age: i })),
      },
    ]
    const ref = React.createRef<IrisTableHandle<Row>>()
    render(
      <IrisTable
        columns={columns}
        data={tree}
        rowKey="id"
        getSubRows={(r) => r.children}
        defaultExpandedRowKeys={[1]}
        virtualScroll={{ itemHeight: 36, height: 200 }}
        tableRef={ref}
      />,
    )
    // A (expanded) + 40 children + B (collapsed) = 42 slots.
    expect(spacer().style.height).toBe(`${42 * 36}px`)

    // Scroll to the bottom, then expand B: itemCount grows → spacer grows, the
    // scroll position is preserved (expansion never yanks the viewport).
    await scrollTo(42 * 36)
    clickTreeToggle(0) // the window only renders B's caret at the bottom
    expect(spacer().style.height).toBe(`${82 * 36}px`)
    expect(scroller().scrollTop).toBe(42 * 36)
    // Window still renders rows (no blank window after the count change).
    expect(virtualItems().length).toBeGreaterThan(0)

    // Scroll deep into the expanded tree, then collapse A from OUTSIDE (the
    // table handle — the caret is out of the window): the list shrinks far
    // past the viewport — the re-clamp must fix BOTH the DOM scrollTop and the
    // window (no blank frame until a scroll event syncs).
    await scrollTo(82 * 36)
    act(() => ref.current?.toggleRowExpand(1))
    // A collapsed, B (with its 40 children) still expanded → 42 slots.
    expect(spacer().style.height).toBe(`${42 * 36}px`)
    const maxScroll = Math.max(0, 42 * 36 - 0) // jsdom viewport collapses to 0
    expect(scroller().scrollTop).toBe(maxScroll) // DOM scrollTop re-clamped
    // The fixed window derives from the clamped state — non-blank immediately.
    expect(virtualItems().length).toBeGreaterThan(0)
  })

  it('virtual + renderDetail renders detail rows as one slot each', async () => {
    render(
      <IrisTable
        columns={columns}
        data={flat.slice(0, 30)}
        rowKey="id"
        renderDetail={(r) => <div>d{r.id}</div>}
        defaultExpandedRowKeys={[1]}
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />,
    )
    // 30 rows + 1 detail slot (row 0 expanded) = 31 slots.
    expect(spacer().style.height).toBe(`${31 * 36}px`)
    // The expanded detail panel renders inside the virtual body.
    const detail = document.querySelector('[data-iris-table-row-detail]') as HTMLElement
    expect(detail).not.toBeNull()
    expect(detail.textContent).toBe('d1')
    // The detail slot sits directly after its row: slot 0 = row, slot 1 = detail.
    const slot1 = document.querySelector('[data-iris-virtual-index="1"]') as HTMLElement
    expect(slot1.querySelector('[data-iris-table-row-detail]')).not.toBeNull()
    const slot0 = document.querySelector('[data-iris-virtual-index="0"]') as HTMLElement
    expect(slot0.querySelector('[data-iris-table-expand-toggle]')).not.toBeNull()

    // Expanding a second row adds exactly one more slot.
    clickDetailToggle(1)
    expect(spacer().style.height).toBe(`${32 * 36}px`)
    expect(document.querySelectorAll('[data-iris-table-row-detail]').length).toBe(2)

    // Collapsing again removes the slot (itemCount shrinks, clamp keeps sane).
    clickDetailToggle(0)
    expect(spacer().style.height).toBe(`${31 * 36}px`)
  })

  it('virtual + tree + renderDetail renders both (previously blocked combination)', () => {
    const tree: Row[] = [
      {
        id: 1,
        name: 'Root',
        age: 0,
        children: Array.from({ length: 30 }, (_, i) => ({ id: 100 + i, name: `C${i}`, age: i })),
      },
    ]
    render(
      <IrisTable
        columns={columns}
        data={tree}
        rowKey="id"
        getSubRows={(r) => r.children}
        renderDetail={(r) => <div>d{r.id}</div>}
        defaultExpandedRowKeys={[1]}
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />,
    )
    // Root + detail slot + 30 children = 32 slots.
    expect(spacer().style.height).toBe(`${32 * 36}px`)
    expect(document.querySelector('[data-iris-table-tree-toggle]')).not.toBeNull()
    const detail = document.querySelector('[data-iris-table-row-detail]') as HTMLElement
    expect(detail).not.toBeNull()
    expect(detail.textContent).toBe('d1')
    // Windowed.
    expect(rowEls().length).toBeLessThan(32)
  })
})
