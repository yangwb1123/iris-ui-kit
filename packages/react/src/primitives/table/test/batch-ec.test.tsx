import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import * as React from 'react'
import { IrisTable } from '../Table'
import type { IrisTableProps } from '../Table'
import { TABLE_ROW_CSS } from '../table-css'
import { adaptiveHeightStyleOf, measureAdaptiveRowHeights } from '../cell-helpers'
import type { IrisTableColumn } from '../types'

/**
 * Batch EC (iris 独有 — vxe autoHeight fills rows to the VIEWPORT; only this
 * feature releases the one-line clamp so DATA rows grow to their content):
 * `adaptiveRowHeight` — with NO fixed row height set (`rowHeight` and
 * `virtualScroll.itemHeight` both absent), data-row cells wrap (CSS marker
 * rule) and each data row is pinned to its MEASURED rendered height, so a
 * textarea/paragraph cell renders fully instead of being one-line clipped.
 * Measurement is a dependency-free layout effect (every commit) + window
 * resize / ResizeObserver; same-value identity bail (zero re-render noise);
 * `≤ 0` measures (jsdom/SSR/hidden) skip — rows keep natural height, never a
 * 0px collapse. Header/summary/footer/state rows stay nowrap; virtual and
 * `rowHeight` tables are inert; `rowStyle` stays the escape hatch.
 * jsdom note: offsetHeight is always 0, so tests stub it per row and drive
 * re-measurement via rerender commits / the window resize listener.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  bio: string
}

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'bio', title: 'Bio' },
]

const rows: Row[] = [
  { id: 1, name: 'A', bio: 'short' },
  { id: 2, name: 'B', bio: 'A long bio line whose cell should wrap and grow the row' },
]

const tableRoot = (): HTMLElement => document.querySelector('[data-iris-table]') as HTMLElement
const marker = (): string | null => tableRoot().getAttribute('data-iris-adaptive-height')
const dataRow = (id: number | string): HTMLElement =>
  document.querySelector(`[data-iris-table-row="${id}"]`) as HTMLElement

/** Stub an element's offsetHeight (jsdom reports 0 for everything). */
function stubHeight(el: HTMLElement, px: number): void {
  Object.defineProperty(el, 'offsetHeight', { configurable: true, value: px })
}

const DATA_ROW_SELECTOR =
  '[data-iris-table-row]:not([data-iris-table-row="header"]):not([data-iris-table-row="summary"]):not([data-iris-table-row="loading"]):not([data-iris-table-row="empty"]):not([data-iris-table-row="error"])'

describe('@iris-ui-kit/react IrisTable adaptiveRowHeight — helpers (batch EC)', () => {
  it('measureAdaptiveRowHeights: measures data rows, skips reserved roles, ≤0 rows and detail wraps', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div role="row" data-iris-table-row="header"></div>
      <div role="row" data-iris-table-row="summary"></div>
      <div role="row" data-iris-table-row="loading"></div>
      <div role="row" data-iris-table-row="empty"></div>
      <div role="row" data-iris-table-row="error"></div>
      <div role="row" data-iris-table-row="footer-0"></div>
      <div role="row" data-iris-table-row="1"></div>
      <div role="row" data-iris-table-row="2"></div>
      <div role="row" data-iris-table-row-detail="1"></div>
    `
    const els = root.querySelectorAll<HTMLElement>('[role="row"]')
    stubHeight(els[6]!, 32) // row 1
    stubHeight(els[7]!, 63) // row 2
    // els[8] (detail wrap) has NO data-iris-table-row attr → skipped anyway.
    const map = measureAdaptiveRowHeights(root, null)
    expect(map).toEqual(
      new Map([
        ['1', 32],
        ['2', 63],
      ]),
    )
    // Same measurements → previous BY IDENTITY (the caller bails — zero noise).
    expect(measureAdaptiveRowHeights(root, map)).toBe(map)
    // Stale keys dropped: remove row 2 → the next map only carries row 1.
    els[7]!.remove()
    const shrunk = measureAdaptiveRowHeights(root, map)
    expect(shrunk).not.toBe(map)
    expect(shrunk).toEqual(new Map([['1', 32]]))
  })

  it('adaptiveHeightStyleOf: off / unknown / ≤0 → undefined, measured → { height }', () => {
    expect(adaptiveHeightStyleOf('1', null)).toBeUndefined()
    expect(adaptiveHeightStyleOf('1', undefined)).toBeUndefined()
    expect(adaptiveHeightStyleOf('x', new Map([['1', 32]]))).toBeUndefined()
    expect(adaptiveHeightStyleOf('1', new Map([['1', 0]]))).toBeUndefined()
    expect(adaptiveHeightStyleOf('1', new Map([['1', 32]]))).toEqual({ height: 32 })
    // Numeric and string identities share one namespace (String coercion).
    expect(adaptiveHeightStyleOf(1, new Map([['1', 32]]))).toEqual({ height: 32 })
  })
})

describe('@iris-ui-kit/react IrisTable adaptiveRowHeight — gates (batch EC)', () => {
  it('fail-closed: off by default — no root marker, rows keep natural height', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(marker()).toBeNull()
    expect(dataRow(1).style.height).toBe('')
    expect(dataRow(2).style.height).toBe('')
  })

  it('explicit rowHeight → inert (marker off, rowHeight wins)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" rowHeight={40} adaptiveRowHeight />)
    expect(marker()).toBeNull()
    expect(dataRow(1).style.height).toBe('40px')
  })

  it('virtualScroll (itemHeight slot source) → inert (uniform slots, no marker)', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        adaptiveRowHeight
        virtualScroll={{ height: 160, itemHeight: 40 }}
      />,
    )
    expect(marker()).toBeNull()
  })

  it('plain table + adaptiveRowHeight → root marker present (natural heights in jsdom)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" adaptiveRowHeight />)
    expect(marker()).toBe('true')
    // jsdom measures 0 → nothing pinned → rows stay at content height, never 0.
    expect(dataRow(1).style.height).toBe('')
    expect(dataRow(2).style.height).toBe('')
  })

  it('turning the prop off mid-life clears the marker and frees pinned heights', () => {
    const view = render(<IrisTable columns={cols} data={rows} rowKey="id" adaptiveRowHeight />)
    stubHeight(dataRow(1), 30)
    stubHeight(dataRow(2), 60)
    fireEvent(window, new Event('resize'))
    expect(dataRow(1).style.height).toBe('30px')
    view.rerender(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(marker()).toBeNull()
    expect(dataRow(1).style.height).toBe('')
    expect(dataRow(2).style.height).toBe('')
    // Re-enabling re-measures from scratch.
    view.rerender(<IrisTable columns={cols} data={rows} rowKey="id" adaptiveRowHeight />)
    expect(marker()).toBe('true')
  })

  it('empty body: no crash, marker stays, zero rows to pin', () => {
    render(<IrisTable columns={cols} data={[]} rowKey="id" adaptiveRowHeight />)
    expect(marker()).toBe('true')
    expect(document.querySelector(DATA_ROW_SELECTOR)).toBeNull()
  })
})

describe('@iris-ui-kit/react IrisTable adaptiveRowHeight — 行高差异/自愈 (batch EC)', () => {
  it('行高差异: content-taller rows measure taller and keep the DIFFERENCE (32 vs 63)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" adaptiveRowHeight />)
    stubHeight(dataRow(1), 32)
    stubHeight(dataRow(2), 63)
    fireEvent(window, new Event('resize'))
    expect(dataRow(1).style.height).toBe('32px')
    expect(dataRow(2).style.height).toBe('63px')
  })

  it('re-measure on a data commit: a grown cell re-pins, untouched rows keep their pin', () => {
    const view = render(<IrisTable columns={cols} data={rows} rowKey="id" adaptiveRowHeight />)
    stubHeight(dataRow(1), 32)
    stubHeight(dataRow(2), 63)
    view.rerender(<IrisTable columns={cols} data={rows} rowKey="id" adaptiveRowHeight />)
    expect(dataRow(2).style.height).toBe('63px')
    const grown = rows.map((r) => (r.id === 2 ? { ...r, bio: r.bio.repeat(12) } : r))
    stubHeight(dataRow(2), 120)
    view.rerender(<IrisTable columns={cols} data={grown} rowKey="id" adaptiveRowHeight />)
    expect(dataRow(2).style.height).toBe('120px')
    expect(dataRow(1).style.height).toBe('32px')
  })

  it('same-value bail: unrelated commits and resize events never churn the pins', () => {
    const view = render(<IrisTable columns={cols} data={rows} rowKey="id" adaptiveRowHeight />)
    stubHeight(dataRow(1), 30)
    stubHeight(dataRow(2), 30)
    fireEvent(window, new Event('resize'))
    expect(dataRow(1).style.height).toBe('30px')
    // Re-commit (bordered flip) → re-measure → identical → no drift, no loop
    // (an effect loop would throw/hang — passing proves termination).
    view.rerender(<IrisTable columns={cols} data={rows} rowKey="id" adaptiveRowHeight bordered />)
    expect(dataRow(1).style.height).toBe('30px')
    expect(dataRow(2).style.height).toBe('30px')
    fireEvent(window, new Event('resize'))
    expect(dataRow(1).style.height).toBe('30px')
    expect(dataRow(2).style.height).toBe('30px')
  })

  it('window resize re-measures WITHOUT a React commit (listener path)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" adaptiveRowHeight />)
    expect(dataRow(1).style.height).toBe('')
    stubHeight(dataRow(1), 44)
    stubHeight(dataRow(2), 88)
    fireEvent(window, new Event('resize'))
    expect(dataRow(1).style.height).toBe('44px')
    expect(dataRow(2).style.height).toBe('88px')
  })

  it('rows measuring ≤ 0 stay at natural height — never a 0px collapse', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" adaptiveRowHeight />)
    stubHeight(dataRow(1), 0)
    stubHeight(dataRow(2), 50)
    fireEvent(window, new Event('resize'))
    expect(dataRow(1).style.height).toBe('')
    expect(dataRow(2).style.height).toBe('50px')
  })

  it('row key colliding with a reserved role attr stays excluded (documented fiat)', () => {
    const weird: Row[] = [
      { id: 1, name: 'x', bio: 'a' },
      { id: 2, name: 'header', bio: 'b' },
    ]
    render(<IrisTable columns={cols} data={weird} rowKey="name" adaptiveRowHeight />)
    const headerMatches = Array.from(document.querySelectorAll('[data-iris-table-row="header"]'))
    const dataRowHeader = headerMatches[headerMatches.length - 1] as HTMLElement
    expect(headerMatches.length).toBeGreaterThan(1) // real header + colliding row
    stubHeight(dataRow('x'), 20)
    stubHeight(dataRowHeader, 90)
    fireEvent(window, new Event('resize'))
    expect(dataRow('x').style.height).toBe('20px')
    expect(dataRowHeader.style.height).toBe('') // reserved namespace — not pinned
  })

  it('rowStyle escape hatch wins over the measured pin', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        adaptiveRowHeight
        rowStyle={(r) => (r.id === 2 ? { height: 77 } : undefined)}
      />,
    )
    stubHeight(dataRow(1), 30)
    stubHeight(dataRow(2), 60)
    fireEvent(window, new Event('resize'))
    expect(dataRow(1).style.height).toBe('30px')
    expect(dataRow(2).style.height).toBe('77px')
  })

  it('grouped mode: data rows measure, group-header rows never pin', () => {
    render(
      <IrisTable columns={cols} data={rows} rowKey="id" adaptiveRowHeight groupBy={['name']} />,
    )
    stubHeight(dataRow(1), 36)
    stubHeight(dataRow(2), 72)
    fireEvent(window, new Event('resize'))
    expect(dataRow(1).style.height).toBe('36px')
    expect(dataRow(2).style.height).toBe('72px')
    const groupHeaders = Array.from(document.querySelectorAll('[data-iris-group-row]'))
    expect(groupHeaders.length).toBe(2)
    for (const gh of groupHeaders) expect((gh as HTMLElement).style.height).toBe('')
  })
})

describe('@iris-ui-kit/react IrisTable adaptiveRowHeight — contracts (batch EC)', () => {
  it('type contract: single-line optional boolean on IrisTableProps (scanner hygiene)', () => {
    const props: IrisTableProps = { adaptiveRowHeight: true }
    expect(props.adaptiveRowHeight).toBe(true)
  })

  it('CSS contract: wrap rule is marker-gated and excludes the reserved roles', () => {
    expect(TABLE_ROW_CSS).toContain('[data-iris-table][data-iris-adaptive-height="true"]')
    expect(TABLE_ROW_CSS).toContain('white-space: normal !important')
    expect(TABLE_ROW_CSS).toContain('word-break: break-word')
    for (const role of ['header', 'summary', 'loading', 'empty', 'error']) {
      expect(TABLE_ROW_CSS).toContain(`[data-iris-table-row="${role}"]`)
    }
    expect(TABLE_ROW_CSS).toContain('[data-iris-table-row^="footer-"]')
    // Token/variable-only stylesheet — no bare hex anywhere in the new rule.
    const rule = TABLE_ROW_CSS.slice(TABLE_ROW_CSS.indexOf('[data-iris-adaptive-height'))
    expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  })

  it('SSR-safe: renderToString never throws and carries the marker (no layout effect on the server)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const html = renderToString(
      <IrisTable columns={cols} data={rows} rowKey="id" adaptiveRowHeight height={300} />,
    )
    spy.mockRestore()
    expect(html).toContain('data-iris-table')
    expect(html).toContain('data-iris-adaptive-height="true"')
    expect(html).not.toContain('data-iris-adaptive-height="false"')
  })
})
