import * as React from 'react'
import { useI18n } from '@iris-ui-kit/react'
import {
  createAdminDataController,
  hasAdminPermission,
  resolveAdminMessage,
  type AdminActionHandler,
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

import { AdminEditor, pageStackStyle } from './data-page-editor'
import { AdminPager, AdminPageHeading, AdminStatus, AdminTable } from './data-page-sections'
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

  return (
    <div data-iris-admin-data-page={page.key} style={pageStackStyle}>
      <AdminPageHeading
        page={page}
        canCreate={canCreate}
        controller={controller}
        message={message}
      />

      <AdminEditor page={page} controller={controller} editor={editor} message={message} id={id} />

      <AdminStatus
        failure={failure}
        loading={resource.loading}
        controller={controller}
        message={message}
      />

      <AdminTable
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

      <AdminPager
        page={resource}
        label={page.title ?? page.key}
        pageCount={pageCount}
        controller={controller}
        message={message}
      />
    </div>
  )
}
