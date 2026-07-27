import { createMemo, Show, type JSX } from 'solid-js'
import { IrisAdminLayout } from '@iris-ui-kit/solid'
import {
  firstNavLeafKey,
  normalizeAdminSchema,
  resolveAdminPage,
  type AdminActionHandler,
  type AdminAppSchema,
  type AdminMessages,
} from '@iris-ui-kit/plugin-admin/core'
import { AdminDataPageView } from './DataPage'

export type {
  AdminActionHandler,
  AdminAppSchema,
  AdminColumn,
  AdminCrudPermissions,
  AdminCustomPage,
  AdminDataFetcher,
  AdminDataPage,
  AdminFieldType,
  AdminMessages,
  AdminMutationHandlers,
  AdminPage,
  AdminPermission,
  AdminRowAction,
  AdminSelectOption,
} from '@iris-ui-kit/plugin-admin/core'
export { adminPlugin } from '@iris-ui-kit/plugin-admin/core'

export interface IrisAdminAppProps {
  schema: AdminAppSchema
  permissions?: readonly string[]
  messages?: AdminMessages
  onAction?: AdminActionHandler
  /** Render a custom page by key (for pages of type `'custom'`). */
  renderPage?: (key: string) => JSX.Element
}

/** Schema-driven Solid CMS with shared query/CRUD logic in the plugin core. */
export function IrisAdminApp(props: IrisAdminAppProps): JSX.Element {
  const normalized = createMemo(() => normalizeAdminSchema(props.schema))
  return (
    <IrisAdminLayout
      menus={normalized().nav}
      defaultActiveKey={firstNavLeafKey(normalized().nav)}
      appTitle={normalized().title}
    >
      {({ activeKey }) => {
        const page = createMemo(() => resolveAdminPage(normalized(), activeKey))
        return (
          <Show
            when={page()}
            keyed
            fallback={<div data-iris-admin-empty="">No page configured for "{activeKey}"</div>}
          >
            {(resolved) =>
              resolved.type === 'data' ? (
                <AdminDataPageView
                  page={resolved}
                  permissions={props.permissions}
                  messages={props.messages}
                  onAction={props.onAction}
                />
              ) : (
                <>{props.renderPage?.(activeKey)}</>
              )
            }
          </Show>
        )
      }}
    </IrisAdminLayout>
  )
}
