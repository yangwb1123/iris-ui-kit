import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

afterEach(cleanup)

type Row = { id: number; city: string; amount: number }
const columns: IrisTableColumn<Row>[] = [
  { key: 'city', title: 'City', editable: true, formatter: (value) => `F:${String(value)}` },
  {
    key: 'amount',
    title: 'Amount',
    editable: true,
    editor: 'number',
    formatter: (value) => Number(value).toFixed(1),
  },
]
const rows: Row[] = [
  { id: 1, city: 'Paris', amount: 2 },
  { id: 2, city: 'Berlin', amount: 3 },
  { id: 3, city: 'Paris', amount: 4 },
]

const cell = (container: HTMLElement, id: number, key: string) =>
  container.querySelector<HTMLElement>(
    `[data-iris-table-row-key="${id}"] [data-iris-table-cell="${key}"]`,
  )!

describe('Solid IrisTable editPreview and pattern feedback', () => {
  it('previews formatter output and updates with the draft', () => {
    const { container } = render(() => <IrisTable columns={columns} data={rows} editPreview />)
    fireEvent.dblClick(cell(container, 1, 'city'))
    expect(container.querySelector('[data-iris-edit-preview]')?.textContent).toBe('F:Paris')
    fireEvent.input(container.querySelector('[data-iris-table-editor]')!, {
      target: { value: 'Rome' },
    })
    expect(container.querySelector('[data-iris-edit-preview]')?.textContent).toBe('F:Rome')
  })

  it('matches raw values in the edited column and patternFill aliases pattern', () => {
    const { container } = render(() => <IrisTable columns={columns} data={rows} patternFill />)
    fireEvent.dblClick(cell(container, 1, 'city'))
    expect(cell(container, 1, 'city').getAttribute('data-iris-input-hint')).toBeNull()
    expect(cell(container, 3, 'city').getAttribute('data-iris-input-hint')).toBe('true')
    fireEvent.input(container.querySelector('[data-iris-table-editor]')!, {
      target: { value: 'Berlin' },
    })
    expect(cell(container, 2, 'city').getAttribute('data-iris-input-hint')).toBe('true')
    expect(cell(container, 3, 'city').getAttribute('data-iris-input-hint')).toBeNull()
  })

  it('is fail-closed when preview is off and does not hint an empty draft', () => {
    const { container } = render(() => <IrisTable columns={columns} data={rows} pattern />)
    fireEvent.dblClick(cell(container, 1, 'city'))
    expect(container.querySelector('[data-iris-edit-preview]')).toBeNull()
    fireEvent.input(container.querySelector('[data-iris-table-editor]')!, {
      target: { value: '' },
    })
    expect(container.querySelectorAll('[data-iris-input-hint="true"]')).toHaveLength(0)
  })
})
