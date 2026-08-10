import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
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
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age', align: 'right' },
]

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

function styleSheet(): string {
  const el = document.getElementById('iris-table-row-styles')
  return el ? (el.textContent ?? '') : ''
}

function headerCell(key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="header"] [data-iris-table-header="${key}"]`,
  ) as HTMLElement
}

function summaryCell(key: string): HTMLElement | null {
  return document.querySelector(`[data-iris-table-row="summary"] [data-iris-table-cell="${key}"]`)
}

describe('@iris-ui-kit/react IrisTable fixed height (batch N)', () => {
  it('height makes the root a scroll container with a sticky header attr', () => {
    render(<IrisTable columns={baseColumns} data={rows} height={200} />)
    expect(root().getAttribute('data-iris-table-fixed-height')).toBe('true')
    expect(root().style.height).toBe('200px')
    expect(root().style.overflow).toBe('auto')
    // The singleton stylesheet pins the header row (flat + grouped both carry
    // data-iris-table-row="header").
    expect(styleSheet()).toContain('[data-iris-table-fixed-height] [data-iris-table-row="header"]')
    expect(styleSheet()).toContain('position: sticky')
  })

  it('minHeight/maxHeight alone also enable the fixed-height container', () => {
    render(<IrisTable columns={baseColumns} data={rows} minHeight={120} maxHeight={400} />)
    expect(root().getAttribute('data-iris-table-fixed-height')).toBe('true')
    expect(root().style.minHeight).toBe('120px')
    expect(root().style.maxHeight).toBe('400px')
    expect(root().style.overflow).toBe('auto')
  })

  it('no height prop → no fixed-height attr and overflow hidden', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    expect(root().getAttribute('data-iris-table-fixed-height')).toBeNull()
    expect(root().style.overflow).toBe('hidden')
    expect(root().style.height).toBe('')
  })
})

describe('@iris-ui-kit/react IrisTable headerAlign/footerAlign (batch N)', () => {
  it('headerAlign wins over the column align on flat header cells', () => {
    render(<IrisTable columns={baseColumns} data={rows} headerAlign="center" />)
    expect(headerCell('name').style.justifyContent).toBe('center')
    expect(headerCell('age').style.justifyContent).toBe('center')
  })

  it('without headerAlign the column align drives header cells (left default)', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    expect(headerCell('name').style.justifyContent).toBe('flex-start')
    expect(headerCell('age').style.justifyContent).toBe('flex-end')
  })

  it('headerAlign applies to grouped header leaf cells too', () => {
    const grouped: IrisTableColumn<Row>[] = [
      {
        key: 'person',
        title: 'Person',
        children: [
          { key: 'name', title: 'Name' },
          { key: 'age', title: 'Age', align: 'right' },
        ],
      },
    ]
    render(<IrisTable columns={grouped} data={rows} headerAlign="center" />)
    expect(headerCell('name').style.justifyContent).toBe('center')
    expect(headerCell('age').style.justifyContent).toBe('center')
  })

  it('footerAlign wins over the column align on summary cells', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age', align: 'right', summary: 'sum' },
    ]
    const { unmount } = render(<IrisTable columns={cols} data={rows} />)
    // Default: the column align (right) aligns the summary value right.
    expect(summaryCell('age')!.style.justifyContent).toBe('flex-end')
    unmount()
    render(<IrisTable columns={cols} data={rows} footerAlign="left" />)
    expect(summaryCell('age')!.style.justifyContent).toBe('flex-start')
  })

  it('footerAlign wins over the column align and number default on footerData cells', () => {
    const footerRows: Row[] = [{ id: 9, name: 'Total', age: 85 }]
    render(
      <IrisTable columns={baseColumns} data={rows} footerData={footerRows} footerAlign="center" />,
    )
    const ageCell = document.querySelector(
      '[data-iris-table-footer-cell][data-iris-table-cell="age"]',
    )
    expect((ageCell as HTMLElement).style.justifyContent).toBe('center')
  })
})

describe('@iris-ui-kit/react IrisTable footerMethod (batch N)', () => {
  const summaryCols: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Name' },
    { key: 'age', title: 'Age', align: 'right', summary: 'sum' },
  ]

  it('replaces the summary op row with one row per returned entry', () => {
    const footer = [
      { id: 9, name: 'Total', age: 85 },
      { id: 10, name: 'Avg', age: 28 },
    ]
    render(
      <IrisTable
        columns={summaryCols}
        data={rows}
        footerMethod={({ columns, data }) => {
          expect(columns.map((c) => c.key)).toEqual(['name', 'age'])
          expect(data).toHaveLength(3)
          return footer
        }}
      />,
    )
    // Summary op path is skipped entirely: no aggregate cells.
    expect(document.querySelectorAll('[data-iris-table-summary-cell]').length).toBe(0)
    // One row per returned entry, cell value = entry[col.key].
    const methodRows = document.querySelectorAll('[data-iris-table-footer-method-row]')
    expect(methodRows.length).toBe(2)
    const cells = document.querySelectorAll('[data-iris-table-footer-method-cell]')
    expect(cells.length).toBe(4)
    expect(Array.from(cells).map((c) => c.textContent)).toEqual(['Total', '85', 'Avg', '28'])
  })

  it('footerData still renders below the footerMethod rows', () => {
    const footerRows: Row[] = [{ id: 9, name: 'Grand total', age: 85 }]
    render(
      <IrisTable
        columns={summaryCols}
        data={rows}
        footerMethod={() => [{ id: 10, name: 'Sum', age: 85 }]}
        footerData={footerRows}
      />,
    )
    const methodRow = document.querySelector('[data-iris-table-footer-method-row]')!
    const footerRow = document.querySelector('[data-iris-table-footer] [role="row"]')!
    expect(
      methodRow.compareDocumentPosition(footerRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(footerRow.textContent).toContain('Grand total')
  })

  it('renders footerMethod rows even when no column declares a summary op', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        footerMethod={() => [{ id: 9, name: 'End', age: 85 }]}
      />,
    )
    expect(document.querySelectorAll('[data-iris-table-footer-method-row]').length).toBe(1)
    expect(document.querySelector('[data-iris-table-summary-cell]')).toBeNull()
  })

  it('skips both footer paths when data is empty', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={[]}
        footerMethod={() => [{ id: 1, name: 'X', age: 1 }]}
      />,
    )
    expect(document.querySelector('[data-iris-table-footer-method-row]')).toBeNull()
    expect(document.querySelector('[data-iris-table-row="summary"]')).toBeNull()
  })
})

describe('@iris-ui-kit/react IrisTable highlightHoverRow (batch N)', () => {
  it('defaults to true — no no-hover attr, hover rule active', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    expect(root().getAttribute('data-iris-no-hover')).toBeNull()
    expect(styleSheet()).toContain('[data-iris-table]:not([data-iris-no-hover]) [role="row"]:hover')
  })

  it('false adds the no-hover attr and suppresses the hover highlight rule', () => {
    render(<IrisTable columns={baseColumns} data={rows} highlightHoverRow={false} />)
    expect(root().getAttribute('data-iris-no-hover')).toBe('true')
    expect(styleSheet()).not.toContain('[data-iris-table] [role="row"]:hover')
  })
})
