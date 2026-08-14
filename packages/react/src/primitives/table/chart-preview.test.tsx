import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  level: number
  qty: string
  city: string | null
}

const rows: Row[] = [
  { id: 1, name: 'Alpha', level: 10, qty: '3', city: 'Berlin' },
  { id: 2, name: 'Beta', level: 4, qty: '7', city: null },
  { id: 3, name: 'Gamma', level: 8, qty: '5', city: 'Paris' },
  { id: 4, name: 'Delta', level: 2, qty: '9', city: 'Rome' },
  { id: 5, name: 'Epsilon', level: 6, qty: '1', city: 'Berlin' },
]

const chartCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'level', title: 'Level' },
  { key: 'qty', title: 'Qty', summary: 'sum' },
  { key: 'city', title: 'City' },
]

function trigger(): HTMLElement | null {
  return document.querySelector('[data-iris-chart-trigger]')
}
function panel(): HTMLElement | null {
  return document.querySelector('[data-iris-chart-panel]')
}
function svg(): SVGSVGElement | null {
  return document.querySelector('[data-iris-chart-svg]')
}
function bars(): NodeListOf<Element> {
  return document.querySelectorAll('[data-iris-chart-bar]')
}
function polylines(): NodeListOf<Element> {
  return document.querySelectorAll('[data-iris-chart-polyline]')
}
function dots(): NodeListOf<Element> {
  return document.querySelectorAll('[data-iris-chart-dot]')
}
function selectOptions(): Element[] {
  return Array.from(document.querySelectorAll('[data-iris-select-option]'))
}
function openPanel(): void {
  act(() => {
    fireEvent.click(trigger()!)
  })
}

describe('@iris-ui-kit/react IrisTable chartPreview (batch AR, iris 独有)', () => {
  it('the toolbar trigger renders only with chartPreview', () => {
    render(<IrisTable columns={chartCols} data={rows} rowKey="id" chartPreview />)
    expect(trigger()).not.toBeNull()
    expect(trigger()!.getAttribute('data-iris-chart-trigger')).toBe('')
  })

  it('without chartPreview the table is inert (no trigger, no panel)', () => {
    render(<IrisTable columns={chartCols} data={rows} rowKey="id" />)
    expect(trigger()).toBeNull()
    expect(panel()).toBeNull()
  })

  it('clicking the trigger opens the floating panel', () => {
    render(<IrisTable columns={chartCols} data={rows} rowKey="id" chartPreview />)
    openPanel()
    expect(panel()).not.toBeNull()
    expect(panel()!.getAttribute('role')).toBe('dialog')
  })

  it('the column select lists the numeric leaf columns (number rows OR summary=sum)', () => {
    render(<IrisTable columns={chartCols} data={rows} rowKey="id" chartPreview />)
    openPanel()
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-select-trigger]')!)
    })
    // name/city are string-only; level has numeric rows, qty is summary=sum.
    expect(selectOptions().map((o) => o.textContent)).toEqual(['Level', 'Qty'])
  })

  it('the bar chart renders one rect per finite value of the default column', () => {
    render(<IrisTable columns={chartCols} data={rows} rowKey="id" chartPreview />)
    openPanel()
    expect(svg()).not.toBeNull()
    expect(svg()!.getAttribute('viewBox')).toBe('0 0 300 120')
    // Default column = the first numeric one (level): all 5 rows finite.
    expect(bars().length).toBe(5)
    expect(panel()!.querySelector('[data-iris-chart-bar="0"]')).not.toBeNull()
    expect(panel()!.querySelector('[data-iris-chart-bar="4"]')).not.toBeNull()
  })

  it('nulls become gaps: no bar, no dot, and the line breaks into segments', () => {
    const gapCols: IrisTableColumn<{ id: number; v: number | null }>[] = [{ key: 'v', title: 'V' }]
    const gapRows = [
      { id: 1, v: 3 },
      { id: 2, v: null },
      { id: 3, v: 7 },
      { id: 4, v: 2 },
    ]
    render(<IrisTable columns={gapCols} data={gapRows} rowKey="id" chartPreview />)
    openPanel()
    expect(bars().length).toBe(3) // the null row draws no bar
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-chart-kind-line]')!)
    })
    // Runs [3] and [7, 2] → two polylines; dots only for finite values.
    expect(polylines().length).toBe(2)
    expect(dots().length).toBe(3)
  })

  it('the kind toggle switches bar ↔ line', () => {
    render(<IrisTable columns={chartCols} data={rows} rowKey="id" chartPreview />)
    openPanel()
    expect(bars().length).toBeGreaterThan(0)
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-chart-kind-line]')!)
    })
    expect(polylines().length).toBeGreaterThan(0)
    expect(dots().length).toBe(5)
    expect(bars().length).toBe(0)
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-chart-kind-bar]')!)
    })
    expect(bars().length).toBeGreaterThan(0)
    expect(polylines().length).toBe(0)
  })

  it('selecting a column via the portaled listbox keeps the panel open and recharts', () => {
    render(<IrisTable columns={chartCols} data={rows} rowKey="id" chartPreview />)
    openPanel()
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-select-trigger]')!)
    })
    const qty = selectOptions().find((o) => o.textContent === 'Qty')!
    // The listbox is portaled to <body> — a real press must SELECT, not close.
    fireEvent.pointerDown(qty)
    fireEvent.click(qty)
    expect(panel()).not.toBeNull()
    expect(svg()!.getAttribute('aria-label')).toContain('Qty')
    // qty holds numeric STRINGS — buildChartData coerces; all 5 finite bars.
    expect(bars().length).toBe(5)
  })

  it('charts the first 20 values and notes the total when truncated', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, v: i }))
    render(<IrisTable columns={[{ key: 'v', title: 'V' }]} data={many} rowKey="id" chartPreview />)
    openPanel()
    expect(bars().length).toBe(20)
    expect(panel()!.querySelector('[data-iris-chart-truncated]')!.textContent).toBe('Total 25')
  })

  it('Escape closes the panel', () => {
    render(<IrisTable columns={chartCols} data={rows} rowKey="id" chartPreview />)
    openPanel()
    expect(panel()).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(panel()).toBeNull()
  })

  it('an outside pointerdown closes the panel; a press inside keeps it', () => {
    render(<IrisTable columns={chartCols} data={rows} rowKey="id" chartPreview />)
    openPanel()
    fireEvent.pointerDown(panel()!)
    expect(panel()).not.toBeNull()
    fireEvent.pointerDown(document.body)
    expect(panel()).toBeNull()
  })

  it('dataIndex indirection: numeric detection reads the dataIndex field', () => {
    const aliased = rows.map((r) => ({
      id: r.id,
      name: r.name,
      qty: r.qty,
      city: r.city,
      lvl: r.level,
    }))
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'level', title: 'Level', dataIndex: 'lvl' },
        ]}
        data={aliased}
        rowKey="id"
        chartPreview
      />,
    )
    openPanel()
    expect(bars().length).toBe(5)
    expect(svg()!.getAttribute('aria-label')).toContain('Level')
  })
})
