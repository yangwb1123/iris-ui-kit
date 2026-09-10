import { createStore } from './store'
import type { EditValidationSource } from './edit-rules'
import {
  createTableRowEditValidator,
  isPromiseLike,
  rejectedValidationMessage,
  validationOutcome,
  type ValidationOutcome,
} from './table-row-edit-validation'
import { createTableRowEditSession } from './table-row-edit-sessions'
import type {
  TableRowEditKey,
  TableRowEditModel,
  TableRowEditOptions,
  TableRowEditSession,
  TableRowEditState,
} from './table-row-edit-types'

interface AttemptToken {
  readonly generation: number
  readonly epoch: number
}

interface PendingAttempt<Row, Column, Key extends TableRowEditKey> {
  readonly id: string
  readonly token: AttemptToken
  /** Incremented by cancelAll/dispose, including cancellation from a callback. */
  readonly cancellationEpoch: number
  readonly row: Row
  readonly column: Column
  readonly rowKey: Key
  readonly rowIndex: number
  readonly oldValue: unknown
  readonly newValue: unknown
  /** Whether a current source row existed when the attempt started. */
  readonly sourceTracked: boolean
  /** Fallback channel for an unexpectedly rejected thenable. */
  readonly validationSource: EditValidationSource
  detached: boolean
  cancelled: boolean
}

export function createTableRowEditModel<Row, Column, Key extends TableRowEditKey = TableRowEditKey>(
  options: TableRowEditOptions<Row, Column, Key>,
): TableRowEditModel<Row, Column, Key> {
  const store = createStore<TableRowEditState<Row, Column, Key>>({
    active: null,
    sessions: new Map(),
  })

  let generation = 0
  let cancellationEpoch = 0
  let disposed = false
  const pendingAttempts = new Set<PendingAttempt<Row, Column, Key>>()

  const sessionId = (key: Key, column: Column): string =>
    options.getSessionId?.(key, column) ?? `${String(key)}::${options.getColumnKey(column)}`

  /** Resolve the adapter's authoritative source row. An explicitly supplied
   * `findRow` is a hard boundary: `undefined` means the keyed row is gone and
   * must not fall back to a captured session row. */
  const currentSourceRow = (key: Key): Row | undefined => {
    if (options.findRow) return options.findRow(key)
    const rows = options.getRows()
    return rows.find((row, index) => Object.is(options.getRowKey(row, index), key))
  }

  const resolveRow = (key: Key, fallback: Row): { row: Row | undefined; tracked: boolean } => {
    const found = currentSourceRow(key)
    if (found !== undefined) return { row: found, tracked: true }
    // Without an explicit resolver, preserve the legacy direct-model contract
    // for callers that open a row not present in their optional row snapshot.
    // Such a row is untracked; async commits cannot claim source identity when
    // the caller did not expose a source row to compare against.
    return options.findRow ? { row: undefined, tracked: true } : { row: fallback, tracked: false }
  }

  const sourceIsCurrent = (key: Key, row: Row, tracked: boolean): boolean => {
    const current = currentSourceRow(key)
    if (current === undefined) return !options.findRow && !tracked
    return Object.is(current, row)
  }

  const replaceSession = (
    id: string,
    nextSession: TableRowEditSession<Row, Column, Key>,
  ): boolean => {
    const current = store.getState()
    if (!current.sessions.has(id)) return false
    const sessions = new Map(current.sessions)
    sessions.set(id, nextSession)
    store.setState({ active: current.active, sessions })
    return true
  }

  const isCurrent = (id: string, token: AttemptToken): boolean => {
    if (disposed || generation !== token.generation) return false
    const current = store.getState().sessions.get(id)
    return current !== undefined && current.epoch === token.epoch
  }

  const setAttemptError = (id: string, token: AttemptToken, error: string | null): boolean => {
    if (!isCurrent(id, token)) return false
    const current = store.getState().sessions.get(id)
    if (!current) return false
    return replaceSession(id, { ...current, error, pending: false })
  }

  const beginAttempt = (
    id: string,
    session: TableRowEditSession<Row, Column, Key>,
  ): AttemptToken | null => {
    const current = store.getState().sessions.get(id)
    if (disposed || current !== session || session.pending) return null
    const token: AttemptToken = { generation, epoch: session.epoch + 1 }
    replaceSession(id, { ...session, epoch: token.epoch, error: null, pending: true })
    return token
  }

  const rejectAttempt = (
    id: string,
    session: TableRowEditSession<Row, Column, Key>,
    error: string,
  ): boolean => {
    const current = store.getState().sessions.get(id)
    if (disposed || current !== session) return false
    return replaceSession(id, {
      ...session,
      epoch: session.epoch + 1,
      error,
      pending: false,
    })
  }

  const finishCommit = (
    id: string,
    token: AttemptToken,
    row: Row,
    column: Column,
    rowKey: Key,
    rowIndex: number,
    oldValue: unknown,
    newValue: unknown,
    sourceTracked: boolean,
  ): boolean => {
    if (!isCurrent(id, token)) return false
    if (!sourceIsCurrent(rowKey, row, sourceTracked)) {
      setAttemptError(id, token, 'The edited row no longer exists')
      return false
    }
    if (!options.isEditable(column, row)) {
      setAttemptError(id, token, 'This cell is not editable')
      return false
    }
    const current = store.getState()
    const sessions = new Map(current.sessions)
    sessions.delete(id)
    store.setState({
      active: sessions.size === 0 ? null : current.active,
      sessions,
    })
    if (!Object.is(oldValue, newValue)) {
      options.onCommit?.({ rowKey, row, column, rowIndex, oldValue, newValue })
    }
    return true
  }

  /**
   * A successful async commit requested while switching rows still belongs to
   * the old source row. Detach only the latest, still-current attempts before
   * replacing the visible session map; stale failures remain silent and a
   * later cancel/dispose can still invalidate the detached attempt.
   */
  const detachCurrentPending = (): void => {
    const current = store.getState()
    for (const attempt of pendingAttempts) {
      if (attempt.cancelled || attempt.detached || attempt.token.generation !== generation) {
        continue
      }
      const session = current.sessions.get(attempt.id)
      if (session?.epoch === attempt.token.epoch) attempt.detached = true
    }
  }

  const cancelPending = (): void => {
    cancellationEpoch++
    for (const attempt of pendingAttempts) attempt.cancelled = true
    pendingAttempts.clear()
  }

  const validate = createTableRowEditValidator(options)

  const settleFailure = (
    attempt: PendingAttempt<Row, Column, Key>,
    outcome: ValidationOutcome,
  ): void => {
    // A draft change/cancel invalidates a non-detached attempt. Its late
    // failure is stale and must stay silent; a detached attempt remains a real
    // commit validation and reports exactly once.
    if (!attempt.detached && !isCurrent(attempt.id, attempt.token)) return
    notifyValidation(attempt.rowKey, attempt.row, attempt.column, attempt.rowIndex, outcome)
    if (!attempt.detached) setAttemptError(attempt.id, attempt.token, outcome.error as string)
  }

  const settleDetachedSuccess = (
    attempt: PendingAttempt<Row, Column, Key>,
    outcome: ValidationOutcome,
  ): void => {
    notifyValidation(attempt.rowKey, attempt.row, attempt.column, attempt.rowIndex, outcome)
    // onValidation is user code and may synchronously cancel/dispose, replace/
    // remove the source row, or change row permissions. Check every boundary
    // once more immediately before the detached write.
    if (
      attempt.cancelled ||
      disposed ||
      cancellationEpoch !== attempt.cancellationEpoch ||
      !sourceIsCurrent(attempt.rowKey, attempt.row, attempt.sourceTracked) ||
      !options.isEditable(attempt.column, attempt.row)
    ) {
      return
    }
    if (!Object.is(attempt.oldValue, attempt.newValue)) {
      options.onCommit?.({
        rowKey: attempt.rowKey,
        row: attempt.row,
        column: attempt.column,
        rowIndex: attempt.rowIndex,
        oldValue: attempt.oldValue,
        newValue: attempt.newValue,
      })
    }
  }

  const notifyValidation = (
    rowKey: Key,
    row: Row,
    column: Column,
    rowIndex: number,
    outcome: ValidationOutcome,
  ): void => {
    options.onValidation?.({
      rowKey,
      row,
      column,
      rowIndex,
      valid: !outcome.error,
      commit: true,
      source: outcome.source,
    })
  }

  const settleCurrentSuccess = (
    attempt: PendingAttempt<Row, Column, Key>,
    outcome: ValidationOutcome,
  ): void => {
    if (!isCurrent(attempt.id, attempt.token)) return
    const currentSession = store.getState().sessions.get(attempt.id)
    if (!currentSession) return
    notifyValidation(
      currentSession.rowKey,
      attempt.row,
      currentSession.column,
      currentSession.rowIndex,
      outcome,
    )
    finishCommit(
      attempt.id,
      attempt.token,
      attempt.row,
      attempt.column,
      attempt.rowKey,
      attempt.rowIndex,
      attempt.oldValue,
      attempt.newValue,
      attempt.sourceTracked,
    )
  }

  const commit = (id: string): boolean => {
    if (disposed) return false
    const session = store.getState().sessions.get(id)
    // Keep stale DOM/blur callbacks harmless, and make a second callback while
    // an async attempt is pending an idempotent observation of that attempt.
    if (!session) return true
    if (session.pending) return true

    const resolved = resolveRow(session.rowKey, session.row)
    if (resolved.row === undefined) {
      rejectAttempt(id, session, 'The edited row no longer exists')
      return false
    }
    if (!options.isEditable(session.column, resolved.row)) {
      rejectAttempt(id, session, 'This cell is not editable')
      return false
    }

    const token = beginAttempt(id, session)
    if (!token) return false
    const row = resolved.row
    const oldValue = options.getCellValue(row, session.column)
    const newValue = options.coerce
      ? options.coerce(session.draft, row, session.column)
      : session.draft
    const validation = validate(session.draft, row, session.column, newValue)
    const rules = options.getEditRules?.(session.column)
    const fallbackSource: EditValidationSource =
      rules && rules.length > 0 ? 'editRules' : options.validate ? 'custom' : 'none'

    if (isPromiseLike<ValidationOutcome>(validation)) {
      const attempt: PendingAttempt<Row, Column, Key> = {
        id,
        token,
        cancellationEpoch,
        row,
        column: session.column,
        rowKey: session.rowKey,
        rowIndex: session.rowIndex,
        oldValue,
        newValue,
        sourceTracked: resolved.tracked,
        validationSource: fallbackSource,
        detached: false,
        cancelled: false,
      }
      pendingAttempts.add(attempt)
      const settle = (outcome: ValidationOutcome): void => {
        pendingAttempts.delete(attempt)
        if (attempt.cancelled || disposed) return
        if (outcome.error) {
          settleFailure(attempt, outcome)
          return
        }

        // A valid result may land only while the exact source row captured for
        // the attempt is still current. This covers both removal and immutable
        // replacement, including a switched-away session that is allowed to
        // commit on its original row.
        if (!sourceIsCurrent(attempt.rowKey, attempt.row, attempt.sourceTracked)) {
          if (!attempt.detached && isCurrent(attempt.id, attempt.token)) {
            setAttemptError(attempt.id, attempt.token, 'The edited row no longer exists')
          }
          return
        }
        if (!options.isEditable(attempt.column, attempt.row)) {
          if (!attempt.detached && isCurrent(attempt.id, attempt.token)) {
            setAttemptError(attempt.id, attempt.token, 'This cell is not editable')
          }
          return
        }
        if (attempt.detached) {
          settleDetachedSuccess(attempt, outcome)
          return
        }
        settleCurrentSuccess(attempt, outcome)
      }
      void Promise.resolve(validation).then(
        (outcome) => settle(outcome),
        (reason: unknown) =>
          settle(validationOutcome(rejectedValidationMessage(reason), fallbackSource)),
      )
      return true
    }

    const outcome = validation
    if (outcome.error) {
      notifyValidation(session.rowKey, row, session.column, session.rowIndex, outcome)
      setAttemptError(id, token, outcome.error)
      return false
    }
    notifyValidation(session.rowKey, row, session.column, session.rowIndex, outcome)
    return finishCommit(
      id,
      token,
      row,
      session.column,
      session.rowKey,
      session.rowIndex,
      oldValue,
      newValue,
      resolved.tracked,
    )
  }

  const commitAll = (): boolean => {
    if (disposed) return false
    let valid = true
    const ids = [...store.getState().sessions.keys()]
    for (const id of ids) {
      if (!commit(id)) valid = false
    }
    return valid
  }

  const clearSessions = (): void => {
    generation++
    cancelPending()
    const current = store.getState()
    if (current.active === null && current.sessions.size === 0) return
    store.setState({ active: null, sessions: new Map() })
  }

  const begin = (row: Row, rowIndex: number): boolean => {
    if (disposed) return false
    const rowKey = options.getRowKey(row, rowIndex)
    const resolved = resolveRow(rowKey, row)
    if (resolved.row === undefined) return false
    const sourceRow = resolved.row
    const columns = options.getColumns().filter((column) => options.isEditable(column, sourceRow))
    if (columns.length === 0) return false
    // Direct begin() also replaces the visible session map. Keep an accepted
    // pending commit tied to its original source row, matching switch().
    detachCurrentPending()
    generation++
    const sessions = new Map<string, TableRowEditSession<Row, Column, Key>>()
    for (const column of columns) {
      sessions.set(
        sessionId(rowKey, column),
        createTableRowEditSession(options, sourceRow, rowKey, column, rowIndex),
      )
    }
    store.setState({
      active: { key: rowKey, index: rowIndex },
      sessions,
    })
    return true
  }

  const switchTo = (row: Row, rowIndex: number): boolean => {
    if (disposed) return false
    if (!commitAll()) return false
    // Preserve an accepted async commit for the old source row while making
    // the new row's sessions current. Its validation error is intentionally
    // not painted after the switch; cancelAll/dispose still cancels it.
    detachCurrentPending()
    return begin(row, rowIndex)
  }

  const openCell = (row: Row, column: Column, rowIndex: number): boolean => {
    if (disposed) return false
    const rowKey = options.getRowKey(row, rowIndex)
    const resolved = resolveRow(rowKey, row)
    if (resolved.row === undefined || !options.isEditable(column, resolved.row)) return false
    const current = store.getState()
    if (current.active === null || !Object.is(current.active.key, rowKey)) {
      return switchTo(row, rowIndex)
    }
    const id = sessionId(rowKey, column)
    if (current.sessions.has(id)) return true
    const sourceRow = resolved.row
    const sessions = new Map(current.sessions)
    sessions.set(id, createTableRowEditSession(options, sourceRow, rowKey, column, rowIndex))
    store.setState({ active: current.active, sessions })
    return true
  }

  const setDraft = (id: string, draft: unknown): boolean => {
    if (disposed) return false
    const session = store.getState().sessions.get(id)
    if (!session) return false
    return replaceSession(id, {
      ...session,
      draft,
      error: null,
      pending: false,
      epoch: session.epoch + 1,
    })
  }

  const cancelAll = (): void => {
    if (disposed) return
    clearSessions()
  }

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    clearSessions()
  }

  return {
    store,
    getState: () => store.getState(),
    getActive: () => {
      const active = store.getState().active
      return active ? { ...active } : null
    },
    session: (id) => store.getState().sessions.get(id),
    begin,
    switch: switchTo,
    openCell,
    setDraft,
    commit,
    commitAll,
    cancelAll,
    dispose,
  }
}
