import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/svelte'
import IrisTable from '../IrisTable.svelte'

afterEach(cleanup)

const data = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
]

const columns = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age', summary: 'sum' as const },
]

describe('Svelte table summary/detail alignment', () => {
  it('keeps the expand track between seq and selection and matches body tracks', () => {
    const { container } = render(IrisTable, {
      props: {
        columns,
        data,
        selectable: 'multi',
        seq: true,
        renderDetail: (row: Record<string, unknown>) => `detail-${String(row.name)}`,
      },
    })
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
