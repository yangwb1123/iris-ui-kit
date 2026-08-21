import { For, Show, type Accessor, type JSX } from 'solid-js'
import { IrisButton, IrisInput } from '@iris-ui-kit/solid'
import {
  adminFieldName,
  formatAdminCell,
  type AdminActionHandler,
  type AdminDataPage,
} from '@iris-ui-kit/plugin-admin/core'
import {
  errorText,
  rowStyle,
  type AdminController,
  type AdminEditorState,
  type AdminMessage,
  type AdminResourceState,
} from './data-page-types'

export const AdminPageHeading = (props: {
  page: AdminDataPage
  canCreate: Accessor<boolean>
  controller: AdminController
  message: AdminMessage
}): JSX.Element => (
  <div style={rowStyle}>
    <Show when={props.page.title}>
      <h2 data-iris-admin-page-title="">{props.page.title}</h2>
    </Show>
    <Show when={props.canCreate()}>
      <IrisButton onClick={() => props.controller.beginCreate()}>
        {props.message('create')}
      </IrisButton>
    </Show>
  </div>
)

export const AdminStatus = (props: {
  failure: Accessor<unknown>
  loading: Accessor<boolean>
  controller: AdminController
  message: AdminMessage
}): JSX.Element => (
  <>
    <Show when={props.failure()}>
      {(error) => (
        <div role="alert" data-iris-admin-error="">
          {errorText(error())}{' '}
          <IrisButton variant="outline" onClick={() => void props.controller.resource.reload()}>
            {props.message('retry')}
          </IrisButton>
        </div>
      )}
    </Show>
    <Show when={props.loading()}>
      <div role="status" aria-live="polite">
        {props.message('loading')}
      </div>
    </Show>
  </>
)

const AdminTableHeader = (props: {
  page: AdminDataPage
  resource: Accessor<AdminResourceState>
  controller: AdminController
  showActions: Accessor<boolean>
  message: AdminMessage
}): JSX.Element => (
  <thead>
    <tr>
      <For each={props.page.columns}>
        {(column) => {
          const activeSort = () =>
            props.resource().sort?.key === column.key ? props.resource().sort : null
          return (
            <th
              scope="col"
              aria-sort={
                activeSort()
                  ? activeSort()!.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : undefined
              }
            >
              <Show when={column.sortable} fallback={column.title}>
                <button
                  type="button"
                  onClick={() =>
                    props.controller.resource.setSort(
                      !activeSort()
                        ? { key: column.key, direction: 'asc' }
                        : activeSort()!.direction === 'asc'
                          ? { key: column.key, direction: 'desc' }
                          : null,
                    )
                  }
                >
                  {column.title}
                </button>
              </Show>
            </th>
          )
        }}
      </For>
      <Show when={props.showActions()}>
        <th scope="col">{props.message('actions')}</th>
      </Show>
    </tr>
    <Show when={props.page.columns.some((column) => column.filterable)}>
      <tr data-iris-admin-filters="">
        <For each={props.page.columns}>
          {(column) => (
            <th>
              <Show when={column.filterable}>
                <IrisInput
                  type="search"
                  value={props.resource().filters[column.key] ?? ''}
                  aria-label={props.message('filter', { column: column.title })}
                  onInput={(event) =>
                    props.controller.resource.setFilter(column.key, event.currentTarget.value)
                  }
                />
              </Show>
            </th>
          )}
        </For>
        <Show when={props.showActions()}>
          <th />
        </Show>
      </tr>
    </Show>
  </thead>
)

const AdminRowActions = (props: {
  row: Record<string, unknown>
  keyValue: string
  actions: NonNullable<AdminDataPage['actions']>
  canUpdate: Accessor<boolean>
  canDelete: Accessor<boolean>
  confirming: Accessor<boolean>
  editor: Accessor<AdminEditorState>
  onAction?: AdminActionHandler
  controller: AdminController
  message: AdminMessage
}): JSX.Element => (
  <td>
    <div style={rowStyle}>
      <Show when={props.canUpdate()}>
        <IrisButton variant="outline" onClick={() => props.controller.beginEdit(props.row)}>
          {props.message('edit')}
        </IrisButton>
      </Show>
      <Show when={props.canDelete() && !props.confirming()}>
        <IrisButton variant="outline" onClick={() => props.controller.requestDelete(props.row)}>
          {props.message('delete')}
        </IrisButton>
      </Show>
      <Show when={props.canDelete() && props.confirming()}>
        <IrisButton
          loading={props.editor().saving}
          onClick={() => void props.controller.confirmDelete()}
        >
          {props.message('confirmDelete')}
        </IrisButton>
        <IrisButton variant="outline" onClick={() => props.controller.cancelDelete()}>
          {props.message('cancel')}
        </IrisButton>
      </Show>
      <For each={props.actions}>
        {(action) => (
          <IrisButton
            variant="outline"
            loading={props.editor().runningAction === `${action.key}:${props.keyValue}`}
            disabled={!props.onAction}
            onClick={() => void props.controller.runAction(action.key, props.row, props.onAction)}
          >
            {action.label}
          </IrisButton>
        )}
      </For>
    </div>
  </td>
)

const AdminTableBody = (props: {
  page: AdminDataPage
  resource: Accessor<AdminResourceState>
  editor: Accessor<AdminEditorState>
  controller: AdminController
  showActions: Accessor<boolean>
  canUpdate: Accessor<boolean>
  canDelete: Accessor<boolean>
  actions: Accessor<NonNullable<AdminDataPage['actions']>>
  onAction?: AdminActionHandler
  message: AdminMessage
}): JSX.Element => (
  <tbody>
    <Show when={props.resource().rows.length === 0 && !props.resource().loading}>
      <tr>
        <td colSpan={props.page.columns.length + (props.showActions() ? 1 : 0)}>
          {props.message('empty')}
        </td>
      </tr>
    </Show>
    <For each={props.resource().rows}>
      {(row, index) => {
        const key = () => props.controller.rowKey(row, index())
        const confirming = () => props.editor().deletingKey === key()
        return (
          <tr data-row-key={key()}>
            <For each={props.page.columns}>
              {(column) => <td>{formatAdminCell(row[adminFieldName(column)], column)}</td>}
            </For>
            <Show when={props.showActions()}>
              <AdminRowActions
                row={row}
                keyValue={key()}
                actions={props.actions()}
                canUpdate={props.canUpdate}
                canDelete={props.canDelete}
                confirming={confirming}
                editor={props.editor}
                onAction={props.onAction}
                controller={props.controller}
                message={props.message}
              />
            </Show>
          </tr>
        )
      }}
    </For>
  </tbody>
)

export const AdminTable = (props: {
  page: AdminDataPage
  resource: Accessor<AdminResourceState>
  editor: Accessor<AdminEditorState>
  controller: AdminController
  showActions: Accessor<boolean>
  canUpdate: Accessor<boolean>
  canDelete: Accessor<boolean>
  actions: Accessor<NonNullable<AdminDataPage['actions']>>
  onAction?: AdminActionHandler
  message: AdminMessage
}): JSX.Element => (
  <table
    data-iris-admin-table=""
    aria-label={props.page.title ?? props.page.key}
    aria-busy={props.resource().loading || undefined}
  >
    <AdminTableHeader
      page={props.page}
      resource={props.resource}
      controller={props.controller}
      showActions={props.showActions}
      message={props.message}
    />
    <AdminTableBody
      page={props.page}
      resource={props.resource}
      editor={props.editor}
      controller={props.controller}
      showActions={props.showActions}
      canUpdate={props.canUpdate}
      canDelete={props.canDelete}
      actions={props.actions}
      onAction={props.onAction}
      message={props.message}
    />
  </table>
)

export const AdminPager = (props: {
  page: Accessor<AdminResourceState>
  pageCount: Accessor<number>
  label: string
  controller: AdminController
  message: AdminMessage
}): JSX.Element => (
  <nav data-iris-admin-pager="" aria-label={`${props.label} pagination`} style={rowStyle}>
    <IrisButton
      variant="outline"
      disabled={props.page().page <= 1}
      onClick={() => props.controller.resource.setPage(props.page().page - 1)}
    >
      {props.message('previous')}
    </IrisButton>
    <span data-iris-admin-page-info="">
      {props.message('page', { page: props.page().page, pages: props.pageCount() })}
    </span>
    <IrisButton
      variant="outline"
      disabled={props.page().page >= props.pageCount()}
      onClick={() => props.controller.resource.setPage(props.page().page + 1)}
    >
      {props.message('next')}
    </IrisButton>
  </nav>
)
