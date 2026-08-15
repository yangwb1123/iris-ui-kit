import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IrisTable } from '../index'
import type { IrisTableColumn, IrisTableHandle } from '../types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  role: string
  score: number
  children?: Row[]
}

const rows: Row[] = [
  { id: 1, name: 'Alice', role: 'Develop', score: 100 },
  { id: 2, name: 'Bob', role: 'Develop', score: 150 },
  { id: 3, name: 'Cara', role: 'QA', score: 80 },
  { id: 4, name: 'Dan', role: 'QA', score: 120 },
]

const groupCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'role', title: 'Role', groupBy: true },
  { key: 'score', title: 'Score', summary: 'sum' },
]

function toggleOf(container: HTMLElement, groupKey: string): HTMLButtonElement {
  const header = Array.from(container.querySelectorAll('[data-iris-group-row]')).find(
    (el) => el.getAttribute('data-iris-group-key') === groupKey,
  )
  return header!.querySelector('[data-iris-group-toggle]') as HTMLButtonElement
}
function visibleRows(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-iris-table-row]'))
    .map((el) => el.getAttribute('data-iris-table-row'))
    .filter((v): v is string => v !== null && v !== 'header' && v !== 'summary')
}
function visibleGroupKeys(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-iris-group-row]')).map(
    (el) => el.getAttribute('data-iris-group-key') ?? '',
  )
}

describe('@iris-ui-kit/react IrisTable group collapse (batch BH, iris 独有)', () => {
  it('renders every group header expanded by default with a toggle button (▾, aria-expanded)', () => {
    const { container } = render(<IrisTable columns={groupCols} data={rows} rowKey="id" />)
    const toggles = container.querySelectorAll('[data-iris-group-toggle]')
    expect(toggles.length).toBe(2)
    expect(toggleOf(container, 'Develop').getAttribute('aria-expanded')).toBe('true')
    expect(toggleOf(container, 'QA').getAttribute('aria-expanded')).toBe('true')
    expect(toggleOf(container, 'Develop').textContent).toBe('▾')
    expect(toggleOf(container, 'Develop').getAttribute('aria-label')).toBe('Collapse group')
    // No header is marked collapsed.
    expect(container.querySelector('[data-iris-group-collapsed]')).toBeNull()
    expect(visibleRows(container)).toEqual(['1', '2', '3', '4'])
  })

  it('collapsing hides the group rows AND its per-group summary; header + full count stay', () => {
    const { container } = render(<IrisTable columns={groupCols} data={rows} rowKey="id" />)
    act(() => fireEvent.click(toggleOf(container, 'Develop')))
    const header = container.querySelector('[data-iris-group-key="Develop"]')!
    expect(header.getAttribute('data-iris-group-collapsed')).toBe('true')
    expect(toggleOf(container, 'Develop').getAttribute('aria-expanded')).toBe('false')
    expect(toggleOf(container, 'Develop').textContent).toBe('▸')
    // Develop rows + its summary are gone; QA rows + summary remain.
    expect(visibleRows(container)).toEqual(['3', '4'])
    const summaries = container.querySelectorAll('[data-iris-group-summary]')
    expect(summaries.length).toBe(1)
    expect(summaries[0]!.getAttribute('data-iris-group-summary')).toBe('QA')
    // The header and its FULL count stay.
    expect(header.querySelector('[data-iris-group-value]')!.textContent).toBe('Develop')
    expect(header.querySelector('[data-iris-group-count]')!.textContent).toBe('(2)')
    // QA headers untouched.
    expect(
      container
        .querySelector('[data-iris-group-key="QA"]')!
        .hasAttribute('data-iris-group-collapsed'),
    ).toBe(false)
  })

  it('expanding restores the rows and the per-group summary', () => {
    const { container } = render(<IrisTable columns={groupCols} data={rows} rowKey="id" />)
    act(() => fireEvent.click(toggleOf(container, 'Develop')))
    act(() => fireEvent.click(toggleOf(container, 'Develop')))
    expect(container.querySelector('[data-iris-group-collapsed]')).toBeNull()
    expect(toggleOf(container, 'Develop').getAttribute('aria-expanded')).toBe('true')
    expect(toggleOf(container, 'Develop').textContent).toBe('▾')
    expect(visibleRows(container)).toEqual(['1', '2', '3', '4'])
    const summaries = container.querySelectorAll('[data-iris-group-summary]')
    expect(summaries.length).toBe(2)
    // Restored group summary aggregates the full group again.
    expect(summaries[0]!.querySelector('[data-iris-table-summary-cell]')!.textContent).toBe('250')
  })

  it('defaultGroupCollapsed seeds the uncontrolled state; toggling clears it', () => {
    const { container } = render(
      <IrisTable columns={groupCols} data={rows} rowKey="id" defaultGroupCollapsed={['Develop']} />,
    )
    expect(
      container
        .querySelector('[data-iris-group-key="Develop"]')!
        .getAttribute('data-iris-group-collapsed'),
    ).toBe('true')
    expect(visibleRows(container)).toEqual(['3', '4'])
    act(() => fireEvent.click(toggleOf(container, 'Develop')))
    expect(visibleRows(container)).toEqual(['1', '2', '3', '4'])
  })

  it('controlled: no optimistic flip — body changes only after the prop is written back', () => {
    const onGroupCollapseChange = vi.fn()
    const { container, rerender } = render(
      <IrisTable
        columns={groupCols}
        data={rows}
        rowKey="id"
        groupCollapsed={[]}
        onGroupCollapseChange={onGroupCollapseChange}
      />,
    )
    act(() => fireEvent.click(toggleOf(container, 'Develop')))
    // Callback fires with the NEXT set…
    expect(onGroupCollapseChange).toHaveBeenCalledTimes(1)
    expect(onGroupCollapseChange).toHaveBeenCalledWith(['Develop'])
    // …but the rendered body is unchanged (parent did not write back yet).
    expect(visibleRows(container)).toEqual(['1', '2', '3', '4'])
    expect(container.querySelector('[data-iris-group-collapsed]')).toBeNull()
    // Parent writes the prop back → body collapses.
    rerender(
      <IrisTable
        columns={groupCols}
        data={rows}
        rowKey="id"
        groupCollapsed={['Develop']}
        onGroupCollapseChange={onGroupCollapseChange}
      />,
    )
    expect(visibleRows(container)).toEqual(['3', '4'])
    expect(
      container
        .querySelector('[data-iris-group-key="Develop"]')!
        .getAttribute('data-iris-group-collapsed'),
    ).toBe('true')
    // Expanding fires the callback with the key removed; body follows the prop.
    act(() => fireEvent.click(toggleOf(container, 'Develop')))
    expect(onGroupCollapseChange).toHaveBeenLastCalledWith([])
    expect(visibleRows(container)).toEqual(['3', '4']) // still collapsed
    rerender(
      <IrisTable
        columns={groupCols}
        data={rows}
        rowKey="id"
        groupCollapsed={[]}
        onGroupCollapseChange={onGroupCollapseChange}
      />,
    )
    expect(visibleRows(container)).toEqual(['1', '2', '3', '4'])
  })

  it('selection coexistence: hidden rows keep their selection; the summary still counts them', () => {
    const { container } = render(
      <IrisTable
        columns={groupCols}
        data={rows}
        rowKey="id"
        selectable="multi"
        selectionSummary
        toolbar={{ title: 'T' }}
      />,
    )
    fireEvent.click(container.querySelector('[data-iris-table-row="1"] input[type="checkbox"]')!)
    fireEvent.click(container.querySelector('[data-iris-table-row="2"] input[type="checkbox"]')!)
    expect(container.querySelector('[data-iris-selection-summary]')!.textContent).toContain(
      '2 selected',
    )
    act(() => fireEvent.click(toggleOf(container, 'Develop')))
    // Collapsing never mutates selection state — the summary still counts the
    // hidden selected rows.
    expect(container.querySelector('[data-iris-selection-summary]')!.textContent).toContain(
      '2 selected',
    )
    // Expanding restores the rows with their selected state intact.
    act(() => fireEvent.click(toggleOf(container, 'Develop')))
    expect(
      container
        .querySelector('[data-iris-table-row="1"]')!
        .getAttribute('data-iris-table-row-selected'),
    ).toBe('true')
    expect(
      container
        .querySelector('[data-iris-table-row="2"]')!
        .getAttribute('data-iris-table-row-selected'),
    ).toBe('true')
  })

  it('select-all still selects rows hidden inside collapsed groups', () => {
    const ref = { current: null as IrisTableHandle<Row> | null }
    const { container } = render(
      <IrisTable
        ref={ref}
        columns={groupCols}
        data={rows}
        rowKey="id"
        selectable="multi"
        selectionSummary
        toolbar={{ title: 'T' }}
        tableRef={ref}
      />,
    )
    act(() => fireEvent.click(toggleOf(container, 'Develop')))
    act(() => ref.current!.selectAll())
    expect(container.querySelector('[data-iris-selection-summary]')!.textContent).toContain(
      '4 selected',
    )
    act(() => fireEvent.click(toggleOf(container, 'Develop')))
    for (const id of ['1', '2', '3', '4']) {
      expect(
        container
          .querySelector(`[data-iris-table-row="${id}"]`)!
          .getAttribute('data-iris-table-row-selected'),
      ).toBe('true')
    }
  })

  it('edit coexistence: committed values + dirty dots survive collapse/expand', () => {
    const { container } = render(
      <IrisTable
        columns={groupCols}
        data={rows}
        rowKey="id"
        editDirtyConfig={{ indicator: true }}
      />,
    )
    const cell = container.querySelector('[data-iris-table-row="1"] [data-iris-table-cell="name"]')!
    act(() => fireEvent.doubleClick(cell))
    act(() => {
      fireEvent.change(container.querySelector('[data-iris-table-editor]')!, {
        target: { value: 'Alicia' },
      })
      fireEvent.keyDown(container.querySelector('[data-iris-table-editor]')!, { key: 'Enter' })
    })
    expect(
      container.querySelector('[data-iris-table-row="1"] [data-iris-table-cell="name"]')!
        .textContent,
    ).toContain('Alicia')
    expect(
      container.querySelector('[data-iris-table-row="1"] [data-iris-cell-dirty]'),
    ).not.toBeNull()
    act(() => fireEvent.click(toggleOf(container, 'Develop')))
    expect(visibleRows(container)).toEqual(['3', '4'])
    act(() => fireEvent.click(toggleOf(container, 'Develop')))
    // Committed value and dirty state survive the round trip untouched.
    expect(
      container.querySelector('[data-iris-table-row="1"] [data-iris-table-cell="name"]')!
        .textContent,
    ).toContain('Alicia')
    expect(
      container.querySelector('[data-iris-table-row="1"] [data-iris-cell-dirty]'),
    ).not.toBeNull()
  })

  it('seq: hidden rows keep their ORIGINAL bodyData indices (no renumbering)', () => {
    const { container } = render(<IrisTable columns={groupCols} data={rows} rowKey="id" seq />)
    act(() => fireEvent.click(toggleOf(container, 'Develop')))
    // QA rows still show seq 3 and 4 — collapse never renumbers survivors.
    expect(
      container.querySelector('[data-iris-table-row="3"] [data-iris-table-cell="__seq"]')!
        .textContent,
    ).toContain('3')
    expect(
      container.querySelector('[data-iris-table-row="4"] [data-iris-table-cell="__seq"]')!
        .textContent,
    ).toContain('4')
  })

  it('virtual path: collapsed groups drop out of the virtual plan', () => {
    const { container } = render(
      <IrisTable
        columns={groupCols}
        data={rows}
        rowKey="id"
        virtualScroll={{ itemHeight: 32, height: 400, buffer: 10 }}
      />,
    )
    expect(visibleRows(container)).toEqual(['1', '2', '3', '4'])
    act(() => fireEvent.click(toggleOf(container, 'Develop')))
    expect(visibleRows(container)).toEqual(['3', '4'])
    expect(container.querySelectorAll('[data-iris-group-summary]').length).toBe(1)
    act(() => fireEvent.click(toggleOf(container, 'Develop')))
    expect(visibleRows(container)).toEqual(['1', '2', '3', '4'])
  })

  it('the toggle button never fires row events', () => {
    const onRowClick = vi.fn()
    const { container } = render(
      <IrisTable columns={groupCols} data={rows} rowKey="id" onRowClick={onRowClick} />,
    )
    act(() => fireEvent.click(toggleOf(container, 'Develop')))
    expect(onRowClick).not.toHaveBeenCalled()
    expect(visibleRows(container)).toEqual(['3', '4'])
  })

  it('stale keys are inert; inert without groupBy and in tree mode', () => {
    const onGroupCollapseChange = vi.fn()
    const { container, rerender } = render(
      <IrisTable
        columns={groupCols}
        data={rows}
        rowKey="id"
        groupCollapsed={['Nope']}
        onGroupCollapseChange={onGroupCollapseChange}
      />,
    )
    // Unknown key: everything stays expanded.
    expect(container.querySelector('[data-iris-group-collapsed]')).toBeNull()
    expect(visibleRows(container)).toEqual(['1', '2', '3', '4'])
    // Without groupBy there are no group headers at all (collapse props inert).
    rerender(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'score', title: 'Score' },
        ]}
        data={rows}
        rowKey="id"
        defaultGroupCollapsed={['Develop']}
        groupCollapsed={['Develop']}
      />,
    )
    expect(container.querySelector('[data-iris-group-toggle]')).toBeNull()
    expect(visibleRows(container)).toEqual(['1', '2', '3', '4'])
    // Tree mode ignores grouping fail-closed: no group toggles, tree toggles work.
    const treeData: Row[] = [
      {
        id: 1,
        name: 'Root',
        role: 'Develop',
        score: 100,
        children: [{ id: 11, name: 'Kid', role: 'Develop', score: 10 }],
      },
    ]
    rerender(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'role', title: 'Role', groupBy: true },
        ]}
        data={treeData}
        rowKey="id"
        getSubRows={(r) => r.children}
        groupCollapsed={['Develop']}
      />,
    )
    expect(container.querySelector('[data-iris-group-toggle]')).toBeNull()
    expect(visibleGroupKeys(container)).toEqual([])
    expect(container.textContent).toContain('Root')
  })
})
