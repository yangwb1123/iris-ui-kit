import {
  createClientFetcher,
  createResourceController,
  createStore,
  readCell,
  type DataViewColumn,
  type ResourceController,
  type Store,
} from '@iris-ui-kit/core'
import { resolveAdminMessage } from './schema'
import type {
  AdminActionHandler,
  AdminColumn,
  AdminDataPage,
  AdminEditorState,
  AdminMessageKey,
  AdminOperationCapabilities,
  AdminRow,
} from './types'

export interface AdminDataController<Row extends AdminRow = AdminRow> {
  readonly page: AdminDataPage<Row>
  readonly resource: ResourceController<Row>
  readonly editor: Store<AdminEditorState<Row>>
  readonly capabilities: AdminOperationCapabilities
  readonly editableColumns: AdminColumn[]
  rowKey(row: Row, index?: number): string
  beginCreate(): void
  beginEdit(row: Row): void
  setField(field: string, value: unknown): void
  cancelEdit(): void
  save(): Promise<boolean>
  requestDelete(row: Row): void
  cancelDelete(): void
  confirmDelete(): Promise<boolean>
  runAction(actionKey: string, row: Row, handler?: AdminActionHandler<Row>): Promise<boolean>
  clearActionError(): void
  destroy(): void
}

/** Map admin columns onto the core data-view column contract. */
export function adminDataViewColumns<Row extends AdminRow>(
  columns: readonly AdminColumn[],
): DataViewColumn<Row>[] {
  return columns.map((column) => ({
    key: column.key,
    getValue: (row: Row) => readCell(row, column),
    filterable: column.filterable,
  }))
}

export function adminFieldName(column: AdminColumn): string {
  return column.dataIndex ?? column.key
}

export function coerceAdminFieldValue(column: AdminColumn, value: unknown): unknown {
  if (column.type === 'boolean') {
    return typeof value === 'string' ? value === 'true' : Boolean(value)
  }
  if (column.type === 'number') {
    if (value === '' || value === null || value === undefined) return undefined
    const number = typeof value === 'number' ? value : Number(value)
    return Number.isNaN(number) ? value : number
  }
  if (column.type === 'select') {
    return column.options?.find((option) => String(option.value) === String(value))?.value ?? value
  }
  return value
}

export function formatAdminCell(value: unknown, column: AdminColumn): string {
  if (value === null || value === undefined) return ''
  if (column.type === 'boolean') return value ? 'Yes' : 'No'
  if (column.type === 'date' && value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toLocaleDateString()
  }
  return String(value)
}

function replaceParams(key: AdminMessageKey, params: Record<string, string | number>): string {
  return resolveAdminMessage(key, params)
}

interface AdminValidationResult {
  message?: string
  stop?: boolean
}

function validateAdminNumber(column: AdminColumn, value: unknown): AdminValidationResult {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) {
    return { message: replaceParams('invalidNumber', { field: column.title }), stop: true }
  }
  if (column.min !== undefined && number < column.min) {
    return { message: replaceParams('min', { field: column.title, min: column.min }) }
  }
  if (column.max !== undefined && number > column.max) {
    return { message: replaceParams('max', { field: column.title, max: column.max }) }
  }
  return {}
}

function validateAdminField(column: AdminColumn, value: unknown): string | undefined {
  const empty = value === undefined || value === null || value === ''
  if (column.required && empty) return replaceParams('required', { field: column.title })
  if (empty) return undefined

  let message: string | undefined
  if (column.type === 'number') {
    const result = validateAdminNumber(column, value)
    message = result.message
    if (result.stop) return message
  }
  if (column.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
    message = replaceParams('invalidEmail', { field: column.title })
  }
  if (column.pattern && !new RegExp(column.pattern).test(String(value))) {
    message = replaceParams('pattern', { field: column.title })
  }
  if (
    column.type === 'select' &&
    column.options &&
    !column.options.some((option) => String(option.value) === String(value))
  ) {
    message = replaceParams('invalidOption', { field: column.title })
  }
  return message
}

export function validateAdminDraft(
  columns: readonly AdminColumn[],
  draft: Readonly<Partial<AdminRow>>,
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const column of columns) {
    const field = adminFieldName(column)
    const message = validateAdminField(column, draft[field])
    if (message) errors[field] = message
  }
  return errors
}

function initialDraft(columns: readonly AdminColumn[]): Partial<AdminRow> {
  return Object.fromEntries(
    columns.map((column) => [
      adminFieldName(column),
      column.defaultValue ?? (column.type === 'boolean' ? false : ''),
    ]),
  )
}

function idleState<Row extends AdminRow>(): AdminEditorState<Row> {
  return {
    mode: 'idle',
    draft: {},
    editingKey: null,
    deletingKey: null,
    errors: {},
    saving: false,
    runningAction: null,
    actionError: undefined,
  }
}

export function adminOperationCapabilities<Row extends AdminRow>(
  page: AdminDataPage<Row>,
): AdminOperationCapabilities {
  const local = page.data !== undefined
  return {
    create: Boolean(page.mutations?.create || (page.editable && local)),
    update: Boolean(page.mutations?.update || (page.editable && local)),
    delete: Boolean(page.mutations?.delete || (page.editable && local)),
  }
}

/**
 * Shared CRUD/query controller. Adapters subscribe to its two stores and only
 * render framework-native DOM/components; validation, mutation ordering,
 * stable keys and server/client behavior stay here.
 */
class AdminDataControllerEngine<Row extends AdminRow> {
  readonly controller: AdminDataController<Row>

  constructor(page: AdminDataPage<Row>) {
    const clientRows = [...(page.data ?? [])]
    const columns = adminDataViewColumns<Row>(page.columns)
    const fetcher = page.fetcher ?? createClientFetcher(clientRows, columns)
    const resource = createResourceController<Row>({
      fetcher,
      pageSize: page.pageSize ?? 10,
    })
    const editor = createStore<AdminEditorState<Row>>(idleState<Row>())
    const capabilities = adminOperationCapabilities(page)
    const editableColumns = page.columns.filter(
      (column) => column.editable ?? page.editable ?? Boolean(page.mutations),
    )
    const generatedKeys = new WeakMap<object, string>()
    let generatedKey = 0

    const rowKey = (row: Row, index = 0): string => {
      const configured = page.rowKey ? row[page.rowKey] : (row.id ?? row.key)
      if (configured !== undefined && configured !== null && configured !== '') {
        return String(configured)
      }
      let generated = generatedKeys.get(row)
      if (!generated) {
        generated = `legacy-${page.key}-${++generatedKey}-${index}`
        generatedKeys.set(row, generated)
      }
      return generated
    }

    const findCurrent = (key: string): Row | undefined =>
      resource.getState().rows.find((row, index) => rowKey(row, index) === key) ??
      clientRows.find((row, index) => rowKey(row, index) === key)

    const resetEditor = (): void => {
      editor.setState((state) => ({ ...idleState<Row>(), actionError: state.actionError }))
    }

    const fail = (error: unknown): false => {
      editor.setState((state) => ({
        ...state,
        saving: false,
        runningAction: null,
        actionError: error,
      }))
      return false
    }

    const controller: AdminDataController<Row> = {
      page,
      resource,
      editor,
      capabilities,
      editableColumns,
      rowKey,
      beginCreate() {
        if (!capabilities.create) return
        editor.setState({
          ...idleState<Row>(),
          mode: 'create',
          draft: initialDraft(editableColumns) as Partial<Row>,
        })
      },
      beginEdit(row) {
        if (!capabilities.update) return
        editor.setState({
          ...idleState<Row>(),
          mode: 'edit',
          editingKey: rowKey(row),
          draft: { ...row },
        })
      },
      setField(field, value) {
        editor.setState((state) => {
          const errors = { ...state.errors }
          delete errors[field]
          return { ...state, draft: { ...state.draft, [field]: value }, errors }
        })
      },
      cancelEdit: resetEditor,
      async save() {
        const state = editor.getState()
        if (state.mode === 'idle' || state.saving) return false
        const errors = validateAdminDraft(editableColumns, state.draft)
        if (Object.keys(errors).length) {
          editor.setState((current) => ({ ...current, errors }))
          return false
        }
        editor.setState((current) => ({ ...current, saving: true, actionError: undefined }))
        try {
          if (state.mode === 'create') {
            await resource.mutate(
              async () => {
                const created = await page.mutations?.create?.(state.draft)
                if (page.data !== undefined) clientRows.push((created ?? { ...state.draft }) as Row)
              },
              { skipReload: true },
            )
          } else {
            const key = state.editingKey
            const current = key ? findCurrent(key) : undefined
            if (!key || !current) throw new Error('The row being edited no longer exists.')
            await resource.mutate(
              async () => {
                const updated = await page.mutations?.update?.(key, state.draft, current)
                if (page.data !== undefined) {
                  const index = clientRows.findIndex(
                    (row, rowIndex) => rowKey(row, rowIndex) === key,
                  )
                  if (index >= 0) {
                    // Replace the row instead of mutating it in place. Solid's
                    // keyed `<For>` observes identity, while React/Vue/Svelte
                    // also benefit from the immutable update.
                    const replacement = {
                      ...current,
                      ...state.draft,
                      ...(updated ?? {}),
                    } as Row
                    const generated = generatedKeys.get(current)
                    if (generated) generatedKeys.set(replacement, generated)
                    clientRows[index] = replacement
                  }
                }
              },
              { skipReload: true },
            )
          }
          // Close the editor before the refreshed row becomes observable. This
          // prevents a fast renderer from opening an edit session on the new row
          // while the preceding save is still completing.
          resetEditor()
          await resource.reload()
          return true
        } catch (error) {
          return fail(error)
        }
      },
      requestDelete(row) {
        if (!capabilities.delete) return
        editor.setState((state) => ({ ...state, deletingKey: rowKey(row), actionError: undefined }))
      },
      cancelDelete() {
        editor.setState((state) => ({ ...state, deletingKey: null }))
      },
      async confirmDelete() {
        const key = editor.getState().deletingKey
        if (!key) return false
        const current = findCurrent(key)
        if (!current) return fail(new Error('The row being deleted no longer exists.'))
        editor.setState((state) => ({ ...state, saving: true, actionError: undefined }))
        try {
          await resource.mutate(
            async () => {
              await page.mutations?.delete?.(key, current)
              if (page.data !== undefined) {
                const index = clientRows.indexOf(current)
                if (index >= 0) clientRows.splice(index, 1)
              }
            },
            { skipReload: true },
          )
          resetEditor()
          await resource.reload()
          return true
        } catch (error) {
          return fail(error)
        }
      },
      async runAction(actionKey, row, handler) {
        if (!handler) return fail(new Error(`No handler registered for action "${actionKey}".`))
        const runningAction = `${actionKey}:${rowKey(row)}`
        editor.setState((state) => ({ ...state, runningAction, actionError: undefined }))
        try {
          await handler(page.key, actionKey, row)
          editor.setState((state) => ({ ...state, runningAction: null }))
          return true
        } catch (error) {
          return fail(error)
        }
      },
      clearActionError() {
        editor.setState((state) => ({ ...state, actionError: undefined }))
      },
      destroy: resource.destroy,
    }
    this.controller = controller
  }
}

export function createAdminDataController<Row extends AdminRow>(
  page: AdminDataPage<Row>,
): AdminDataController<Row> {
  return new AdminDataControllerEngine(page).controller
}
