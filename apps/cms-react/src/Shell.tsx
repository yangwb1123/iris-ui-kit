import { useState, type ComponentType } from 'react'
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
} from '@iris-ui/react'
import { menus } from './menus'
import { tabsNav } from './tabs'
import { DashboardPage } from './pages/DashboardPage'
import { UsersPage } from './pages/UsersPage'
import { SettingsPage } from './pages/SettingsPage'
import { GenericPage } from './pages/GenericPage'

const pages: Record<string, ComponentType<{ title?: string }>> = {
  dashboard: DashboardPage,
  'all-users': UsersPage,
  settings: SettingsPage,
}

function PageHost({ routeKey }: { routeKey: string }) {
  const Comp = pages[routeKey] ?? GenericPage
  const props = pages[routeKey] ? {} : { title: findNavNode(menus, routeKey)?.title ?? routeKey }
  return <Comp {...props} />
}

export function Shell() {
  const { skin, setSkin, setMode, getActiveId, availableSkins } = useSkin()
  const t = useTabsNav(tabsNav)
  const [activeKey, setActiveKey] = useState('dashboard')

  // Skin switcher: 'auto' follows the system, anything else pins a fixed skin.
  const selectSkin = (id: string) => {
    if (id === 'auto') setMode('system')
    else setMode('fixed')
    setSkin(id)
  }
  const isDark = skin.type === 'dark'
  const toggleDark = () => {
    setMode('fixed')
    setSkin(isDark ? 'light' : 'dark')
  }

  const toolbar = (
    <>
      <select
        className="skin-select"
        aria-label="Theme"
        value={getActiveId()}
        onChange={(e) => selectSkin(e.target.value)}
      >
        {availableSkins().map((s) => (
          <option key={s.id} value={s.id}>
            {s.name ?? s.id}
          </option>
        ))}
      </select>

      <IrisButton
        size="sm"
        variant="outline"
        aria-label={isDark ? 'Light mode' : 'Dark mode'}
        onClick={toggleDark}
      >
        <IrisIcon name={isDark ? 'sun' : 'moon'} size={16} />
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
      activeKey={activeKey}
      onActiveKeyChange={setActiveKey}
      tabs={tabsNav}
      appTitle="Iris CMS"
      toolbar={toolbar}
      footer={
        <div className="cms-footer">
          <span>Iris CMS — built with @iris-ui/react/admin</span>
          <span>v0.1.x</span>
        </div>
      }
    >
      {({ activeKey: active }) =>
        // React keep-alive: render one page per open tab, only the active visible
        // (inactive stay mounted → state preserved). The cacheKey React-key makes
        // the tab "Refresh" action remount that page.
        t.tabs.map((tab) => (
          <div key={tab.key} style={{ display: tab.key === active ? 'block' : 'none' }}>
            <PageHost key={t.cacheKey(tab.key)} routeKey={tab.key} />
          </div>
        ))
      }
    </IrisAdminLayout>
  )
}
