import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  score: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 10, score: 100 },
  { id: 2, name: 'Alice', age: 20, score: 200 },
  { id: 3, name: 'Bob', age: 30, score: 300 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age', summary: 'sum' },
  { key: 'score', title: 'Score', summary: 'sum' },
]

/** One sum column (`age`) + one non-sum column (`name`) — the sum-only gate. */
const mixedCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age', align: 'right', summary: 'sum' },
]

function bar(): HTMLElement | null {
  return document.querySelector('[data-iris-column-totals]')
}

function barCell(key: string): HTMLElement | null {
  return document.querySelector(`[data-iris-column-totals-cell="${key}"]`)
}

function toolbar(): HTMLElement | null {
  return document.querySelector('[data-iris-table-toolbar]')
}

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

/** The global summary row (no group key) — the footer's op row. */
function summaryRow(): HTMLElement | null {
  return document.querySelector('[data-iris-table-row="summary"]:not([data-iris-group-summary])')
}

function summaryCell(key: string): HTMLElement | null {
  const row = summaryRow()
  if (!row) return null
  return row.querySelector(`[data-iris-table-cell="${key}"]`)
}

// ── Batch CR column totals (iris 独有 — vxe has no equivalent: no status
//    bar / toolbar-adjacent totals strip) ────────────────────────────────
describe('IrisTable columnTotals (batch CR)', () => {
  it('fail-closed: no strip without the prop, even with summary columns', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(bar()).toBeNull()
    expect(document.querySelector('[data-iris-column-totals-cell]')).toBeNull()
  })

  it('renders a full-width strip below the toolbar and above the root', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        columnTotals
        toolbar={{ buttons: [{ key: 'b', label: 'B', onClick: () => {} }] }}
      />,
    )
    const strip = bar()
    expect(strip).not.toBeNull()
    // The strip sits directly after the toolbar (spec-literal 工具栏下方横条).
    expect(toolbar()!.nextElementSibling).toBe(strip)
    // …and before the root (`data-iris-table`).
    expect(strip!.compareDocumentPosition(root()) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })

  it('sum correctness: 3×[10,20,30] → 60 for every sum column', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" columnTotals />)
    expect(barCell('age')!.textContent).toBe('60')
    expect(barCell('score')!.textContent).toBe('600')
  })

  it('sum-only gating: non-sum columns render an empty placeholder cell', () => {
    render(<IrisTable columns={mixedCols} data={rows} rowKey="id" columnTotals />)
    expect(barCell('name')!.textContent).toBe('')
    expect(barCell('age')!.textContent).toBe('60')
  })

  it('aggregate null / non-finite semantics: null, NaN-ish and Infinity rows are skipped', () => {
    const messy: Row[] = [
      { id: 1, name: 'a', age: 10, score: 0 },
      { id: 2, name: 'b', age: null as unknown as number, score: 0 },
      { id: 3, name: 'c', age: 'abc' as unknown as number, score: 0 },
      { id: 4, name: 'd', age: Infinity, score: 0 },
    ]
    render(<IrisTable columns={cols} data={messy} rowKey="id" columnTotals />)
    // Only the finite 10 counts; null / 'abc' / Infinity are dropped.
    expect(barCell('age')!.textContent).toBe('10')
  })

  it('formula columns funnel through the summary-row pipeline (getCellValue choke point)', () => {
    const formulaCols: IrisTableColumn<Row>[] = [
      { key: 'age', title: 'Age' },
      { key: 'double', title: 'Double', formula: 'age * 2', summary: 'sum' },
    ]
    render(<IrisTable columns={formulaCols} data={rows} rowKey="id" columnTotals />)
    // 10*2 + 20*2 + 30*2 = 120 — the COMPUTED values aggregate.
    expect(barCell('double')!.textContent).toBe('120')
  })

  it('aggregateAccuracy rounding applies; out-of-range values are ignored (raw)', () => {
    const dec: Row[] = [
      { id: 1, name: 'a', age: 10.44, score: 0 },
      { id: 2, name: 'b', age: 20.48, score: 0 },
    ]
    const { rerender } = render(
      <IrisTable columns={cols} data={dec} rowKey="id" columnTotals aggregateAccuracy={1} />,
    )
    expect(barCell('age')!.textContent).toBe('30.9')
    // Out-of-range accuracy is ignored (same gate as the summary row).
    rerender(
      <IrisTable columns={cols} data={dec} rowKey="id" columnTotals aggregateAccuracy={101} />,
    )
    expect(barCell('age')!.textContent).toBe('30.92')
  })

  it('footer parity: the strip cell === the summary-row cell (same pipeline + renderSummary)', () => {
    const renderCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      {
        key: 'age',
        title: 'Age',
        summary: 'sum',
        renderSummary: (v) => `Σ ${v.toFixed(2)}`,
      },
    ]
    render(<IrisTable columns={renderCols} data={rows} rowKey="id" columnTotals />)
    expect(barCell('age')!.textContent).toBe('Σ 60.00')
    expect(summaryCell('age')!.textContent).toBe('Σ 60.00')
    expect(barCell('age')!.textContent).toBe(summaryCell('age')!.textContent)
  })

  it('empty body: the strip still renders with 0; live data update refreshes it', () => {
    const { rerender } = render(<IrisTable columns={cols} data={[]} rowKey="id" columnTotals />)
    expect(bar()).not.toBeNull()
    expect(barCell('age')!.textContent).toBe('0')
    rerender(<IrisTable columns={cols} data={rows} rowKey="id" columnTotals />)
    expect(barCell('age')!.textContent).toBe('60')
  })

  it('selection-track spacer keeps alignment when selectable is on', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" columnTotals selectable="multi" />)
    expect(document.querySelector('[data-iris-column-totals-cell="__selection"]')).not.toBeNull()
    // Cells still land on their own tracks.
    expect(barCell('age')).not.toBeNull()
  })

  it('toolbar independence: the strip renders without any toolbar config', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" columnTotals />)
    expect(toolbar()).toBeNull()
    expect(bar()).not.toBeNull()
    expect(barCell('age')!.textContent).toBe('60')
  })

  it('token-style contract: surface background + border language, token-only', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" columnTotals />)
    const strip = bar()!
    // jsdom does not expand the `border` shorthand into longhands — the raw
    // inline string carries the token contract.
    expect(strip.getAttribute('style')).toContain('var(--iris-surface)')
    expect(strip.getAttribute('style')).toContain('1px solid var(--iris-border)')
    expect(strip.style.display).toBe('grid')
    // Cell styling rides the shared base-cell tokens.
    const cell = barCell('age')!
    expect(cell.style.padding).toBe('var(--iris-cell-pad, var(--iris-cell-pad-y, 8px) 12px)')
  })
})
