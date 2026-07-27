import * as React from 'react'
import {
  IrisAdminLayout,
  useAdminPreferences,
  type AdminPreferences,
  type NavNode,
  type TabsNav,
} from '@iris-ui-kit/react/admin'

export interface AdminLayoutProps {
  menus: NavNode[]
  activeKey: string
  onNavigate: (key: string) => void
  preferences: AdminPreferences
  tabs?: TabsNav
  appTitle?: string
  logo?: React.ReactNode | ((state: { collapsed: boolean }) => React.ReactNode)
  toolbar?: React.ReactNode
  footer?: React.ReactNode
  children?: React.ReactNode | ((state: { activeKey: string }) => React.ReactNode)
}

/**
 * Stable application shell inspired by sverpweb.
 *
 * Layout preferences change the shell chrome; route/page modules remain normal
 * static imports rendered through `children`, so runtime switching never
 * downloads or executes a different template.
 */
export function AdminLayout(props: AdminLayoutProps): React.ReactElement {
  const { state, set } = useAdminPreferences(props.preferences)
  return (
    <div data-admin-layout="" data-density={state.density}>
      <IrisAdminLayout
        menus={props.menus}
        activeKey={props.activeKey}
        onActiveKeyChange={props.onNavigate}
        collapsed={state.collapsed}
        onCollapsedChange={(value) => set('collapsed', value)}
        mode={state.navigationMode}
        menuAlign={state.menuAlign}
        contentWidth={state.contentWidth}
        contentHeight={state.contentHeight}
        showTabs={state.showTabs}
        showBreadcrumb={state.showBreadcrumb}
        stickyHeader={state.stickyHeader}
        stickyTabs={state.stickyTabs}
        tabs={props.tabs}
        appTitle={props.appTitle ?? 'Admin'}
        logo={props.logo}
        toolbar={props.toolbar}
        footer={props.footer}
      >
        {props.children}
      </IrisAdminLayout>
    </div>
  )
}
