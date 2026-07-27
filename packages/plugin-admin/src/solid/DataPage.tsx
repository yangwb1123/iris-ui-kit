import { createMemo, createSignal, createUniqueId, For, onCleanup, Show, type JSX } from 'solid-js'
import { IrisButton, IrisInput, useI18n } from '@iris-ui-kit/solid'
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

const stackStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: 'var(--iris-gap-md)',
}

const rowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'flex-wrap': 'wrap',
  gap: 'var(--iris-gap-sm)',
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function inputType(column: AdminColumn): 'text' | 'email' | 'number' {
  if (column.type === 'email' || column.type === 'number') return column.type
  return 'text'
}

function ariaInvalid(invalid: boolean): 'true' | undefined {
  return invalid ? 'true' : undefined
}

function errorReference(invalid: boolean, errorId: string): string | undefined {
  return invalid ? errorId : undefined
}

/** Thin Solid renderer over the framework-independent admin data controller. */
export function AdminDataPageView(props: AdminDataPageViewProps): JSX.Element {
  const controller = createAdminDataController(props.page)
  const [resource, setResource] = createSignal(controller.resource.getState())
  const [editor, setEditor] = createSignal(controller.editor.getState())
  const fieldPrefix = createUniqueId()
  const { t } = useI18n()

  onCleanup(controller.resource.subscribe(setResource))
  onCleanup(controller.editor.subscribe(setEditor))
  onCleanup(controller.destroy)

  const message = (key: AdminMessageKey, params: Record<string, string | number> = {}): string =>
    resolveAdminMessage(key, params, props.messages, t)
  const canCreate = (): boolean =>
    controller.capabilities.create &&
    hasAdminPermission(props.page.permissions?.create, props.permissions)
  const canUpdate = (): boolean =>
    controller.capabilities.update &&
    hasAdminPermission(props.page.permissions?.update, props.permissions)
  const canDelete = (): boolean =>
    controller.capabilities.delete &&
    hasAdminPermission(props.page.permissions?.delete, props.permissions)
  const actions = createMemo(() =>
    (props.page.actions ?? []).filter((action) =>
      hasAdminPermission(action.permission, props.permissions),
    ),
  )
  const showActions = (): boolean => canUpdate() || canDelete() || actions().length > 0
  const pageCount = (): number => {
    void resource()
    return Math.max(1, controller.resource.pageCount())
  }
  const failure = (): unknown => editor().actionError ?? resource().error

  const renderField = (column: AdminColumn): JSX.Element => {
    const field = adminFieldName(column)
    const fieldId = `${fieldPrefix}-${field}`
    const errorId = `${fieldId}-error`
    const value = (): unknown => editor().draft[field]
    const invalid = (): boolean => Boolean(editor().errors[field])
    let control: JSX.Element

    if (column.type === 'boolean') {
      control = (
        <input
          id={fieldId}
          type="checkbox"
          checked={Boolean(value())}
          aria-invalid={ariaInvalid(invalid())}
          aria-describedby={errorReference(invalid(), errorId)}
          onChange={(event) => controller.setField(field, event.currentTarget.checked)}
        />
      )
    } else if (column.type === 'select') {
      control = (
        <select
          id={fieldId}
          value={String(value() ?? '')}
          aria-invalid={ariaInvalid(invalid())}
          aria-describedby={errorReference(invalid(), errorId)}
          onChange={(event) =>
            controller.setField(field, coerceAdminFieldValue(column, event.currentTarget.value))
          }
        >
          <option value="">{column.placeholder ?? ''}</option>
          <For each={column.options}>
            {(option) => <option value={String(option.value)}>{option.label}</option>}
          </For>
        </select>
      )
    } else if (column.type === 'date') {
      control = (
        <input
          id={fieldId}
          type="date"
          value={String(value() ?? '')}
          aria-invalid={ariaInvalid(invalid())}
          aria-describedby={errorReference(invalid(), errorId)}
          onInput={(event) => controller.setField(field, event.currentTarget.value)}
        />
      )
    } else {
      control = (
        <IrisInput
          id={fieldId}
          type={inputType(column)}
          value={String(value() ?? '')}
          placeholder={column.placeholder}
          invalid={invalid()}
          ariaDescribedby={errorReference(invalid(), errorId)}
          onInput={(event) =>
            controller.setField(field, coerceAdminFieldValue(column, event.currentTarget.value))
          }
        />
      )
    }

    return (
      <div data-iris-admin-field={field} style={stackStyle}>
        <label for={fieldId}>
          {column.title}
          {column.required ? ' *' : ''}
        </label>
        {control}
        <Show when={invalid()}>
          <span id={errorId} role="alert">
            {editor().errors[field]}
          </span>
        </Show>
      </div>
    )
  }

  return (
    <div data-iris-admin-data-page={props.page.key} style={stackStyle}>
      <div style={rowStyle}>
        <Show when={props.page.title}>
          <h2 data-iris-admin-page-title="">{props.page.title}</h2>
        </Show>
        <Show when={canCreate()}>
          <IrisButton onClick={() => controller.beginCreate()}>{message('create')}</IrisButton>
        </Show>
      </div>

      <Show when={editor().mode !== 'idle'}>
        <form
          data-iris-admin-editor={editor().mode}
          aria-label={message(editor().mode === 'create' ? 'editorCreate' : 'editorEdit', {
            title: props.page.title ?? props.page.key,
          })}
          style={stackStyle}
          onSubmit={(event) => {
            event.preventDefault()
            void controller.save()
          }}
        >
          <For each={controller.editableColumns}>{renderField}</For>
          <div style={rowStyle}>
            <IrisButton type="submit" loading={editor().saving}>
              {message('save')}
            </IrisButton>
            <IrisButton variant="outline" onClick={() => controller.cancelEdit()}>
              {message('cancel')}
            </IrisButton>
          </div>
        </form>
      </Show>

      <Show when={failure()}>
        {(error) => (
          <div role="alert" data-iris-admin-error="">
            {errorText(error())}{' '}
            <IrisButton variant="outline" onClick={() => void controller.resource.reload()}>
              {message('retry')}
            </IrisButton>
          </div>
        )}
      </Show>
      <Show when={resource().loading}>
        <div role="status" aria-live="polite">
          {message('loading')}
        </div>
      </Show>

      <table
        data-iris-admin-table=""
        aria-label={props.page.title ?? props.page.key}
        aria-busy={resource().loading || undefined}
      >
        <thead>
          <tr>
            <For each={props.page.columns}>
              {(column) => {
                const activeSort = () =>
                  resource().sort?.key === column.key ? resource().sort : null
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
                          controller.resource.setSort(
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
            <Show when={showActions()}>
              <th scope="col">{message('actions')}</th>
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
                        value={resource().filters[column.key] ?? ''}
                        aria-label={message('filter', { column: column.title })}
                        onInput={(event) =>
                          controller.resource.setFilter(column.key, event.currentTarget.value)
                        }
                      />
                    </Show>
                  </th>
                )}
              </For>
              <Show when={showActions()}>
                <th />
              </Show>
            </tr>
          </Show>
        </thead>
        <tbody>
          <Show when={resource().rows.length === 0 && !resource().loading}>
            <tr>
              <td colSpan={props.page.columns.length + (showActions() ? 1 : 0)}>
                {message('empty')}
              </td>
            </tr>
          </Show>
          <For each={resource().rows}>
            {(row, index) => {
              const key = (): string => controller.rowKey(row, index())
              const confirming = (): boolean => editor().deletingKey === key()
              return (
                <tr data-row-key={key()}>
                  <For each={props.page.columns}>
                    {(column) => <td>{formatAdminCell(row[adminFieldName(column)], column)}</td>}
                  </For>
                  <Show when={showActions()}>
                    <td>
                      <div style={rowStyle}>
                        <Show when={canUpdate()}>
                          <IrisButton variant="outline" onClick={() => controller.beginEdit(row)}>
                            {message('edit')}
                          </IrisButton>
                        </Show>
                        <Show when={canDelete() && !confirming()}>
                          <IrisButton
                            variant="outline"
                            onClick={() => controller.requestDelete(row)}
                          >
                            {message('delete')}
                          </IrisButton>
                        </Show>
                        <Show when={canDelete() && confirming()}>
                          <IrisButton
                            loading={editor().saving}
                            onClick={() => void controller.confirmDelete()}
                          >
                            {message('confirmDelete')}
                          </IrisButton>
                          <IrisButton variant="outline" onClick={() => controller.cancelDelete()}>
                            {message('cancel')}
                          </IrisButton>
                        </Show>
                        <For each={actions()}>
                          {(action) => (
                            <IrisButton
                              variant="outline"
                              loading={editor().runningAction === `${action.key}:${key()}`}
                              disabled={!props.onAction}
                              onClick={() =>
                                void controller.runAction(action.key, row, props.onAction)
                              }
                            >
                              {action.label}
                            </IrisButton>
                          )}
                        </For>
                      </div>
                    </td>
                  </Show>
                </tr>
              )
            }}
          </For>
        </tbody>
      </table>

      <nav
        data-iris-admin-pager=""
        aria-label={`${props.page.title ?? props.page.key} pagination`}
        style={rowStyle}
      >
        <IrisButton
          variant="outline"
          disabled={resource().page <= 1}
          onClick={() => controller.resource.setPage(resource().page - 1)}
        >
          {message('previous')}
        </IrisButton>
        <span data-iris-admin-page-info="">
          {message('page', {
            page: resource().page,
            pages: pageCount(),
          })}
        </span>
        <IrisButton
          variant="outline"
          disabled={resource().page >= pageCount()}
          onClick={() => controller.resource.setPage(resource().page + 1)}
        >
          {message('next')}
        </IrisButton>
      </nav>
    </div>
  )
}
