import { createSignal, For, Show, type Component, type JSX } from 'solid-js'
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
import { menus } from './menus'
import { tabsNav } from './tabs'
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
  const { skin, setSkin, setMode, getActiveId, availableSkins } = useSkin()
  const t = useTabsNav(tabsNav)
  const [activeKey, setActiveKey] = createSignal('dashboard')

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
          <IrisAvatar name="Ada Lovelace" size={32} />
        </IrisDropdownTrigger>
        <IrisDropdownMenu>
          <IrisDropdownItem>Profile</IrisDropdownItem>
          <IrisDropdownItem>Account settings</IrisDropdownItem>
          <IrisDropdownItem>Sign out</IrisDropdownItem>
        </IrisDropdownMenu>
      </IrisDropdown>
    </>
  )

  return (
    <IrisAdminLayout
      menus={menus}
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
