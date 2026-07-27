import * as React from 'react'
import { IrisButton, IrisInput, useI18n } from '@iris-ui-kit/react'
import {
  adminFieldName,
  coerceAdminFieldValue,
  createAdminDataController,
  formatAdminCell,
  hasAdminPermission,
  resolveAdminMessage,
  type AdminActionHandler,
  type AdminColumn,
  type AdminDataPage,
  type AdminMessageKey,
  type AdminMessages,
} from '@iris-ui-kit/plugin-admin/core'

export interface AdminDataPageViewProps {
  page: AdminDataPage
  permissions?: readonly string[]
  messages?: AdminMessages
  onAction?: AdminActionHandler
}

const stackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--iris-gap-md)',
}
const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--iris-gap-sm)',
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function inputType(column: AdminColumn): 'text' | 'email' | 'number' {
  if (column.type === 'email' || column.type === 'number') return column.type
  return 'text'
}

export function AdminDataPageView({
  page,
  permissions = [],
  messages,
  onAction,
}: AdminDataPageViewProps): React.ReactElement {
  const [controller] = React.useState(() => createAdminDataController(page))
  const resource = React.useSyncExternalStore(
    controller.resource.subscribe,
    controller.resource.getState,
    controller.resource.getState,
  )
  const editor = React.useSyncExternalStore(
    controller.editor.subscribe,
    controller.editor.getState,
    controller.editor.getState,
  )
  const { t } = useI18n()
  const id = React.useId()
  React.useEffect(() => () => controller.destroy(), [controller])

  const message = React.useCallback(
    (key: AdminMessageKey, params: Record<string, string | number> = {}) =>
      resolveAdminMessage(key, params, messages, t),
    [messages, t],
  )
  const canCreate =
    controller.capabilities.create && hasAdminPermission(page.permissions?.create, permissions)
  const canUpdate =
    controller.capabilities.update && hasAdminPermission(page.permissions?.update, permissions)
  const canDelete =
    controller.capabilities.delete && hasAdminPermission(page.permissions?.delete, permissions)
  const actions = (page.actions ?? []).filter((action) =>
    hasAdminPermission(action.permission, permissions),
  )
  const showActions = canUpdate || canDelete || actions.length > 0
  const pageCount = Math.max(1, controller.resource.pageCount())
  const failure = editor.actionError ?? resource.error

  const renderField = (column: AdminColumn): React.ReactNode => {
    const field = adminFieldName(column)
    const fieldId = `${id}-${field}`
    const errorId = `${fieldId}-error`
    const value = editor.draft[field]
    const invalid = Boolean(editor.errors[field])
    let control: React.ReactNode
    if (column.type === 'boolean') {
      control = (
        <input
          id={fieldId}
          type="checkbox"
          checked={Boolean(value)}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => controller.setField(field, event.currentTarget.checked)}
        />
      )
    } else if (column.type === 'select') {
      control = (
        <select
          id={fieldId}
          value={String(value ?? '')}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) =>
            controller.setField(field, coerceAdminFieldValue(column, event.currentTarget.value))
          }
        >
          <option value="">{column.placeholder ?? ''}</option>
          {column.options?.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      )
    } else if (column.type === 'date') {
      control = (
        <input
          id={fieldId}
          type="date"
          value={String(value ?? '')}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => controller.setField(field, event.currentTarget.value)}
        />
      )
    } else {
      control = (
        <IrisInput
          id={fieldId}
          type={inputType(column)}
          value={String(value ?? '')}
          placeholder={column.placeholder}
          invalid={invalid}
          ariaDescribedby={invalid ? errorId : undefined}
          onChange={(event) =>
            controller.setField(field, coerceAdminFieldValue(column, event.currentTarget.value))
          }
        />
      )
    }
    return (
      <div key={column.key} data-iris-admin-field={field} style={stackStyle}>
        <label htmlFor={fieldId}>
          {column.title}
          {column.required ? ' *' : ''}
        </label>
        {control}
        {invalid ? (
          <span id={errorId} role="alert">
            {editor.errors[field]}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div data-iris-admin-data-page={page.key} style={stackStyle}>
      <div style={rowStyle}>
        {page.title ? <h2 data-iris-admin-page-title="">{page.title}</h2> : null}
        {canCreate ? (
          <IrisButton onClick={() => controller.beginCreate()}>{message('create')}</IrisButton>
        ) : null}
      </div>

      {editor.mode !== 'idle' ? (
        <form
          data-iris-admin-editor={editor.mode}
          aria-label={message(editor.mode === 'create' ? 'editorCreate' : 'editorEdit', {
            title: page.title ?? page.key,
          })}
          style={stackStyle}
          onSubmit={(event) => {
            event.preventDefault()
            void controller.save()
          }}
        >
          {controller.editableColumns.map(renderField)}
          <div style={rowStyle}>
            <IrisButton type="submit" loading={editor.saving}>
              {message('save')}
            </IrisButton>
            <IrisButton variant="outline" onClick={() => controller.cancelEdit()}>
              {message('cancel')}
            </IrisButton>
          </div>
        </form>
      ) : null}

      {failure ? (
        <div role="alert" data-iris-admin-error="">
          {errorText(failure)}{' '}
          <IrisButton variant="outline" onClick={() => void controller.resource.reload()}>
            {message('retry')}
          </IrisButton>
        </div>
      ) : null}
      {resource.loading ? (
        <div role="status" aria-live="polite">
          {message('loading')}
        </div>
      ) : null}

      <table
        data-iris-admin-table=""
        aria-label={page.title ?? page.key}
        aria-busy={resource.loading || undefined}
      >
        <thead>
          <tr>
            {page.columns.map((column) => {
              const activeSort = resource.sort?.key === column.key ? resource.sort : null
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    activeSort
                      ? activeSort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() =>
                        controller.resource.setSort(
                          !activeSort
                            ? { key: column.key, direction: 'asc' }
                            : activeSort.direction === 'asc'
                              ? { key: column.key, direction: 'desc' }
                              : null,
                        )
                      }
                    >
                      {column.title}
                    </button>
                  ) : (
                    column.title
                  )}
                </th>
              )
            })}
            {showActions ? <th scope="col">{message('actions')}</th> : null}
          </tr>
          {page.columns.some((column) => column.filterable) ? (
            <tr data-iris-admin-filters="">
              {page.columns.map((column) => (
                <th key={column.key}>
                  {column.filterable ? (
                    <IrisInput
                      type="search"
                      value={resource.filters[column.key] ?? ''}
                      aria-label={message('filter', { column: column.title })}
                      onChange={(event) =>
                        controller.resource.setFilter(column.key, event.currentTarget.value)
                      }
                    />
                  ) : null}
                </th>
              ))}
              {showActions ? <th /> : null}
            </tr>
          ) : null}
        </thead>
        <tbody>
          {resource.rows.length === 0 && !resource.loading ? (
            <tr>
              <td colSpan={page.columns.length + (showActions ? 1 : 0)}>{message('empty')}</td>
            </tr>
          ) : (
            resource.rows.map((row, index) => {
              const key = controller.rowKey(row, index)
              const confirming = editor.deletingKey === key
              return (
                <tr key={key} data-row-key={key}>
                  {page.columns.map((column) => (
                    <td key={column.key}>{formatAdminCell(row[adminFieldName(column)], column)}</td>
                  ))}
                  {showActions ? (
                    <td>
                      <div style={rowStyle}>
                        {canUpdate ? (
                          <IrisButton variant="outline" onClick={() => controller.beginEdit(row)}>
                            {message('edit')}
                          </IrisButton>
                        ) : null}
                        {canDelete && !confirming ? (
                          <IrisButton
                            variant="outline"
                            onClick={() => controller.requestDelete(row)}
                          >
                            {message('delete')}
                          </IrisButton>
                        ) : null}
                        {canDelete && confirming ? (
                          <>
                            <IrisButton
                              loading={editor.saving}
                              onClick={() => void controller.confirmDelete()}
                            >
                              {message('confirmDelete')}
                            </IrisButton>
                            <IrisButton variant="outline" onClick={() => controller.cancelDelete()}>
                              {message('cancel')}
                            </IrisButton>
                          </>
                        ) : null}
                        {actions.map((action) => {
                          const running = editor.runningAction === `${action.key}:${key}`
                          return (
                            <IrisButton
                              key={action.key}
                              variant="outline"
                              loading={running}
                              disabled={!onAction}
                              onClick={() => void controller.runAction(action.key, row, onAction)}
                            >
                              {action.label}
                            </IrisButton>
                          )
                        })}
                      </div>
                    </td>
                  ) : null}
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      <nav
        data-iris-admin-pager=""
        aria-label={`${page.title ?? page.key} pagination`}
        style={rowStyle}
      >
        <IrisButton
          variant="outline"
          disabled={resource.page <= 1}
          onClick={() => controller.resource.setPage(resource.page - 1)}
        >
          {message('previous')}
        </IrisButton>
        <span data-iris-admin-page-info="">
          {message('page', { page: resource.page, pages: pageCount })}
        </span>
        <IrisButton
          variant="outline"
          disabled={resource.page >= pageCount}
          onClick={() => controller.resource.setPage(resource.page + 1)}
        >
          {message('next')}
        </IrisButton>
      </nav>
    </div>
  )
}
