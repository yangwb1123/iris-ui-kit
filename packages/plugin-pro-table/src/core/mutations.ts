import type { DataSourceController, Store } from '@iris-ui-kit/core'
import type { ProTableMutateOptions, ProTableMutationKind, ProTableState } from './types'

interface MutationToolsOptions<Row extends Record<string, unknown>> {
  store: Store<ProTableState<Row>>
  dataSource: DataSourceController<Row>
  allRows: Row[]
  treeRoots: Row[] | null
  allRowsForEdit: Row[]
  rowKeyOf: (row: Row) => string
  removeRowsFromModel?: (keys: ReadonlySet<string>) => readonly string[]
}

interface ProTableMutationTools<Row extends Record<string, unknown>> {
  runMutation<T>(
    kind: ProTableMutationKind,
    rowKeys: string[],
    action: () => Promise<T>,
    mutateOptions?: Pick<ProTableMutateOptions<Row>, 'optimistic' | 'skipReload'>,
  ): Promise<T>
  resourceHandlerRequired(kind: Exclude<ProTableMutationKind, 'custom'>): Error
  removeClientRows(keys: ReadonlySet<string>): readonly string[]
}

/** Shared resource-mutation lifecycle and in-memory reconciliation helpers. */
class ProTableMutationToolsEngine<Row extends Record<string, unknown>> {
  readonly tools: ProTableMutationTools<Row>

  constructor(options: MutationToolsOptions<Row>) {
    const { store, dataSource, allRows, treeRoots, allRowsForEdit, rowKeyOf, removeRowsFromModel } =
      options
    let mutationEpoch = 0

    const runMutation = async <T>(
      kind: ProTableMutationKind,
      rowKeys: string[],
      action: () => Promise<T>,
      mutateOptions?: Pick<ProTableMutateOptions<Row>, 'optimistic' | 'skipReload'>,
    ): Promise<T> => {
      const token = ++mutationEpoch
      store.setState((state) => ({
        ...state,
        mutation: { kind, pending: true, rowKeys: [...rowKeys], error: undefined },
      }))
      let result!: T
      try {
        await dataSource.mutate(
          async () => {
            result = await action()
          },
          {
            optimistic: mutateOptions?.optimistic,
            skipReload: mutateOptions?.skipReload,
          },
        )
        if (token === mutationEpoch) {
          store.setState((state) => ({
            ...state,
            mutation: { kind, pending: false, rowKeys: [...rowKeys], error: undefined },
          }))
        }
        return result
      } catch (error) {
        if (token === mutationEpoch) {
          store.setState((state) => ({
            ...state,
            mutation: { kind, pending: false, rowKeys: [...rowKeys], error },
          }))
        }
        throw error
      }
    }

    const resourceHandlerRequired = (kind: Exclude<ProTableMutationKind, 'custom'>): Error =>
      new Error(
        `[iris-ui] ProTable ${kind} requires config.mutations.${kind === 'bulk-delete' ? 'bulkDelete' : kind} in server mode`,
      )

    const removeClientRows = (keys: ReadonlySet<string>): readonly string[] => {
      if (removeRowsFromModel) {
        return removeRowsFromModel(keys)
      }
      const removed = new Set<string>()
      for (let index = allRows.length - 1; index >= 0; index--) {
        const rowKey = rowKeyOf(allRows[index]!)
        if (keys.has(rowKey)) {
          removed.add(rowKey)
          allRows.splice(index, 1)
        }
      }
      if (treeRoots) {
        for (let index = treeRoots.length - 1; index >= 0; index--) {
          const rowKey = rowKeyOf(treeRoots[index]!)
          if (keys.has(rowKey)) {
            removed.add(rowKey)
            treeRoots.splice(index, 1)
          }
        }
      }
      for (let index = allRowsForEdit.length - 1; index >= 0; index--) {
        const rowKey = rowKeyOf(allRowsForEdit[index]!)
        if (keys.has(rowKey)) {
          removed.add(rowKey)
          allRowsForEdit.splice(index, 1)
        }
      }
      return [...removed]
    }

    this.tools = { runMutation, resourceHandlerRequired, removeClientRows }
  }
}

export function createProTableMutationTools<Row extends Record<string, unknown>>(
  options: MutationToolsOptions<Row>,
) {
  return new ProTableMutationToolsEngine(options).tools
}
