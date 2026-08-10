import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IrisTable, type IrisTableColumn } from '../index'

afterEach(cleanup)

interface Row {
  id: number
  name: string
  age: number
  children?: Row[]
  [key: string]: unknown
}

/** Two editable columns (text + number) and one plain column. */
const rowCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true, editor: 'number' },
  { key: 'note', title: 'Note' }, // not editable — never gets an editor
]
const rows: Row[] = [{ id: 1, name: 'alice', age: 30, note: 'x' }]
const twoRows: Row[] = [
  { id: 1, name: 'alice', age: 30, note: 'x' },
  { id: 2, name: 'bob', age: 40, note: 'y' },
]

function rowEl(id: number): HTMLElement {
  return document.querySelector(`[data-iris-table-row="${id}"]`) as HTMLElement
}
function cellEl(id: number, colKey: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${id}"] [data-iris-table-cell="${colKey}"]`,
  ) as HTMLElement
}
function editorIn(id: number, colKey: string): HTMLElement | null {
  return document.querySelector(
    `[data-iris-table-row="${id}"] [data-iris-table-cell="${colKey}"] [data-iris-table-editor]`,
  )
}

describe('@iris-ui-kit/react IrisTable row edit mode (vxe editConfig.mode="row", batch K)', () => {
  it('clicking a cell opens every editable column; Enter commits only that column; Escape cancels the row', () => {
    const onCellEdit = vi.fn()
    render(
      <IrisTable
        columns={rowCols}
        data={rows}
        rowKey="id"
        editConfig={{ mode: 'row' }}
        onCellEdit={onCellEdit}
      />,
    )
    // A plain click on any cell of an editable row starts whole-row editing.
    act(() => {
      fireEvent.click(cellEl(1, 'note'))
    })
    expect(editorIn(1, 'name')).not.toBeNull()
    expect(editorIn(1, 'age')).not.toBeNull()
    // The non-editable column renders normally (no editor).
    expect(editorIn(1, 'note')).toBeNull()
    // The row is marked as editing (token-driven highlight).
    expect(rowEl(1).getAttribute('data-iris-row-editing')).toBe('true')

    // Typing in one editor and pressing Enter commits THAT column only.
    act(() => {
      fireEvent.change(editorIn(1, 'name')!, { target: { value: 'alice2' } })
      fireEvent.keyDown(editorIn(1, 'name')!, { key: 'Enter' })
    })
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        column: expect.objectContaining({ key: 'name' }),
        newValue: 'alice2',
      }),
    )
    // The committed column's editor closed; the row is still editing with the
    // other columns open (per-cell commit, no auto-commit of the rest).
    expect(editorIn(1, 'name')).toBeNull()
    expect(editorIn(1, 'age')).not.toBeNull()
    expect(rowEl(1).getAttribute('data-iris-row-editing')).toBe('true')
    // The cell shows the committed value.
    expect(cellEl(1, 'name').textContent).toContain('alice2')

    // Escape cancels the WHOLE row: every remaining editor closes, drafts are
    // discarded, the row leaves edit mode.
    act(() => {
      fireEvent.change(editorIn(1, 'age')!, { target: { value: '99' } })
      fireEvent.keyDown(editorIn(1, 'age')!, { key: 'Escape' })
    })
    expect(editorIn(1, 'age')).toBeNull()
    expect(rowEl(1).getAttribute('data-iris-row-editing')).toBeNull()
    // The discarded age draft was never committed.
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    expect(cellEl(1, 'age').textContent).toContain('30')
  })

  it('committing the last open column leaves row edit mode; clicking reopens the row', () => {
    const onCellEdit = vi.fn()
    render(
      <IrisTable
        columns={rowCols}
        data={rows}
        rowKey="id"
        editConfig={{ mode: 'row' }}
        onCellEdit={onCellEdit}
      />,
    )
    act(() => {
      fireEvent.click(cellEl(1, 'name'))
    })
    act(() => {
      fireEvent.keyDown(editorIn(1, 'name')!, { key: 'Enter' })
      fireEvent.keyDown(editorIn(1, 'age')!, { key: 'Enter' })
    })
    // Both columns committed → the row is no longer editing.
    expect(editorIn(1, 'name')).toBeNull()
    expect(editorIn(1, 'age')).toBeNull()
    expect(rowEl(1).getAttribute('data-iris-row-editing')).toBeNull()
    // Clicking the row again starts a fresh whole-row edit.
    act(() => {
      fireEvent.click(cellEl(1, 'age'))
    })
    expect(editorIn(1, 'name')).not.toBeNull()
    expect(editorIn(1, 'age')).not.toBeNull()
    expect(rowEl(1).getAttribute('data-iris-row-editing')).toBe('true')
  })

  it('clicking another row commits the current row edits and opens the new row', () => {
    const onCellEdit = vi.fn()
    render(
      <IrisTable
        columns={rowCols}
        data={twoRows}
        rowKey="id"
        editConfig={{ mode: 'row' }}
        onCellEdit={onCellEdit}
      />,
    )
    act(() => {
      fireEvent.click(cellEl(1, 'name'))
    })
    act(() => {
      fireEvent.change(editorIn(1, 'name')!, { target: { value: 'alice2' } })
    })
    // Click a cell of the other row: the current row's open editors commit
    // (vxe click-elsewhere-commits parity), then the new row starts editing.
    act(() => {
      fireEvent.click(cellEl(2, 'note'))
    })
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        column: expect.objectContaining({ key: 'name' }),
        newValue: 'alice2',
      }),
    )
    expect(cellEl(1, 'name').textContent).toContain('alice2')
    expect(rowEl(1).getAttribute('data-iris-row-editing')).toBeNull()
    expect(rowEl(2).getAttribute('data-iris-row-editing')).toBe('true')
    expect(editorIn(2, 'name')).not.toBeNull()
    expect(editorIn(2, 'age')).not.toBeNull()
  })

  it('a sync validation failure keeps the row open with the error visible', () => {
    const validated: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        validate: (v) => (String(v).length >= 3 ? null : 'too short'),
      },
      { key: 'age', title: 'Age', editable: true, editor: 'number' },
    ]
    render(
      <IrisTable columns={validated} data={twoRows} rowKey="id" editConfig={{ mode: 'row' }} />,
    )
    act(() => {
      fireEvent.click(cellEl(1, 'name'))
    })
    act(() => {
      fireEvent.change(editorIn(1, 'name')!, { target: { value: 'x' } })
      fireEvent.click(cellEl(2, 'age'))
    })
    // The rejected commit blocks the row switch — the error stays visible.
    expect(rowEl(1).getAttribute('data-iris-row-editing')).toBe('true')
    expect(editorIn(1, 'name')).not.toBeNull()
    expect(document.querySelector('[data-iris-table-editor-error]')?.textContent).toContain(
      'too short',
    )
    expect(rowEl(2).getAttribute('data-iris-row-editing')).toBeNull()
  })

  it('Escape cancels a row whose async commit is pending without writing it back', async () => {
    const onCellEdit = vi.fn()
    const asyncRowCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [{ validator: (v) => Promise.resolve(v === 'ok' ? null : 'must be ok') }],
      },
      { key: 'age', title: 'Age', editable: true, editor: 'number' },
    ]
    render(
      <IrisTable
        columns={asyncRowCols}
        data={rows}
        rowKey="id"
        editConfig={{ mode: 'row' }}
        onCellEdit={onCellEdit}
      />,
    )
    act(() => {
      fireEvent.click(cellEl(1, 'age'))
    })
    act(() => {
      // Tab on the async-validated column starts a pending commit and moves
      // focus to the next editor; Escape then cancels the WHOLE row while the
      // validation promise is still in flight.
      fireEvent.change(editorIn(1, 'name')!, { target: { value: 'ok' } })
      fireEvent.keyDown(editorIn(1, 'name')!, { key: 'Tab' })
    })
    act(() => {
      fireEvent.keyDown(editorIn(1, 'age')!, { key: 'Escape' })
    })
    expect(rowEl(1).getAttribute('data-iris-row-editing')).toBeNull()
    await act(async () => {})
    // Neither the pending name commit nor anything else was written back.
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(cellEl(1, 'name').textContent).toContain('alice')
  })
})

describe('@iris-ui-kit/react IrisTable M1 fix: async editRules + Tab navigation (batch K)', () => {
  const asyncCols: IrisTableColumn<Row>[] = [
    {
      key: 'name',
      title: 'Name',
      editable: true,
      editRules: [{ validator: (v) => Promise.resolve(v === 'ok' ? null : 'must be ok') }],
    },
    { key: 'age', title: 'Age', editable: true, editor: 'number' },
  ]

  function openCell(colKey: string): void {
    fireEvent.doubleClick(
      document.querySelector(`[data-iris-table-row="1"] [data-iris-table-cell="${colKey}"]`)!,
    )
  }
  function editor(): HTMLElement | null {
    return document.querySelector('[data-iris-table-editor]')
  }

  it('Tab with a pending async validation moves to the next column when it resolves', async () => {
    const onCellEdit = vi.fn()
    const { container } = render(
      <IrisTable columns={asyncCols} data={rows} rowKey="id" onCellEdit={onCellEdit} />,
    )
    act(() => {
      openCell('name')
    })
    expect(editor()).not.toBeNull()
    act(() => {
      fireEvent.change(editor()!, { target: { value: 'ok' } })
      fireEvent.keyDown(editor()!, { key: 'Tab' })
    })
    // The async validation settles → the stashed Tab intent executes.
    await act(async () => {})
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        column: expect.objectContaining({ key: 'name' }),
        newValue: 'ok',
      }),
    )
    const next = container.querySelector(
      '[data-iris-table-row="1"] [data-iris-table-cell="age"] [data-iris-table-editor]',
    )
    expect(next).not.toBeNull()
    expect(next).toBe(editor())
  })

  it('Tab with a rejected async validation stays in the cell with the error', async () => {
    const onCellEdit = vi.fn()
    const { container } = render(
      <IrisTable columns={asyncCols} data={rows} rowKey="id" onCellEdit={onCellEdit} />,
    )
    act(() => {
      openCell('name')
    })
    act(() => {
      fireEvent.change(editor()!, { target: { value: 'bad' } })
      fireEvent.keyDown(editor()!, { key: 'Tab' })
    })
    await act(async () => {})
    // Rejected → the pending nav is dropped: still editing the same cell with
    // the error message visible, nothing committed, no move to `age`.
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(
      container.querySelector(
        '[data-iris-table-row="1"] [data-iris-table-cell="name"] [data-iris-table-editor]',
      ),
    ).not.toBeNull()
    expect(document.querySelector('[data-iris-table-editor-error]')?.textContent).toContain(
      'must be ok',
    )
    expect(
      container.querySelector(
        '[data-iris-table-row="1"] [data-iris-table-cell="age"] [data-iris-table-editor]',
      ),
    ).toBeNull()
  })

  it('Escape during a pending async validation cancels the commit (no write-back)', async () => {
    const onCellEdit = vi.fn()
    const { container } = render(
      <IrisTable columns={asyncCols} data={rows} rowKey="id" onCellEdit={onCellEdit} />,
    )
    act(() => {
      openCell('name')
    })
    act(() => {
      fireEvent.change(editor()!, { target: { value: 'ok' } })
      // Tab starts the async commit (pending) and stashes the nav intent.
      fireEvent.keyDown(editor()!, { key: 'Tab' })
    })
    // Escape while the validation promise is still in flight — the session is
    // cancelled, so the value must NOT be written back when it resolves.
    act(() => {
      fireEvent.keyDown(editor()!, { key: 'Escape' })
    })
    expect(editor()).toBeNull()
    await act(async () => {})
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(
      container.querySelector('[data-iris-table-row="1"] [data-iris-table-cell="name"]')
        ?.textContent,
    ).toContain('alice')
  })
})

describe('@iris-ui-kit/react IrisTable M2 fix: lazy-tree cache drops on data refresh (batch K)', () => {
  const cols: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Name' },
    { key: 'age', title: 'Age' },
  ]
  function caretOf(id: number): HTMLButtonElement | null {
    return document.querySelector(`[data-iris-table-row="${id}"] [data-iris-table-tree-toggle]`)
  }

  it('a new data reference drops cached lazy children so fresh getSubRows children render', () => {
    const lazyLoad = vi.fn((_row: Row, load: (children: Row[]) => void) => {
      load([{ id: 2, name: 'old child', age: 2 }])
    })
    function Harness({ data }: { data: Row[] }) {
      return (
        <IrisTable
          columns={cols}
          data={data}
          rowKey="id"
          getSubRows={(r) => r.children}
          lazyLoad={lazyLoad}
        />
      )
    }
    const { rerender } = render(<Harness data={[{ id: 1, name: 'root', age: 1 }]} />)
    act(() => {
      fireEvent.click(caretOf(1)!)
    })
    expect(document.querySelector('[data-iris-table-row="2"]')).not.toBeNull()
    expect(lazyLoad).toHaveBeenCalledTimes(1)

    // The parent re-feeds a NEW data array — the cached children belong to the
    // previous rows and must be dropped.
    rerender(
      <Harness
        data={[{ id: 1, name: 'root', age: 1, children: [{ id: 7, name: 'fresh', age: 7 }] }]}
      />,
    )
    expect(document.querySelector('[data-iris-table-row="2"]')).toBeNull()
    expect(document.querySelector('[data-iris-table-row="7"]')).not.toBeNull()
  })

  it('a refreshed lazy row is a lazy leaf again and reloads its children on expand', () => {
    const lazyLoad = vi.fn((_row: Row, load: (children: Row[]) => void) => {
      load([{ id: 2, name: 'child', age: 2 }])
    })
    function Harness({ data }: { data: Row[] }) {
      return (
        <IrisTable
          columns={cols}
          data={data}
          rowKey="id"
          getSubRows={(r) => r.children}
          lazyLoad={lazyLoad}
        />
      )
    }
    const { rerender } = render(<Harness data={[{ id: 1, name: 'root', age: 1 }]} />)
    act(() => {
      fireEvent.click(caretOf(1)!)
    })
    expect(document.querySelector('[data-iris-table-row="2"]')).not.toBeNull()
    expect(lazyLoad).toHaveBeenCalledTimes(1)

    // New data reference with the same (childless) shape — the cache is gone,
    // so the row is a lazy leaf again with a caret.
    rerender(<Harness data={[{ id: 1, name: 'root', age: 1 }]} />)
    expect(document.querySelector('[data-iris-table-row="2"]')).toBeNull()
    expect(caretOf(1)).not.toBeNull()

    // Expanding re-fetches (fresh cache) and the new children render.
    act(() => {
      fireEvent.click(caretOf(1)!)
    })
    expect(lazyLoad).toHaveBeenCalledTimes(2)
    act(() => {
      fireEvent.click(caretOf(1)!)
    })
    expect(document.querySelector('[data-iris-table-row="2"]')).not.toBeNull()
  })

  it('an in-flight lazyLoad resolving after a data refresh does not re-seed the cache', () => {
    let pending: ((children: Row[]) => void) | null = null
    const lazyLoad = vi.fn((_row: Row, load: (children: Row[]) => void) => {
      pending = load
    })
    function Harness({ data }: { data: Row[] }) {
      return (
        <IrisTable
          columns={cols}
          data={data}
          rowKey="id"
          getSubRows={(r) => r.children}
          lazyLoad={lazyLoad}
        />
      )
    }
    const { rerender } = render(<Harness data={[{ id: 1, name: 'root', age: 1 }]} />)
    act(() => {
      fireEvent.click(caretOf(1)!)
    })
    expect(lazyLoad).toHaveBeenCalledTimes(1)
    expect(pending).not.toBeNull()

    // The parent refreshes the data WHILE the fetch is in flight: the root
    // now has fresh children via getSubRows. Expanding it (it is a plain
    // parent again) renders the fresh child.
    rerender(
      <Harness
        data={[{ id: 1, name: 'root', age: 1, children: [{ id: 7, name: 'fresh', age: 7 }] }]}
      />,
    )
    act(() => {
      fireEvent.click(caretOf(1)!)
    })
    expect(document.querySelector('[data-iris-table-row="7"]')).not.toBeNull()

    // The stale fetch resolves AFTER the refresh — it must not re-seed the
    // cleared cache with its old children (nor collapse the expanded row).
    act(() => {
      pending!([{ id: 2, name: 'stale child', age: 2 }])
    })
    expect(document.querySelector('[data-iris-table-row="2"]')).toBeNull()
    expect(document.querySelector('[data-iris-table-row="7"]')).not.toBeNull()
  })
})
