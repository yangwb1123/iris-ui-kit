import type { OutboxFlushResult, OutboxItemOutcome } from './outbox'
import { cloneRuntimeValue } from './outbox-runtime'
import {
  DataSourceMutationDeferredError,
  DataSourceMutationUndeliveredError,
  type DataSourceMutationDescriptor,
  type DataSourceMutationOutcome,
  type MutateOptions,
  type RowMutateOptions,
} from './data-source/types'
import {
  type DataSourceMutationRecord,
  type DataSourceMutationRuntime,
  type DataSourceMutationRuntimeOptions,
} from './data-source-mutation-types'

type MutationRecord<T> = DataSourceMutationRecord<T>

export function createDataSourceMutationRuntime<T>(
  options: DataSourceMutationRuntimeOptions<T>,
): DataSourceMutationRuntime<T> {
  let lifecycle = 0
  const mutationRecords = new Map<string, MutationRecord<T>>()
  const detachedMutationRecords = new Map<string, MutationRecord<T>>()
  let mutationSequence = 0
  let unsubscribeOutboxFlush: (() => void) | undefined
  let unsubscribeOutboxRemoval: (() => void) | undefined

  const isCurrentMutation = (record: MutationRecord<T>): boolean =>
    record.lifecycle === lifecycle &&
    (record.id === undefined ||
      mutationRecords.get(record.id) === record ||
      detachedMutationRecords.get(record.id) === record)

  const applyOptimistic = (apply: (rows: T[]) => T[], rows: T[]): T[] =>
    cloneRuntimeValue(apply(cloneRuntimeValue(rows)))
  const rowsAfterRemoving = (record: MutationRecord<T>): T[] | undefined => {
    if (!record.optimistic || !record.optimisticApply) return undefined
    const remaining = [...mutationRecords.values()]
      .filter(
        (candidate) =>
          candidate !== record &&
          candidate.lifecycle === lifecycle &&
          candidate.optimistic &&
          candidate.optimisticApply,
      )
      .sort((a, b) => a.sequence - b.sequence)
    let rows = cloneRuntimeValue(options.getCanonicalRows())
    for (const layer of remaining) rows = applyOptimistic(layer.optimisticApply!, rows)
    return rows
  }

  const reapplyPendingOptimistic = (): void => {
    const pending = [...mutationRecords.values()]
      .filter(
        (record) => record.lifecycle === lifecycle && record.optimistic && record.optimisticApply,
      )
      .sort((a, b) => a.sequence - b.sequence)
    let rows = cloneRuntimeValue(options.getCanonicalRows())
    for (const record of pending) rows = applyOptimistic(record.optimisticApply!, rows)
    options.store.setState((s) => ({ ...s, rows }))
  }

  const hasOtherRowMutation = (record: MutationRecord<T>): boolean => {
    if (record.rowKey === undefined) return false
    for (const candidate of mutationRecords.values()) {
      if (
        candidate !== record &&
        candidate.lifecycle === lifecycle &&
        candidate.rowKey === record.rowKey
      )
        return true
    }
    return false
  }

  const finishFailure = (record: MutationRecord<T>, error: unknown): void => {
    if (!isCurrentMutation(record)) return
    if (record.id !== undefined) {
      mutationRecords.delete(record.id)
      detachedMutationRecords.delete(record.id)
    }
    const rows = rowsAfterRemoving(record)
    const preserveOtherRowState = hasOtherRowMutation(record)
    options.store.setState((s) => ({
      ...s,
      rows: rows ?? s.rows,
      rowErrors:
        record.rowKey === undefined || preserveOtherRowState
          ? s.rowErrors
          : { ...s.rowErrors, [record.rowKey]: error },
      pendingRows:
        record.rowKey === undefined || preserveOtherRowState
          ? s.pendingRows
          : s.pendingRows.filter((key) => key !== record.rowKey),
    }))
  }

  const discardMutation = (record: MutationRecord<T>): void => {
    if (!isCurrentMutation(record)) return
    if (record.id !== undefined) mutationRecords.delete(record.id)
    const rows = rowsAfterRemoving(record)
    const preserveOtherRowState = hasOtherRowMutation(record)
    if (record.rowKey === undefined || preserveOtherRowState) {
      if (rows !== undefined) options.store.setState((s) => ({ ...s, rows }))
      return
    }
    const rowKey = record.rowKey
    options.store.setState((s) => ({
      ...s,
      rows: rows ?? s.rows,
      pendingRows: s.pendingRows.filter((key) => key !== rowKey),
      rowErrors: { ...s.rowErrors, [rowKey]: undefined },
    }))
  }

  const handleOutboxRemoval = ({
    ids,
    inFlightIds = [],
  }: {
    ids: string[]
    inFlightIds?: string[]
  }): void => {
    const inFlight = new Set(inFlightIds)
    for (const id of ids) {
      const record = mutationRecords.get(id)
      if (!record || record.lifecycle !== lifecycle) continue
      if (inFlight.has(id)) detachedMutationRecords.set(id, record)
      discardMutation(record)
    }
  }

  const finishDeferred = (record: MutationRecord<T>, error: unknown): void => {
    if (!isCurrentMutation(record) || record.rowKey === undefined) return
    const rowKey = record.rowKey
    options.store.setState((s) => ({
      ...s,
      rowErrors: { ...s.rowErrors, [rowKey]: error },
      pendingRows: s.pendingRows.includes(rowKey) ? s.pendingRows : [...s.pendingRows, rowKey],
    }))
  }

  const finishDelivered = async (record: MutationRecord<T>): Promise<void> => {
    if (!isCurrentMutation(record)) return
    if (record.id !== undefined) {
      mutationRecords.delete(record.id)
      detachedMutationRecords.delete(record.id)
    }
    if (record.skipReload && record.optimisticApply) {
      options.setCanonicalRows(applyOptimistic(record.optimisticApply, options.getCanonicalRows()))
    }
    const preserveOtherRowState = hasOtherRowMutation(record)
    const rowKey = record.rowKey
    if (rowKey !== undefined && !preserveOtherRowState) {
      options.store.setState((s) => ({
        ...s,
        pendingRows: s.pendingRows.filter((key) => key !== rowKey),
        rowErrors: { ...s.rowErrors, [rowKey]: undefined },
      }))
    }
    if (record.skipReload && record.optimisticApply) reapplyPendingOptimistic()
    options.invalidateAfterMutation()
    if (!record.skipReload) await options.reload()
  }

  const finishRemoved = async (
    record: MutationRecord<T>,
    outcome: OutboxItemOutcome,
  ): Promise<void> => {
    if (!isCurrentMutation(record)) return
    if (record.id !== undefined) {
      mutationRecords.delete(record.id)
      detachedMutationRecords.delete(record.id)
    }
    const preserveOtherRowState = hasOtherRowMutation(record)
    const rowKey = record.rowKey
    if (rowKey !== undefined && !preserveOtherRowState) {
      options.store.setState((s) => ({
        ...s,
        pendingRows: s.pendingRows.filter((key) => key !== rowKey),
        rowErrors: { ...s.rowErrors, [rowKey]: undefined },
      }))
    }
    if (outcome.executorStatus === 'resolved') {
      options.invalidateAfterMutation()
      if (!record.skipReload) await options.reload()
    }
  }

  const settleOutboxRecord = (
    record: MutationRecord<T>,
    outcome: OutboxItemOutcome,
  ): Promise<void> => {
    if (outcome.removed === true) return finishRemoved(record, outcome)
    if (outcome.status === 'delivered') return finishDelivered(record)
    if (outcome.status === 'deferred' && outcome.queued) {
      finishDeferred(record, outcome.error ?? new DataSourceMutationDeferredError())
      return Promise.resolve()
    }
    finishFailure(
      record,
      outcome.error ??
        new DataSourceMutationUndeliveredError('Outbox mutation was no longer queued'),
    )
    return Promise.resolve()
  }

  const handleOutboxFlush = (result: OutboxFlushResult): void => {
    let hydratedDeliveryNeedsResync = false
    let trackedDeliveryWillReload = false
    for (const outcome of result.outcomes) {
      const record = mutationRecords.get(outcome.id) ?? detachedMutationRecords.get(outcome.id)
      if (!record || record.lifecycle !== lifecycle) {
        if (outcome.status === 'delivered' && outcome.executorStatus === 'resolved')
          hydratedDeliveryNeedsResync = true
        continue
      }
      if (record.lastAttempt === outcome.attempts && record.lastStatus === outcome.status) continue
      record.lastAttempt = outcome.attempts
      record.lastStatus = outcome.status
      if (outcome.status === 'delivered' && !record.skipReload) trackedDeliveryWillReload = true
      const settlement = settleOutboxRecord(record, outcome)
      record.settlement = settlement
      if (outcome.status === 'deferred') {
        void settlement.then(() => {
          if (record.settlement === settlement) record.settlement = undefined
        })
      }
    }
    if (hydratedDeliveryNeedsResync && !trackedDeliveryWillReload) {
      options.invalidateAfterMutation()
      void options.reload()
    }
  }

  const ensureOutboxSubscription = (): void => {
    const outbox = options.outbox
    if (outbox && !unsubscribeOutboxFlush) {
      unsubscribeOutboxFlush = outbox.subscribeFlush(handleOutboxFlush)
      unsubscribeOutboxRemoval = outbox.subscribeRemoval(handleOutboxRemoval)
    }
  }

  const missingOutboxOutcome = (id: string): OutboxItemOutcome => {
    const current = options.outbox!.items().find((item) => item.id === id)
    if (current?.status === 'pending') {
      return {
        id,
        status: 'deferred',
        attempts: current.attempts,
        error: new DataSourceMutationDeferredError('Mutation is queued behind an earlier mutation'),
        executorStatus: 'rejected',
        queued: true,
      }
    }
    if (current?.status === 'failed') {
      return {
        id,
        status: 'failed',
        attempts: current.attempts,
        error: new Error(current.error ?? 'Outbox mutation failed'),
        executorStatus: 'rejected',
        queued: true,
      }
    }
    return {
      id,
      status: 'failed',
      attempts: 0,
      error: new DataSourceMutationUndeliveredError(),
      executorStatus: 'rejected',
      queued: false,
    }
  }

  const queueMutation = async (
    record: MutationRecord<T>,
    description: string,
    action: () => Promise<unknown>,
    descriptor?: DataSourceMutationDescriptor,
  ): Promise<DataSourceMutationOutcome> => {
    const outbox = options.outbox
    if (!outbox) throw new Error('Mutation outbox is not enabled')
    ensureOutboxSubscription()

    let id: string
    try {
      id = outbox.enqueue({ description, run: action, descriptor })
      record.id = id
      mutationRecords.set(id, record)
    } catch (error) {
      finishFailure(record, error)
      return { status: 'failed', error, queued: false }
    }

    try {
      const result = await outbox.flushDetailed()
      if (record.lifecycle !== lifecycle) {
        return {
          status: 'failed',
          id,
          error: new DataSourceMutationUndeliveredError(
            'Data-source mutation was interrupted by destroy()',
          ),
          queued: false,
        }
      }

      const outcome =
        result.outcomes.find((candidate) => candidate.id === id) ?? missingOutboxOutcome(id)
      if (!result.outcomes.some((candidate) => candidate.id === id)) {
        record.lastAttempt = outcome.attempts
        record.lastStatus = outcome.status
        record.settlement = settleOutboxRecord(record, outcome)
      }

      if (record.settlement) await record.settlement
      if (record.lifecycle !== lifecycle) {
        return {
          status: 'failed',
          id,
          error: new DataSourceMutationUndeliveredError(
            'Data-source mutation was interrupted by destroy()',
          ),
          queued: false,
        }
      }
      if (outcome.status === 'deferred' && !outcome.queued) {
        return {
          status: 'failed',
          id,
          attempts: outcome.attempts,
          error: outcome.error ?? new DataSourceMutationUndeliveredError(),
          queued: false,
        }
      }
      return {
        status: outcome.status,
        id,
        attempts: outcome.attempts,
        error: outcome.error,
        queued: outcome.queued,
      }
    } catch (error) {
      finishFailure(record, error)
      return { status: 'failed', id, error, queued: false }
    }
  }

  const mutate = async (
    action: () => Promise<unknown>,
    mutateOptions?: MutateOptions<T>,
  ): Promise<DataSourceMutationOutcome> => {
    const record: MutationRecord<T> = {
      lifecycle,
      sequence: ++mutationSequence,
      snapshot: cloneRuntimeValue(options.store.getState().rows),
      optimistic: mutateOptions?.optimistic !== undefined,
      optimisticApply: mutateOptions?.optimistic,
      skipReload: mutateOptions?.skipReload === true,
    }
    if (mutateOptions?.optimistic) {
      options.store.setState((s) => ({
        ...s,
        rows: applyOptimistic(mutateOptions.optimistic!, s.rows),
      }))
    }

    if (options.outbox) {
      return queueMutation(record, 'data-source mutate', action, mutateOptions?.descriptor)
    }

    try {
      await action()
    } catch (error) {
      if (record.lifecycle === lifecycle) {
        finishFailure(record, error)
        await options.reload()
      }
      return { status: 'failed', error, queued: false }
    }
    if (record.lifecycle !== lifecycle) {
      return {
        status: 'failed',
        error: new DataSourceMutationUndeliveredError(
          'Data-source mutation was interrupted by destroy()',
        ),
        queued: false,
      }
    }
    await finishDelivered(record)
    return { status: 'delivered', queued: false }
  }

  const mutateRow = async (
    rowKey: string,
    action: () => Promise<unknown>,
    mutateOptions?: RowMutateOptions<T>,
  ): Promise<DataSourceMutationOutcome> => {
    const record: MutationRecord<T> = {
      lifecycle,
      sequence: ++mutationSequence,
      rowKey,
      snapshot: cloneRuntimeValue(options.store.getState().rows),
      optimistic: mutateOptions?.optimistic !== undefined,
      optimisticApply: mutateOptions?.optimistic,
      skipReload: mutateOptions?.skipReload === true,
    }
    options.store.batch(() => {
      options.store.setState((s) => ({
        ...s,
        rowErrors: { ...s.rowErrors, [rowKey]: undefined },
        pendingRows: s.pendingRows.includes(rowKey) ? s.pendingRows : [...s.pendingRows, rowKey],
      }))
      if (mutateOptions?.optimistic) {
        options.store.setState((s) => ({
          ...s,
          rows: applyOptimistic(mutateOptions.optimistic!, s.rows),
        }))
      }
    })

    if (options.outbox) {
      return queueMutation(record, `mutate-row:${rowKey}`, action, mutateOptions?.descriptor)
    }

    try {
      await action()
    } catch (error) {
      if (record.lifecycle === lifecycle) finishFailure(record, error)
      return { status: 'failed', error, queued: false }
    }
    if (record.lifecycle !== lifecycle) {
      return {
        status: 'failed',
        error: new DataSourceMutationUndeliveredError(
          'Data-source mutation was interrupted by destroy()',
        ),
        queued: false,
      }
    }
    await finishDelivered(record)
    return { status: 'delivered', queued: false }
  }

  const throwIfUndelivered = (outcome: DataSourceMutationOutcome): void => {
    if (outcome.status === 'delivered') return
    if (outcome.status === 'deferred') {
      if (outcome.error instanceof DataSourceMutationDeferredError) throw outcome.error
      throw new DataSourceMutationDeferredError(outcome.error)
    }
    throw outcome.error ?? new DataSourceMutationUndeliveredError()
  }

  const destroy = (): void => {
    const destroyedLifecycle = lifecycle
    lifecycle += 1
    const activeRecords = [...mutationRecords.values()].filter(
      (record) => record.lifecycle === destroyedLifecycle,
    )
    const rowsToClear = new Set(
      activeRecords
        .map((record) => record.rowKey)
        .filter((rowKey): rowKey is string => rowKey !== undefined),
    )
    const optimisticRecords = activeRecords
      .filter((record) => record.optimistic)
      .sort((a, b) => a.sequence - b.sequence)
    const restoredRows = optimisticRecords[0] ? [...optimisticRecords[0].snapshot] : undefined
    mutationRecords.clear()
    detachedMutationRecords.clear()
    if (rowsToClear.size > 0 || restoredRows !== undefined) {
      options.store.setState((s) => {
        const rowErrors = { ...s.rowErrors }
        for (const rowKey of rowsToClear) rowErrors[rowKey] = undefined
        return {
          ...s,
          rows: restoredRows ?? s.rows,
          pendingRows: s.pendingRows.filter((rowKey) => !rowsToClear.has(rowKey)),
          rowErrors,
        }
      })
    }
    unsubscribeOutboxFlush?.()
    unsubscribeOutboxFlush = undefined
    unsubscribeOutboxRemoval?.()
    unsubscribeOutboxRemoval = undefined
  }

  ensureOutboxSubscription()

  return {
    reapplyPendingOptimistic,
    mutate,
    mutateRow,
    throwIfUndelivered,
    destroy,
  }
}
