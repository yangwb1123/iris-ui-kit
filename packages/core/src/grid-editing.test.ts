import { describe, expect, it, vi } from 'vitest'
import {
  createGridCore,
  createGridEditingFeature,
  createGridRowsFeature,
  GRID_EDITING_CHANGE_EVENT,
  GRID_EDITING_COMMIT_EVENT,
  GRID_ROWS_CHANGE_EVENT,
  type GridEditingCommit,
  type GridRowsTransaction,
} from './grid'

type Row = { id: number; name: string; count: number }

const initialRows: Row[] = [
  { id: 1, name: 'Ada', count: 10 },
  { id: 2, name: 'Lin', count: 20 },
]

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  return { promise: new Promise<T>((done) => (resolve = done)), resolve }
}

describe('createGridEditingFeature', () => {
  it('commits through the rows transaction source and emits editing contracts', () => {
    const onStateChange = vi.fn()
    const onCommit = vi.fn()
    const grid = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({ defaultRows: initialRows }),
        createGridEditingFeature<Row>({
          getRowKey: (row) => row.id,
          onStateChange,
          onCommit,
        }),
      ],
    })
    const stateEvents = vi.fn()
    const commitEvents = vi.fn()
    const rowEvents = vi.fn()
    grid.on(GRID_EDITING_CHANGE_EVENT, stateEvents)
    grid.on(GRID_EDITING_COMMIT_EVENT, commitEvents)
    grid.on(GRID_ROWS_CHANGE_EVENT, rowEvents)

    expect(grid.invoke<boolean>('startCellEdit', 1, 'name')).toBe(true)
    expect(grid.invoke('getEditingState')).toMatchObject({
      editing: { rowKey: 1, columnKey: 'name' },
      draft: 'Ada',
      error: null,
    })
    expect(grid.invoke<boolean>('isCellEditing', 1, 'name')).toBe(true)
    grid.invoke('setCellDraft', 'Alicia')
    expect(grid.invoke<boolean>('commitCellEdit')).toBe(true)

    expect(grid.invoke<Row[]>('getRows')).toEqual([
      { id: 1, name: 'Alicia', count: 10 },
      initialRows[1],
    ])
    expect(rowEvents).toHaveBeenCalledWith(
      expect.objectContaining<GridRowsTransaction<Row>>({ reason: 'cell-edit' }),
    )
    const expectedCommit: GridEditingCommit<Row> = {
      rowKey: 1,
      columnKey: 'name',
      rowIndex: 0,
      row: initialRows[0]!,
      nextRow: { id: 1, name: 'Alicia', count: 10 },
      oldValue: 'Ada',
      value: 'Alicia',
    }
    expect(onCommit).toHaveBeenCalledWith(expectedCommit)
    expect(commitEvents).toHaveBeenCalledWith(expectedCommit)
    expect(onStateChange).toHaveBeenCalledTimes(3)
    expect(stateEvents).toHaveBeenCalledTimes(3)
    expect(grid.invoke('getEditingState')).toMatchObject({ editing: null, validated: 'Alicia' })
  })

  it('coerces before custom validation and keeps rejected sessions open', () => {
    const grid = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({ defaultRows: initialRows }),
        createGridEditingFeature<Row>({
          getRowKey: (row) => row.id,
          coerce: (draft) => Number(draft),
          validate: (value) => (typeof value === 'number' && value >= 0 ? null : 'non-negative'),
        }),
      ],
    })

    grid.invoke('startCellEdit', 1, 'count')
    grid.invoke('setCellDraft', '-1')
    expect(grid.invoke('getEditingState')).toMatchObject({ error: 'non-negative' })
    expect(grid.invoke<boolean>('commitCellEdit')).toBe(false)
    expect(grid.invoke<boolean>('isCellEditing', 1, 'count')).toBe(true)

    grid.invoke('setCellDraft', '12')
    expect(grid.invoke('getEditingState')).toMatchObject({ error: null })
    expect(grid.invoke<boolean>('commitCellEdit')).toBe(true)
    expect(grid.invoke<Row[]>('getRows')[0]!.count).toBe(12)
    expect(grid.invoke('getEditingState')).toMatchObject({ editing: null, validated: 12 })
  })

  it('marks commit validation separately from draft validation', () => {
    const validations: Array<{ valid: boolean; commit: boolean }> = []
    const grid = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({ defaultRows: initialRows }),
        createGridEditingFeature<Row>({
          getRowKey: (row) => row.id,
          validate: (value) => (value === 'ok' ? null : 'invalid'),
          onValidation: ({ valid, commit }) => validations.push({ valid, commit }),
        }),
      ],
    })

    grid.invoke('startCellEdit', 1, 'name')
    grid.invoke('setCellDraft', 'bad')
    expect(grid.invoke<boolean>('commitCellEdit')).toBe(false)
    expect(validations.at(-1)).toEqual({ valid: false, commit: true })

    grid.invoke('setCellDraft', 'ok')
    expect(grid.invoke<boolean>('commitCellEdit')).toBe(true)
    expect(validations.at(-1)).toEqual({ valid: true, commit: true })
    expect(validations.some((validation) => !validation.commit)).toBe(true)
  })

  it('runs a custom async validator once per commit and marks it as a commit validation', async () => {
    const validate = vi.fn(() => Promise.resolve(null))
    const validations: Array<{ valid: boolean; commit: boolean }> = []
    const grid = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({ defaultRows: initialRows }),
        createGridEditingFeature<Row>({
          getRowKey: (row) => row.id,
          validate,
          onValidation: ({ valid, commit }) => validations.push({ valid, commit }),
        }),
      ],
    })

    grid.invoke('startCellEdit', 1, 'name')
    grid.invoke('setCellDraft', 'Alicia')
    await vi.waitFor(() => expect(validations).toHaveLength(2))
    validations.length = 0
    validate.mockClear()

    expect(grid.invoke<boolean>('commitCellEdit')).toBe(false)
    await vi.waitFor(() => expect(grid.invoke<Row[]>('getRows')[0]!.name).toBe('Alicia'))

    expect(validate).toHaveBeenCalledTimes(1)
    expect(validations.at(-1)).toEqual({ valid: true, commit: true })
  })

  it('runs declarative async rules with current rows and accepts a later valid draft', async () => {
    const grid = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({ defaultRows: initialRows }),
        createGridEditingFeature<Row>({
          getRowKey: (row) => row.id,
          getRules: (columnKey) =>
            columnKey === 'name' ? [{ required: true }, { unique: true }] : undefined,
        }),
      ],
    })

    grid.invoke('startCellEdit', 2, 'name')
    grid.invoke('setCellDraft', 'Ada')
    expect(grid.invoke<boolean>('commitCellEdit')).toBe(false)
    await vi.waitFor(() =>
      expect(grid.invoke('getEditingState')).toMatchObject({ error: 'Value must be unique' }),
    )
    expect(grid.invoke<Row[]>('getRows')[1]!.name).toBe('Lin')

    grid.invoke('setCellDraft', 'Grace')
    expect(grid.invoke<boolean>('commitCellEdit')).toBe(false)
    await vi.waitFor(() => expect(grid.invoke<Row[]>('getRows')[1]!.name).toBe('Grace'))
    expect(grid.invoke('getEditingState')).toMatchObject({ editing: null, validated: 'Grace' })
  })

  it('drops pending async commits after cancel or disposal', async () => {
    const pending = deferred<string | null>()
    const grid = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({ defaultRows: initialRows }),
        createGridEditingFeature<Row>({
          getRowKey: (row) => row.id,
          validate: () => pending.promise,
        }),
      ],
    })
    const stateEvents = vi.fn()
    grid.on(GRID_EDITING_CHANGE_EVENT, stateEvents)

    grid.invoke('startCellEdit', 1, 'name')
    grid.invoke('setCellDraft', 'late')
    expect(grid.invoke<boolean>('commitCellEdit')).toBe(false)
    grid.invoke('cancelCellEdit')
    pending.resolve(null)
    await pending.promise
    await Promise.resolve()
    expect(grid.invoke<Row[]>('getRows')[0]!.name).toBe('Ada')
    expect(grid.invoke('getEditingState')).toMatchObject({ editing: null, validated: undefined })

    grid.invoke('startCellEdit', 1, 'name')
    const eventCount = stateEvents.mock.calls.length
    grid.destroy()
    expect(stateEvents).toHaveBeenCalledTimes(eventCount)
  })

  it('closes no-op commits without emitting a row or commit transaction', () => {
    const grid = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({ defaultRows: initialRows }),
        createGridEditingFeature<Row>({ getRowKey: (row) => row.id }),
      ],
    })
    const rowsChanged = vi.fn()
    const committed = vi.fn()
    grid.on(GRID_ROWS_CHANGE_EVENT, rowsChanged)
    grid.on(GRID_EDITING_COMMIT_EVENT, committed)

    grid.invoke('startCellEdit', 1, 'name')
    expect(grid.invoke<boolean>('commitCellEdit')).toBe(true)
    expect(rowsChanged).not.toHaveBeenCalled()
    expect(committed).not.toHaveBeenCalled()
    expect(grid.invoke('getEditingState')).toMatchObject({ editing: null, validated: 'Ada' })
  })

  it('resolves and commits a nested tree row through the rows path', () => {
    type TreeRow = Row & { children?: TreeRow[] }
    const child: TreeRow = { id: 2, name: 'Lin', count: 20 }
    const root: TreeRow = { id: 1, name: 'Ada', count: 10, children: [child] }
    const onCommit = vi.fn()
    const grid = createGridCore<TreeRow>({
      features: [
        createGridRowsFeature<TreeRow>({
          defaultRows: [root],
          getRowKey: (row) => row.id,
          getChildren: (row) => row.children,
        }),
        createGridEditingFeature<TreeRow>({
          getRowKey: (row) => row.id,
          getRowIndex: (rowKey) => (rowKey === 2 ? 4 : undefined),
          getValue: (row, columnKey) => row[columnKey],
          setValue: (row, columnKey, value) => ({ ...row, [columnKey]: value }),
          onCommit,
        }),
      ],
    })

    expect(grid.invoke<boolean>('startCellEdit', 2, 'name')).toBe(true)
    grid.invoke('setCellDraft', 'Updated')
    expect(grid.invoke<boolean>('commitCellEdit')).toBe(true)

    const next = grid.invoke<TreeRow[]>('getRows')
    expect(next[0]?.children?.[0]).toEqual({ id: 2, name: 'Updated', count: 20 })
    expect(next[0]).not.toBe(root)
    expect(root.children?.[0]).toBe(child)
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ rowKey: 2, rowIndex: 4, oldValue: 'Lin', value: 'Updated' }),
    )
  })

  it('rejects locked, missing, and removed rows and enforces the rows dependency', () => {
    const grid = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({ defaultRows: initialRows }),
        createGridEditingFeature<Row>({
          getRowKey: (row) => row.id,
          isEditable: (row, columnKey) => row.id !== 2 && columnKey !== 'id',
          missingRowMessage: 'gone',
        }),
      ],
    })

    expect(grid.invoke<boolean>('startCellEdit', 2, 'name')).toBe(false)
    expect(grid.invoke<boolean>('startCellEdit', 1, 'id')).toBe(false)
    expect(grid.invoke<boolean>('startCellEdit', 99, 'name')).toBe(false)
    expect(grid.invoke<boolean>('startCellEdit', 1, 'name')).toBe(true)
    grid.invoke('syncRows', [])
    expect(grid.invoke<boolean>('commitCellEdit', 'new')).toBe(false)
    expect(grid.invoke('getEditingState')).toMatchObject({ error: 'gone' })

    expect(() =>
      createGridCore<Row>({
        features: [createGridEditingFeature<Row>({ getRowKey: (row) => row.id })],
      }),
    ).toThrow('requires missing feature "rows"')
  })
})
