import { describe, expect, it, vi } from 'vitest'
import { createGridCore, createGridRowsFeature } from '@iris-ui-kit/core/grid'
import {
  createGridAuditFeature,
  createGridExportFeature,
  createGridFormulaFeature,
  createGridHistoryFeature,
  createGridPersistenceFeature,
  GRID_PERSISTENCE_CHANGE_EVENT,
  GRID_HISTORY_CHANGE_EVENT,
  createGridViewsFeature,
  GRID_EXPORT_COMPLETE_EVENT,
  GRID_VIEWS_CHANGE_EVENT,
  type GridExportComplete,
  type GridViewsChange,
  type GridViewsModel,
} from './grid'

type Row = { id: number; name: string; score: number }
const columns = [
  { key: 'id', title: 'ID' },
  { key: 'name', title: 'Name' },
]

type ViewSnapshot = { sort?: null; filter?: string }

function makeRows() {
  return [
    { id: 1, name: 'Ada', score: 10 },
    { id: 2, name: 'Lin', score: 20 },
  ] satisfies Row[]
}

describe('plugin-pro-table GridFeature capabilities', () => {
  it('exports the current rows and columns through core serializers', () => {
    const rows = makeRows()
    const onExport = vi.fn()
    const grid = createGridCore<Row>({
      features: [
        createGridExportFeature({ getRows: () => rows, getColumns: () => columns, onExport }),
      ],
    })
    const events: GridExportComplete[] = []
    grid.on<GridExportComplete>(GRID_EXPORT_COMPLETE_EVENT, (event) => events.push(event))

    expect(grid.invoke<string>('exportCsv')).toContain('ID,Name')
    expect(JSON.parse(grid.invoke<string>('exportJson'))).toEqual([
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Lin' },
    ])
    expect(grid.invoke<string>('exportExcelXml')).toContain('<Worksheet')
    expect(grid.invoke<string>('exportHtml')).toContain('<table')
    expect(onExport).toHaveBeenCalledTimes(4)
    expect(events.map((event) => event.format)).toEqual(['csv', 'json', 'excel-xml', 'html'])
    expect(events[0]).toEqual({ format: 'csv', rowCount: 2, columnCount: 2 })
  })

  it('derives one rows + columns snapshot per export method call', () => {
    const getData = vi.fn(() => ({ rows: makeRows(), columns }))
    const grid = createGridCore<Row>({ features: [createGridExportFeature({ getData })] })

    expect(grid.invoke<string>('exportCsv')).toContain('Ada')
    expect(getData).toHaveBeenCalledTimes(1)
  })

  it('saves, restores and resets injected persistence without touching global storage', () => {
    const values = new Map<string, string>()
    let state = { page: 1, filter: '' }
    const grid = createGridCore<Row>({
      features: [
        createGridPersistenceFeature<Row, typeof state>({
          key: 'grid',
          storage: {
            getItem: (key) => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
            removeItem: (key) => values.delete(key),
          },
          getState: () => state,
          applyState: (next) => {
            state = next
          },
        }),
      ],
    })

    state = { page: 3, filter: 'Ada' }
    expect(grid.invoke<boolean>('saveState')).toBe(true)
    state = { page: 1, filter: '' }
    expect(grid.invoke<boolean>('restoreState')).toBe(true)
    expect(state).toEqual({ page: 3, filter: 'Ada' })
    expect(grid.invoke<boolean>('resetState')).toBe(true)
    expect(grid.invoke<boolean>('restoreState')).toBe(false)
  })

  it('resets persistence with only getItem/setItem storage by writing an absent sentinel', () => {
    const values = new Map<string, string>()
    let state = { page: 1 }
    const grid = createGridCore<Row>({
      features: [
        createGridPersistenceFeature<Row, typeof state>({
          key: 'grid',
          storage: {
            getItem: (key) => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
          },
          getState: () => state,
          applyState: (next) => {
            state = next
          },
        }),
      ],
    })
    const events: Array<{ type: string }> = []
    grid.on<{ type: string }>(GRID_PERSISTENCE_CHANGE_EVENT, (event) => events.push(event))

    expect(grid.invoke<boolean>('saveState')).toBe(true)
    expect(values.get('grid')).toBe(JSON.stringify({ page: 1 }))
    expect(grid.invoke<boolean>('resetState')).toBe(true)
    expect(values.get('grid')).toBe('')
    expect(grid.invoke<boolean>('restoreState')).toBe(false)
    expect(events).toEqual([{ type: 'save' }, { type: 'reset' }])
  })

  it('keeps persistence storage failures fail-inert', () => {
    const grid = createGridCore<Row>({
      features: [
        createGridPersistenceFeature<Row, { page: number }>({
          key: 'grid',
          storage: {
            getItem: () => {
              throw new Error('denied')
            },
            setItem: () => {
              throw new Error('quota')
            },
          },
          getState: () => ({ page: 1 }),
          applyState: () => {},
        }),
      ],
    })
    const events: Array<{ type: string }> = []
    grid.on<{ type: string }>(GRID_PERSISTENCE_CHANGE_EVENT, (event) => events.push(event))

    expect(grid.invoke<boolean>('saveState')).toBe(false)
    expect(grid.invoke<boolean>('restoreState')).toBe(false)
    expect(grid.invoke<boolean>('resetState')).toBe(false)
    expect(events).toEqual([])
  })

  it('records row changes once and provides undo/redo plus cell-level audit', () => {
    const rows = makeRows()
    let currentRows = rows
    const grid = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({ defaultRows: rows }),
        createGridHistoryFeature<Row>({
          getRows: () => currentRows,
          setRows: (next) => {
            currentRows = next
            grid.invoke('setRows', next)
          },
        }),
        createGridAuditFeature<Row>({ rowKeyField: 'id' }),
      ],
    })

    grid.invoke('setRows', [{ ...rows[0], score: 11 }])
    expect(grid.invoke<boolean>('canUndo')).toBe(true)
    expect(grid.invoke<number>('getHistoryDepth')).toBe(2)
    expect(grid.invoke<number>('getAuditEntries').length).toBe(1)
    expect(grid.invoke('getAuditEntries')[0].diff.changed).toEqual([1])

    const auditSnapshot = grid.invoke('getAuditEntries')[0]
    const before = auditSnapshot.before as Row[]
    const changed = auditSnapshot.diff.changed as Array<string | number>
    before.push({ id: 99, name: 'leak', score: 0 })
    changed.push(99)
    expect(grid.invoke('getAuditEntries')[0].before).toHaveLength(2)
    expect(grid.invoke('getAuditEntries')[0].diff.changed).toEqual([1])

    expect(grid.invoke<boolean>('undo')).toBe(true)
    expect(grid.invoke<Row[]>('getRows')).toEqual(rows)
    expect(grid.invoke<boolean>('redo')).toBe(true)
    expect(grid.invoke<Row[]>('getRows')[0].score).toBe(11)
  })

  it('isolates history snapshots from submitted row mutations across undo and redo', () => {
    const rows = makeRows()
    const changed = [{ ...rows[0], score: 11 }, { ...rows[1] }]
    const grid = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({ defaultRows: rows }),
        createGridHistoryFeature<Row>({}),
      ],
    })

    grid.invoke('setRows', changed)
    changed[0]!.score = 99

    expect(grid.invoke<boolean>('undo')).toBe(true)
    expect(grid.invoke<Row[]>('getRows')).toEqual(rows)
    expect(grid.invoke<boolean>('redo')).toBe(true)
    expect(grid.invoke<Row[]>('getRows')[0]!.score).toBe(11)
  })

  it('isolates history snapshots from legacy setRows input mutations', () => {
    const rows = makeRows()
    const grid = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({ defaultRows: rows }),
        createGridHistoryFeature<Row>({
          setRows: (next) => {
            next[0]!.score += 100
            grid.invoke('setRows', next)
          },
        }),
      ],
    })

    grid.invoke('setRows', [{ ...rows[0], score: 11 }, { ...rows[1] }])
    expect(grid.invoke<boolean>('undo')).toBe(true)
    expect(grid.invoke<Row[]>('getRows')[0]!.score).toBe(110)
    expect(grid.invoke<boolean>('redo')).toBe(true)
    expect(grid.invoke<Row[]>('getRows')[0]!.score).toBe(111)
    expect(grid.invoke<boolean>('undo')).toBe(true)
    expect(grid.invoke<Row[]>('getRows')[0]!.score).toBe(110)
    expect(grid.invoke<boolean>('redo')).toBe(true)
    expect(grid.invoke<Row[]>('getRows')[0]!.score).toBe(111)
  })

  it('isolates audit row snapshots from returned entries and submitted rows', () => {
    const rows = makeRows()
    const submitted = [{ ...rows[0], score: 11 }, { ...rows[1] }]
    const grid = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({ defaultRows: rows }),
        createGridAuditFeature<Row>({ rowKeyField: 'id' }),
      ],
    })

    grid.invoke('setRows', submitted)
    const returned = grid.invoke('getAuditEntries')[0]
    ;(returned.before[0] as Row).name = 'returned mutation'
    ;(returned.after[0] as Row).score = 12
    submitted[0]!.score = 99
    submitted[1]!.name = 'submitted mutation'

    const stored = grid.invoke('getAuditEntries')[0]
    expect(stored.before).toEqual(rows)
    expect(stored.after).toEqual([{ ...rows[0], score: 11 }, rows[1]])
    expect(stored.diff.cellChanges.get(1)?.get('score')).toEqual({
      key: 'score',
      oldValue: 10,
      newValue: 11,
    })
  })

  it('uses the rows capability as the default history mutation boundary', () => {
    const rows = makeRows()
    const grid = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({ defaultRows: rows }),
        createGridHistoryFeature<Row>({}),
      ],
    })

    grid.invoke('setRows', [{ ...rows[0], score: 11 }, rows[1]])
    expect(grid.invoke<boolean>('canUndo')).toBe(true)
    expect(grid.invoke<boolean>('undo')).toBe(true)
    expect(grid.invoke<Row[]>('getData')).toEqual(rows)
    expect(grid.invoke<boolean>('redo')).toBe(true)
    expect(grid.invoke<Row[]>('getData')[0]!.score).toBe(11)
  })

  it('restores the history pointer when a legacy rows write is rejected', () => {
    const rows = makeRows()
    const changed = [{ ...rows[0], score: 11 }, rows[1]]
    let acceptWrites = true
    const grid = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({ defaultRows: rows }),
        createGridHistoryFeature<Row>({
          setRows: (next) => {
            if (!acceptWrites) return false
            grid.invoke('setRows', next)
            return true
          },
        }),
      ],
    })
    const events: Array<{ canUndo: boolean; canRedo: boolean }> = []
    grid.on<{ canUndo: boolean; canRedo: boolean }>(GRID_HISTORY_CHANGE_EVENT, (event) =>
      events.push(event),
    )

    grid.invoke('setRows', changed)
    events.length = 0
    acceptWrites = false
    expect(grid.invoke<boolean>('undo')).toBe(false)
    expect(grid.invoke<boolean>('canUndo')).toBe(true)
    expect(grid.invoke<boolean>('canRedo')).toBe(false)

    acceptWrites = true
    expect(grid.invoke<boolean>('undo')).toBe(true)
    acceptWrites = false
    expect(grid.invoke<boolean>('redo')).toBe(false)
    expect(grid.invoke<boolean>('canUndo')).toBe(false)
    expect(grid.invoke<boolean>('canRedo')).toBe(true)
    expect(events).toEqual([
      { canUndo: true, canRedo: false },
      { canUndo: false, canRedo: true },
      { canUndo: false, canRedo: true },
    ])
  })

  it('preserves legacy write errors and restores the history pointer', () => {
    const rows = makeRows()
    const changed = [{ ...rows[0], score: 11 }, rows[1]]
    const failure = new Error('legacy history write failed')
    let writeMode: 'accept' | 'throw' = 'accept'
    const grid = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({ defaultRows: rows }),
        createGridHistoryFeature<Row>({
          setRows: (next) => {
            if (writeMode === 'throw') throw failure
            grid.invoke('setRows', next)
            return true
          },
        }),
      ],
    })

    grid.invoke('setRows', changed)
    writeMode = 'throw'
    let caught: unknown
    try {
      grid.invoke<boolean>('undo')
    } catch (error) {
      caught = error
    }
    expect(caught).toBe(failure)
    expect(grid.invoke<boolean>('canUndo')).toBe(true)
    expect(grid.invoke<boolean>('canRedo')).toBe(false)

    writeMode = 'accept'
    expect(grid.invoke<boolean>('undo')).toBe(true)
    writeMode = 'throw'
    caught = undefined
    try {
      grid.invoke<boolean>('redo')
    } catch (error) {
      caught = error
    }
    expect(caught).toBe(failure)
    expect(grid.invoke<boolean>('canUndo')).toBe(false)
    expect(grid.invoke<boolean>('canRedo')).toBe(true)
  })

  it('exposes formula evaluation as an optional method without adapter dependencies', () => {
    const spy = vi.fn()
    const grid = createGridCore<Row>({ features: [createGridFormulaFeature()] })
    expect(grid.invoke('evaluateFormula', 'score * 2', { id: 1, name: 'Ada', score: 7 })).toBe(14)
    spy(grid.methodNames)
    expect(spy).toHaveBeenCalledWith(['evaluateFormula'])
  })
})
