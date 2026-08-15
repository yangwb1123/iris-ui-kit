import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { matchConditionalStyles } from '@iris-ui-kit/core'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  status: string
  score: number | null
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', status: 'active', score: 10 },
  { id: 2, name: 'Alice', status: 'paused', score: 25 },
  { id: 3, name: 'Bob', status: 'active', score: 40 },
  { id: 4, name: 'Dana', status: 'offline', score: null },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'status', title: 'Status' },
  { key: 'score', title: 'Score' },
]

function cell(rowId: number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

describe('@iris-ui-kit/core matchConditionalStyles bridge types (batch AX, iris 独有)', () => {
  it('the react rule shape is compatible with the core rule (no cast needed)', () => {
    const rules = [
      {
        column: 'score',
        when: (row: Row, value: unknown) => (value as number) >= 25,
        style: { background: 'red' },
      },
    ]
    const merged = matchConditionalStyles(rules, rows[1], 'score', rows[1].score)
    expect(merged).toEqual({ background: 'red' })
  })
})

describe('@iris-ui-kit/react IrisTable conditionalStyles (batch AX, iris 独有)', () => {
  it('a rule highlights matching cells and leaves non-matching untouched', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        conditionalStyles={[
          {
            when: (row, value) => (value as number | null) !== null && (value as number) >= 25,
            style: { background: 'var(--iris-primary)', fontWeight: 'bold' },
          },
        ]}
      />,
    )
    expect(cell(2, 'score').style.background).toBe('var(--iris-primary)')
    expect(cell(2, 'score').style.fontWeight).toBe('bold')
    // Below threshold → default transparent background, no font weight.
    expect(cell(1, 'score').style.background).toBe('transparent')
    expect(cell(1, 'score').style.fontWeight).toBe('')
    // null cell doesn't match either.
    expect(cell(4, 'score').style.background).toBe('transparent')
    // Non-score columns are unaffected by the rule's predicate.
    expect(cell(3, 'name').style.background).toBe('transparent')
  })

  it('column filter: a rule with `column` applies only to that column', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        conditionalStyles={[
          {
            column: 'status',
            when: (row) => row.status === 'active',
            style: { background: 'var(--iris-surface-selected)' },
          },
        ]}
      />,
    )
    expect(cell(1, 'status').style.background).toBe('var(--iris-surface-selected)')
    // Same predicate against other columns' raw values → no match.
    expect(cell(1, 'name').style.background).toBe('transparent')
    expect(cell(1, 'score').style.background).toBe('transparent')
  })

  it('multiple rules merge in array order — later matches win on conflicts', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        conditionalStyles={[
          {
            when: () => true,
            style: { background: 'var(--iris-warning)', color: 'var(--iris-foreground)' },
          },
          {
            column: 'score',
            when: (row) => (row.score ?? 0) >= 30,
            style: { background: 'var(--iris-primary)' },
          },
        ]}
      />,
    )
    // Later rule only overrides the conflicting key; the rest survive.
    expect(cell(3, 'score').style.background).toBe('var(--iris-primary)')
    expect(cell(3, 'score').style.color).toBe('var(--iris-foreground)')
    // Non-conflicting cell keeps the first rule's full style.
    expect(cell(1, 'name').style.background).toBe('var(--iris-warning)')
    expect(cell(1, 'name').style.color).toBe('var(--iris-foreground)')
  })

  it('no match → cell style unchanged (no inline background injected)', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        conditionalStyles={[{ when: () => false, style: { background: 'red' } }]}
      />,
    )
    expect(cell(1, 'name').style.background).toBe('transparent')
    // Without the prop at all the render is identical (inert).
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(container.querySelector('[data-iris-table-cell="name"]')).not.toBeNull()
  })

  it('cellStyle runs BEFORE rules — the rule spread wins on conflicts', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellStyle={(row) =>
          (row.score ?? 0) >= 30 ? { background: 'yellow', color: 'black' } : {}
        }
        conditionalStyles={[
          {
            column: 'score',
            when: (row) => (row.score ?? 0) >= 30,
            style: { background: 'var(--iris-primary)' },
          },
        ]}
      />,
    )
    expect(cell(3, 'score').style.background).toBe('var(--iris-primary)')
    expect(cell(3, 'score').style.color).toBe('black')
  })

  it('the `value` passed to `when` is the raw cell value (dataIndex resolved)', () => {
    const seen: unknown[] = []
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'score', title: 'Score', dataIndex: 'points' },
        ]}
        data={rows.map((r) => ({ id: r.id, name: r.name, points: r.score }))}
        rowKey="id"
        conditionalStyles={[
          {
            column: 'score',
            when: (row, value) => (seen.push(value), true),
            style: { background: 'red' },
          },
        ]}
      />,
    )
    expect(seen).toContain(10)
    expect(seen).toContain(40)
    expect(seen).toContain(null)
    expect(cell(2, 'score').style.background).toBe('red')
  })

  it('a formula column passes the COMPUTED value (getCellValue choke point)', () => {
    const seen: unknown[] = []
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'total', title: 'Total', formula: 'price * qty' },
        ]}
        data={rows.map((r) => ({ id: r.id, name: r.name, price: r.score ?? 0, qty: 2 }))}
        rowKey="id"
        conditionalStyles={[
          {
            column: 'total',
            when: (row, value) => (seen.push(value), true),
            style: { background: 'var(--iris-primary)' },
          },
        ]}
      />,
    )
    // 10*2, 25*2, 40*2, null score → 0*2
    expect(seen).toEqual(expect.arrayContaining([20, 50, 80, 0]))
    expect(cell(1, 'total').style.background).toBe('var(--iris-primary)')
  })
})
