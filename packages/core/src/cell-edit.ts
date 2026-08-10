import { createStore, type Store } from './store'
export interface CellEditTarget {
  rowKey: string
  columnKey: string
}

export interface CellEditState {
  editing: CellEditTarget | null
  /** Draft value while an edit session is open. */
  draft: unknown
  /** Validation error message for the current draft; null when valid/unknown. */
  error: string | null
  /** Coerced value of the last successful validation (used by consumers to
   *  render the committed representation before commit actually runs). */
  validated: unknown
}

export interface CreateCellEditOptions {
  /**
   * Apply a committed value. Receives the active edit target + the coerced
   * value; resolve the column/row, mutate your data, and fire your own change
   * callback here. Runs synchronously BEFORE the editing state is cleared.
   * Not called when nothing is being edited or validation failed.
   */
  onCommit?: (target: CellEditTarget, value: unknown) => void
  /**
   * Validate a draft before commit. Return an error message to REJECT (the
   * session stays open, `getError()` reports it); null/undefined to accept.
   * Receives the raw draft and the target.
   */
  validate?: (
    draft: unknown,
    target: CellEditTarget,
  ) => string | null | undefined | Promise<string | null | undefined>
  /**
   * Coerce a raw draft into the committed value (e.g. string → number for a
   * number editor). Runs after validation passes; the result is passed to
   * `onCommit` and stored as `validated`.
   */
  coerce?: (draft: unknown, target: CellEditTarget) => unknown
}

export interface CellEdit {
  store: Store<CellEditState>
  /** The cell being edited, or null. */
  getEditing(): CellEditTarget | null
  /** Whether this exact cell is the one being edited. */
  isEditing(rowKey: string, columnKey: string): boolean
  /** The current draft value (while editing). */
  getDraft(): unknown
  /** Validation error of the current draft, or null. */
  getError(): string | null
  /** The coerced value of the last successful validation. */
  getValidated(): unknown
  /** Open the editor on a cell with an initial draft (replaces any current
   *  edit; clears error/validated state). */
  startEdit(rowKey: string, columnKey: string, initialDraft?: unknown): void
  /** Update the draft; re-validates it against the column validator (errors
   *  update live, but only a CLEAN draft can be committed). */
  setDraft(value: unknown): void
  /** Discard the active edit without committing. */
  cancelEdit(): void
  /**
   * Validate + coerce + commit the active draft. Validation failure keeps the
   * session open with `getError()` set. No-op when idle.
   * Returns true when committed, false when rejected.
   * An optional explicit value commits that value (legacy call shape).
   */
  commitEdit(value?: unknown): boolean
}

export function createCellEdit(options: CreateCellEditOptions = {}): CellEdit {
  const store = createStore<CellEditState>({
    editing: null,
    draft: '',
    error: null,
    validated: undefined,
  })

  const validateDraft = (
    draft: unknown,
    target: CellEditTarget,
  ): string | null | undefined | Promise<string | null | undefined> => {
    if (!options.validate) return null
    return options.validate(draft, target) ?? null
  }

  const commitAsync = async (draft: unknown, target: CellEditTarget): Promise<boolean> => {
    const error = (await validateDraft(draft, target)) as string | null | undefined
    if (error) {
      store.setState((prev) => ({ ...prev, error }))
      return false
    }
    const coerced = options.coerce ? options.coerce(draft, target) : draft
    options.onCommit?.(target, coerced)
    store.setState({ editing: null, draft: '', error: null, validated: coerced })
    return true
  }

  return {
    store,
    getEditing: () => store.getState().editing,
    isEditing(rowKey, columnKey) {
      const e = store.getState().editing
      return e !== null && e.rowKey === rowKey && e.columnKey === columnKey
    },
    getDraft: () => store.getState().draft,
    getError: () => store.getState().error,
    getValidated: () => store.getState().validated,

    startEdit(rowKey, columnKey, initialDraft = '') {
      const target = { rowKey, columnKey }
      const err = validateDraft(initialDraft, target)
      store.setState({
        editing: target,
        draft: initialDraft,
        error:
          err && typeof (err as Promise<unknown>).then === 'function'
            ? null
            : (err as string | null),
        validated: undefined,
      })
    },

    setDraft(value) {
      const target = store.getState().editing
      if (!target) return
      const err = validateDraft(value, target) as string | null | Promise<string | null | undefined>
      store.setState((prev) => ({
        ...prev,
        draft: value,
        error:
          err && typeof (err as Promise<unknown>).then === 'function'
            ? null
            : (err as string | null),
      }))
    },

    cancelEdit() {
      store.setState({ editing: null, draft: '', error: null, validated: undefined })
    },

    commitEdit(value) {
      const target = store.getState().editing
      if (!target) return false
      const draft = value !== undefined ? value : store.getState().draft
      const error = validateDraft(draft, target) as
        | string
        | null
        | undefined
        | Promise<string | null | undefined>
      if (error && typeof (error as Promise<unknown>).then === 'function') {
        void commitAsync(draft, target)
        return false
      }
      if (error) {
        store.setState((prev) => ({ ...prev, error: error as string }))
        return false
      }
      const coerced = options.coerce ? options.coerce(draft, target) : draft
      options.onCommit?.(target, coerced)
      store.setState({ editing: null, draft: '', error: null, validated: coerced })
      return true
    },
  }
}

/**
 * Immutably set a cell value in a row list by row key (vxe-grid edit write-back
 * parity). Returns a NEW array; the matching row object is replaced (other
 * rows keep identity). Rows without the key (or missing key field) are
 * returned untouched.
 */
export function setCellValue<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  rowKeyField: string,
  rowKeyValue: string | number,
  columnKey: string,
  value: unknown,
): Row[] {
  const index = rows.findIndex(
    (row) => (row as Record<string, unknown>)[rowKeyField] === rowKeyValue,
  )
  if (index < 0) return rows as Row[]
  return rows.map((row, i) => (i === index ? { ...row, [columnKey]: value } : row))
}
