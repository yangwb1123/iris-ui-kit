import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IrisTable } from '../index'
import type { IrisTableColumn } from '../types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  dept: string
  status: string
  region: string
  score: number
  children?: Row[]
}

const rows: Row[] = [
  { id: 1, name: 'Alice', dept: 'Eng', status: 'Active', region: 'US', score: 100 },
  { id: 2, name: 'Bob', dept: 'Eng', status: 'Active', region: 'EU', score: 150 },
  { id: 3, name: 'Cara', dept: 'Eng', status: 'Leave', region: 'US', score: 80 },
  { id: 4, name: 'Dan', dept: 'Ops', status: 'Active', region: 'US', score: 120 },
  { id: 5, name: 'Eve', dept: 'Ops', status: 'Active', region: 'EU', score: 90 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'dept', title: 'Dept' },
  { key: 'status', title: 'Status' },
  { key: 'region', title: 'Region' },
  { key: 'score', title: 'Score', summary: 'sum' },
]

/** One marker per body row in DOM order: `G:<key>@<depth>` group header, `R:<id>` data row, `S:<composite key>` group summary. */
function bodySequence(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[role="row"]'))
    .map((el) => {
      if (el.hasAttribute('data-iris-group-row'))
        return `G:${el.getAttribute('data-iris-group-key')}@${el.getAttribute('data-iris-group-depth') ?? '0'}`
      if (el.hasAttribute('data-iris-group-summary'))
        return `S:${el.getAttribute('data-iris-group-summary')}`
      const rowKey = el.getAttribute('data-iris-table-row')
      if (rowKey && rowKey !== 'header' && rowKey !== 'summary') return `R:${rowKey}`
      return null
    })
    .filter((v): v is string => v !== null)
}

function groupHeaders(
  container: HTMLElement,
): Array<{ key: string; depth: string; value: string; count: string }> {
  return Array.from(container.querySelectorAll('[data-iris-group-row]')).map((el) => ({
    key: el.getAttribute('data-iris-group-key') ?? '',
    depth: el.getAttribute('data-iris-group-depth') ?? '',
    value: el.querySelector('[data-iris-group-value]')!.textContent ?? '',
    count: el.querySelector('[data-iris-group-count]')!.textContent ?? '',
  }))
}

function toggleOf(container: HTMLElement, groupKey: string): HTMLButtonElement {
  const header = Array.from(container.querySelectorAll('[data-iris-group-row]')).find(
    (el) => el.getAttribute('data-iris-group-key') === groupKey,
  )
  return header!.querySelector('[data-iris-group-toggle]') as HTMLButtonElement
}

describe('@iris-ui-kit/react IrisTable multi-column groupBy (batch BS, iris 独有)', () => {
  it('nested two-level render: header order + depth + value + composite key + subtree counts', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" groupBy={['dept', 'status']} />,
    )
    // Group headers first-appearance order: dept level 0 → status level 1.
    const headers = groupHeaders(container)
    expect(headers.map((h) => h.key)).toEqual([
      'Eng',
      'Eng::Active',
      'Eng::Leave',
      'Ops',
      'Ops::Active',
    ])
    // depth: 0 for dept, 1 for status.
    expect(headers.map((h) => h.depth)).toEqual(['0', '1', '1', '0', '1'])
    // Displayed value is this level's OWN value, not the composite key.
    expect(headers.map((h) => h.value)).toEqual(['Eng', 'Active', 'Leave', 'Ops', 'Active'])
    // Parent counts are the SUBTREE totals.
    expect(headers.map((h) => h.count)).toEqual(['(3)', '(2)', '(1)', '(2)', '(2)'])
    // Full body order: dept group → its status subgroups → rows (then summary).
    expect(bodySequence(container)).toEqual([
      'G:Eng@0',
      'G:Eng::Active@1',
      'R:1',
      'R:2',
      'S:Eng::Active',
      'G:Eng::Leave@1',
      'R:3',
      'S:Eng::Leave',
      'G:Ops@0',
      'G:Ops::Active@1',
      'R:4',
      'R:5',
      'S:Ops::Active',
    ])
  })

  it('three-level nesting: order + depth + value + composite key + innermost-only summaries', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" groupBy={['dept', 'status', 'region']} />,
    )
    const headers = groupHeaders(container)
    expect(headers.map((h) => h.key)).toEqual([
      'Eng',
      'Eng::Active',
      'Eng::Active::US',
      'Eng::Active::EU',
      'Eng::Leave',
      'Eng::Leave::US',
      'Ops',
      'Ops::Active',
      'Ops::Active::US',
      'Ops::Active::EU',
    ])
    expect(headers.map((h) => h.depth)).toEqual(['0', '1', '2', '2', '1', '2', '0', '1', '2', '2'])
    expect(headers.map((h) => h.value)).toEqual([
      'Eng',
      'Active',
      'US',
      'EU',
      'Leave',
      'US',
      'Ops',
      'Active',
      'US',
      'EU',
    ])
    expect(headers.map((h) => h.count)).toEqual([
      '(3)',
      '(2)',
      '(1)',
      '(1)',
      '(1)',
      '(1)',
      '(2)',
      '(2)',
      '(1)',
      '(1)',
    ])
    expect(bodySequence(container)).toEqual([
      'G:Eng@0',
      'G:Eng::Active@1',
      'G:Eng::Active::US@2',
      'R:1',
      'S:Eng::Active::US',
      'G:Eng::Active::EU@2',
      'R:2',
      'S:Eng::Active::EU',
      'G:Eng::Leave@1',
      'G:Eng::Leave::US@2',
      'R:3',
      'S:Eng::Leave::US',
      'G:Ops@0',
      'G:Ops::Active@1',
      'G:Ops::Active::US@2',
      'R:4',
      'S:Ops::Active::US',
      'G:Ops::Active::EU@2',
      'R:5',
      'S:Ops::Active::EU',
    ])
  })

  it('single-element array is the single-column path: bare keys, depth 0, collapsible', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" groupBy={['dept']} />,
    )
    const headers = groupHeaders(container)
    expect(headers.map((h) => h.key)).toEqual(['Eng', 'Ops'])
    expect(headers.map((h) => h.depth)).toEqual(['0', '0'])
    expect(headers.map((h) => h.value)).toEqual(['Eng', 'Ops'])
    expect(headers.map((h) => h.count)).toEqual(['(3)', '(2)'])
    act(() => fireEvent.click(toggleOf(container, 'Eng')))
    expect(bodySequence(container)).toEqual(['G:Eng@0', 'G:Ops@0', 'R:4', 'R:5', 'S:Ops'])
  })

  it('table-level array WINS over the column-level flag; flag alone still groups', () => {
    const flagCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'dept', title: 'Dept' },
      { key: 'status', title: 'Status', groupBy: true },
      { key: 'score', title: 'Score' },
    ]
    // Array set → dept grouping, the status flag is ignored.
    const { container } = render(
      <IrisTable columns={flagCols} data={rows} rowKey="id" groupBy={['dept']} />,
    )
    expect(groupHeaders(container).map((h) => h.key)).toEqual(['Eng', 'Ops'])
    expect(container.textContent).toContain('Alice')
    // Without the array → the column flag path runs (byte-identical fallback).
    const { container: flagOnly } = render(<IrisTable columns={flagCols} data={rows} rowKey="id" />)
    const flagHeaders = groupHeaders(flagOnly)
    expect(flagHeaders.map((h) => h.key)).toEqual(['Active', 'Leave'])
    expect(flagHeaders.map((h) => h.depth)).toEqual(['0', '0'])
    expect(flagHeaders.map((h) => h.count)).toEqual(['(4)', '(1)'])
  })

  it('unknown keys dropped, duplicates keep the first occurrence', () => {
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        groupBy={['dept', 'missing', 'dept', 'status', 'missing']}
      />,
    )
    // Resolved to ['dept','status'] — identical to the two-level render.
    expect(groupHeaders(container).map((h) => h.key)).toEqual([
      'Eng',
      'Eng::Active',
      'Eng::Leave',
      'Ops',
      'Ops::Active',
    ])
    expect(bodySequence(container)).toContain('R:1')
  })

  it('unknown-only / empty array is inert — no grouping at all', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" groupBy={['nope']} />,
    )
    expect(container.querySelector('[data-iris-group-row]')).toBeNull()
    expect(bodySequence(container)).toEqual(['R:1', 'R:2', 'R:3', 'R:4', 'R:5'])
    const { container: empty } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" groupBy={[]} />,
    )
    expect(empty.querySelector('[data-iris-group-row]')).toBeNull()
  })

  it('collapsing a parent hides its whole subtree; header + full count stay', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" groupBy={['dept', 'status']} />,
    )
    act(() => fireEvent.click(toggleOf(container, 'Eng')))
    // Eng's subgroup headers AND rows are gone; Ops subtree remains.
    expect(bodySequence(container)).toEqual([
      'G:Eng@0',
      'G:Ops@0',
      'G:Ops::Active@1',
      'R:4',
      'R:5',
      'S:Ops::Active',
    ])
    const eng = groupHeaders(container)[0]!
    expect(eng.key).toBe('Eng')
    expect(eng.count).toBe('(3)')
    expect(eng.depth).toBe('0')
    expect(
      container
        .querySelector('[data-iris-group-key="Eng"]')!
        .getAttribute('data-iris-group-collapsed'),
    ).toBe('true')
    // Expanding restores the whole subtree.
    act(() => fireEvent.click(toggleOf(container, 'Eng')))
    expect(bodySequence(container)).toContain('G:Eng::Active@1')
    expect(bodySequence(container)).toContain('R:3')
  })

  it('collapsing a leaf hides only its rows + summary; sibling leaf stays', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" groupBy={['dept', 'status']} />,
    )
    act(() => fireEvent.click(toggleOf(container, 'Eng::Active')))
    expect(bodySequence(container)).toEqual([
      'G:Eng@0',
      'G:Eng::Active@1',
      'G:Eng::Leave@1',
      'R:3',
      'S:Eng::Leave',
      'G:Ops@0',
      'G:Ops::Active@1',
      'R:4',
      'R:5',
      'S:Ops::Active',
    ])
    // Same composite key under a different parent collapses independently.
    act(() => fireEvent.click(toggleOf(container, 'Ops::Active')))
    expect(bodySequence(container)).toEqual([
      'G:Eng@0',
      'G:Eng::Active@1',
      'G:Eng::Leave@1',
      'R:3',
      'S:Eng::Leave',
      'G:Ops@0',
      'G:Ops::Active@1',
    ])
  })

  it('controlled: no optimistic flip — body changes only after the prop is written back', () => {
    const onGroupCollapseChange = vi.fn()
    const { container, rerender } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        groupBy={['dept', 'status']}
        groupCollapsed={[]}
        onGroupCollapseChange={onGroupCollapseChange}
      />,
    )
    act(() => fireEvent.click(toggleOf(container, 'Eng::Active')))
    // Callback fires with the NEXT composite key…
    expect(onGroupCollapseChange).toHaveBeenCalledTimes(1)
    expect(onGroupCollapseChange).toHaveBeenCalledWith(['Eng::Active'])
    // …but the rendered body is unchanged (parent did not write back yet).
    expect(bodySequence(container)).toContain('R:1')
    expect(bodySequence(container)).toContain('R:2')
    // Parent writes the prop back → the leaf subtree collapses.
    rerender(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        groupBy={['dept', 'status']}
        groupCollapsed={['Eng::Active']}
        onGroupCollapseChange={onGroupCollapseChange}
      />,
    )
    expect(bodySequence(container)).not.toContain('R:1')
    expect(bodySequence(container)).not.toContain('R:2')
  })

  it('per-group summary appears ONLY on the innermost level, with the right aggregates', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" groupBy={['dept', 'status']} />,
    )
    const summaries = container.querySelectorAll('[data-iris-group-summary]')
    expect(summaries.length).toBe(3)
    expect(Array.from(summaries).map((s) => s.getAttribute('data-iris-group-summary'))).toEqual([
      'Eng::Active',
      'Eng::Leave',
      'Ops::Active',
    ])
    // No summary row sits between a parent header and its first child header.
    const seq = bodySequence(container)
    expect(seq.indexOf('G:Eng@0')).toBe(0)
    expect(seq[1]).toBe('G:Eng::Active@1')
    expect(seq[5]).toBe('G:Eng::Leave@1')
    // Aggregates over the leaf group's rows (sum of score).
    expect(summaries[0]!.querySelector('[data-iris-table-summary-cell]')!.textContent).toBe('250')
    expect(summaries[2]!.querySelector('[data-iris-table-summary-cell]')!.textContent).toBe('210')
  })

  it('seq keeps original bodyData indices under nested groups (zero drift)', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" groupBy={['dept', 'status']} seq />,
    )
    const seqs = Array.from(container.querySelectorAll('[data-iris-table-cell="__seq"]'))
    expect(seqs.map((el) => el.textContent)).toEqual(['1', '2', '3', '4', '5'])
  })

  it('virtual path renders nested group headers with depth + rows', () => {
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        groupBy={['dept', 'status']}
        virtualScroll={{ itemHeight: 32, height: 200 }}
      />,
    )
    // jsdom clientHeight is 0 → the initial window covers the first ~4 items;
    // the leading nested headers + their rows are the contract under test.
    const headers = groupHeaders(container)
    expect(headers.map((h) => h.key)).toEqual(['Eng', 'Eng::Active'])
    expect(headers.map((h) => h.depth)).toEqual(['0', '1'])
    expect(headers[0]!.value).toBe('Eng')
    expect(headers[1]!.value).toBe('Active')
    expect(container.textContent).toContain('Alice')
    expect(container.textContent).toContain('Bob')
    // Collapse works on the virtualized path too (window recomputes).
    act(() => fireEvent.click(toggleOf(container, 'Eng::Active')))
    expect(container.textContent).not.toContain('Alice')
    expect(container.textContent).not.toContain('Bob')
    expect(container.textContent).toContain('Cara')
  })

  it('tree mode is fail-closed: the groupBy array never groups', () => {
    const treeRows: Row[] = [
      {
        id: 1,
        name: 'Root',
        dept: 'Eng',
        status: 'Active',
        region: 'US',
        score: 10,
        children: [
          { id: 11, name: 'Child', dept: 'Ops', status: 'Leave', region: 'EU', score: 20 },
        ],
      },
    ]
    const getSubRows = (r: Row): Row[] | undefined => r.children
    const { container } = render(
      <IrisTable
        columns={cols}
        data={treeRows}
        rowKey="id"
        getSubRows={getSubRows}
        groupBy={['dept', 'status']}
      />,
    )
    expect(container.querySelector('[data-iris-group-row]')).toBeNull()
    expect(container.querySelector('[data-iris-table-row="1"]')).not.toBeNull()
  })
})
