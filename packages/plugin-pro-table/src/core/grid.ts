import {
  createUndoStack,
  diffRows,
  memoizedFormulaValue,
  toCsv,
  toHtml,
  toJson,
  toSpreadsheetXml,
  type FormulaTables,
  type RowDiff,
  type TableExportColumn,
} from '@iris-ui-kit/core'
import type { GridFeature, GridMethod, GridRowsTransaction } from '@iris-ui-kit/core/grid'

export interface GridExportData<Row extends Record<string, unknown>> {
  readonly rows: readonly Row[]
  readonly columns: readonly TableExportColumn[]
}
interface GridExportObservers {
  readonly onExport?: (event: GridExportComplete) => void
}
export type GridExportFeatureOptions<Row extends Record<string, unknown>> = GridExportObservers &
  (
    | {
        /** One lazy snapshot prevents rows and columns being derived twice. */
        readonly getData: () => GridExportData<Row>
        readonly getRows?: never
        readonly getColumns?: never
      }
    | {
        /** Backward-compatible split sources for independently stored rows/columns. */
        readonly getRows: () => readonly Row[]
        readonly getColumns: () => readonly TableExportColumn[]
        readonly getData?: never
      }
  )
export type GridExportFormat = 'csv' | 'json' | 'excel-xml' | 'html'
export interface GridExportComplete {
  readonly format: GridExportFormat
  readonly rowCount: number
  readonly columnCount: number
}
export const GRID_EXPORT_COMPLETE_EVENT = 'export:complete'
export interface GridExportMethods {
  exportCsv(): string
  exportJson(options?: { pretty?: boolean }): string
  exportExcelXml(sheetName?: string): string
  exportHtml(options?: { caption?: string; alignNumbers?: boolean }): string
}

/** Optional B-layer export feature; serializers remain framework-agnostic. */
export function createGridExportFeature<Row extends Record<string, unknown>>(
  options: GridExportFeatureOptions<Row>,
): GridFeature<Row> {
  return {
    name: 'export',
    setup(context) {
      const data = (): GridExportData<Row> =>
        typeof options.getData === 'function'
          ? options.getData()
          : { rows: options.getRows(), columns: options.getColumns() }
      const run = (
        format: GridExportFormat,
        serialize: (snapshot: GridExportData<Row>) => string,
      ): string => {
        const snapshot = data()
        const output = serialize(snapshot)
        const event: GridExportComplete = {
          format,
          rowCount: snapshot.rows.length,
          columnCount: snapshot.columns.length,
        }
        options.onExport?.(event)
        context.emit(GRID_EXPORT_COMPLETE_EVENT, event)
        return output
      }
      const methods: GridExportMethods = {
        exportCsv: () => run('csv', ({ rows, columns }) => toCsv(rows, columns)),
        exportJson: (exportOptions) =>
          run('json', ({ rows, columns }) => toJson(rows, columns, exportOptions)),
        exportExcelXml: (sheetName) =>
          run('excel-xml', ({ rows, columns }) => toSpreadsheetXml(rows, columns, { sheetName })),
        exportHtml: (htmlOptions) =>
          run('html', ({ rows, columns }) => toHtml(rows, columns, htmlOptions)),
      }
      return { methods: methods as unknown as Readonly<Record<string, GridMethod>> }
    },
  }
}

export interface GridPersistenceStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}
export interface GridPersistenceFeatureOptions<State> {
  key: string
  storage: GridPersistenceStorage
  getState: () => State
  applyState: (state: State) => void
  validate?: (value: unknown) => value is State
  /** Restore once when the Grid Core enters ready; default true for legacy parity. */
  restoreOnReady?: boolean
}
export interface GridPersistenceMethods {
  saveState(): boolean
  restoreState(): boolean
  resetState(): boolean
}
export const GRID_PERSISTENCE_CHANGE_EVENT = 'persistence:change'

/** Optional persistence feature. Storage failures are deliberately fail-inert. */
export function createGridPersistenceFeature<Row extends Record<string, unknown>, State>(
  options: GridPersistenceFeatureOptions<State>,
): GridFeature<Row> {
  return {
    name: 'persistence',
    setup(context) {
      const read = (): State | undefined => {
        try {
          const raw = options.storage.getItem(options.key)
          if (!raw) return undefined
          const parsed: unknown = JSON.parse(raw)
          return options.validate && !options.validate(parsed) ? undefined : (parsed as State)
        } catch {
          return undefined
        }
      }
      const methods: GridPersistenceMethods = {
        saveState() {
          try {
            options.storage.setItem(options.key, JSON.stringify(options.getState()))
            context.emit(GRID_PERSISTENCE_CHANGE_EVENT, { type: 'save' })
            return true
          } catch {
            return false
          }
        },
        restoreState() {
          const state = read()
          if (state === undefined) return false
          options.applyState(state)
          context.emit(GRID_PERSISTENCE_CHANGE_EVENT, { type: 'restore' })
          return true
        },
        resetState() {
          try {
            if (options.storage.removeItem) options.storage.removeItem(options.key)
            else options.storage.setItem(options.key, '')
            context.emit(GRID_PERSISTENCE_CHANGE_EVENT, { type: 'reset' })
            return true
          } catch {
            return false
          }
        },
      }
      return {
        methods: methods as unknown as Readonly<Record<string, GridMethod>>,
        onReady: () => {
          if (options.restoreOnReady !== false) methods.restoreState()
        },
      }
    },
  }
}

export interface GridHistoryFeatureOptions<Row extends Record<string, unknown>> {
  /**
   * Optional legacy snapshot source. When omitted, the feature reads the
   * standard `rows` capability directly (`getData`).
   */
  getRows?: () => readonly Row[]
  /**
   * Optional legacy write-back hook. When omitted, undo/redo commits through
   * the standard `rows` capability (`setRows`), keeping the mutation boundary
   * inside Grid Core.
   */
  setRows?: (rows: Row[]) => void | boolean
  maxHistory?: number
}
export interface GridHistoryMethods {
  canUndo(): boolean
  canRedo(): boolean
  undo(): boolean
  redo(): boolean
  clearHistory(): void
  getHistoryDepth(): number
}
export const GRID_HISTORY_CHANGE_EVENT = 'history:change'

/** Row-snapshot history composed over the core rows feature. */
export function createGridHistoryFeature<Row extends Record<string, unknown>>(
  options: GridHistoryFeatureOptions<Row>,
): GridFeature<Row> {
  return {
    name: 'history',
    dependsOn: ['rows'],
    setup(context) {
      const readRows = (): readonly Row[] =>
        options.getRows?.() ??
        (context.core.hasMethod('getData')
          ? context.core.invoke<Row[]>('getData')
          : context.core.invoke<Row[]>('getRows'))
      const writeRows = (rows: readonly Row[]): boolean => {
        if (options.setRows) {
          // Preserve the old adapter hook's void return contract while letting
          // newer callers report a rejected write explicitly.
          return options.setRows(cloneAuditRows(rows)) !== false
        }
        return context.core.invoke<boolean>('setRows', cloneAuditRows(rows), { reason: 'history' })
      }
      const stack = createUndoStack<readonly Row[]>({
        initial: cloneAuditRows(readRows()),
        maxHistory: options.maxHistory,
      })
      let replaying = false
      const emit = () =>
        context.emit(GRID_HISTORY_CHANGE_EVENT, {
          canUndo: stack.canUndo(),
          canRedo: stack.canRedo(),
        })
      const offRows = context.on<GridRowsTransaction<Row>>('rows:change', (tx) => {
        if (replaying) return
        stack.push(cloneAuditRows(tx.rows))
        emit()
      })
      const apply = (rows: readonly Row[], recover: () => void): boolean => {
        replaying = true
        try {
          const applied = writeRows(rows)
          if (!applied) {
            recover()
            return false
          }
          return true
        } catch (error) {
          recover()
          throw error
        } finally {
          replaying = false
          emit()
        }
      }
      const methods: GridHistoryMethods = {
        canUndo: () => stack.canUndo(),
        canRedo: () => stack.canRedo(),
        undo: () => {
          const rows = stack.undo()
          return rows === undefined ? false : apply(rows, () => stack.redo())
        },
        redo: () => {
          const rows = stack.redo()
          return rows === undefined ? false : apply(rows, () => stack.undo())
        },
        clearHistory: () => {
          stack.clear()
          stack.push(cloneAuditRows(readRows()))
          emit()
        },
        getHistoryDepth: () => stack.depth,
      }
      return {
        methods: methods as unknown as Readonly<Record<string, GridMethod>>,
        dispose: offRows,
      }
    },
  }
}

export interface GridAuditEntry<Row extends Record<string, unknown>> {
  before: readonly Row[]
  after: readonly Row[]
  diff: RowDiff
  at: number
}
export interface GridAuditFeatureOptions {
  rowKeyField: string
  maxEntries?: number
}
export interface GridAuditMethods<Row extends Record<string, unknown>> {
  getAuditEntries(): readonly GridAuditEntry<Row>[]
  clearAudit(): void
}
export const GRID_AUDIT_CHANGE_EVENT = 'audit:change'

function cloneAuditSnapshot<Value>(value: Value): Value {
  if (typeof globalThis.structuredClone === 'function') {
    try {
      return globalThis.structuredClone(value)
    } catch {
      // Functions and other host values are not structured-cloneable. Keep the
      // audit boundary non-throwing and still detach the containing object.
    }
  }
  if (Array.isArray(value)) return [...value] as Value
  if (value !== null && typeof value === 'object') {
    return { ...(value as Record<string, unknown>) } as Value
  }
  return value
}

function cloneAuditRows<Row extends Record<string, unknown>>(rows: readonly Row[]): Row[] {
  return rows.map((row) => cloneAuditSnapshot(row))
}

function cloneAuditDiff(diff: RowDiff): RowDiff {
  return {
    status: new Map(diff.status),
    cellChanges: new Map(
      [...diff.cellChanges].map(([rowKey, changes]) => [
        rowKey,
        new Map(
          [...changes].map(([columnKey, change]) => [
            columnKey,
            {
              ...change,
              oldValue: cloneAuditSnapshot(change.oldValue),
              newValue: cloneAuditSnapshot(change.newValue),
            },
          ]),
        ),
      ]),
    ),
    added: [...diff.added],
    removed: [...diff.removed],
    changed: [...diff.changed],
  }
}

/** Optional row-diff audit observer; it never mutates the rows feature. */
export function createGridAuditFeature<Row extends Record<string, unknown>>(
  options: GridAuditFeatureOptions,
): GridFeature<Row> {
  return {
    name: 'audit',
    dependsOn: ['rows'],
    setup(context) {
      const entries: GridAuditEntry<Row>[] = []
      const max = options.maxEntries ?? 200
      const offRows = context.on<GridRowsTransaction<Row>>('rows:change', (tx) => {
        const before = cloneAuditRows(tx.previousRows)
        const after = cloneAuditRows(tx.rows)
        entries.unshift({
          before,
          after,
          diff: diffRows(before, after, options.rowKeyField),
          at: Date.now(),
        })
        if (max > 0) entries.length = Math.min(entries.length, max)
        context.emit(GRID_AUDIT_CHANGE_EVENT, { depth: entries.length })
      })
      const methods: GridAuditMethods<Row> = {
        getAuditEntries: () =>
          entries.map((entry) => ({
            before: cloneAuditRows(entry.before),
            after: cloneAuditRows(entry.after),
            diff: cloneAuditDiff(entry.diff),
            at: entry.at,
          })),
        clearAudit: () => {
          entries.length = 0
          context.emit(GRID_AUDIT_CHANGE_EVENT, { depth: 0 })
        },
      }
      return {
        methods: methods as unknown as Readonly<Record<string, GridMethod>>,
        dispose: offRows,
      }
    },
  }
}

export interface GridFormulaFeatureOptions {
  tables?: FormulaTables
}
export interface GridFormulaMethods<Row extends Record<string, unknown>> {
  evaluateFormula(formula: string, row: Row): unknown
}

/** Optional formula method feature; formula evaluation remains core pure logic. */
export function createGridFormulaFeature<Row extends Record<string, unknown>>(
  options: GridFormulaFeatureOptions = {},
): GridFeature<Row> {
  return {
    name: 'formula',
    setup() {
      const methods: GridFormulaMethods<Row> = {
        evaluateFormula: (formula, row) => memoizedFormulaValue(formula, row, options.tables),
      }
      return { methods: methods as unknown as Readonly<Record<string, GridMethod>> }
    },
  }
}

export * from './grid-views'
export * from './grid-query'
export type { FormulaTables, RowDiff, TableExportColumn }
