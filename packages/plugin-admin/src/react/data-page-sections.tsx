import * as React from 'react'
import { IrisButton, IrisInput } from '@iris-ui-kit/react'
import {
  adminFieldName,
  formatAdminCell,
  type AdminActionHandler,
  type AdminColumn,
  type AdminDataPage,
} from '@iris-ui-kit/plugin-admin/core'

import {
  errorText,
  rowStyle,
  type AdminController,
  type AdminEditorSnapshot,
  type AdminMessage,
  type AdminResourceState,
} from './data-page-editor'
function AdminSortButton({
  column,
  onSort,
}: {
  column: AdminColumn
  onSort: () => void
}): React.ReactElement | string {
  if (!column.sortable) return column.title
  return (
    <button type="button" onClick={onSort}>
      {column.title}
    </button>
  )
}

function AdminTableHeader({
  page,
  resource,
  controller,
  showActions,
  message,
}: {
  page: AdminDataPage
  resource: AdminResourceState
  controller: AdminController
  showActions: boolean
  message: AdminMessage
}): React.ReactElement {
  const hasFilters = page.columns.some((column) => column.filterable)
  return (
    <thead>
      <tr>
        {page.columns.map((column) => {
          const activeSort = resource.sort?.key === column.key ? resource.sort : null
          const nextSort = !activeSort
            ? { key: column.key, direction: 'asc' as const }
            : activeSort.direction === 'asc'
              ? { key: column.key, direction: 'desc' as const }
              : null
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
              <AdminSortButton
                column={column}
                onSort={() => controller.resource.setSort(nextSort)}
              />
            </th>
          )
        })}
        {showActions ? <th scope="col">{message('actions')}</th> : null}
      </tr>
      {hasFilters ? (
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
  )
}

function AdminRowActions({
  row,
  rowKey,
  pageActions,
  canUpdate,
  canDelete,
  confirming,
  runningAction,
  saving,
  onAction,
  controller,
  message,
}: {
  row: Record<string, unknown>
  rowKey: string
  pageActions: NonNullable<AdminDataPage['actions']>
  canUpdate: boolean
  canDelete: boolean
  confirming: boolean
  runningAction: string | null
  saving: boolean
  onAction?: AdminActionHandler
  controller: AdminController
  message: AdminMessage
}): React.ReactElement {
  return (
    <td>
      <div style={rowStyle}>
        {canUpdate ? (
          <IrisButton variant="outline" onClick={() => controller.beginEdit(row)}>
            {message('edit')}
          </IrisButton>
        ) : null}
        {canDelete && !confirming ? (
          <IrisButton variant="outline" onClick={() => controller.requestDelete(row)}>
            {message('delete')}
          </IrisButton>
        ) : null}
        {canDelete && confirming ? (
          <>
            <IrisButton loading={saving} onClick={() => void controller.confirmDelete()}>
              {message('confirmDelete')}
            </IrisButton>
            <IrisButton variant="outline" onClick={() => controller.cancelDelete()}>
              {message('cancel')}
            </IrisButton>
          </>
        ) : null}
        {pageActions.map((action) => {
          const running = runningAction === `${action.key}:${rowKey}`
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
  )
}

function AdminTableBody({
  page,
  resource,
  editor,
  controller,
  showActions,
  canUpdate,
  canDelete,
  actions,
  onAction,
  message,
}: {
  page: AdminDataPage
  resource: AdminResourceState
  editor: AdminEditorSnapshot
  controller: AdminController
  showActions: boolean
  canUpdate: boolean
  canDelete: boolean
  actions: NonNullable<AdminDataPage['actions']>
  onAction?: AdminActionHandler
  message: AdminMessage
}): React.ReactElement {
  if (resource.rows.length === 0 && !resource.loading) {
    return (
      <tbody>
        <tr>
          <td colSpan={page.columns.length + (showActions ? 1 : 0)}>{message('empty')}</td>
        </tr>
      </tbody>
    )
  }
  return (
    <tbody>
      {resource.rows.map((row, index) => {
        const key = controller.rowKey(row, index)
        const confirming = editor.deletingKey === key
        return (
          <tr key={key} data-row-key={key}>
            {page.columns.map((column) => (
              <td key={column.key}>{formatAdminCell(row[adminFieldName(column)], column)}</td>
            ))}
            {showActions ? (
              <AdminRowActions
                row={row}
                rowKey={key}
                pageActions={actions}
                canUpdate={canUpdate}
                canDelete={canDelete}
                confirming={confirming}
                runningAction={editor.runningAction}
                saving={editor.saving}
                onAction={onAction}
                controller={controller}
                message={message}
              />
            ) : null}
          </tr>
        )
      })}
    </tbody>
  )
}

export function AdminTable({
  page,
  resource,
  editor,
  controller,
  showActions,
  canUpdate,
  canDelete,
  actions,
  onAction,
  message,
}: {
  page: AdminDataPage
  resource: AdminResourceState
  editor: AdminEditorSnapshot
  controller: AdminController
  showActions: boolean
  canUpdate: boolean
  canDelete: boolean
  actions: NonNullable<AdminDataPage['actions']>
  onAction?: AdminActionHandler
  message: AdminMessage
}): React.ReactElement {
  return (
    <table
      data-iris-admin-table=""
      aria-label={page.title ?? page.key}
      aria-busy={resource.loading || undefined}
    >
      <AdminTableHeader
        page={page}
        resource={resource}
        controller={controller}
        showActions={showActions}
        message={message}
      />
      <AdminTableBody
        page={page}
        resource={resource}
        editor={editor}
        controller={controller}
        showActions={showActions}
        canUpdate={canUpdate}
        canDelete={canDelete}
        actions={actions}
        onAction={onAction}
        message={message}
      />
    </table>
  )
}

export function AdminPageHeading({
  page,
  canCreate,
  controller,
  message,
}: {
  page: AdminDataPage
  canCreate: boolean
  controller: AdminController
  message: AdminMessage
}): React.ReactElement {
  return (
    <div style={rowStyle}>
      {page.title ? <h2 data-iris-admin-page-title="">{page.title}</h2> : null}
      {canCreate ? (
        <IrisButton onClick={() => controller.beginCreate()}>{message('create')}</IrisButton>
      ) : null}
    </div>
  )
}

export function AdminStatus({
  failure,
  loading,
  controller,
  message,
}: {
  failure: unknown
  loading: boolean
  controller: AdminController
  message: AdminMessage
}): React.ReactElement {
  return (
    <>
      {failure ? (
        <div role="alert" data-iris-admin-error="">
          {errorText(failure)}{' '}
          <IrisButton variant="outline" onClick={() => void controller.resource.reload()}>
            {message('retry')}
          </IrisButton>
        </div>
      ) : null}
      {loading ? (
        <div role="status" aria-live="polite">
          {message('loading')}
        </div>
      ) : null}
    </>
  )
}

export function AdminPager({
  page,
  label,
  pageCount,
  controller,
  message,
}: {
  page: AdminResourceState
  label: string
  pageCount: number
  controller: AdminController
  message: AdminMessage
}): React.ReactElement {
  return (
    <nav data-iris-admin-pager="" aria-label={`${label} pagination`} style={rowStyle}>
      <IrisButton
        variant="outline"
        disabled={page.page <= 1}
        onClick={() => controller.resource.setPage(page.page - 1)}
      >
        {message('previous')}
      </IrisButton>
      <span data-iris-admin-page-info="">
        {message('page', { page: page.page, pages: pageCount })}
      </span>
      <IrisButton
        variant="outline"
        disabled={page.page >= pageCount}
        onClick={() => controller.resource.setPage(page.page + 1)}
      >
        {message('next')}
      </IrisButton>
    </nav>
  )
}
