import { Show, type Accessor, type JSX } from 'solid-js'
import type { AdminActionHandler, AdminDataPage } from '@iris-ui-kit/plugin-admin/core'
import { AdminEditor } from './data-page-editor'
import { AdminPageHeading, AdminPager, AdminStatus, AdminTable } from './data-page-sections'
import {
  pageStackStyle,
  type AdminController,
  type AdminEditorState,
  type AdminMessage,
  type AdminResourceState,
} from './data-page-types'

export interface AdminDataPageLayoutProps {
  page: AdminDataPage
  controller: AdminController
  resource: Accessor<AdminResourceState>
  editor: Accessor<AdminEditorState>
  fieldPrefix: string
  canCreate: Accessor<boolean>
  canUpdate: Accessor<boolean>
  canDelete: Accessor<boolean>
  showActions: Accessor<boolean>
  actions: Accessor<NonNullable<AdminDataPage['actions']>>
  pageCount: Accessor<number>
  failure: Accessor<unknown>
  onAction?: AdminActionHandler
  message: AdminMessage
}

export const AdminDataPageLayout = (props: AdminDataPageLayoutProps): JSX.Element => (
  <div data-iris-admin-data-page={props.page.key} style={pageStackStyle}>
    <AdminPageHeading
      page={props.page}
      canCreate={props.canCreate}
      controller={props.controller}
      message={props.message}
    />
    <Show when={props.editor().mode !== 'idle'}>
      <AdminEditor
        page={props.page}
        controller={props.controller}
        editor={props.editor}
        fieldPrefix={props.fieldPrefix}
        message={props.message}
      />
    </Show>
    <AdminStatus
      failure={props.failure}
      loading={() => props.resource().loading}
      controller={props.controller}
      message={props.message}
    />
    <AdminTable
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
    <AdminPager
      page={props.resource}
      pageCount={props.pageCount}
      label={props.page.title ?? props.page.key}
      controller={props.controller}
      message={props.message}
    />
  </div>
)
