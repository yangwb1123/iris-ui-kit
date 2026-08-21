import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisTable } from '../index'
import type { IrisTableColumn } from '../types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Alice', age: 20 },
  { id: 2, name: 'Bob', age: 30 },
]

const summaryColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age', summary: 'sum' },
]

function summaryCells(container: HTMLElement): string[] {
  const summary = container.querySelector('[data-iris-table-row="summary"]')
  return Array.from(summary?.children ?? [])
    .filter((cell): cell is HTMLElement => cell.getAttribute('role') === 'cell')
    .map(
      (cell) =>
        cell.getAttribute('data-iris-table-cell') ??
        cell.getAttribute('data-iris-summary-track') ??
        '',
    )
}

function firstBodyRow(container: HTMLElement): HTMLElement {
  return Array.from(container.querySelectorAll('[data-iris-table-row]')).find((row) => {
    const key = row.getAttribute('data-iris-table-row')
    return key !== 'header' && key !== 'summary'
  }) as HTMLElement
}

describe('@iris-ui-kit/react IrisTable summary/detail grid tracks', () => {
  it('reserves the detail track before summary data cells', () => {
    const { container } = render(
      <IrisTable
        columns={summaryColumns}
        data={rows}
        renderDetail={(row) => <div>detail-{row.id}</div>}
      />,
    )

    expect(summaryCells(container)).toEqual(['__expand', 'name', 'age'])
    expect(
      (container.querySelector('[data-iris-table-row="summary"]') as HTMLElement).style
        .gridTemplateColumns,
    ).toBe(firstBodyRow(container).style.gridTemplateColumns)
    expect(
      container.querySelector('[data-iris-table-row="summary"] [data-iris-table-cell="__expand"]'),
    ).not.toBeNull()
  })

  it('keeps the summary DOM unchanged when detail rows are disabled', () => {
    const { container } = render(<IrisTable columns={summaryColumns} data={rows} />)

    expect(summaryCells(container)).toEqual(['name', 'age'])
    expect(
      container.querySelector('[data-iris-table-row="summary"] [data-iris-table-cell="__expand"]'),
    ).toBeNull()
  })

  it('mirrors every enabled leading track in the summary row', () => {
    const { container } = render(
      <IrisTable
        columns={summaryColumns}
        data={rows}
        renderDetail={(row) => <div>detail-{row.id}</div>}
        rowDrag
        seq
        selectable="multi"
      />,
    )

    expect(summaryCells(container)).toEqual([
      '__drag',
      '__seq',
      '__expand',
      '__selection',
      'name',
      'age',
    ])
  })
})
