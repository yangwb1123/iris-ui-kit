import { createStore, type Store } from './store'
export interface CellEditTarget<Key extends string | number = string> {
  rowKey: Key
  columnKey: string
}

export interface CellEditState<Key extends string | number = string> {
  editing: CellEditTarget<Key> | null
  /** Draft value while an edit session is open. */
  draft: unknown
  /** Validation error message for the current draft; null when valid/unknown. */
  error: string | null
  /** Coerced value of the last successful validation (used by consumers to
   *  render the committed representation before commit actually runs). */
  validated: unknown
}

export interface CreateCellEditOptions<Key extends string | number = string> {
  /**
   * Apply a committed value. Receives the active edit target + the coerced
   * value; resolve the column/row, mutate your data, and fire your own change
   * callback here. Runs synchronously BEFORE the editing state is cleared.
   * Not called when nothing is being edited or validation failed.
   */
  onCommit?: (target: CellEditTarget<Key>, value: unknown) => void
  /**
   * Validate a draft before commit. Return an error message to REJECT (the
   * session stays open, `getError()` reports it); null/undefined to accept.
   * Receives the raw draft and the target.
   */
  validate?: (
    draft: unknown,
    target: CellEditTarget<Key>,
  ) => string | null | undefined | Promise<string | null | undefined>
  /**
   * Coerce a raw draft into the committed value (e.g. string → number for a
   * number editor). Runs after validation passes; the result is passed to
   * `onCommit` and stored as `validated`.
   */
  coerce?: (draft: unknown, target: CellEditTarget<Key>) => unknown
}

export interface CellEdit<Key extends string | number = string> {
  store: Store<CellEditState<Key>>
  /** The cell being edited, or null. */
  getEditing(): CellEditTarget<Key> | null
  /** Whether this exact cell is the one being edited. */
  isEditing(rowKey: Key, columnKey: string): boolean
  /** The current draft value (while editing). */
  getDraft(): unknown
  /** Validation error of the current draft, or null. */
  getError(): string | null
  /** The coerced value of the last successful validation. */
  getValidated(): unknown
  /** Open the editor on a cell with an initial draft (replaces any current
   *  edit; clears error/validated state). */
  startEdit(rowKey: Key, columnKey: string, initialDraft?: unknown): void
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

export function createCellEdit<Key extends string | number = string>(
  options: CreateCellEditOptions<Key> = {},
): CellEdit<Key> {
  const store = createStore<CellEditState<Key>>({
    editing: null,
    draft: '',
    error: null,
    validated: undefined,
  })

  // Monotonic session generation (batch K review fix): bumped on start/cancel/
  // commit so an in-flight async commit can detect it was cancelled or
  // superseded while its validation promise was pending — Escape during an
  // async-pending commit must NOT write the value back ("Escape cancels all").
  let sessionGen = 0

  const validateDraft = (
    draft: unknown,
    target: CellEditTarget<Key>,
  ): string | null | undefined | Promise<string | null | undefined> => {
    if (!options.validate) return null
    return options.validate(draft, target) ?? null
  }

  const commitAsync = async (
    draft: unknown,
    target: CellEditTarget<Key>,
    validation: string | null | undefined | Promise<string | null | undefined>,
  ): Promise<boolean> => {
    const gen = ++sessionGen
    const error = (await validation) as string | null | undefined
    if (gen !== sessionGen) return false // cancelled / restarted / superseded
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
      sessionGen++ // a new session supersedes any pending async commit
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
      sessionGen++ // drop any in-flight async commit (Escape cancels all)
      store.setState({ editing: null, draft: '', error: null, validated: undefined })
    },

    commitEdit(value) {
      const target = store.getState().editing
      if (!target) return false
      const draft = value !== undefined ? value : store.getState().draft
      const error = validateDraft(draft, target) as
        string | null | undefined | Promise<string | null | undefined>
      if (error && typeof (error as Promise<unknown>).then === 'function') {
        void commitAsync(draft, target, error)
        return false
      }
      if (error) {
        store.setState((prev) => ({ ...prev, error: error as string }))
        return false
      }
      const coerced = options.coerce ? options.coerce(draft, target) : draft
      sessionGen++ // a landed commit supersedes any pending async commit
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
