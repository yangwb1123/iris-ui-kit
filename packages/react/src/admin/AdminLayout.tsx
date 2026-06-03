import * as React from 'react'
import {
  findNavNode,
  findNavPath,
  firstLeaf,
  isBranch,
  type NavNode,
  type TabsNav,
} from '@iris-ui/core'
import { IrisSidebarLayout } from '../layouts/SidebarLayout'
import { IrisHeaderLayout } from '../layouts/HeaderLayout'
import { useStore } from '../useStore'
import { IrisNavMenu } from './NavMenu'
import { IrisAdminBreadcrumb } from './AdminBreadcrumb'
import { IrisAdminTabs } from './AdminTabs'
import { IrisIcon } from '../primitives/icon/Icon'

export type IrisAdminLayoutMode = 'sidebar' | 'full-content'

type LogoRenderer = React.ReactNode | ((state: { collapsed: boolean }) => React.ReactNode)
type ContentRenderer = React.ReactNode | ((state: { activeKey: string }) => React.ReactNode)

export interface IrisAdminLayoutProps {
  /** Normalized nav tree driving menu + breadcrumb. */
  menus: NavNode[]
  /** Active page key (controlled). */
  activeKey?: string
  defaultActiveKey?: string
  onActiveKeyChange?: (key: string) => void
  /** Sidebar collapsed (controlled); undefined = uncontrolled. */
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (next: boolean) => void
  mode?: IrisAdminLayoutMode
  appTitle?: string
  /** Optional shared tabs store; when present the tab bar is rendered. */
  tabs?: TabsNav
  showBreadcrumb?: boolean
  sidebarWidth?: number | string
  collapsedWidth?: number | string
  /** Brand region; render-prop receives `{ collapsed }`. */
  logo?: LogoRenderer
  /** Header end region (theme switch, user menu, …). */
  toolbar?: React.ReactNode
  footer?: React.ReactNode
  onSelect?: (key: string, node: NavNode) => void
  /** Page content; render-prop receives `{ activeKey }`. */
  children?: ContentRenderer
}

/** Mirrors tab-store activation (incl. close→neighbor) into the layout's active key. */
function TabsSync({
  nav,
  activeKey,
  onActivate,
}: {
  nav: TabsNav
  activeKey: string
  onActivate: (key: string) => void
}): null {
  const state = useStore(nav.store)
  React.useEffect(() => {
    if (state.activeKey && state.activeKey !== activeKey) onActivate(state.activeKey)
  }, [state.activeKey, activeKey, onActivate])
  return null
}

/**
 * The CMS / admin shell — a Vben-style, router-agnostic, data-driven layout that
 * composes IrisSidebarLayout + IrisHeaderLayout with the admin nav pieces. One
 * `menus` tree drives the collapsible sidebar nav, the header breadcrumb, and
 * (when a `tabs` store is passed) the multi-tab bar; `activeKey` is the current
 * page. The host owns routing: react to `onSelect` / `onActiveKeyChange` and
 * render the page via the children render-prop (wrap it in keep-alive keyed by
 * `tabs.cacheKey` for Vben-style tab caching).
 *
 * Modes: `sidebar` (default) and `full-content` (chrome hidden). React port of
 * the Vue `IrisAdminLayout`.
 */
export function IrisAdminLayout({
  menus,
  activeKey,
  defaultActiveKey,
  onActiveKeyChange,
  collapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  mode = 'sidebar',
  appTitle = 'Iris Admin',
  tabs,
  showBreadcrumb = true,
  sidebarWidth = 240,
  collapsedWidth = 64,
  logo,
  toolbar,
  footer,
  onSelect,
  children,
}: IrisAdminLayoutProps): React.ReactElement {
  const activeControlled = activeKey !== undefined
  const [internalActive, setInternalActive] = React.useState(activeKey ?? defaultActiveKey ?? '')
  const currentActive = activeControlled ? (activeKey as string) : internalActive
  const setActive = React.useCallback(
    (key: string) => {
      if (!activeControlled) setInternalActive(key)
      onActiveKeyChange?.(key)
    },
    [activeControlled, onActiveKeyChange],
  )

  const collapseControlled = collapsed !== undefined
  const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed)
  const currentCollapsed = collapseControlled ? (collapsed as boolean) : internalCollapsed
  const setCollapsed = React.useCallback(
    (next: boolean) => {
      if (!collapseControlled) setInternalCollapsed(next)
      onCollapsedChange?.(next)
    },
    [collapseControlled, onCollapsedChange],
  )

  const trail = findNavPath(menus, currentActive)

  const navigateTo = (node: NavNode): void => {
    const leaf = isBranch(node) ? firstLeaf(node) : node
    setActive(leaf.key)
    onSelect?.(leaf.key, leaf)
    tabs?.open({ key: leaf.key, title: leaf.title, icon: leaf.icon })
  }
  const handleSelect = (_key: string, node: NavNode): void => navigateTo(node)

  const syncFromTab = React.useCallback(
    (key: string) => {
      setActive(key)
      const node = findNavNode(menus, key)
      if (node) onSelect?.(key, node)
    },
    [setActive, menus, onSelect],
  )

  const renderContent = (): React.ReactNode =>
    typeof children === 'function' ? children({ activeKey: currentActive }) : children

  if (mode === 'full-content') {
    return (
      <div data-iris-admin-layout="" data-mode="full-content" style={{ height: '100%' }}>
        {renderContent()}
      </div>
    )
  }

  const defaultLogo = (state: { collapsed: boolean }): React.ReactElement => (
    <div
      data-iris-admin-logo=""
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 52,
        padding: '0 16px',
        color: 'var(--iris-foreground)',
        fontWeight: 700,
        fontSize: 16,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 'var(--iris-radius-md, 6px)',
          background: 'var(--iris-primary)',
          color: 'var(--iris-primary-foreground, #fff)',
          flexShrink: 0,
        }}
      >
        <IrisIcon name="menu" size={18} />
      </span>
      {state.collapsed ? null : <span>{appTitle}</span>}
    </div>
  )
  const renderLogo = (state: { collapsed: boolean }): React.ReactNode =>
    typeof logo === 'function' ? logo(state) : (logo ?? defaultLogo(state))

  const collapseToggle = (
    <button
      type="button"
      data-iris-admin-collapse=""
      aria-label={currentCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-pressed={currentCollapsed ? 'true' : 'false'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        border: 'none',
        borderRadius: 'var(--iris-radius-md, 6px)',
        background: 'transparent',
        color: 'var(--iris-foreground)',
        cursor: 'pointer',
        flexShrink: 0,
      }}
      onClick={() => setCollapsed(!currentCollapsed)}
    >
      <IrisIcon name={currentCollapsed ? 'chevron-right' : 'menu'} size={18} />
    </button>
  )

  const headerBar = (
    <div
      data-iris-admin-headerbar=""
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: 52,
        padding: '0 16px',
        borderBottom: '1px solid var(--iris-border)',
        background: 'var(--iris-background)',
      }}
    >
      {collapseToggle}
      {showBreadcrumb ? <IrisAdminBreadcrumb trail={trail} onSelect={handleSelect} /> : null}
      <div style={{ flex: 1 }} />
      {toolbar ? (
        <div data-iris-admin-toolbar="" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {toolbar}
        </div>
      ) : null}
    </div>
  )

  return (
    <IrisSidebarLayout
      data-iris-admin-layout=""
      data-mode="sidebar"
      collapsed={currentCollapsed}
      onCollapsedChange={setCollapsed}
      width={sidebarWidth}
      collapsedWidth={collapsedWidth}
      style={{ height: '100vh' }}
      sidebar={(state) => (
        <div
          data-iris-admin-sidebar=""
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            borderInlineEnd: '1px solid var(--iris-border)',
            background: 'var(--iris-surface)',
          }}
        >
          {renderLogo(state)}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 8 }}>
            <IrisNavMenu
              items={menus}
              activeKey={currentActive}
              collapsed={state.collapsed}
              onSelect={handleSelect}
            />
          </div>
        </div>
      )}
    >
      {tabs ? <TabsSync nav={tabs} activeKey={currentActive} onActivate={syncFromTab} /> : null}
      <IrisHeaderLayout
        sticky
        header={
          <div data-iris-admin-header="">
            {headerBar}
            {tabs ? <IrisAdminTabs nav={tabs} /> : null}
          </div>
        }
        footer={footer}
      >
        <div data-iris-admin-content="" style={{ padding: 16 }}>
          {renderContent()}
        </div>
      </IrisHeaderLayout>
    </IrisSidebarLayout>
  )
}
