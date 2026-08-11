import { afterEach, describe, expect, it } from 'vitest'
import { createSignal } from 'solid-js'
import { render, cleanup, waitFor } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn, IrisTableSpanMethodParams } from './types'

afterEach(cleanup)

const cols: IrisTableColumn<{ name: string; age: number; city: string }>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age' },
  { key: 'city', title: 'City' },
]

const rows = [
  { name: 'Alice', age: 30, city: 'Berlin' },
  { name: 'Bob', age: 25, city: 'Paris' },
]

const cellTexts = (container: HTMLElement, key: string): string[] =>
  [...container.querySelectorAll(`[data-iris-table-cell="${key}"]`)].map(
    (c) => (c as HTMLElement).textContent ?? '',
  )

describe('IrisTable parity-AA: spanMethod', () => {
  type Span = { rowspan?: number; colspan?: number } | null | undefined
  const renderSpan = (spanMethod: (p: IrisTableSpanMethodParams) => Span) =>
    render(() => <IrisTable columns={cols} data={rows} spanMethod={spanMethod} />)

  it('colspan merges cells: origin extends its track, covered cell skipped', () => {
    const { container } = renderSpan(() => ({ colspan: 2 }))
    const nameCell = container.querySelector('[data-iris-table-cell="name"]') as HTMLElement
    expect(nameCell.style.gridColumnEnd).toBe('span 2')
    expect(cellTexts(container, 'name')).toEqual(['Alice', 'Bob']) // per row: merged + city
    expect(cellTexts(container, 'age')).toEqual([]) // covered by the colspan
    expect(cellTexts(container, 'city')).toEqual(['Berlin', 'Paris'])
  })

  it('rowspan removes the covered cell of the next row', () => {
    const { container } = renderSpan(({ rowIndex, columnIndex }) =>
      rowIndex === 0 && columnIndex === 0 ? { rowspan: 2 } : undefined,
    )
    expect(cellTexts(container, 'name')).toEqual(['Alice']) // row 1's name covered
    expect(cellTexts(container, 'age')).toEqual(['30', '25'])
    expect(cellTexts(container, 'city')).toEqual(['Berlin', 'Paris'])
  })

  it('rebuilds coverage when spanMethod is swapped without a data change', async () => {
    const merge = ({ rowIndex, columnIndex }: IrisTableSpanMethodParams): Span =>
      rowIndex === 0 && columnIndex === 0 ? { rowspan: 2 } : undefined
    const noMerge = (): Span => undefined
    const [method, setMethod] = createSignal<(p: IrisTableSpanMethodParams) => Span>(merge)
    const { container } = render(() => (
      <IrisTable columns={cols} data={rows} spanMethod={method()} />
    ))
    expect(cellTexts(container, 'name')).toEqual(['Alice']) // row 1's name covered
    // Swap to a no-span function with identical data/columns: the occupy set is
    // keyed on spanMethod identity, so Bob's covered cell must come back.
    setMethod(() => noMerge)
    await waitFor(() => {
      expect(cellTexts(container, 'name')).toEqual(['Alice', 'Bob'])
    })
    // And swapping back re-applies the merge.
    setMethod(() => merge)
    await waitFor(() => {
      expect(cellTexts(container, 'name')).toEqual(['Alice'])
    })
  })
})
