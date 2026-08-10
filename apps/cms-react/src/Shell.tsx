import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import { isCmsWorkspaceRoute } from '@iris-ui-kit/cms-shared'
import {
  IrisAdminLayout,
  IrisAvatar,
  IrisBadge,
  IrisButton,
  IrisCommandPalette,
  IrisDropdown,
  IrisDropdownTrigger,
  IrisDropdownMenu,
  IrisDropdownItem,
  IrisDropdownSeparator,
  IrisIcon,
  IrisToastViewport,
  filterNavByAccess,
  findNavNode,
  firstLeaf,
  useSkin,
  useTabsNav,
  type IrisCommandItem,
  type NavNode,
} from '@iris-ui-kit/react'
import { menus } from './menus'
import { tabsNav } from './tabs'
import { useHashRoute } from './router'
import { useAuth } from './auth'
import {
  clearNotifications,
  markAllRead,
  useNotifications,
  type Notification,
} from './notifications'
import { DashboardPage } from './pages/DashboardPage'
import { UsersPage } from './pages/UsersPage'
import { SettingsPage } from './pages/SettingsPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { FormBuilderPage } from './pages/FormBuilderPage'
import { RealtimePage } from './pages/RealtimePage'
import { ProTablePage } from './pages/ProTablePage'
import { MarkdownPage } from './pages/MarkdownPage'
import { VxeGridExamplePage } from './pages/VxeGridExamplePage'

const pages: Record<string, ComponentType> = {
  dashboard: DashboardPage,
  'all-users': UsersPage,
  settings: SettingsPage,
  'form-builder': FormBuilderPage,
  realtime: RealtimePage,
  'pro-table': ProTablePage,
  documentation: MarkdownPage,
  'vxe-example': VxeGridExamplePage,
}

function PageHost({ routeKey }: { routeKey: string }) {
  if (isCmsWorkspaceRoute(routeKey)) return <WorkspacePage routeKey={routeKey} />
  const Comp = pages[routeKey] ?? DashboardPage
  return <Comp />
}

const toneColor: Record<Notification['tone'], string> = {
  success: 'var(--iris-success)',
  error: 'var(--iris-danger)',
  info: 'var(--iris-primary)',
}

export function Shell() {
  const { session, logout } = useAuth()
  const { skin, setSkin, setMode, getActiveId, availableSkins } = useSkin()
  const { route, navigate } = useHashRoute('dashboard')
  const t = useTabsNav(tabsNav)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const notifications = useNotifications()
  const unread = notifications.filter((n) => !n.read).length

  // RBAC: the sidebar is the nav tree filtered by the session's role. A viewer
  // sees fewer nodes (no Admin section, no Roles & access).
  const role = session?.role ?? 'viewer'
  const visibleMenus = useMemo(() => filterNavByAccess(menus, [role]), [role])

  // Resolve the route to its leaf key (a branch route → its first child) and
  // guard against deep-links the current role can't reach.
  const resolvedRoute = useMemo(() => {
    const node = findNavNode(visibleMenus, route)
    if (!node) return 'dashboard'
    return firstLeaf(node).key
  }, [visibleMenus, route])

  // Keep a tab open for the active route (covers deep-links + browser back), and
  // keep the tabs store activated in sync with the hash.
  useEffect(() => {
    const node = findNavNode(visibleMenus, resolvedRoute)
    tabsNav.open({
      key: resolvedRoute,
      title: node?.title ?? resolvedRoute,
      icon: node?.icon,
    })
  }, [visibleMenus, resolvedRoute])

  // Normalize the URL when a branch/blocked route was resolved to a leaf.
  useEffect(() => {
    if (resolvedRoute !== route) navigate(resolvedRoute)
  }, [resolvedRoute, route, navigate])

  // Skin switcher: 'auto' follows the system, anything else pins a fixed skin.
  const selectSkin = (id: string) => {
    if (id === 'auto') setMode('system')
    else setMode('fixed')
    setSkin(id)
  }
  const isDark = skin.type === 'dark'
  const toggleDark = useCallback(() => {
    setMode('fixed')
    setSkin(isDark ? 'light' : 'dark')
  }, [isDark, setMode, setSkin])

  // Ctrl/Cmd-K opens the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Command palette items: navigate to any visible page + a couple of actions.
  const commandItems = useMemo<IrisCommandItem[]>(() => {
    const navItems: IrisCommandItem[] = []
    const walk = (nodes: NavNode[]) => {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) walk(n.children)
        else
          navItems.push({
            id: `nav:${n.key}`,
            label: `Go to ${n.title}`,
            group: 'Navigate',
            icon: '→',
            action: () => navigate(n.key),
          })
      }
    }
    walk(visibleMenus)
    const actions: IrisCommandItem[] = [
      {
        id: 'action:toggle-theme',
        label: isDark ? 'Switch to light mode' : 'Switch to dark mode',
        group: 'Actions',
        icon: isDark ? '☀' : '☾',
        action: toggleDark,
      },
      {
        id: 'action:logout',
        label: 'Sign out',
        group: 'Actions',
        icon: '⎋',
        action: logout,
      },
    ]
    return [...navItems, ...actions]
  }, [visibleMenus, isDark, navigate, logout, toggleDark])

  const toolbar = (
    <>
      <IrisButton
        size="sm"
        variant="outline"
        aria-label="Open command palette"
        onClick={() => setPaletteOpen(true)}
      >
        <IrisIcon name="search" size={16} />
        <span style={{ marginInlineStart: 6, opacity: 0.7, fontSize: 12 }}>⌘K</span>
      </IrisButton>

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

      {/* Notification center */}
      <IrisDropdown onOpenChange={(open) => open && markAllRead()}>
        <IrisDropdownTrigger
          aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
          style={{
            position: 'relative',
            border: '1px solid var(--iris-border)',
            background: 'var(--iris-surface)',
            borderRadius: 'var(--iris-radius-md, 6px)',
            cursor: 'pointer',
            height: 32,
            width: 32,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--iris-foreground)',
          }}
        >
          <IrisIcon name="info" size={16} />
          {unread > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -6,
                insetInlineEnd: -6,
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                borderRadius: 8,
                background: 'var(--iris-danger)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {unread}
            </span>
          )}
        </IrisDropdownTrigger>
        <IrisDropdownMenu>
          <div
            style={{
              padding: '8px 12px',
              fontWeight: 600,
              fontSize: 13,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              minWidth: 240,
            }}
          >
            <span>Notifications</span>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearNotifications}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--iris-muted)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'inherit',
                }}
              >
                Clear
              </button>
            )}
          </div>
          <IrisDropdownSeparator />
          {notifications.length === 0 ? (
            <div style={{ padding: '16px 12px', color: 'var(--iris-muted)', fontSize: 13 }}>
              No notifications yet — create or delete a user.
            </div>
          ) : (
            notifications.slice(0, 8).map((n) => (
              <div
                key={n.id}
                style={{
                  padding: '8px 12px',
                  display: 'flex',
                  gap: 8,
                  borderBottom: '1px solid var(--iris-border)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 8,
                    marginTop: 5,
                    background: toneColor[n.tone],
                    flexShrink: 0,
                  }}
                />
                <span style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                  {n.description && (
                    <div style={{ fontSize: 12, color: 'var(--iris-muted)' }}>{n.description}</div>
                  )}
                </span>
              </div>
            ))
          )}
        </IrisDropdownMenu>
      </IrisDropdown>

      {/* Account menu */}
      <IrisDropdown>
        <IrisDropdownTrigger
          aria-label="Account"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
        >
          <IrisAvatar name={session?.username ?? 'User'} size={32} />
        </IrisDropdownTrigger>
        <IrisDropdownMenu>
          <div style={{ padding: '8px 12px', minWidth: 200 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{session?.username}</div>
            <div style={{ marginTop: 4 }}>
              <IrisBadge tone={role === 'admin' ? 'primary' : 'neutral'} variant="subtle">
                {role}
              </IrisBadge>
            </div>
          </div>
          <IrisDropdownSeparator />
          <IrisDropdownItem onSelect={() => navigate('settings')}>Settings</IrisDropdownItem>
          <IrisDropdownItem onSelect={logout}>Sign out</IrisDropdownItem>
        </IrisDropdownMenu>
      </IrisDropdown>
    </>
  )

  return (
    <>
      <IrisAdminLayout
        menus={visibleMenus}
        activeKey={resolvedRoute}
        onActiveKeyChange={navigate}
        tabs={tabsNav}
        appTitle="Iris CMS"
        toolbar={toolbar}
        footer={
          <div className="cms-footer">
            <span>Iris CMS — built with @iris-ui-kit/react/admin</span>
            <span>
              signed in as {session?.username} ({role}) · v0.1.x
            </span>
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

      <IrisCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={commandItems}
        placeholder="Search pages and actions…"
      />
      <IrisToastViewport position="bottom-right" />
    </>
  )
}
