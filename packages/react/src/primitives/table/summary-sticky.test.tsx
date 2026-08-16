import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  dept: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', dept: 'Eng', age: 25 },
  { id: 2, name: 'Alice', dept: 'Eng', age: 32 },
  { id: 3, name: 'Bob', dept: 'Ops', age: 28 },
]

const summaryCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age', align: 'right', summary: 'sum' },
]

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

function styleSheet(): string {
  const el = document.getElementById('iris-table-row-styles')
  return el ? (el.textContent ?? '') : ''
}

/** The global summary row (`data-iris-table-row="summary"` without a group key). */
function globalSummaryRow(): HTMLElement | null {
  return document.querySelector('[data-iris-table-row="summary"]:not([data-iris-group-summary])')
}

/** Batch CM: the global summary row can stick to the fixed-height scroll
 *  container's bottom edge (`summaryRowStyle="sticky"`, iris 独有 — vxe has
 *  no summary sticky parity). Pure CSS additive: a `data-iris-summary-sticky`
 *  attr on the GLOBAL summary row (op row + footerMethod replacement rows —
 *  the two renders that occupy the same footer slot) + one singleton
 *  stylesheet rule gated on fixed-height. Fail-closed: default / invalid
 *  values never set the attr. Two explicit fiats: per-group summary rows
 *  never stick, footerData rows never stick. */
describe('@iris-ui-kit/react IrisTable summaryRowStyle sticky (batch CM)', () => {
  it('default: fail-closed — no sticky attr and no sticky inline style', () => {
    render(<IrisTable columns={summaryCols} data={rows} height={200} />)
    const summary = globalSummaryRow()
    expect(summary).not.toBeNull()
    expect(summary!.getAttribute('data-iris-summary-sticky')).toBeNull()
    expect(summary!.style.position).toBe('')
  })

  it('explicit "default": no sticky attr either (only "sticky" opts in)', () => {
    render(<IrisTable columns={summaryCols} data={rows} height={200} summaryRowStyle="default" />)
    expect(globalSummaryRow()!.getAttribute('data-iris-summary-sticky')).toBeNull()
  })

  it('"sticky": attr true on the global summary row and aggregates unchanged', () => {
    render(<IrisTable columns={summaryCols} data={rows} height={200} summaryRowStyle="sticky" />)
    const summary = globalSummaryRow()!
    expect(summary.getAttribute('data-iris-summary-sticky')).toBe('true')
    // The sticky marker is additive — the aggregate value still renders.
    const ageCell = summary.querySelector('[data-iris-table-cell="age"]')!
    expect(ageCell.textContent).toBe('85')
    expect(root().getAttribute('data-iris-table-fixed-height')).toBe('true')
  })

  it('stylesheet rule: fixed-height gate + sticky + bottom: 0 + z-index 1', () => {
    render(<IrisTable columns={summaryCols} data={rows} height={200} summaryRowStyle="sticky" />)
    const css = styleSheet()
    expect(css).toContain('[data-iris-table-fixed-height] [data-iris-summary-sticky="true"]')
    expect(css).toContain('position: sticky')
    expect(css).toContain('bottom: 0')
    expect(css).toContain('z-index: 1')
    // No fixed height → the sticky rule is inert (never matches).
    cleanup()
    render(<IrisTable columns={summaryCols} data={rows} summaryRowStyle="sticky" />)
    expect(globalSummaryRow()!.getAttribute('data-iris-summary-sticky')).toBe('true')
  })

  it('footerMethod replacement rows get the attr; footerData rows do not (fiat)', () => {
    const footerRows: Row[] = [{ id: 9, name: 'Total', dept: '', age: 85 }]
    render(
      <IrisTable
        columns={summaryCols}
        data={rows}
        height={200}
        summaryRowStyle="sticky"
        footerMethod={() => [{ id: 9, name: 'Total', dept: '', age: 85 }]}
        footerData={footerRows}
      />,
    )
    const methodRows = document.querySelectorAll('[data-iris-table-footer-method-row]')
    expect(methodRows.length).toBe(1)
    expect(methodRows[0].getAttribute('data-iris-summary-sticky')).toBe('true')
    // footerData renders below the summary slot — contractually never sticky.
    const footerRow = document.querySelector('[data-iris-table-footer] [role="row"]')!
    expect(footerRow.getAttribute('data-iris-summary-sticky')).toBeNull()
  })

  it('group summary rows never stick, even with "sticky" (fiat)', () => {
    const groupCols: IrisTableColumn<Row>[] = [
      { key: 'dept', title: 'Dept', groupBy: true },
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age', align: 'right', summary: 'sum' },
    ]
    render(<IrisTable columns={groupCols} data={rows} height={200} summaryRowStyle="sticky" />)
    const groupSummaries = document.querySelectorAll('[data-iris-group-summary]')
    expect(groupSummaries.length).toBe(2)
    for (const s of Array.from(groupSummaries)) {
      expect(s.getAttribute('data-iris-summary-sticky')).toBeNull()
    }
  })

  it('virtual scroll keeps the global summary sticky (footer stack is outside the virtualizer)', () => {
    const many: Row[] = Array.from({ length: 40 }, (_, i) => ({
      id: i + 1,
      name: `N${i}`,
      dept: 'Eng',
      age: i,
    }))
    render(
      <IrisTable
        columns={summaryCols}
        data={many}
        height={200}
        virtualScroll={{ itemHeight: 36, height: 120 }}
        summaryRowStyle="sticky"
      />,
    )
    expect(globalSummaryRow()!.getAttribute('data-iris-summary-sticky')).toBe('true')
    // Aggregate still computed over the full body.
    expect(globalSummaryRow()!.querySelector('[data-iris-table-cell="age"]')!.textContent).toBe(
      '780',
    )
  })

  it('invalid value fails closed (only the literal "sticky" opts in)', () => {
    // Runtime fallback: anything other than "sticky" — e.g. a stray value —
    // behaves like the default. (TypeScript already narrows the prop.)
    const { rerender } = render(
      <IrisTable columns={summaryCols} data={rows} height={200} summaryRowStyle="sticky" />,
    )
    expect(globalSummaryRow()!.getAttribute('data-iris-summary-sticky')).toBe('true')
    rerender(
      <IrisTable
        columns={summaryCols}
        data={rows}
        height={200}
        summaryRowStyle={'bogus' as never}
      />,
    )
    expect(globalSummaryRow()!.getAttribute('data-iris-summary-sticky')).toBeNull()
  })
})
