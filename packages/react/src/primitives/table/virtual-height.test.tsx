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
 * Batch AG: variable-height virtualization through the table's
 * `virtualScroll.itemHeight` function form. jsdom note: `clientHeight` is 0,
 * so the viewport collapses to 0 and windows render `buffer` rows around the
 * scroll position — assertions use the SPACER height + per-slot
 * transform/height styles (the wrapper derives both from the same size fn).
 */
describe('@iris-ui-kit/react IrisTable variable-height virtualScroll (batch AG)', () => {
  const flat: Row[] = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    name: `N${i}`,
    age: i,
  }))

  it('variable itemHeight renders rows at cumulative tops (spacer = total)', () => {
    render(
      <IrisTable
        columns={columns}
        data={flat}
        virtualScroll={{ itemHeight: heights, height: 200, buffer: 4 }}
      />,
    )
    // Total scrollable size = sum of the per-row heights (30 slots).
    expect(spacer().style.height).toBe(`${cum[30]}px`)
    // jsdom viewport 0 → window = buffer around index 0: slots 0..4.
    const items = virtualItems()
    expect(items.length).toBe(5)
    for (let i = 0; i < items.length; i += 1) {
      // Position = cumulative offset, size = the per-index height.
      expect(slot(i).style.transform).toBe(`translateY(${cum[i]}px)`)
      expect(slot(i).style.height).toBe(`${heights(i)}px`)
    }
  })

  it('the fixed number form is unchanged (i * height positioning)', () => {
    render(
      <IrisTable
        columns={columns}
        data={flat}
        virtualScroll={{ itemHeight: 36, height: 200, buffer: 4 }}
      />,
    )
    expect(spacer().style.height).toBe(`${30 * 36}px`)
    // Fixed form: exclusive end → exactly `buffer` rows at scroll 0 (0..3).
    expect(virtualItems().length).toBe(4)
    for (let i = 0; i < 4; i += 1) {
      expect(slot(i).style.transform).toBe(`translateY(${i * 36}px)`)
      expect(slot(i).style.height).toBe('36px')
    }
  })

  it('scrolling shifts the variable window to the right cumulative slice', async () => {
    render(
      <IrisTable
        columns={columns}
        data={flat}
        virtualScroll={{ itemHeight: heights, height: 200, buffer: 4 }}
      />,
    )
    // scrollTop 100 sits inside slot 3 (top 96, next slot at 120).
    await scrollTo(100)
    // window = [max(0, 3-4), min(29, 3+0+4)] = slots 0..7 (8 rows).
    expect(virtualItems().length).toBe(8)
    expect(slot(3).style.transform).toBe(`translateY(${cum[3]}px)`)
    expect(slot(7).style.transform).toBe(`translateY(${cum[7]}px)`)
    // Rows at a mixed boundary keep their own heights (slot 3 = 24px group).
    expect(slot(3).style.height).toBe(`${heights(3)}px`)
  })

  it('a deep scroll lands inside the variable list without gaps', async () => {
    render(
      <IrisTable
        columns={columns}
        data={flat}
        virtualScroll={{ itemHeight: heights, height: 200, buffer: 4 }}
      />,
    )
    // scrollTop 700: cum[22] = 696 <= 700 < cum[23] = 728 → slot 22 is the
    // window anchor → window [max(0, 22-4), min(29, 22+4)] = slots 18..26.
    await scrollTo(700)
    expect(virtualItems().length).toBe(9)
    // The window's first slot sits exactly at its cumulative offset (no
    // drift from index * height arithmetic).
    const first = document.querySelector('[data-iris-virtual-item]') as HTMLElement
    const firstIndex = Number(first.getAttribute('data-iris-virtual-index'))
    expect(firstIndex).toBe(18)
    expect(first.style.transform).toBe(`translateY(${cum[18]}px)`)
  })

  it('a deep fixed-form scroll keeps the closed-form window', async () => {
    render(
      <IrisTable
        columns={columns}
        data={flat}
        virtualScroll={{ itemHeight: 36, height: 200, buffer: 4 }}
      />,
    )
    await scrollTo(400)
    // first = floor(400/36) = 11 → window [7, 15) = 8 rows (7..14).
    expect(virtualItems().length).toBe(8)
    expect(slot(7).style.transform).toBe('translateY(252px)')
    expect(slot(14).style.transform).toBe('translateY(504px)')
  })

  it('variable heights address the VIRTUAL PLAN index (detail slots interleave)', () => {
    render(
      <IrisTable
        columns={columns}
        data={flat.slice(0, 10)}
        rowKey="id"
        renderDetail={(r) => <div>d{r.id}</div>}
        defaultExpandedRowKeys={[1]}
        virtualScroll={{ itemHeight: heights, height: 200, buffer: 4 }}
      />,
    )
    // Plan = 10 rows + 1 detail slot (row 0 expanded) = 11 slots; the size fn
    // receives the PLAN index, so the total is cum[11] (NOT cum[10] + heights(0)).
    expect(spacer().style.height).toBe(`${cum[11]}px`)
    // Slot 1 is the detail of row 0, positioned at the PLAN offset cum[1].
    const detailSlot = slot(1)
    expect(detailSlot.querySelector('[data-iris-table-row-detail]')).not.toBeNull()
    expect(detailSlot.style.transform).toBe(`translateY(${cum[1]}px)`)
    expect(detailSlot.style.height).toBe(`${heights(1)}px`)
    // Slot 2 is row 1 — the fn's index stays the plan slot, not bodyData idx.
    expect(slot(2).querySelector('[data-iris-table-row-detail]')).toBeNull()
    expect(slot(2).style.transform).toBe(`translateY(${cum[2]}px)`)
  })
})
