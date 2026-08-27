import { createStore, type Store } from './store'
import type { GridFeature, GridMethod } from './grid'
import { findTreeRow, removeTreeRows, setTreeChildren, updateTreeRows } from './grid-tree-rows'
import { insertRowInList, removeRowFromList, updateRowInList } from './table-rows'

export type GridRowKey = string | number

export interface GridRowsCommitOptions<Meta = unknown> {
  /** Stable semantic label such as `insert`, `remove`, or `cell-edit`. */
  readonly reason?: string
  /** Adapter-owned context forwarded untouched to transaction observers. */
  readonly meta?: Meta
}

export interface GridRowsTransaction<Row extends Record<string, unknown>, Meta = unknown> {
  readonly previousRows: readonly Row[]
  readonly rows: readonly Row[]
  readonly reason: string
  readonly meta: Meta | undefined
}

export const GRID_ROWS_CHANGE_EVENT = 'rows:change'

export interface GridRowsFeatureOptions<Row extends Record<string, unknown>, Meta = unknown> {
  readonly defaultRows?: readonly Row[]
  /** Copy the initial seed before storing it; defaults to true. */
  readonly cloneDefaultRows?: boolean
  /** Field used by the built-in imperative row operations. Defaults to `id`. */
  readonly rowKeyField?: string
  /** Optional computed key resolver (for rowId-style tables). */
  readonly getRowKey?: (row: Row, index: number) => GridRowKey | undefined
  /** Read nested rows so key-addressed mutations can traverse a tree. */
  readonly getChildren?: (row: Row) => readonly Row[] | undefined
  /** Replace nested rows immutably when `getChildren` is not a direct property. */
  readonly setChildren?: (row: Row, children: Row[]) => Row
  /** Runs synchronously before the store changes. It observes but cannot veto. */
  readonly onBeforeRowsChange?: (transaction: GridRowsTransaction<Row, Meta>) => void
  /** Runs after the store changes and before the Grid Core event is emitted. */
  readonly onRowsChange?: (transaction: GridRowsTransaction<Row, Meta>) => void
}

export interface GridRowsModel<Row extends Record<string, unknown>, Meta = unknown> {
  readonly store: Store<Row[]>
  get(): Row[]
  /** Alias for `get`, matching the table handle vocabulary. */
  getData(): Row[]
  /** Find the first row with a resolved key, including nested tree rows. */
  find(key: GridRowKey): Row | undefined
  commit(rows: readonly Row[], options?: GridRowsCommitOptions<Meta>): boolean
  /** Replace rows through a user-visible transaction (default reason: `load`). */
  loadData(rows: readonly Row[], options?: GridRowsCommitOptions<Meta>): boolean
  transact(
    updater: (rows: readonly Row[]) => readonly Row[],
    options?: GridRowsCommitOptions<Meta>,
  ): boolean
  /** Insert one row; the index is clamped and defaults to the end. */
  insert(row: Row, index?: number, options?: GridRowsCommitOptions<Meta>): boolean
  /** Remove one row by its resolved key. Missing keys are silent no-ops. */
  remove(key: GridRowKey, options?: GridRowsCommitOptions<Meta>): boolean
  /** Remove several rows in one transaction and return the keys actually removed. */
  removeMany(
    keys: readonly GridRowKey[],
    options?: GridRowsCommitOptions<Meta>,
  ): readonly GridRowKey[]
  /** Shallow-merge one row by key. Missing keys are silent no-ops. */
  update(key: GridRowKey, patch: Partial<Row>, options?: GridRowsCommitOptions<Meta>): boolean
  /** Replace one nested child list through a user-visible transaction. */
  setChildren(
    key: GridRowKey,
    children: readonly Row[],
    options?: GridRowsCommitOptions<Meta>,
  ): boolean
  /** Replace one nested child list without callbacks/events. */
  syncChildren(key: GridRowKey, children: readonly Row[]): boolean
  /** Replace rows from a controlled prop or remote source without callbacks/events. */
  sync(rows: readonly Row[]): boolean
  clear(options?: GridRowsCommitOptions<Meta>): boolean
}

export interface GridRowsMethods<Row extends Record<string, unknown>, Meta = unknown> {
  /** Adapter bridge: the feature-owned framework-agnostic controller. */
  getRowsModel(): GridRowsModel<Row, Meta>
  /** Returns a shallow array snapshot so callers cannot mutate the store list. */
  getRows(): Row[]
  /** Table-handle aliases owned by the rows feature. */
  getData(): Row[]
  /** Find a row by resolved key, traversing nested children when configured. */
  findRow(key: GridRowKey): Row | undefined
  setRows(rows: Row[], options?: GridRowsCommitOptions<Meta>): boolean
  loadData(rows: Row[], options?: GridRowsCommitOptions<Meta>): boolean
  /** Short capability names for low-level Grid consumers. */
  insert(row: Row, index?: number, options?: GridRowsCommitOptions<Meta>): boolean
  remove(key: GridRowKey, options?: GridRowsCommitOptions<Meta>): boolean
  removeMany(
    keys: readonly GridRowKey[],
    options?: GridRowsCommitOptions<Meta>,
  ): readonly GridRowKey[]
  update(key: GridRowKey, patch: Partial<Row>, options?: GridRowsCommitOptions<Meta>): boolean
  setChildren(key: GridRowKey, children: Row[], options?: GridRowsCommitOptions<Meta>): boolean
  syncChildren(key: GridRowKey, children: Row[]): boolean
  insertRow(row: Row, index?: number, options?: GridRowsCommitOptions<Meta>): boolean
  removeRow(key: GridRowKey, options?: GridRowsCommitOptions<Meta>): boolean
  removeRows(
    keys: readonly GridRowKey[],
    options?: GridRowsCommitOptions<Meta>,
  ): readonly GridRowKey[]
  updateRow(key: GridRowKey, patch: Partial<Row>, options?: GridRowsCommitOptions<Meta>): boolean
  transactRows(
    updater: (rows: readonly Row[]) => readonly Row[],
    options?: GridRowsCommitOptions<Meta>,
  ): boolean
  syncRows(rows: Row[]): boolean
  clearRows(options?: GridRowsCommitOptions<Meta>): boolean
}

/** One framework-independent row source and mutation transaction throat. */
export function createGridRowsModel<Row extends Record<string, unknown>, Meta = unknown>(
  options: GridRowsFeatureOptions<Row, Meta> = {},
  emit?: (transaction: GridRowsTransaction<Row, Meta>) => void,
): GridRowsModel<Row, Meta> {
  const rowKeyField = options.rowKeyField ?? 'id'
  // Core owns its initial seed by default. Legacy adapters that intentionally
  // expose source-array identity can disable this copy; every later commit is
  // still copied below, so write-back inputs cannot mutate Grid state.
  const seed = options.defaultRows ?? []
  const store = createStore<Row[]>(options.cloneDefaultRows === false ? (seed as Row[]) : [...seed])

  const keyOf = (row: Row, index: number): GridRowKey | undefined => {
    const computed = options.getRowKey?.(row, index)
    if (computed !== undefined && computed !== null) return computed
    const value = (row as Record<string, unknown>)[rowKeyField]
    return typeof value === 'string' || typeof value === 'number' ? value : undefined
  }

  const treeOptions = options.getChildren
    ? {
        getRowKey: keyOf,
        getChildren: options.getChildren,
        setChildren: options.setChildren,
      }
    : null

  const reasoned = (
    commitOptions: GridRowsCommitOptions<Meta> | undefined,
    reason: string,
  ): GridRowsCommitOptions<Meta> => ({
    ...commitOptions,
    reason: commitOptions?.reason ?? reason,
  })

  const removeAt = (rows: readonly Row[], index: number): Row[] =>
    rows.filter((_, rowIndex) => rowIndex !== index)

  const updateAt = (rows: readonly Row[], index: number, patch: Partial<Row>): Row[] =>
    rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))

  const commit = (
    rows: readonly Row[],
    commitOptions: GridRowsCommitOptions<Meta> = {},
    notify: boolean,
  ): boolean => {
    const previousRows = store.getState()
    if (Object.is(rows, previousRows)) return false
    // Keep the store list private. Feature consumers can safely retain or
    // mutate their input array after a commit without changing Grid state.
    const nextRows = [...rows]
    const previousSnapshot = [...previousRows]
    if (!notify) {
      store.setState(nextRows)
      return true
    }
    const transaction: GridRowsTransaction<Row, Meta> = {
      previousRows: previousSnapshot,
      // Observers receive their own list snapshot. A listener must not be able
      // to mutate the store by pushing into `transaction.rows`.
      rows: [...nextRows],
      reason: commitOptions.reason ?? 'set',
      meta: commitOptions.meta,
    }
    options.onBeforeRowsChange?.(transaction)
    store.setState(nextRows)
    options.onRowsChange?.(transaction)
    emit?.(transaction)
    return true
  }

  const model: GridRowsModel<Row, Meta> = {
    store,
    get: () => [...store.getState()],
    getData: () => [...store.getState()],
    find: (key) => {
      const rows = store.getState()
      if (treeOptions) return findTreeRow(rows, key, treeOptions)
      const index = rows.findIndex((row, rowIndex) => keyOf(row, rowIndex) === key)
      return index < 0 ? undefined : rows[index]
    },
    commit: (rows, commitOptions) => commit(rows, commitOptions, true),
    loadData: (rows, commitOptions) => commit(rows, reasoned(commitOptions, 'load'), true),
    transact(updater, commitOptions) {
      const current = store.getState()
      // Do not expose the store-owned array to an updater. Returning any
      // same-shape, row-reference-equivalent array is a no-op; mutating the
      // working copy and returning it is an intentional transaction.
      const working = [...current]
      const next = updater(working)
      if (Array.isArray(next) && next.length === current.length) {
        let unchanged = true
        for (let index = 0; index < current.length; index += 1) {
          if (!Object.is(current[index], next[index])) {
            unchanged = false
            break
          }
        }
        if (unchanged) return false
      }
      return commit(next, commitOptions, true)
    },
    insert: (row, index, commitOptions) =>
      commit(
        insertRowInList(store.getState(), rowKeyField, row, index),
        reasoned(commitOptions, 'insert'),
        true,
      ),
    remove: (key, commitOptions) => {
      const rows = store.getState()
      if (treeOptions) {
        const result = removeTreeRows(rows, new Set([key]), treeOptions)
        if (result.blocked || result.removed.size === 0 || !result.changed) return false
        commit(result.rows, reasoned(commitOptions, 'remove'), true)
        return true
      }
      const index = rows.findIndex((row, rowIndex) => keyOf(row, rowIndex) === key)
      if (index < 0) return false
      return commit(
        options.getRowKey ? removeAt(rows, index) : removeRowFromList(rows, rowKeyField, key),
        reasoned(commitOptions, 'remove'),
        true,
      )
    },
    removeMany: (keys, commitOptions) => {
      const current = store.getState()
      if (treeOptions) {
        const result = removeTreeRows(current, new Set(keys), treeOptions)
        if (result.blocked || result.removed.size === 0 || !result.changed) return []
        commit(result.rows, reasoned(commitOptions, 'remove'), true)
        const removed: GridRowKey[] = []
        for (const key of keys) {
          if (result.removed.has(key) && !removed.includes(key)) removed.push(key)
        }
        // Removing a parent also removes every reachable descendant. Keep
        // requested keys first for legacy ordering, then append descendant
        // keys so adapters can prune selection/lookup state for the entire
        // subtree in the same transaction.
        result.removed.forEach((key) => {
          if (!removed.includes(key)) removed.push(key)
        })
        return removed
      }
      const removedIndexes = new Set<number>()
      const removedKeys: GridRowKey[] = []
      // Resolve every key against the same pre-transaction snapshot. This is
      // important for index-derived getRowKey functions: removing an earlier
      // row must not renumber the later row before its requested key is
      // resolved. Duplicate keys still remove one matching row at a time.
      for (const key of keys) {
        const index = current.findIndex(
          (row, rowIndex) => !removedIndexes.has(rowIndex) && keyOf(row, rowIndex) === key,
        )
        if (index < 0) continue
        removedIndexes.add(index)
        removedKeys.push(key)
      }
      if (removedKeys.length === 0) return []
      const next = current.filter((_, index) => !removedIndexes.has(index))
      commit(next, reasoned(commitOptions, 'remove'), true)
      return removedKeys
    },
    update: (key, patch, commitOptions) => {
      const rows = store.getState()
      if (treeOptions) {
        const result = updateTreeRows(rows, key, patch, treeOptions)
        if (!result.matched || result.blocked || !result.changed) return false
        return commit(result.rows, reasoned(commitOptions, 'edit'), true)
      }
      const index = rows.findIndex((row, rowIndex) => keyOf(row, rowIndex) === key)
      if (index < 0) return false
      return commit(
        options.getRowKey
          ? updateAt(rows, index, patch)
          : updateRowInList(rows, rowKeyField, key, patch),
        reasoned(commitOptions, 'edit'),
        true,
      )
    },
    setChildren: (key, children, commitOptions) => {
      if (!treeOptions) return false
      const result = setTreeChildren(store.getState(), key, children, treeOptions)
      if (result.blocked || !result.matched || !result.changed) return false
      return commit(result.rows, reasoned(commitOptions, 'children'), true)
    },
    syncChildren: (key, children) => {
      if (!treeOptions) return false
      const result = setTreeChildren(store.getState(), key, children, treeOptions)
      if (result.blocked || !result.matched || !result.changed) return false
      return commit(result.rows, {}, false)
    },
    sync: (rows) => {
      const current = store.getState()
      if (
        rows.length === current.length &&
        rows.every((row, index) => Object.is(row, current[index]))
      ) {
        return false
      }
      return commit(rows, {}, false)
    },
    clear: (commitOptions) =>
      store.getState().length === 0 ? false : commit([], commitOptions, true),
  }
  return model
}

/** Built-in rows capability: one source, transaction hooks, methods, and event. */
export function createGridRowsFeature<
  Row extends Record<string, unknown> = Record<string, unknown>,
  Meta = unknown,
>(options: GridRowsFeatureOptions<Row, Meta> = {}): GridFeature<Row> {
  return {
    name: 'rows',
    setup(context) {
      const model = createGridRowsModel(options, (transaction) =>
        context.emit(GRID_ROWS_CHANGE_EVENT, transaction),
      )
      const methods: GridRowsMethods<Row, Meta> = {
        getRowsModel: () => model,
        getRows: () => [...model.get()],
        getData: () => model.getData(),
        findRow: (key) => model.find(key),
        setRows: (rows, commitOptions) => model.commit(rows, commitOptions),
        loadData: (rows, commitOptions) => model.loadData(rows, commitOptions),
        insert: (row, index, commitOptions) => model.insert(row, index, commitOptions),
        remove: (key, commitOptions) => model.remove(key, commitOptions),
        removeMany: (keys, commitOptions) => model.removeMany(keys, commitOptions),
        update: (key, patch, commitOptions) => model.update(key, patch, commitOptions),
        setChildren: (key, children, commitOptions) =>
          model.setChildren(key, children, commitOptions),
        syncChildren: (key, children) => model.syncChildren(key, children),
        insertRow: (row, index, commitOptions) => model.insert(row, index, commitOptions),
        removeRow: (key, commitOptions) => model.remove(key, commitOptions),
        removeRows: (keys, commitOptions) => model.removeMany(keys, commitOptions),
        updateRow: (key, patch, commitOptions) => model.update(key, patch, commitOptions),
        transactRows: (updater, commitOptions) => model.transact(updater, commitOptions),
        syncRows: (rows) => model.sync(rows),
        clearRows: (commitOptions) => model.clear(commitOptions),
      }
      return { methods: methods as unknown as Readonly<Record<string, GridMethod>> }
    },
  }
}
