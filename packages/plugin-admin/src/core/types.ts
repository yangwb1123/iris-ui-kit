import type { NavNode, ResourceQuery } from '@iris-ui-kit/core'

export type AdminRow = Record<string, unknown>
export type AdminFieldType = 'text' | 'email' | 'number' | 'boolean' | 'select' | 'date'
export type AdminPermission = boolean | string | readonly string[]
export type AdminActionTone = 'default' | 'danger'
export type MaybePromise<T> = T | Promise<T>

export interface AdminSelectOption {
  label: string
  value: string | number
}

/** Display, query and optional editor metadata for one data-page field. */
export interface AdminColumn {
  key: string
  title: string
  /** Row field to read; defaults to `key`. */
  dataIndex?: string
  type?: AdminFieldType
  sortable?: boolean
  filterable?: boolean
  /** Included in create/edit forms. Defaults to the page's `editable` flag. */
  editable?: boolean
  required?: boolean
  placeholder?: string
  defaultValue?: unknown
  options?: AdminSelectOption[]
  min?: number
  max?: number
  pattern?: string
}

export interface AdminMutationHandlers<Row extends AdminRow = AdminRow> {
  create?: (values: Partial<Row>) => MaybePromise<Row | void>
  update?: (key: string, values: Partial<Row>, current: Row) => MaybePromise<Row | void>
  delete?: (key: string, current: Row) => MaybePromise<void>
}

export interface AdminCrudPermissions {
  create?: AdminPermission
  update?: AdminPermission
  delete?: AdminPermission
}

/** Declarative custom row action; execution is delegated to `onAction`. */
export interface AdminRowAction {
  key: string
  label: string
  tone?: AdminActionTone
  permission?: AdminPermission
}

export type AdminDataFetcher<Row extends AdminRow = AdminRow> = (
  query: ResourceQuery,
) => Promise<{ rows: Row[]; total: number }>

/**
 * Paginated client or server data page. Existing read-only schemas remain
 * valid (`data` + `columns`); CRUD/query metadata is entirely opt-in.
 */
export interface AdminDataPage<Row extends AdminRow = AdminRow> {
  type: 'data'
  /** Matches the nav leaf key it renders for. */
  key: string
  title?: string
  columns: AdminColumn[]
  /** Client-mode dataset. Omit when `fetcher` owns server data. */
  data?: Row[]
  /** Server-mode fetcher; receives page, sort and filter query state. */
  fetcher?: AdminDataFetcher<Row>
  /** Stable row identifier field. Defaults to `id`, then `key` for legacy rows. */
  rowKey?: string
  /** Enables local create/edit/delete. Server pages still require handlers. */
  editable?: boolean
  mutations?: AdminMutationHandlers<Row>
  permissions?: AdminCrudPermissions
  actions?: AdminRowAction[]
  /** Rows per page. Default 10. */
  pageSize?: number
}

/** A custom page: the host renders it (by key) via `IrisAdminApp.renderPage`. */
export interface AdminCustomPage {
  type: 'custom'
  key: string
  title?: string
}

export type AdminPage = AdminDataPage | AdminCustomPage

/** The declarative CMS schema: a nav tree + a page per route key. */
export interface AdminAppSchema {
  title?: string
  nav: NavNode[]
  pages: AdminPage[]
}

export interface AdminSchemaIssue {
  path: string
  code:
    | 'invalid-schema'
    | 'duplicate-key'
    | 'missing-page'
    | 'missing-source'
    | 'invalid-page-size'
    | 'invalid-field'
    | 'missing-row-key'
  severity: 'error' | 'warning'
  message: string
}

export type AdminEditorMode = 'idle' | 'create' | 'edit'

export interface AdminEditorState<Row extends AdminRow = AdminRow> {
  mode: AdminEditorMode
  draft: Partial<Row>
  editingKey: string | null
  deletingKey: string | null
  errors: Record<string, string>
  saving: boolean
  runningAction: string | null
  actionError: unknown
}

export interface AdminOperationCapabilities {
  create: boolean
  update: boolean
  delete: boolean
}

export type AdminActionHandler<Row extends AdminRow = AdminRow> = (
  pageKey: string,
  actionKey: string,
  row: Row,
) => MaybePromise<void>

export const adminMessageDefaults = {
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  save: 'Save',
  cancel: 'Cancel',
  confirmDelete: 'Confirm delete',
  actions: 'Actions',
  previous: 'Previous',
  next: 'Next',
  page: 'Page {page} of {pages}',
  loading: 'Loading…',
  empty: 'No rows',
  retry: 'Retry',
  filter: 'Filter {column}',
  editorCreate: 'Create {title}',
  editorEdit: 'Edit {title}',
  required: '{field} is required.',
  invalidNumber: '{field} must be a number.',
  invalidEmail: '{field} must be a valid email address.',
  min: '{field} must be at least {min}.',
  max: '{field} must be at most {max}.',
  pattern: '{field} has an invalid format.',
  invalidOption: '{field} has an invalid value.',
} as const

export type AdminMessageKey = keyof typeof adminMessageDefaults
export type AdminMessages = Partial<Record<AdminMessageKey, string>>
