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

const flat: Row[] = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  name: `N${i}`,
  age: i,
}))

/** Row 1 carries 20 children; rows 2–10 are leaves. */
function makeTree(): Row[] {
  return [
    {
      id: 1,
      name: 'A',
      age: 0,
      children: Array.from({ length: 20 }, (_, i) => ({
        id: 100 + i,
        name: `A${i}`,
        age: i,
      })),
    },
    { id: 2, name: 'B', age: 1 },
    { id: 3, name: 'C', age: 2 },
    { id: 4, name: 'D', age: 3 },
    { id: 5, name: 'E', age: 4 },
    { id: 6, name: 'F', age: 5 },
    { id: 7, name: 'G', age: 6 },
    { id: 8, name: 'H', age: 7 },
    { id: 9, name: 'I', age: 8 },
    { id: 10, name: 'J', age: 9 },
  ]
}

function scroller(): HTMLElement {
  return document.querySelector('[data-iris-virtual-scroll]') as HTMLElement
}

function spacer(): HTMLElement {
  return document.querySelector('[data-iris-virtual-spacer]') as HTMLElement
}

function virtualItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-virtual-item]'))
}

function treeToggle(rowId: number): HTMLElement | null {
  return document.querySelector(`[data-iris-table-row="${rowId}"] [data-iris-table-tree-toggle]`)
}

function detailToggle(rowId: number): HTMLElement | null {
  return document.querySelector(`[data-iris-table-row="${rowId}"] [data-iris-table-expand-toggle]`)
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

/** After a toggle's transition write, flush the child's scroll event → rAF →
 * window update (a real browser fires the scroll event automatically). */
async function syncScroll(): Promise<void> {
  act(() => {
    fireEvent.scroll(scroller())
  })
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  })
}

// ── Batch CS expandScrollPreserve (iris 独有 — vxe keeps the pixel offset but
//    never re-anchors the CONTENT: expanding a node above the viewport shifts
//    every row below by the inserted height, so the rows being read jump) ────
// jsdom note: clientHeight is 0, so the fixed window renders buffer items and
// `max` = the spacer height. The anchor math (`newIndex × slotHeight +
// relativeTop`) is asserted on the DOM scrollTop written by the transition
// layout effect; the window-follow is synced explicitly like the batch-AE
// tests.
describe('IrisTable expandScrollPreserve (batch CS)', () => {
  it('fail-closed: without the prop the pixel scrollTop is preserved but the content is NOT anchored', async () => {
    render(
      <IrisTable
        columns={columns}
        data={makeTree()}
        rowKey="id"
        getSubRows={(r) => r.children}
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />,
    )
    // 10 collapsed rows.
    expect(spacer().style.height).toBe(`${10 * 36}px`)
    await scrollTo(4 * 36)
    // Expand row 1 (above the viewport): 20 slots inserted — the pixel offset
    // survives the virtualizer rebuild (default behavior), the anchor does NOT
    // move (the rows under the cursor jump).
    act(() => fireEvent.click(treeToggle(1)!))
    expect(scroller().scrollTop).toBe(4 * 36)
    expect(spacer().style.height).toBe(`${30 * 36}px`)
  })

  it('tree expand ABOVE the viewport re-anchors: newTop = newIndex × slotHeight (content under the cursor stays)', async () => {
    render(
      <IrisTable
        columns={columns}
        data={makeTree()}
        rowKey="id"
        getSubRows={(r) => r.children}
        expandScrollPreserve
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />,
    )
    // First visible = row 5 (plan index 4, key '5'), full offset.
    await scrollTo(4 * 36)
    act(() => fireEvent.click(treeToggle(1)!))
    // Row 5 re-locates to plan index 24 → 24 × 36.
    expect(scroller().scrollTop).toBe(24 * 36)
    await syncScroll()
    expect(virtualItems().length).toBeGreaterThan(0)
  })

  it('tree expand BELOW the viewport is a zero-move (anchor index unchanged)', async () => {
    const tree = makeTree()
    // Row 8 also carries children (its subtree lands below the anchor).
    tree[7] = {
      id: 8,
      name: 'H',
      age: 7,
      children: Array.from({ length: 20 }, (_, i) => ({ id: 800 + i, name: `H${i}`, age: i })),
    }
    render(
      <IrisTable
        columns={columns}
        data={tree}
        rowKey="id"
        getSubRows={(r) => r.children}
        expandScrollPreserve
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />,
    )
    await scrollTo(4 * 36)
    // Expand row 8 (plan index 7): its children insert AFTER the anchor (row 5
    // at index 4) → anchor index unchanged → the write is a no-op.
    act(() => fireEvent.click(treeToggle(8)!))
    expect(scroller().scrollTop).toBe(4 * 36)
  })

  it('tree collapse ABOVE the viewport re-anchors back up (newTop = newIndex × slotHeight)', async () => {
    const ref = React.createRef<IrisTableHandle<Row>>()
    render(
      <IrisTable
        columns={columns}
        data={makeTree()}
        rowKey="id"
        getSubRows={(r) => r.children}
        defaultExpandedRowKeys={[1]}
        expandScrollPreserve
        virtualScroll={{ itemHeight: 36, height: 200 }}
        tableRef={ref}
      />,
    )
    // 1 + 20 children + 9 leaves = 30 slots; first visible = row 5 (index 24).
    expect(spacer().style.height).toBe(`${30 * 36}px`)
    await scrollTo(24 * 36)
    // Collapse row 1 via the handle (its caret is out of the window).
    act(() => ref.current?.toggleRowExpand(1))
    // Row 5 re-locates back to plan index 4 → 4 × 36.
    expect(scroller().scrollTop).toBe(4 * 36)
  })

  it('detail expand above the viewport moves the anchor by exactly one slot (+36)', async () => {
    render(
      <IrisTable
        columns={columns}
        data={flat}
        rowKey="id"
        renderDetail={(r) => <div>d{r.id}</div>}
        expandScrollPreserve
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />,
    )
    // First visible = row 5 (plan index 4).
    await scrollTo(4 * 36)
    act(() => fireEvent.click(detailToggle(1)!))
    // Row 1's detail slot lands at plan index 1 → row 5 shifts to index 5.
    expect(scroller().scrollTop).toBe(5 * 36)
    expect(document.querySelector('[data-iris-table-row-detail]')).not.toBeNull()
  })

  it('a partial anchor offset (relativeTop) survives the re-location', async () => {
    render(
      <IrisTable
        columns={columns}
        data={makeTree()}
        rowKey="id"
        getSubRows={(r) => r.children}
        expandScrollPreserve
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />,
    )
    // scrollTop 130 = 3 slots × 36 + 22 → anchor row 4 (index 3), offset 22.
    await scrollTo(130)
    act(() => fireEvent.click(treeToggle(1)!))
    // Row 4 re-locates to plan index 23 → 23 × 36 + 22.
    expect(scroller().scrollTop).toBe(23 * 36 + 22)
  })

  it('collapse deep past the old bottom clamps to the new max (no blank window)', async () => {
    const tree: Row[] = [
      {
        id: 1,
        name: 'A',
        age: 0,
        children: Array.from({ length: 60 }, (_, i) => ({ id: 100 + i, name: `A${i}`, age: i })),
      },
      ...Array.from({ length: 11 }, (_, i) => ({ id: i + 2, name: `R${i}`, age: i })),
    ]
    const ref = React.createRef<IrisTableHandle<Row>>()
    render(
      <IrisTable
        columns={columns}
        data={tree}
        rowKey="id"
        getSubRows={(r) => r.children}
        defaultExpandedRowKeys={[1]}
        expandScrollPreserve
        virtualScroll={{ itemHeight: 36, height: 200 }}
        tableRef={ref}
      />,
    )
    // 1 + 60 + 11 = 72 slots; scroll to the very bottom (the jsdom max).
    expect(spacer().style.height).toBe(`${72 * 36}px`)
    await scrollTo(72 * 36)
    act(() => ref.current?.toggleRowExpand(1))
    // 12 slots remain; the re-located anchor (last row, index 11) + its offset
    // lands exactly on the new max → clamped, never beyond.
    expect(spacer().style.height).toBe(`${12 * 36}px`)
    expect(scroller().scrollTop).toBe(12 * 36)
    await syncScroll()
    expect(virtualItems().length).toBeGreaterThan(0)
  })

  it('the imperative handle path (toggleRowExpand) goes through the same transition', async () => {
    const ref = React.createRef<IrisTableHandle<Row>>()
    render(
      <IrisTable
        columns={columns}
        data={makeTree()}
        rowKey="id"
        getSubRows={(r) => r.children}
        expandScrollPreserve
        virtualScroll={{ itemHeight: 36, height: 200 }}
        tableRef={ref}
      />,
    )
    await scrollTo(4 * 36)
    act(() => ref.current?.toggleRowExpand(1))
    expect(scroller().scrollTop).toBe(24 * 36)
  })

  it('anchor-removed fallback: collapsing the anchored detail panel keeps the pixel scrollTop', async () => {
    render(
      <IrisTable
        columns={columns}
        data={flat}
        rowKey="id"
        renderDetail={(r) => <div>d{r.id}</div>}
        defaultExpandedRowKeys={[1, 2]}
        expandScrollPreserve
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />,
    )
    // Plan: [r1, d1, r2, d2, r3, …] — anchor = d2 (plan index 3) at 3 × 36.
    expect(spacer().style.height).toBe(`${32 * 36}px`)
    await scrollTo(3 * 36)
    act(() => fireEvent.click(detailToggle(2)!))
    // The `2::detail` slot is removed from the plan → the anchor key no longer
    // exists → the write is skipped, the pixel preserve (72… 108) stays.
    expect(scroller().scrollTop).toBe(3 * 36)
    expect(spacer().style.height).toBe(`${31 * 36}px`)
  })

  it('variable-height fiat: a fn itemHeight keeps the pixel-only preserve (inert)', async () => {
    render(
      <IrisTable
        columns={columns}
        data={makeTree()}
        rowKey="id"
        getSubRows={(r) => r.children}
        expandScrollPreserve
        virtualScroll={{ itemHeight: (i) => 36 + (i % 2) * 4, height: 200 }}
      />,
    )
    await scrollTo(4 * 36)
    act(() => fireEvent.click(treeToggle(1)!))
    // The offset tree is child-internal → no anchor math, pixel offset stays.
    expect(scroller().scrollTop).toBe(4 * 36)
  })

  it('non-virtual fiat: no active preservation, expansion still works', async () => {
    render(
      <IrisTable
        columns={columns}
        data={makeTree()}
        rowKey="id"
        getSubRows={(r) => r.children}
        expandScrollPreserve
        height={200}
      />,
    )
    const root = document.querySelector('[data-iris-table]') as HTMLElement
    act(() => {
      root.scrollTop = 100
    })
    act(() => fireEvent.click(treeToggle(1)!))
    // Non-virtual renders every row — the expansion lands, the root pixel
    // scrollTop is untouched (documented fiat).
    expect(document.querySelector('[data-iris-table-row="101"]')).not.toBeNull()
    expect(root.scrollTop).toBe(100)
  })

  it('flat-table inert: the prop is a no-op on a flat virtual body', async () => {
    render(
      <IrisTable
        columns={columns}
        data={flat}
        rowKey="id"
        expandScrollPreserve
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />,
    )
    expect(scroller()).not.toBeNull()
    expect(spacer().style.height).toBe(`${30 * 36}px`)
    await scrollTo(4 * 36)
    expect(scroller().scrollTop).toBe(4 * 36)
  })
})
