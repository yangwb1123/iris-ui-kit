import { createDataSourceMutationRuntime } from '../data-source-mutations'
import type {
  DataSourceMutationRuntime,
  DataSourceMutationRuntimeOptions,
} from '../data-source-mutation-types'

/** Keep outbox subscriptions eager; plain read-only sources need no mutation state. */
export function createLazyDataSourceMutationRuntime<T>(
  options: DataSourceMutationRuntimeOptions<T>,
): DataSourceMutationRuntime<T> {
  if (options.outbox) return createDataSourceMutationRuntime(options)
  let runtime: DataSourceMutationRuntime<T> | undefined
  const ensure = (): DataSourceMutationRuntime<T> =>
    (runtime ??= createDataSourceMutationRuntime(options))
  return {
    // No pending record can exist before the first mutation creates its runtime.
    reapplyPendingOptimistic: () => runtime?.reapplyPendingOptimistic(),
    mutate: (action, settings) => ensure().mutate(action, settings),
    mutateRow: (key, action, settings) => ensure().mutateRow(key, action, settings),
    throwIfUndelivered: (outcome) => ensure().throwIfUndelivered(outcome),
    // Empty pre-initialization destroy has no records or subscriptions to release.
    destroy: () => runtime?.destroy(),
  }
}
