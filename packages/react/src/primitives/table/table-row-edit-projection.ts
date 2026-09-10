import type {
  CellEdit,
  CellEditState,
  GridEditingKey,
  Store,
  TableRowEditModel,
} from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'

type TableRowKey = GridEditingKey
type RowCellEdit = CellEdit<TableRowKey>

function sameCellEditState<Key extends string | number>(
  a: CellEditState<Key>,
  b: CellEditState<Key>,
): boolean {
  const aEditing = a.editing
  const bEditing = b.editing
  const sameEditing =
    aEditing === bEditing ||
    (aEditing !== null &&
      bEditing !== null &&
      Object.is(aEditing.rowKey, bEditing.rowKey) &&
      aEditing.columnKey === bEditing.columnKey)
  return (
    sameEditing &&
    Object.is(a.draft, b.draft) &&
    a.error === b.error &&
    Object.is(a.validated, b.validated)
  )
}

function createProjectedStore(
  read: () => CellEditState<TableRowKey>,
  subscribeSource: (listener: () => void) => () => void,
): Store<CellEditState<TableRowKey>> {
  let snapshot = read()
  const listeners = new Set<(state: CellEditState<TableRowKey>) => void>()
  let sourceUnsubscribe: (() => void) | null = null

  const notify = (): void => {
    for (const listener of [...listeners]) {
      if (listeners.has(listener)) listener(snapshot)
    }
  }
  const refresh = (): boolean => {
    const next = read()
    if (sameCellEditState(snapshot, next)) return false
    snapshot = next
    notify()
    return true
  }
  const subscribe = (listener: (state: CellEditState<TableRowKey>) => void): (() => void) => {
    listeners.add(listener)
    if (sourceUnsubscribe === null) {
      sourceUnsubscribe = subscribeSource(() => refresh())
      refresh()
    }
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0 && sourceUnsubscribe !== null) {
        sourceUnsubscribe()
        sourceUnsubscribe = null
      }
    }
  }

  return {
    getState: () => {
      refresh()
      return snapshot
    },
    subscribe,
    setState: () => {
      throw new Error('row edit projection store is read-only')
    },
    subscribeWith<U>(
      selector: (state: CellEditState<TableRowKey>) => U,
      listener: (value: U) => void,
      equals: (a: U, b: U) => boolean = Object.is,
    ): () => void {
      let previous = selector(snapshot)
      return subscribe((state) => {
        const next = selector(state)
        if (!equals(previous, next)) {
          previous = next
          listener(next)
        }
      })
    },
    batch<R>(fn: () => R): R {
      return fn()
    },
  }
}

export interface ProjectedSession {
  readonly edit: RowCellEdit
  markValidated(value: unknown): void
}

function sessionId(key: TableRowKey, columnKey: string): string {
  return `${String(key)}::${columnKey}`
}

export function createProjectedSession<Row extends Record<string, unknown>>(
  id: string,
  model: TableRowEditModel<Row, IrisTableColumn<Row>, TableRowKey>,
  getColumnKey: (column: IrisTableColumn<Row>) => string,
  startEdit: (rowKey: TableRowKey, columnKey: string, initialDraft: unknown) => void,
): ProjectedSession {
  let validated: unknown = undefined
  const read = (): CellEditState<TableRowKey> => {
    const session = model.session(id)
    return {
      editing: session ? { rowKey: session.rowKey, columnKey: getColumnKey(session.column) } : null,
      draft: session?.draft ?? '',
      error: session?.error ?? null,
      validated,
    }
  }
  const store = createProjectedStore(read, (listener) => model.store.subscribe(() => listener()))
  const edit: RowCellEdit = {
    store,
    getEditing: () => store.getState().editing,
    isEditing: (rowKey, columnKey) => {
      const editing = store.getState().editing
      return (
        editing !== null && Object.is(editing.rowKey, rowKey) && editing.columnKey === columnKey
      )
    },
    getDraft: () => store.getState().draft,
    getError: () => store.getState().error,
    getValidated: () => store.getState().validated,
    startEdit: (rowKey, columnKey, initialDraft = '') => {
      startEdit(rowKey, columnKey, initialDraft)
    },
    setDraft: (draft) => {
      model.setDraft(id, draft)
    },
    cancelEdit: () => {
      model.cancelAll()
    },
    commitEdit: (value) => {
      if (value !== undefined) model.setDraft(id, value)
      if (model.session(id) === undefined) return false
      const accepted = model.commit(id)
      return accepted && model.session(id) === undefined
    },
  }
  return {
    edit,
    markValidated(value) {
      validated = value
      store.getState()
    },
  }
}

export { sessionId }
