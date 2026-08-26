import * as React from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createGridFeature, type GridCore } from '@iris-ui-kit/core/grid'
import { useGridCore } from './useGridCore'
import { useGridExpansion } from './useGridExpansion'
import { useGridFiltering } from './useGridFiltering'
import { useGridPagination } from './useGridPagination'
import { useGridRows } from './useGridRows'
import { useGridSelection } from './useGridSelection'
import { useGridSorting } from './useGridSorting'

async function flushTeardown(): Promise<void> {
  await act(async () => Promise.resolve())
}

describe('useGridCore', () => {
  it('bridges ready and dispose to the React mount lifecycle', async () => {
    const ready = vi.fn()
    const dispose = vi.fn()
    let core: GridCore | undefined
    const feature = createGridFeature({
      name: 'lifecycle',
      setup: () => ({ onReady: ready, dispose }),
    })
    function Harness() {
      core = useGridCore({ features: [feature] })
      return null
    }

    const view = render(<Harness />)
    expect(core?.status).toBe('ready')
    expect(ready).toHaveBeenCalledOnce()

    view.unmount()
    await flushTeardown()
    expect(core?.status).toBe('destroyed')
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('survives the StrictMode effect replay without destroying the live core', async () => {
    let core: GridCore | undefined
    function Harness() {
      core = useGridCore()
      return null
    }

    const view = render(
      <React.StrictMode>
        <Harness />
      </React.StrictMode>,
    )
    await flushTeardown()
    expect(core?.status).toBe('ready')

    view.unmount()
    await flushTeardown()
    expect(core?.status).toBe('destroyed')
  })
})

describe('useGridSelection', () => {
  it('bridges an uncontrolled selection feature without duplicating its state', () => {
    const onChange = vi.fn()
    function Harness() {
      const core = useGridCore()
      const selection = useGridSelection(core, { defaultValue: ['a'], onChange })
      return (
        <button type="button" onClick={() => selection.model.toggle('b')}>
          {selection.selection.join(',')}
        </button>
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button'))

    expect(view.getByRole('button').textContent).toBe('a,b')
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b'])
    view.unmount()
  })

  it('renders controlled state and rebases mutations on the latest prop', () => {
    const onChange = vi.fn()
    function Harness({ value }: { value: string[] }) {
      const core = useGridCore()
      const selection = useGridSelection(core, { value, onChange })
      return (
        <button
          type="button"
          onClick={() => {
            selection.rebase()
            selection.model.toggle('b')
          }}
        >
          {selection.selection.join(',')}
        </button>
      )
    }

    const view = render(<Harness value={['a']} />)
    view.rerender(<Harness value={['c']} />)
    fireEvent.click(view.getByRole('button'))

    expect(view.getByRole('button').textContent).toBe('c')
    expect(onChange).toHaveBeenLastCalledWith(['c', 'b'])
    view.unmount()
  })
})

describe('useGridRows', () => {
  it('renders committed rows while silent sync skips transaction observers', () => {
    const before = vi.fn()
    const after = vi.fn()
    function Harness() {
      const core = useGridCore<{ name: string }>()
      const rows = useGridRows(core, [{ name: 'Ada' }], {
        onBeforeRowsChange: before,
        onRowsChange: after,
      })
      return (
        <div>
          <span>{rows.rows.map((row) => row.name).join(',')}</span>
          <button type="button" onClick={() => rows.model.commit([{ name: 'Bob' }])}>
            commit
          </button>
          <button type="button" onClick={() => rows.model.sync([{ name: 'Cora' }])}>
            sync
          </button>
        </div>
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button', { name: 'commit' }))
    expect(view.getByText('Bob')).toBeTruthy()
    expect(before).toHaveBeenCalledOnce()
    expect(after).toHaveBeenCalledOnce()

    fireEvent.click(view.getByRole('button', { name: 'sync' }))
    expect(view.getByText('Cora')).toBeTruthy()
    expect(before).toHaveBeenCalledOnce()
    expect(after).toHaveBeenCalledOnce()
    view.unmount()
  })

  it('uses rowKeyField for key-addressed mutations through the React bridge', () => {
    type Row = { id: number; code: string; name: string }
    function Harness() {
      const core = useGridCore<Row>()
      const rows = useGridRows(core, [{ id: 1, code: 'ada', name: 'Ada' }], {
        rowKeyField: 'code',
      })
      return (
        <div>
          <span data-testid="field-rows">{rows.rows.map((row) => row.name).join(',')}</span>
          <button type="button" onClick={() => rows.model.update('ada', { name: 'Alicia' })}>
            update field key
          </button>
          <button type="button" onClick={() => rows.model.remove('ada')}>
            remove field key
          </button>
        </div>
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button', { name: 'update field key' }))
    expect(view.getByTestId('field-rows').textContent).toBe('Alicia')
    fireEvent.click(view.getByRole('button', { name: 'remove field key' }))
    expect(view.getByTestId('field-rows').textContent).toBe('')
    view.unmount()
  })

  it('uses getRowKey for computed key mutations through the React bridge', () => {
    type Row = { id: number; code: string; name: string }
    function Harness() {
      const core = useGridCore<Row>()
      const rows = useGridRows(core, [{ id: 1, code: 'ada', name: 'Ada' }], {
        getRowKey: (row, index) => `${row.code}:${index}`,
      })
      return (
        <div>
          <span data-testid="computed-rows">{rows.rows.map((row) => row.name).join(',')}</span>
          <button type="button" onClick={() => rows.model.update('ada:0', { name: 'Alicia' })}>
            update computed key
          </button>
          <button type="button" onClick={() => rows.model.remove('ada:0')}>
            remove computed key
          </button>
        </div>
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button', { name: 'update computed key' }))
    expect(view.getByTestId('computed-rows').textContent).toBe('Alicia')
    fireEvent.click(view.getByRole('button', { name: 'remove computed key' }))
    expect(view.getByTestId('computed-rows').textContent).toBe('')
    view.unmount()
  })

  it('routes nested row mutations through tree accessors', () => {
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    function Harness() {
      const core = useGridCore<TreeRow>()
      const rows = useGridRows(
        core,
        [{ id: 1, name: 'Root', children: [{ id: 2, name: 'Child' }] }],
        { getChildren: (row) => row.children },
      )
      return (
        <div>
          <span data-testid="tree-child">{rows.rows[0]?.children?.[0]?.name ?? ''}</span>
          <button type="button" onClick={() => rows.model.update(2, { name: 'Updated' })}>
            update nested
          </button>
          <button type="button" onClick={() => rows.model.remove(2)}>
            remove nested
          </button>
        </div>
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button', { name: 'update nested' }))
    expect(view.getByTestId('tree-child').textContent).toBe('Updated')
    fireEvent.click(view.getByRole('button', { name: 'remove nested' }))
    expect(view.getByTestId('tree-child').textContent).toBe('')
    view.unmount()
  })
})

describe('useGridPagination', () => {
  it('bridges controlled proxy state and resets the page when pageSize changes', () => {
    const onChange = vi.fn()
    function Harness({ page, pageSize }: { page: number; pageSize: number }) {
      const core = useGridCore()
      const pagination = useGridPagination(core, { page, pageSize, total: 101, onChange })
      return (
        <button type="button" onClick={() => pagination.setPageSize(50)}>
          {pagination.pagination.page}/{pagination.pagination.pageSize}/
          {pagination.pagination.total}
        </button>
      )
    }

    const view = render(<Harness page={3} pageSize={25} />)
    fireEvent.click(view.getByRole('button'))

    expect(view.getByRole('button').textContent).toBe('3/25/101')
    expect(onChange).toHaveBeenLastCalledWith({ page: 1, pageSize: 50, reason: 'pageSize' })
    view.unmount()
  })
})

describe('composed Grid features', () => {
  it('loads rows, selection, expansion, sorting, filtering, and pagination into one core', () => {
    const onExpand = vi.fn()
    let seenCore: GridCore | undefined
    function Harness() {
      const core = useGridCore()
      seenCore = core
      const rows = useGridRows(core, [{ name: 'b' }, { name: 'a' }])
      const selection = useGridSelection(core, { defaultValue: ['selected'] })
      const expansion = useGridExpansion(core, { defaultValue: ['open'], onChange: onExpand })
      const sorting = useGridSorting(core, rows.rows, {
        leafColumns: [{ key: 'name', sortable: true }],
        defaultSort: { key: 'name', direction: 'asc' },
      })
      const filtering = useGridFiltering(core, sorting.sortedData, {
        columns: [{ key: 'name' }],
        getValue: (row, column) => row[column.key],
        defaultFilters: { name: 'a' },
      })
      const pagination = useGridPagination(core, { defaultPageSize: 25, defaultTotal: 51 })
      return (
        <button
          type="button"
          onClick={() => {
            expansion.model.toggle('next')
            pagination.setPage(2)
          }}
        >
          {selection.selection.join(',')}|{expansion.expandedKeys.join(',')}|
          {filtering.filteredData.map((row) => row.name).join(',')}|{pagination.pagination.page}
        </button>
      )
    }

    const view = render(<Harness />)
    expect(seenCore?.features).toEqual([
      'rows',
      'selection',
      'expansion',
      'sorting',
      'filtering',
      'pagination',
    ])
    fireEvent.click(view.getByRole('button'))

    expect(view.getByRole('button').textContent).toBe('selected|open,next|a|2')
    expect(onExpand).toHaveBeenLastCalledWith(['open', 'next'])
    view.unmount()
  })
})
