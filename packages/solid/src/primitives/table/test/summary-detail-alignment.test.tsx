import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisTable } from '../IrisTable'
import type { IrisTableColumn } from '../types'

afterEach(cleanup)

const data = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
]

const columns: IrisTableColumn[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age', summary: 'sum' },
]

describe('Solid table summary/detail alignment', () => {
  it('keeps the expand track between seq and selection and matches body tracks', () => {
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={data}
        selectable="multi"
        seq
        renderDetail={(row) => `detail-${String(row.name)}`}
      />
    ))
    const summary = container.querySelector('[data-iris-table-row="summary"]')
    expect(summary).not.toBeNull()
    expect(
      Array.from(summary!.querySelectorAll('[data-iris-table-cell]')).map((cell) =>
        cell.getAttribute('data-iris-table-cell'),
      ),
    ).toEqual(['__seq', '__expand', '__selection', 'name', 'age'])
    expect((summary as HTMLElement).style.gridTemplateColumns).toBe(
      (container.querySelector('[data-iris-table-row=""]') as HTMLElement).style
        .gridTemplateColumns,
    )
  })
})
