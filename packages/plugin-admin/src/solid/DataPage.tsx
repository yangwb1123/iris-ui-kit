import {
  createMemo,
  createSignal,
  createUniqueId,
  onCleanup,
  type Accessor,
  type JSX,
} from 'solid-js'
import { useI18n } from '@iris-ui-kit/solid'
import {
  createAdminDataController,
  hasAdminPermission,
  resolveAdminMessage,
  type AdminActionHandler,
  type AdminDataPage,
  type AdminMessageKey,
  type AdminMessages,
} from '@iris-ui-kit/plugin-admin/core'
import { AdminDataPageLayout } from './data-page-layout'
import { type AdminController, type AdminMessage } from './data-page-types'

export interface AdminDataPageViewProps {
  page: AdminDataPage
  permissions?: readonly string[]
  messages?: AdminMessages
  onAction?: AdminActionHandler
}

function createPageBindings(
  props: AdminDataPageViewProps,
  controller: AdminController,
  resolve: (key: AdminMessageKey, params: Record<string, string | number>) => string,
): {
  message: AdminMessage
  canCreate: () => boolean
  canUpdate: () => boolean
  canDelete: () => boolean
  showActions: () => boolean
  actions: Accessor<NonNullable<AdminDataPage['actions']>>
} {
  const message: AdminMessage = (key, params = {}) => resolve(key, params)
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
  return { message, canCreate, canUpdate, canDelete, showActions, actions }
}

/** Thin Solid renderer over the framework-independent admin data controller. */
export function AdminDataPageView(props: AdminDataPageViewProps): JSX.Element {
  const controller: AdminController = createAdminDataController(props.page)
  const [resource, setResource] = createSignal(controller.resource.getState())
  const [editor, setEditor] = createSignal(controller.editor.getState())
  const fieldPrefix = createUniqueId()
  const { t } = useI18n()

  onCleanup(controller.resource.subscribe(setResource))
  onCleanup(controller.editor.subscribe(setEditor))
  onCleanup(controller.destroy)

  const bindings = createPageBindings(props, controller, (key, params) =>
    resolveAdminMessage(key, params, props.messages, t),
  )
  const pageCount = (): number => {
    void resource()
    return Math.max(1, controller.resource.pageCount())
  }
  const failure = (): unknown => editor().actionError ?? resource().error

  return (
    <AdminDataPageLayout
      page={props.page}
      controller={controller}
      resource={resource}
      editor={editor}
      fieldPrefix={fieldPrefix}
      canCreate={bindings.canCreate}
      canUpdate={bindings.canUpdate}
      canDelete={bindings.canDelete}
      showActions={bindings.showActions}
      actions={bindings.actions}
      pageCount={pageCount}
      failure={failure}
      onAction={props.onAction}
      message={bindings.message}
    />
  )
}
