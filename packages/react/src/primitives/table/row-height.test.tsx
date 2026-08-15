import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age', align: 'right' },
]

/** Height fn: 24 / 32 / 40 px cycling — the variable-height driver. */
const heights = (i: number): number => 24 + (i % 3) * 8

/** Cumulative offsets over `heights` (cum[i] = top of slot i). */
const cum: number[] = [0]
for (let i = 0; i < 40; i += 1) cum.push(cum[i]! + heights(i))

function rows(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll('[data-iris-table-row]:not([data-iris-table-row="header"])'),
  )
}

function rowAt(i: number): HTMLElement {
  return document.querySelector(`[data-iris-table-row="${i + 1}"]`) as HTMLElement
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

function slot(i: number): HTMLElement {
  return document.querySelector(`[data-iris-virtual-index="${i}"]`) as HTMLElement
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
 * Batch BN: `rowHeight` — per-row height (iris 独有; vxe row-height is a
 * fixed config value). Fixed number → uniform height; fn → per-row heights
 * (virtual mode: variable-height virtualizer / prefix-sum offsets; non-virtual:
 * inline per-bodyData-index height). One throat `rowHeight ??
 * virtualScroll.itemHeight` feeds the render paths AND PageUp/PageDown.
 * jsdom note: `clientHeight` is 0, so the virtual viewport collapses to 0 and
 * windows render `buffer` rows around the scroll position — assertions use the
 * SPACER height + per-slot transform/height styles (same as batch AG).
 */
describe('@iris-ui-kit/react IrisTable rowHeight (batch BN)', () => {
  const flat: Row[] = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    name: `N${i}`,
    age: i,
  }))

  it('fixed number form sets a uniform inline height on non-virtual rows', () => {
    render(<IrisTable columns={columns} data={flat} rowHeight={36} />)
    expect(rows()).toHaveLength(30)
    for (const el of rows()) expect(el.style.height).toBe('36px')
    // No virtual machinery when virtualScroll is absent.
    expect(document.querySelector('[data-iris-virtual-scroll]')).toBeNull()
  })

  it('fixed number form with a detail wrap keeps the detail row content height', () => {
    render(
      <IrisTable
        columns={columns}
        data={flat.slice(0, 3)}
        rowHeight={36}
        rowKey="id"
        renderDetail={(r) => <div>d{r.id}</div>}
        defaultExpandedRowKeys={[1]}
      />,
    )
    expect(rowAt(0).style.height).toBe('36px')
    const detail = document.querySelector('[data-iris-table-row-detail="1"]') as HTMLElement
    expect(detail).not.toBeNull()
    expect(detail.style.height).toBe('')
  })

  it('fn form sets per-bodyData-index inline heights on non-virtual rows', () => {
    render(<IrisTable columns={columns} data={flat} rowHeight={heights} />)
    expect(rows()).toHaveLength(30)
    for (let i = 0; i < 30; i += 1) expect(rowAt(i).style.height).toBe(`${heights(i)}px`)
  })

  it('unset rowHeight is a byte-identical no-op (no inline height)', () => {
    render(<IrisTable columns={columns} data={flat} />)
    expect(rows()).toHaveLength(30)
    for (const el of rows()) expect(el.style.height).toBe('')
  })

  it('rowStyle stays the per-row escape hatch (wins over rowHeight)', () => {
    render(
      <IrisTable
        columns={columns}
        data={flat.slice(0, 3)}
        rowHeight={36}
        rowStyle={() => ({ height: 50 })}
      />,
    )
    for (const el of rows()) expect(el.style.height).toBe('50px')
  })

  it('fixed number form drives a uniform closed-form virtual window', () => {
    render(
      <IrisTable
        columns={columns}
        data={flat}
        rowHeight={36}
        virtualScroll={{ itemHeight: 40, height: 200, buffer: 4 }}
      />,
    )
    // rowHeight WINS over virtualScroll.itemHeight (single throat).
    expect(spacer().style.height).toBe(`${30 * 36}px`)
    // Fixed form: exclusive end → exactly `buffer` rows at scroll 0 (0..3).
    expect(virtualItems().length).toBe(4)
    for (let i = 0; i < 4; i += 1) {
      expect(slot(i).style.transform).toBe(`translateY(${i * 36}px)`)
      expect(slot(i).style.height).toBe('36px')
    }
  })

  it('without rowHeight the virtualScroll itemHeight fallback is unchanged', () => {
    render(
      <IrisTable
        columns={columns}
        data={flat}
        virtualScroll={{ itemHeight: 40, height: 200, buffer: 4 }}
      />,
    )
    expect(spacer().style.height).toBe(`${30 * 40}px`)
    expect(slot(0).style.transform).toBe('translateY(0px)')
    expect(slot(0).style.height).toBe('40px')
  })

  it('fn form renders virtual rows at cumulative tops (spacer = total)', () => {
    render(
      <IrisTable
        columns={columns}
        data={flat}
        rowHeight={heights}
        virtualScroll={{ itemHeight: 40, height: 200, buffer: 4 }}
      />,
    )
    // Total scrollable size = sum of the per-row heights (30 slots) — the
    // virtualizer's Fenwick offset tree IS the prefix-sum machinery.
    expect(spacer().style.height).toBe(`${cum[30]}px`)
    // jsdom viewport 0 → window = buffer around index 0: slots 0..4.
    const items = virtualItems()
    expect(items.length).toBe(5)
    for (let i = 0; i < items.length; i += 1) {
      expect(slot(i).style.transform).toBe(`translateY(${cum[i]}px)`)
      expect(slot(i).style.height).toBe(`${heights(i)}px`)
    }
  })

  it('scrolling shifts the fn-form window to the right cumulative slice', async () => {
    render(
      <IrisTable
        columns={columns}
        data={flat}
        rowHeight={heights}
        virtualScroll={{ itemHeight: 40, height: 200, buffer: 4 }}
      />,
    )
    // scrollTop 100 sits inside slot 3 (top 96, next slot at 120).
    await scrollTo(100)
    // window = [max(0, 3-4), min(29, 3+0+4)] = slots 0..7 (8 rows).
    expect(virtualItems().length).toBe(8)
    expect(slot(3).style.transform).toBe(`translateY(${cum[3]}px)`)
    expect(slot(7).style.transform).toBe(`translateY(${cum[7]}px)`)
    expect(slot(3).style.height).toBe(`${heights(3)}px`)
  })

  it('a deep fn-form scroll lands inside the list without drift', async () => {
    render(
      <IrisTable
        columns={columns}
        data={flat}
        rowHeight={heights}
        virtualScroll={{ itemHeight: 40, height: 200, buffer: 4 }}
      />,
    )
    // scrollTop 700: cum[22] = 696 <= 700 < cum[23] = 728 → slot 22 anchors
    // the window [max(0, 22-4), min(29, 22+4)] = slots 18..26.
    await scrollTo(700)
    expect(virtualItems().length).toBe(9)
    const first = document.querySelector('[data-iris-virtual-item]') as HTMLElement
    expect(Number(first.getAttribute('data-iris-virtual-index'))).toBe(18)
    expect(first.style.transform).toBe(`translateY(${cum[18]}px)`)
  })

  it('fn heights address the VIRTUAL PLAN index (detail slots interleave)', () => {
    render(
      <IrisTable
        columns={columns}
        data={flat.slice(0, 10)}
        rowKey="id"
        renderDetail={(r) => <div>d{r.id}</div>}
        defaultExpandedRowKeys={[1]}
        rowHeight={heights}
        virtualScroll={{ itemHeight: 40, height: 200, buffer: 4 }}
      />,
    )
    // Plan = 10 rows + 1 detail slot (row 0 expanded) = 11 slots; the fn
    // receives the PLAN index, so the total is cum[11] (NOT cum[10] +
    // heights(0)) — documented plan-index trap, same as batch AG itemHeight.
    expect(spacer().style.height).toBe(`${cum[11]}px`)
    // Slot 1 is the detail of row 0, positioned at the PLAN offset cum[1].
    expect(slot(1).querySelector('[data-iris-table-row-detail]')).not.toBeNull()
    expect(slot(1).style.transform).toBe(`translateY(${cum[1]}px)`)
    expect(slot(1).style.height).toBe(`${heights(1)}px`)
  })

  it('PageDown scrolls ±10 × the fixed rowHeight', () => {
    render(
      <IrisTable
        columns={columns}
        data={flat}
        keyboardNavigation
        rowHeight={36}
        virtualScroll={{ itemHeight: 40, height: 300, buffer: 2 }}
      />,
    )
    const cell = document.querySelector('[data-grid-row="0"][data-grid-col="0"]') as HTMLElement
    act(() => cell.focus())
    act(() => fireEvent.keyDown(cell, { key: 'PageDown' }))
    // The resolved source (rowHeight wins) drives the paging step.
    expect(scroller().scrollTop).toBe(10 * 36)
  })

  it('PageDown with the fn form steps by the current row height', () => {
    render(
      <IrisTable
        columns={columns}
        data={flat}
        keyboardNavigation
        rowHeight={heights}
        virtualScroll={{ itemHeight: 40, height: 300, buffer: 2 }}
      />,
    )
    const cell = document.querySelector('[data-grid-row="0"][data-grid-col="0"]') as HTMLElement
    act(() => cell.focus())
    act(() => fireEvent.keyDown(cell, { key: 'PageDown' }))
    // Row 0's fn height (24) is the approximation — NOT the itemHeight 40.
    expect(scroller().scrollTop).toBe(10 * heights(0))
  })
})
