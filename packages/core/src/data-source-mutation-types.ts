import type { AdvancedOutbox, OutboxItemOutcome } from './outbox'
import type {
  DataSourceMutationDescriptor,
  DataSourceMutationOutcome,
  DataSourceState,
  MutateOptions,
  RowMutateOptions,
} from './data-source/types'
import type { Store } from './store'

export type DataSourceQueuedMutation = {
  description: string
  run: () => Promise<unknown>
  descriptor?: DataSourceMutationDescriptor
}

export interface DataSourceMutationRecord<T> {
  id?: string
  lifecycle: number
  sequence: number
  rowKey?: string
  snapshot: T[]
  optimistic: boolean
  optimisticApply?: (rows: T[]) => T[]
  skipReload: boolean
  lastAttempt?: number
  lastStatus?: OutboxItemOutcome['status']
  settlement?: Promise<void>
}

export interface DataSourceMutationRuntimeOptions<T> {
  store: Store<DataSourceState<T>>
  outbox: AdvancedOutbox<DataSourceQueuedMutation> | null
  reload: () => Promise<void>
  invalidateAfterMutation: () => void
  getCanonicalRows: () => T[]
  setCanonicalRows: (rows: T[]) => void
}

export interface DataSourceMutationRuntime<T> {
  reapplyPendingOptimistic(): void
  mutate(
    action: () => Promise<unknown>,
    options?: MutateOptions<T>,
  ): Promise<DataSourceMutationOutcome>
  mutateRow(
    rowKey: string,
    action: () => Promise<unknown>,
    options?: RowMutateOptions<T>,
  ): Promise<DataSourceMutationOutcome>
  throwIfUndelivered(outcome: DataSourceMutationOutcome): void
  destroy(): void
}
