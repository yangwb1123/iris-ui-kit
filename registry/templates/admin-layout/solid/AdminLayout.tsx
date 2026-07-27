import type { JSX } from 'solid-js'
import {
  IrisAdminLayout,
  useAdminPreferences,
  type AdminPreferences,
  type NavNode,
  type TabsNav,
} from '@iris-ui-kit/solid/admin'

export interface AdminLayoutProps {
  menus: NavNode[]
  activeKey: string
  onNavigate: (key: string) => void
  preferences: AdminPreferences
  tabs?: TabsNav
  appTitle?: string
  logo?: JSX.Element | ((state: { collapsed: boolean }) => JSX.Element)
  toolbar?: JSX.Element
  footer?: JSX.Element
  children?: JSX.Element | ((state: { activeKey: string }) => JSX.Element)
}

/** Stable admin shell; runtime changes only declarative preferences/data. */
export function AdminLayout(props: AdminLayoutProps): JSX.Element {
  const preferences = useAdminPreferences(props.preferences)
  const state = preferences.state
  return (
    <div data-admin-layout="" data-density={state().density}>
      <IrisAdminLayout
        menus={props.menus}
        activeKey={props.activeKey}
        onActiveKeyChange={props.onNavigate}
        collapsed={state().collapsed}
        onCollapsedChange={(value) => preferences.set('collapsed', value)}
        mode={state().navigationMode}
        menuAlign={state().menuAlign}
        contentWidth={state().contentWidth}
        contentHeight={state().contentHeight}
        showTabs={state().showTabs}
        showBreadcrumb={state().showBreadcrumb}
        stickyHeader={state().stickyHeader}
        stickyTabs={state().stickyTabs}
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
