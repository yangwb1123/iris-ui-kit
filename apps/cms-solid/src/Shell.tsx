import { createMemo, createSignal, For, Show, type Component, type JSX } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import {
  IrisAdminLayout,
  IrisAvatar,
  IrisButton,
  IrisDropdown,
  IrisDropdownTrigger,
  IrisDropdownMenu,
  IrisDropdownItem,
  IrisIcon,
  useSkin,
  useTabsNav,
  findNavNode,
} from '@iris-ui/solid'
import { filterNavByAccess } from '@iris-ui/core'
import { menus } from './menus'
import { tabsNav } from './tabs'
import { useAuth, type Role } from './auth'
import { DashboardPage } from './pages/DashboardPage'
import { UsersPage } from './pages/UsersPage'
import { SettingsPage } from './pages/SettingsPage'
import { GenericPage } from './pages/GenericPage'

const pages: Record<string, Component<{ title?: string }>> = {
  dashboard: DashboardPage,
  'all-users': UsersPage,
  settings: SettingsPage,
}

function PageHost(props: { routeKey: string }): JSX.Element {
  const comp = (): Component<{ title?: string }> => pages[props.routeKey] ?? GenericPage
  const title = (): string | undefined =>
    pages[props.routeKey]
      ? undefined
      : (findNavNode(menus, props.routeKey)?.title ?? props.routeKey)
  return <Dynamic component={comp()} title={title()} />
}

export function Shell(): JSX.Element {
  // Keep the auth context object (not a destructured snapshot) so `.session`
  // stays reactive through its getter.
  const auth = useAuth()
  const logout = auth.logout
  const { skin, setSkin, setMode, getActiveId, availableSkins } = useSkin()
  const t = useTabsNav(tabsNav)
  const [activeKey, setActiveKey] = createSignal('dashboard')

  // RBAC: the sidebar is the nav tree filtered by the session's role. A viewer
  // sees fewer nodes (no Settings, no Roles & access).
  const username = (): string => auth.session?.username ?? 'User'
  const role = (): Role => auth.session?.role ?? 'viewer'
  const visibleMenus = createMemo(() => filterNavByAccess(menus, [role()]))

  // Skin switcher: 'auto' follows the system, anything else pins a fixed skin.
  const selectSkin = (id: string): void => {
    if (id === 'auto') setMode('system')
    else setMode('fixed')
    setSkin(id)
  }
  const isDark = (): boolean => skin().type === 'dark'
  const toggleDark = (): void => {
    setMode('fixed')
    setSkin(isDark() ? 'light' : 'dark')
  }

  const toolbar = (
    <>
      <select
        class="skin-select"
        aria-label="Theme"
        value={getActiveId()}
        onChange={(e) => selectSkin(e.currentTarget.value)}
      >
        <For each={availableSkins()}>{(s) => <option value={s.id}>{s.name ?? s.id}</option>}</For>
      </select>

      <IrisButton
        size="sm"
        variant="outline"
        aria-label={isDark() ? 'Light mode' : 'Dark mode'}
        onClick={toggleDark}
      >
        <IrisIcon name={isDark() ? 'sun' : 'moon'} size={16} />
      </IrisButton>

      <IrisDropdown>
        <IrisDropdownTrigger
          aria-label="Account"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
        >
          <IrisAvatar name={username()} size={32} />
        </IrisDropdownTrigger>
        <IrisDropdownMenu>
          <div style={{ padding: '8px 12px', 'min-width': '200px' }}>
            <div style={{ 'font-weight': 600, 'font-size': '14px' }}>{username()}</div>
            <div style={{ 'margin-top': '4px', 'font-size': '12px', color: 'var(--iris-muted)' }}>
              {role()}
            </div>
          </div>
          <IrisDropdownItem>Profile</IrisDropdownItem>
          <IrisDropdownItem>Account settings</IrisDropdownItem>
          <IrisDropdownItem onSelect={logout}>Sign out</IrisDropdownItem>
        </IrisDropdownMenu>
      </IrisDropdown>
    </>
  )

  return (
    <IrisAdminLayout
      menus={visibleMenus()}
      activeKey={activeKey()}
      onActiveKeyChange={setActiveKey}
      tabs={tabsNav}
      appTitle="Iris CMS"
      toolbar={toolbar}
      footer={
        <div class="cms-footer">
          <span>Iris CMS — built with @iris-ui/solid</span>
          <span>v0.1.x</span>
        </div>
      }
    >
      {(s) => (
        // Keep-alive: render one page per open tab; only the active one shown
        // (inactive stay mounted so their local state survives switching). The
        // keyed <Show> re-creates a page when its reactive cacheKey changes, so
        // the tab "Refresh" action remounts it.
        <For each={t.tabs()}>
          {(tab) => {
            const cacheKey = (): string =>
              t.cacheKeys().find((k) => k.slice(0, k.lastIndexOf(':')) === tab.key) ?? tab.key
            return (
              <div style={{ display: tab.key === s.activeKey ? 'block' : 'none' }}>
                <Show when={cacheKey()} keyed>
                  {(_ck: string) => <PageHost routeKey={tab.key} />}
                </Show>
              </div>
            )
          }}
        </For>
      )}
    </IrisAdminLayout>
  )
}
