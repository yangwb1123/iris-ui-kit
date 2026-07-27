import * as React from 'react'
import { IrisAdminLayout } from '@iris-ui-kit/react'
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
  /** Execute declarative row actions. */
  onAction?: AdminActionHandler
  /** Render a custom page by key (for pages of type `'custom'`). */
  renderPage?: (key: string) => React.ReactNode
}

/** Schema-driven React CMS with shared query/CRUD logic in the plugin core. */
export function IrisAdminApp({
  schema,
  permissions,
  messages,
  onAction,
  renderPage,
}: IrisAdminAppProps): React.ReactElement {
  const normalized = React.useMemo(() => normalizeAdminSchema(schema), [schema])
  return (
    <IrisAdminLayout
      menus={normalized.nav}
      defaultActiveKey={firstNavLeafKey(normalized.nav)}
      appTitle={normalized.title}
    >
      {({ activeKey }) => {
        const page = resolveAdminPage(normalized, activeKey)
        if (page?.type === 'data') {
          return (
            <AdminDataPageView
              key={page.key}
              page={page}
              permissions={permissions}
              messages={messages}
              onAction={onAction}
            />
          )
        }
        if (page?.type === 'custom') return <>{renderPage?.(activeKey)}</>
        return <div data-iris-admin-empty="">No page configured for &quot;{activeKey}&quot;</div>
      }}
    </IrisAdminLayout>
  )
}
