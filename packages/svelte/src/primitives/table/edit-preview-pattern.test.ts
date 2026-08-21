import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'

afterEach(cleanup)

const columns = [
  {
    key: 'city',
    title: 'City',
    editable: true,
    formatter: (value: unknown) => `F:${String(value)}`,
  },
  {
    key: 'amount',
    title: 'Amount',
    editable: true,
    editor: 'number' as const,
    formatter: (value: unknown) => Number(value).toFixed(1),
  },
]
const data = [
  { id: 1, city: 'Paris', amount: 2 },
  { id: 2, city: 'Berlin', amount: 3 },
  { id: 3, city: 'Paris', amount: 4 },
]

const cell = (container: HTMLElement, id: number, key: string) =>
  container.querySelector<HTMLElement>(
    `[data-iris-table-row-key="${id}"] [data-iris-table-cell="${key}"]`,
  )!

describe('Svelte IrisTable editPreview and pattern feedback', () => {
  it('previews formatter output and updates with the draft', async () => {
    const rendered = render(IrisTable, { props: { columns, data, editPreview: true } })
    await waitFor(() => expect(cell(rendered.container, 1, 'city')).not.toBeNull())
    await fireEvent.dblClick(cell(rendered.container, 1, 'city'))
    expect(rendered.container.querySelector('[data-iris-edit-preview]')?.textContent).toBe(
      'F:Paris',
    )
    await fireEvent.input(rendered.container.querySelector('[data-iris-table-editor]')!, {
      target: { value: 'Rome' },
    })
    expect(rendered.container.querySelector('[data-iris-edit-preview]')?.textContent).toBe('F:Rome')
  })

  it('matches raw values in the edited column and patternFill aliases pattern', async () => {
    const rendered = render(IrisTable, { props: { columns, data, patternFill: true } })
    await waitFor(() => expect(cell(rendered.container, 1, 'city')).not.toBeNull())
    await fireEvent.dblClick(cell(rendered.container, 1, 'city'))
    expect(cell(rendered.container, 1, 'city').getAttribute('data-iris-input-hint')).toBeNull()
    expect(cell(rendered.container, 3, 'city').getAttribute('data-iris-input-hint')).toBe('true')
    await fireEvent.input(rendered.container.querySelector('[data-iris-table-editor]')!, {
      target: { value: 'Berlin' },
    })
    expect(cell(rendered.container, 2, 'city').getAttribute('data-iris-input-hint')).toBe('true')
    expect(cell(rendered.container, 3, 'city').getAttribute('data-iris-input-hint')).toBeNull()
  })

  it('is fail-closed when preview is off and does not hint an empty draft', async () => {
    const rendered = render(IrisTable, { props: { columns, data, pattern: true } })
    await waitFor(() => expect(cell(rendered.container, 1, 'city')).not.toBeNull())
    await fireEvent.dblClick(cell(rendered.container, 1, 'city'))
    expect(rendered.container.querySelector('[data-iris-edit-preview]')).toBeNull()
    await fireEvent.input(rendered.container.querySelector('[data-iris-table-editor]')!, {
      target: { value: '' },
    })
    expect(rendered.container.querySelectorAll('[data-iris-input-hint="true"]')).toHaveLength(0)
  })
})
