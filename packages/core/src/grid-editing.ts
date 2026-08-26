import { createCellEdit, type CellEdit, type CellEditState, type CellEditTarget } from './cell-edit'
import { validateEditRules, validateEditRulesAsync, type EditRules } from './edit-rules'
import type { GridFeature, GridMethod } from './grid'
import type { GridRowsCommitOptions, GridRowsModel } from './grid-rows'

export type GridEditingKey = string | number

export interface GridEditingCommit<Row extends Record<string, unknown>> {
  readonly rowKey: GridEditingKey
  readonly columnKey: string
  readonly rowIndex: number
  readonly row: Row
  readonly nextRow: Row
  readonly oldValue: unknown
  readonly value: unknown
}

export interface GridEditingValidation {
  readonly rowKey: GridEditingKey
  readonly columnKey: string
  readonly valid: boolean
  /** True only when the validation was requested by commitCellEdit(). */
  readonly commit: boolean
}

export interface GridEditingFeatureOptions<Row extends Record<string, unknown>> {
  readonly getRowKey: (row: Row, index: number) => GridEditingKey
  /** Resolve the adapter's current visible index for a nested row, if any. */
  readonly getRowIndex?: (
    rowKey: GridEditingKey,
    row: Row,
    rootRows: readonly Row[],
  ) => number | undefined
  readonly getRules?: (columnKey: string) => EditRules<Row> | undefined
  readonly getValue?: (row: Row, columnKey: string) => unknown
  readonly setValue?: (row: Row, columnKey: string, value: unknown) => Row
  readonly coerce?: (draft: unknown, row: Row, columnKey: string) => unknown
  readonly validate?: (
    value: unknown,
    row: Row,
    columnKey: string,
  ) => string | null | undefined | Promise<string | null | undefined>
  readonly isEditable?: (row: Row, columnKey: string) => boolean
  readonly missingRowMessage?: string
  /** Adapter-owned transaction context forwarded to the rows feature. */
  readonly commitOptions?: GridRowsCommitOptions | (() => GridRowsCommitOptions)
  readonly onStateChange?: (state: CellEditState<GridEditingKey>) => void
  readonly onValidation?: (validation: GridEditingValidation) => void
  readonly onCommit?: (commit: GridEditingCommit<Row>) => void
}

export interface GridEditingBindings<Row extends Record<string, unknown>> {
  getRows(): Row[]
  setRows(rows: Row[], options?: GridRowsCommitOptions): boolean
  /** Resolve rows that are not direct members of the root list (tree mode). */
  findRow?(rowKey: GridEditingKey): Row | undefined
  /** Replace a resolved row through the rows feature's key-addressed path. */
  setRow?(
    rowKey: GridEditingKey,
    nextRow: Row,
    previousRow: Row,
    options?: GridRowsCommitOptions,
  ): boolean
}

export interface GridEditingModel extends CellEdit<GridEditingKey> {
  getState(): CellEditState<GridEditingKey>
  start(rowKey: GridEditingKey, columnKey: string, initialDraft?: unknown): boolean
  destroy(): void
}

export interface GridEditingMethods {
  getEditingModel(): GridEditingModel
  getEditingState(): CellEditState<GridEditingKey>
  startCellEdit(rowKey: GridEditingKey, columnKey: string, initialDraft?: unknown): boolean
  setCellDraft(value: unknown): void
  cancelCellEdit(): void
  commitCellEdit(value?: unknown): boolean
  isCellEditing(rowKey: GridEditingKey, columnKey: string): boolean
}

export const GRID_EDITING_CHANGE_EVENT = 'editing:change'
export const GRID_EDITING_COMMIT_EVENT = 'editing:commit'

function cloneEditingState(state: CellEditState<GridEditingKey>): CellEditState<GridEditingKey> {
  return {
    ...state,
    editing: state.editing ? { ...state.editing } : null,
  }
}

function defaultGetValue<Row extends Record<string, unknown>>(
  row: Row,
  columnKey: string,
): unknown {
  return row[columnKey]
}

function defaultSetValue<Row extends Record<string, unknown>>(
  row: Row,
  columnKey: string,
  value: unknown,
): Row {
  return { ...row, [columnKey]: value }
}

class GridEditingModelEngine<Row extends Record<string, unknown>> implements GridEditingModel {
  readonly store: CellEdit<GridEditingKey>['store']
  private readonly controller: CellEdit<GridEditingKey>
  private readonly unsubscribe: () => void
  private commitValidationPending = false

  constructor(
    private readonly options: GridEditingFeatureOptions<Row>,
    private readonly bindings: GridEditingBindings<Row>,
    emitState?: (state: CellEditState<GridEditingKey>) => void,
    private readonly emitCommit?: (commit: GridEditingCommit<Row>) => void,
  ) {
    this.controller = createCellEdit<GridEditingKey>({
      validate: (draft, target) => this.validateDraft(draft, target),
      coerce: (draft, target) => this.coerceDraft(draft, target),
      onCommit: (target, value) => this.applyCommit(target, value),
    })
    this.store = this.controller.store
    this.unsubscribe = this.store.subscribe((state) => {
      this.options.onStateChange?.(cloneEditingState(state))
      emitState?.(cloneEditingState(state))
    })
  }

  private findRow(
    target: CellEditTarget<GridEditingKey>,
  ): { rows: Row[]; row: Row; rowIndex: number; nested: boolean } | null {
    const rows = this.bindings.getRows()
    const rowIndex = rows.findIndex((row, index) =>
      Object.is(this.options.getRowKey(row, index), target.rowKey),
    )
    if (rowIndex >= 0) return { rows, row: rows[rowIndex]!, rowIndex, nested: false }
    const nested = this.bindings.findRow?.(target.rowKey)
    if (!nested) return null
    // The adapter's visible projection may use a different index (sorting,
    // filtering, expansion). Let it resolve that callback-facing index while
    // keeping the source lookup key authoritative. A missing resolver retains
    // the explicit "not a root row" marker for framework-neutral consumers.
    return {
      rows,
      row: nested,
      rowIndex: this.options.getRowIndex?.(target.rowKey, nested, rows) ?? -1,
      nested: true,
    }
  }

  private coerceDraft(draft: unknown, target: CellEditTarget<GridEditingKey>): unknown {
    const found = this.findRow(target)
    if (!found || !this.options.coerce) return draft
    return this.options.coerce(draft, found.row, target.columnKey)
  }

  private validateCustom(
    draft: unknown,
    target: CellEditTarget<GridEditingKey>,
    found: { row: Row },
  ): string | null | undefined | Promise<string | null | undefined> {
    if (!this.options.validate) return null
    const value = this.options.coerce
      ? this.options.coerce(draft, found.row, target.columnKey)
      : draft
    return this.options.validate(value, found.row, target.columnKey) ?? null
  }

  private reportValidation(
    target: CellEditTarget<GridEditingKey>,
    error: string | null | undefined,
    commit: boolean,
  ): string | null | undefined {
    this.options.onValidation?.({
      rowKey: target.rowKey,
      columnKey: target.columnKey,
      valid: !error,
      commit,
    })
    return error
  }

  private finishCustomValidation(
    draft: unknown,
    target: CellEditTarget<GridEditingKey>,
    found: { row: Row },
    commit: boolean,
  ): string | null | undefined | Promise<string | null | undefined> {
    const result = this.validateCustom(draft, target, found)
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      return (result as Promise<string | null | undefined>).then((error) =>
        this.reportValidation(target, error, commit),
      )
    }
    return this.reportValidation(target, result as string | null | undefined, commit)
  }

  private validateDraft(
    draft: unknown,
    target: CellEditTarget<GridEditingKey>,
  ): string | null | undefined | Promise<string | null | undefined> {
    const commit = this.commitValidationPending
    this.commitValidationPending = false
    const found = this.findRow(target)
    if (!found) {
      return this.reportValidation(
        target,
        this.options.missingRowMessage ?? 'The edited row no longer exists',
        commit,
      )
    }
    if (this.options.isEditable && !this.options.isEditable(found.row, target.columnKey)) {
      return this.reportValidation(target, 'This cell is not editable', commit)
    }
    const rules = this.options.getRules?.(target.columnKey)
    if (!rules?.length) return this.finishCustomValidation(draft, target, found, commit)
    // Keep the common built-in rule path synchronous. Apart from avoiding an
    // unnecessary microtask, this preserves the adapter contract that a
    // required/unique/pattern failure is observable immediately after Enter.
    // Custom validators may be asynchronous, so retain the async path when a
    // rule supplies one.
    if (!rules.some((rule) => rule.validator)) {
      const result = validateEditRules(rules, draft, found.row, false, {
        rows: found.rows,
        columnKey: target.columnKey,
      })
      const error = this.reportValidation(target, result.messages[0] ?? null, commit)
      // Keep successful declarative-rule commits on the async contract used
      // by the historical adapter path; only failures need to be surfaced
      // synchronously so the editor can paint its error in the same turn.
      return error ? error : Promise.resolve(null)
    }
    return validateEditRulesAsync(rules, draft, found.row, false, {
      rows: found.rows,
      columnKey: target.columnKey,
    }).then((result) => {
      if (!result.valid) {
        return this.reportValidation(target, result.messages[0] ?? 'Value is invalid', commit)
      }
      return this.finishCustomValidation(draft, target, found, commit)
    })
  }

  private applyCommit(target: CellEditTarget<GridEditingKey>, value: unknown): void {
    const found = this.findRow(target)
    if (!found) return
    const getValue = this.options.getValue ?? defaultGetValue
    const oldValue = getValue(found.row, target.columnKey)
    if (Object.is(oldValue, value)) return
    const setValue = this.options.setValue ?? defaultSetValue
    const nextRow = setValue(found.row, target.columnKey, value)
    if (Object.is(nextRow, found.row)) return
    const nextRows = [...found.rows]
    const configuredOptions =
      typeof this.options.commitOptions === 'function'
        ? this.options.commitOptions()
        : this.options.commitOptions
    const commitOptions = { reason: 'cell-edit', ...configuredOptions }
    let changed = false
    if (this.bindings.setRow && found.nested) {
      changed = this.bindings.setRow(target.rowKey, nextRow, found.row, commitOptions)
    } else {
      // Legacy custom bindings only know how to replace root rows. Do not
      // accidentally assign to `rows[-1]` when a nested lookup was supplied
      // without its matching path-aware setter.
      if (found.rowIndex < 0) return
      nextRows[found.rowIndex] = nextRow
      changed = this.bindings.setRows(nextRows, commitOptions)
    }
    if (!changed) return
    const commit: GridEditingCommit<Row> = {
      rowKey: target.rowKey,
      columnKey: target.columnKey,
      rowIndex: found.rowIndex,
      row: found.row,
      nextRow,
      oldValue,
      value,
    }
    this.options.onCommit?.(commit)
    this.emitCommit?.(commit)
  }

  getState(): CellEditState<GridEditingKey> {
    return cloneEditingState(this.store.getState())
  }

  getEditing(): CellEditTarget<GridEditingKey> | null {
    const editing = this.controller.getEditing()
    return editing ? { ...editing } : null
  }

  isEditing(rowKey: GridEditingKey, columnKey: string): boolean {
    return this.controller.isEditing(rowKey, columnKey)
  }

  getDraft(): unknown {
    return this.controller.getDraft()
  }

  getError(): string | null {
    return this.controller.getError()
  }

  getValidated(): unknown {
    return this.controller.getValidated()
  }

  start(rowKey: GridEditingKey, columnKey: string, initialDraft?: unknown): boolean {
    const found = this.findRow({ rowKey, columnKey })
    if (!found || (this.options.isEditable && !this.options.isEditable(found.row, columnKey))) {
      return false
    }
    const draft =
      initialDraft === undefined
        ? (this.options.getValue ?? defaultGetValue)(found.row, columnKey)
        : initialDraft
    this.controller.startEdit(rowKey, columnKey, draft)
    return true
  }

  startEdit(rowKey: GridEditingKey, columnKey: string, initialDraft?: unknown): void {
    this.start(rowKey, columnKey, initialDraft)
  }

  setDraft(value: unknown): void {
    this.controller.setDraft(value)
  }

  cancelEdit(): void {
    this.controller.cancelEdit()
  }

  commitEdit(value?: unknown): boolean {
    this.commitValidationPending = true
    try {
      return this.controller.commitEdit(value)
    } finally {
      this.commitValidationPending = false
    }
  }

  destroy(): void {
    this.unsubscribe()
    this.controller.cancelEdit()
  }
}

export function createGridEditingModel<Row extends Record<string, unknown>>(
  options: GridEditingFeatureOptions<Row>,
  bindings: GridEditingBindings<Row>,
  emitState?: (state: CellEditState<GridEditingKey>) => void,
  emitCommit?: (commit: GridEditingCommit<Row>) => void,
): GridEditingModel {
  return new GridEditingModelEngine(options, bindings, emitState, emitCommit)
}

/** Built-in cell-editing capability composed over the standard rows transaction source. */
export function createGridEditingFeature<Row extends Record<string, unknown>>(
  options: GridEditingFeatureOptions<Row>,
): GridFeature<Row> {
  return {
    name: 'editing',
    dependsOn: ['rows'],
    setup(context) {
      const rows = context.core.invoke<GridRowsModel<Row>>('getRowsModel')
      const model = createGridEditingModel(
        options,
        {
          getRows: () => context.core.invoke<Row[]>('getRows'),
          setRows: (nextRows, commitOptions) =>
            context.core.invoke<boolean>('setRows', nextRows, commitOptions),
          findRow: (rowKey) => rows.find(rowKey),
          setRow: (rowKey, nextRow, previousRow, commitOptions) => {
            const patch: Partial<Row> = {}
            for (const key of Object.keys(nextRow) as Array<keyof Row>) {
              if (!Object.is(nextRow[key], previousRow[key])) patch[key] = nextRow[key]
            }
            return rows.update(rowKey, patch, commitOptions)
          },
        },
        (state) => context.emit(GRID_EDITING_CHANGE_EVENT, state),
        (commit) => context.emit(GRID_EDITING_COMMIT_EVENT, commit),
      )
      const methods: GridEditingMethods = {
        getEditingModel: () => model,
        getEditingState: () => model.getState(),
        startCellEdit: (rowKey, columnKey, initialDraft) =>
          model.start(rowKey, columnKey, initialDraft),
        setCellDraft: (value) => model.setDraft(value),
        cancelCellEdit: () => model.cancelEdit(),
        commitCellEdit: (value) => model.commitEdit(value),
        isCellEditing: (rowKey, columnKey) => model.isEditing(rowKey, columnKey),
      }
      return {
        methods: methods as unknown as Readonly<Record<string, GridMethod>>,
        dispose: () => model.destroy(),
      }
    },
  }
}
