import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import { exportCsv } from '../exportCsv'
import type { IrisTableColumn } from '../types'
import type { IrisTableHandle } from '../props'

afterEach(() => {
  cleanup()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
  { id: 4, name: 'Alicia', age: 41 },
]

const baseColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function tableRef(): { current: IrisTableHandle<Row> | null } {
  return { current: null }
}

const styleOf = (el: Element): CSSStyleDeclaration => (el as HTMLElement).style

describe('IrisTable handle view methods (vxe getFilteredData parity + current-view export, batch W)', () => {
  it('getFilteredData returns the filtered + sorted memo as a copy', () => {
    const r = tableRef()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        filters={{ name: 'ali' }}
        sort={{ key: 'age', direction: 'asc' }}
        tableRef={r}
      />,
    )
    act(() => {})
    // Filter 'ali' → Alice + Alicia; age asc → Alice (32), Alicia (41).
    expect(r.current!.getFilteredData()).toEqual([rows[1], rows[3]])
    // The returned array is a COPY: mutating it cannot change the table.
    const out = r.current!.getFilteredData()
    out.push(rows[0])
    expect(r.current!.getFilteredData()).toHaveLength(2)
  })

  it('getFilteredData without filters returns the full current list', () => {
    const r = tableRef()
    render(<IrisTable columns={baseColumns} data={rows} rowKey="id" tableRef={r} />)
    expect(r.current!.getFilteredData()).toEqual(rows)
    expect(r.current!.getFilteredData()).not.toBe(rows)
  })

  it('exportCurrentViewCsv serializes the filtered view, hidden columns excluded', () => {
    const r = tableRef()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        filters={{ name: 'ali' }}
        sort={{ key: 'age', direction: 'asc' }}
        columnVisibility={{ age: false }}
        tableRef={r}
      />,
    )
    act(() => {})
    expect(r.current!.exportCurrentViewCsv()).toBe('Name\nAlice\nAlicia')
    // Identical to the pure helper wired to the same inputs (toCsv parity).
    expect(r.current!.exportCurrentViewCsv()).toBe(
      exportCsv(r.current!.getFilteredData(), [{ key: 'name', title: 'Name' }]),
    )
  })

  it('exportCurrentViewCsv without filters exports the whole current page', () => {
    const r = tableRef()
    render(<IrisTable columns={baseColumns} data={rows} rowKey="id" tableRef={r} />)
    expect(r.current!.exportCurrentViewCsv()).toBe(
      'Name,Age\nCharlie,25\nAlice,32\nBob,28\nAlicia,41',
    )
  })
})

describe('IrisTable showHeaderOverflow (vxe parity, batch W)', () => {
  it('default keeps the ellipsis base on header cells', () => {
    const { container } = render(<IrisTable columns={baseColumns} data={rows} rowKey="id" />)
    const style = styleOf(container.querySelector('[data-iris-table-header="name"]')!)
    expect(style.whiteSpace).toBe('nowrap')
    expect(style.overflow).toBe('hidden')
    expect(style.textOverflow).toBe('ellipsis')
  })

  it('false drops the ellipsis on flat header cells (wrap + visible)', () => {
    const { container } = render(
      <IrisTable columns={baseColumns} data={rows} rowKey="id" showHeaderOverflow={false} />,
    )
    const style = styleOf(container.querySelector('[data-iris-table-header="name"]')!)
    expect(style.whiteSpace).toBe('normal')
    expect(style.overflow).toBe('visible')
  })

  it('false applies to grouped header cells (leaf and group rows)', () => {
    const groupedColumns: IrisTableColumn<Row>[] = [
      {
        key: 'identity',
        title: 'Identity',
        children: [
          { key: 'name', title: 'Name' },
          { key: 'age', title: 'Age' },
        ],
      },
    ]
    const { container } = render(
      <IrisTable columns={groupedColumns} data={rows} rowKey="id" showHeaderOverflow={false} />,
    )
    const leaf = styleOf(container.querySelector('[data-iris-table-header="name"]')!)
    expect(leaf.whiteSpace).toBe('normal')
    expect(leaf.overflow).toBe('visible')
    const group = styleOf(
      container.querySelector('[data-iris-table-header="identity"][data-iris-table-header-group]')!,
    )
    expect(group.whiteSpace).toBe('normal')
    expect(group.overflow).toBe('visible')
  })
})

describe('IrisTable showFooterOverflow (vxe parity, batch W)', () => {
  const footerColumns: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Name' },
    { key: 'age', title: 'Age', summary: 'sum' },
  ]

  it('default keeps the ellipsis base on summary / footerMethod / footerData cells', () => {
    // footerMethod wins over the summary row — check it in a separate render.
    const summaryView = render(
      <IrisTable
        columns={footerColumns}
        data={rows}
        rowKey="id"
        footerData={[{ id: 9, name: 'Grand total', age: 126 }]}
      />,
    )
    const methodView = render(
      <IrisTable
        columns={footerColumns}
        data={rows}
        rowKey="id"
        footerMethod={() => [{ id: 8, name: 'Sub total', age: 126 }]}
      />,
    )
    const checks: Array<[HTMLElement, string]> = [
      [summaryView.container, '[data-iris-table-summary-cell=""]'],
      [summaryView.container, '[data-iris-table-footer-cell=""]'],
      [methodView.container, '[data-iris-table-footer-method-cell=""]'],
    ]
    for (const [container, selector] of checks) {
      const style = styleOf(container.querySelector(selector)!)
      expect(style.whiteSpace).toBe('nowrap')
      expect(style.overflow).toBe('hidden')
      expect(style.textOverflow).toBe('ellipsis')
    }
  })

  it('false drops the ellipsis on summary / footerMethod / footerData cells', () => {
    const summaryView = render(
      <IrisTable
        columns={footerColumns}
        data={rows}
        rowKey="id"
        showFooterOverflow={false}
        footerData={[{ id: 9, name: 'Grand total', age: 126 }]}
      />,
    )
    const methodView = render(
      <IrisTable
        columns={footerColumns}
        data={rows}
        rowKey="id"
        showFooterOverflow={false}
        footerMethod={() => [{ id: 8, name: 'Sub total', age: 126 }]}
      />,
    )
    const checks: Array<[HTMLElement, string]> = [
      [summaryView.container, '[data-iris-table-summary-cell=""]'],
      [summaryView.container, '[data-iris-table-footer-cell=""]'],
      [methodView.container, '[data-iris-table-footer-method-cell=""]'],
    ]
    for (const [container, selector] of checks) {
      const style = styleOf(container.querySelector(selector)!)
      expect(style.whiteSpace).toBe('normal')
      expect(style.overflow).toBe('visible')
    }
  })
})
