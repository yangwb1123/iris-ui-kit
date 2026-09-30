import * as React from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GRID_ROWS_CHANGE_EVENT, type GridCore, type GridRowsModel } from '@iris-ui-kit/core/grid'
import { useGridCore } from './useGridCore'
import { useGridRows } from './useGridRows'

describe('useGridRows', () => {
  it.each([undefined, false] as const)(
    'keeps mutable row snapshots detached across commits and silent sync (%s)',
    (cloneDefaultRows) => {
      type Row = { id: number; name: string }
      const initialRows = [{ id: 1, name: 'Ada' }]
      const committedRows = [{ id: 2, name: 'Bea' }]
      const synchronizedRows = [{ id: 3, name: 'Cora' }]
      const before = vi.fn()
      const after = vi.fn()
      let core!: GridCore<Row>
      let bridge!: { model: GridRowsModel<Row>; rows: Row[] }

      function Harness() {
        core = useGridCore<Row>()
        bridge = useGridRows(core, initialRows, {
          cloneDefaultRows,
          onBeforeRowsChange: before,
          onRowsChange: after,
        })
        return null
      }

      const view = render(<Harness />)
      const storeObserver = vi.fn()
      const rowEvent = vi.fn()
      const unsubscribeStore = bridge.model.store.subscribe(storeObserver)
      const unsubscribeEvent = core.on(GRID_ROWS_CHANGE_EVENT, rowEvent)
      before.mockReset()
      after.mockReset()

      const initialSnapshot = bridge.rows
      expect(initialSnapshot).not.toBe(bridge.model.store.getState())
      initialSnapshot.push({ id: 99, name: 'local' })
      initialSnapshot.splice(0, 1)
      expect(bridge.model.get()).toEqual(initialRows)
      expect(core.invoke<Row[]>('getRows')).toEqual(initialRows)
      expect(bridge.model.store.getState()).toEqual(initialRows)
      expect(storeObserver).not.toHaveBeenCalled()
      expect(before).not.toHaveBeenCalled()
      expect(after).not.toHaveBeenCalled()
      expect(rowEvent).not.toHaveBeenCalled()

      act(() => bridge.model.commit(committedRows))
      expect(bridge.rows).toEqual(committedRows)
      expect(bridge.rows).not.toBe(bridge.model.store.getState())
      expect(bridge.rows[0]).toBe(committedRows[0])
      expect(storeObserver).toHaveBeenCalledOnce()
      expect(before).toHaveBeenCalledOnce()
      expect(after).toHaveBeenCalledOnce()
      expect(rowEvent).toHaveBeenCalledOnce()

      const committedSnapshot = bridge.rows
      committedSnapshot.push({ id: 100, name: 'local' })
      committedSnapshot.splice(0, 1)
      expect(bridge.model.get()).toEqual(committedRows)
      expect(core.invoke<Row[]>('getRows')).toEqual(committedRows)
      expect(bridge.model.store.getState()).toEqual(committedRows)
      expect(storeObserver).toHaveBeenCalledOnce()
      expect(before).toHaveBeenCalledOnce()
      expect(after).toHaveBeenCalledOnce()
      expect(rowEvent).toHaveBeenCalledOnce()

      act(() => bridge.model.sync(synchronizedRows))
      expect(bridge.rows).toEqual(synchronizedRows)
      expect(bridge.rows).not.toBe(bridge.model.store.getState())
      expect(bridge.model.get()).toEqual(synchronizedRows)
      expect(core.invoke<Row[]>('getRows')).toEqual(synchronizedRows)
      expect(storeObserver).toHaveBeenCalledTimes(2)
      expect(before).toHaveBeenCalledOnce()
      expect(after).toHaveBeenCalledOnce()
      expect(rowEvent).toHaveBeenCalledOnce()

      unsubscribeStore()
      unsubscribeEvent()
      view.unmount()
    },
  )

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

  it('uses replacement tree callbacks without recreating the rows model', () => {
    type TreeRow = {
      id: number
      name: string
      a?: TreeRow[]
      b?: TreeRow[]
    }
    type TreeOptions = {
      getChildren: (row: TreeRow) => readonly TreeRow[] | undefined
      setChildren: (row: TreeRow, children: TreeRow[]) => TreeRow
    }
    const initialRows: TreeRow[] = [
      {
        id: 1,
        name: 'Root',
        a: [{ id: 2, name: 'A' }],
        b: [{ id: 3, name: 'B' }],
      },
    ]
    const getChildrenA = vi.fn((row: TreeRow) => row.a)
    const getChildrenB = vi.fn((row: TreeRow) => row.b)
    const setChildrenA = vi.fn((row: TreeRow, children: TreeRow[]) => ({ ...row, a: children }))
    const setChildrenB = vi.fn((row: TreeRow, children: TreeRow[]) => ({ ...row, b: children }))
    let setOptions!: React.Dispatch<React.SetStateAction<TreeOptions>>
    let bridge!: { model: GridRowsModel<TreeRow> }

    function Harness({ options }: { options: TreeOptions }) {
      const core = useGridCore<TreeRow>()
      bridge = useGridRows(core, initialRows, options)
      return null
    }
    function Parent() {
      const [options, updateOptions] = React.useState<TreeOptions>({
        getChildren: getChildrenA,
        setChildren: setChildrenA,
      })
      setOptions = updateOptions
      return <Harness options={options} />
    }

    const view = render(<Parent />)
    const model = bridge.model
    getChildrenA.mockClear()
    setChildrenA.mockClear()

    act(() => setOptions({ getChildren: getChildrenB, setChildren: setChildrenA }))
    expect(bridge.model).toBe(model)
    expect(model.find(3)).toMatchObject({ id: 3, name: 'B' })
    expect(model.find(2)).toBeUndefined()
    expect(getChildrenA).not.toHaveBeenCalled()
    getChildrenB.mockClear()
    setChildrenA.mockClear()

    act(() =>
      setOptions({
        getChildren: getChildrenB,
        setChildren: setChildrenB,
      }),
    )

    expect(bridge.model).toBe(model)
    expect(model.find(3)).toMatchObject({ id: 3, name: 'B' })
    expect(model.find(2)).toBeUndefined()
    expect(getChildrenA).not.toHaveBeenCalled()

    expect(model.update(3, { name: 'Updated' })).toBe(true)
    expect(model.find(3)).toMatchObject({ id: 3, name: 'Updated' })
    expect(setChildrenB).toHaveBeenCalledOnce()
    expect(setChildrenA).not.toHaveBeenCalled()

    const replacement = [{ id: 4, name: 'Replacement' }]
    expect(model.setChildren(1, replacement)).toBe(true)
    expect(model.get()[0]?.b).toEqual(replacement)
    expect(setChildrenB).toHaveBeenCalledTimes(2)
    expect(setChildrenA).not.toHaveBeenCalled()
    expect(getChildrenA).not.toHaveBeenCalled()
    view.unmount()
  })
})
