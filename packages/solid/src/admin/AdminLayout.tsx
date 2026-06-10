import { createEffect, createSignal, mergeProps, Show, type JSX } from 'solid-js'
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
import { useI18n } from '../i18n'

export type IrisAdminLayoutMode = 'sidebar' | 'full-content'

type LogoRenderer = JSX.Element | ((state: { collapsed: boolean }) => JSX.Element)
type ContentRenderer = JSX.Element | ((state: { activeKey: string }) => JSX.Element)

export interface IrisAdminLayoutProps {
  /** Normalized nav tree driving menu + breadcrumb. */
  menus: NavNode[]
  activeKey?: string
  defaultActiveKey?: string
  onActiveKeyChange?: (key: string) => void
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
  toolbar?: JSX.Element
  footer?: JSX.Element
  onSelect?: (key: string, node: NavNode) => void
  /** Page content; render-prop receives `{ activeKey }`. */
  children?: ContentRenderer
}

/**
 * The CMS / admin shell — a router-agnostic, data-driven, Vben-style layout that
 * composes IrisSidebarLayout + IrisHeaderLayout with the admin nav pieces. One
 * `menus` tree drives the collapsible sidebar nav, the header breadcrumb, and
 * (when a `tabs` store is passed) the multi-tab bar; `activeKey` is the current
 * page. The host owns routing: react to `onSelect`/`onActiveKeyChange` and
 * render the page via the children render-prop. Modes: `sidebar` + `full-content`.
 * Solid port of the React/Vue IrisAdminLayout.
 */
export function IrisAdminLayout(props: IrisAdminLayoutProps): JSX.Element {
  const { t } = useI18n()
  const merged = mergeProps(
    {
      defaultCollapsed: false,
      mode: 'sidebar' as IrisAdminLayoutMode,
      appTitle: 'Iris Admin',
      showBreadcrumb: true,
      sidebarWidth: 240 as number | string,
      collapsedWidth: 64 as number | string,
    },
    props,
  )

  const activeControlled = (): boolean => props.activeKey !== undefined
  const [internalActive, setInternalActive] = createSignal(
    props.activeKey ?? props.defaultActiveKey ?? '',
  )
  const currentActive = (): string =>
    activeControlled() ? (props.activeKey as string) : internalActive()
  const setActive = (key: string): void => {
    if (!activeControlled()) setInternalActive(key)
    merged.onActiveKeyChange?.(key)
  }

  const collapseControlled = (): boolean => props.collapsed !== undefined
  const [internalCollapsed, setInternalCollapsed] = createSignal(merged.defaultCollapsed)
  const currentCollapsed = (): boolean =>
    collapseControlled() ? (props.collapsed as boolean) : internalCollapsed()
  const setCollapsed = (next: boolean): void => {
    if (!collapseControlled()) setInternalCollapsed(next)
    merged.onCollapsedChange?.(next)
  }

  const trail = (): NavNode[] => findNavPath(props.menus, currentActive())

  const navigateTo = (node: NavNode): void => {
    const leaf = isBranch(node) ? firstLeaf(node) : node
    setActive(leaf.key)
    merged.onSelect?.(leaf.key, leaf)
    props.tabs?.open({ key: leaf.key, title: leaf.title, icon: leaf.icon })
  }
  const handleSelect = (_key: string, node: NavNode): void => navigateTo(node)

  // Mirror tab-store activation (incl. close→neighbor) back into the active key.
  if (props.tabs) {
    const tabsState = useStore(props.tabs.store)
    createEffect(() => {
      const key = tabsState().activeKey
      if (!key || key === currentActive()) return
      setActive(key)
      const node = findNavNode(props.menus, key)
      if (node) merged.onSelect?.(key, node)
    })
  }

  const renderContent = (): JSX.Element =>
    typeof props.children === 'function'
      ? (props.children as (s: { activeKey: string }) => JSX.Element)({
          activeKey: currentActive(),
        })
      : props.children

  const renderLogo = (state: { collapsed: boolean }): JSX.Element => {
    if (typeof props.logo === 'function')
      return (props.logo as (s: { collapsed: boolean }) => JSX.Element)(state)
    if (props.logo !== undefined) return props.logo
    return (
      <div
        data-iris-admin-logo=""
        style={{
          display: 'flex',
          'align-items': 'center',
          gap: '10px',
          height: '52px',
          padding: '0 16px',
          color: 'var(--iris-foreground)',
          'font-weight': '700',
          'font-size': '16px',
          'white-space': 'nowrap',
          overflow: 'hidden',
          'flex-shrink': 0,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            'align-items': 'center',
            'justify-content': 'center',
            width: '28px',
            height: '28px',
            'border-radius': 'var(--iris-radius-md, 6px)',
            background: 'var(--iris-primary)',
            color: 'var(--iris-primary-foreground, #fff)',
            'flex-shrink': 0,
          }}
        >
          <IrisIcon name="menu" size={18} />
        </span>
        <Show when={!state.collapsed}>
          <span>{merged.appTitle}</span>
        </Show>
      </div>
    )
  }

  const collapseToggle = (): JSX.Element => (
    <button
      type="button"
      data-iris-admin-collapse=""
      aria-label={currentCollapsed() ? t('admin.expandSidebar') : t('admin.collapseSidebar')}
      aria-pressed={currentCollapsed() ? 'true' : 'false'}
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        'justify-content': 'center',
        width: '32px',
        height: '32px',
        border: 'none',
        'border-radius': 'var(--iris-radius-md, 6px)',
        background: 'transparent',
        color: 'var(--iris-foreground)',
        cursor: 'pointer',
        'flex-shrink': 0,
      }}
      onClick={() => setCollapsed(!currentCollapsed())}
    >
      <IrisIcon name={currentCollapsed() ? 'chevron-right' : 'menu'} size={18} />
    </button>
  )

  const headerBar = (): JSX.Element => (
    <div
      data-iris-admin-headerbar=""
      style={{
        display: 'flex',
        'align-items': 'center',
        gap: '12px',
        height: '52px',
        padding: '0 16px',
        'border-bottom': '1px solid var(--iris-border)',
        background: 'var(--iris-background)',
      }}
    >
      {collapseToggle()}
      <Show when={merged.showBreadcrumb}>
        <IrisAdminBreadcrumb trail={trail()} onSelect={handleSelect} />
      </Show>
      <div style={{ flex: 1 }} />
      <Show when={props.toolbar}>
        <div
          data-iris-admin-toolbar=""
          style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}
        >
          {props.toolbar}
        </div>
      </Show>
    </div>
  )

  return (
    <Show
      when={merged.mode !== 'full-content'}
      fallback={
        <div data-iris-admin-layout="" data-mode="full-content" style={{ height: '100%' }}>
          {renderContent()}
        </div>
      }
    >
      <IrisSidebarLayout
        data-iris-admin-layout=""
        data-mode="sidebar"
        collapsed={currentCollapsed()}
        onCollapsedChange={setCollapsed}
        width={merged.sidebarWidth}
        collapsedWidth={merged.collapsedWidth}
        style={{ height: '100vh' }}
        sidebar={(state) => (
          <div
            data-iris-admin-sidebar=""
            style={{
              display: 'flex',
              'flex-direction': 'column',
              height: '100%',
              'border-inline-end': '1px solid var(--iris-border)',
              background: 'var(--iris-surface)',
            }}
          >
            {renderLogo(state)}
            <div style={{ flex: 1, 'overflow-y': 'auto', 'overflow-x': 'hidden', padding: '8px' }}>
              <IrisNavMenu
                items={props.menus}
                activeKey={currentActive()}
                collapsed={state.collapsed}
                onSelect={handleSelect}
              />
            </div>
          </div>
        )}
      >
        <IrisHeaderLayout
          sticky
          header={
            <div data-iris-admin-header="">
              {headerBar()}
              <Show when={props.tabs}>
                <IrisAdminTabs nav={props.tabs!} />
              </Show>
            </div>
          }
          footer={props.footer}
        >
          <div data-iris-admin-content="" style={{ padding: '16px' }}>
            {renderContent()}
          </div>
        </IrisHeaderLayout>
      </IrisSidebarLayout>
    </Show>
  )
}
