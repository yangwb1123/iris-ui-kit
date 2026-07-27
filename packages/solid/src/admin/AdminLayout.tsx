import { createEffect, createSignal, mergeProps, Show, type JSX } from 'solid-js'
import { type NavNode, type TabsNav } from '@iris-ui-kit/core'
import { IrisSidebarLayout } from '../layouts/SidebarLayout'
import { IrisHeaderLayout } from '../layouts/HeaderLayout'
import { useStore } from '../useStore'
import { IrisNavMenu } from './NavMenu'
import { IrisAdminBreadcrumb } from './AdminBreadcrumb'
import { IrisAdminTabs } from './AdminTabs'
import { IrisIcon } from '../primitives/icon/Icon'
import { useI18n } from '../i18n'
import { useAdminShell } from './useAdminShell'

export type IrisAdminLayoutMode = 'sidebar' | 'horizontal' | 'full-content'
export type IrisAdminMenuAlign = 'start' | 'center' | 'end'
export type IrisAdminContentWidth = 'fluid' | 'centered'
export type IrisAdminContentHeight = 'auto' | 'viewport'

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
  showTabs?: boolean
  showBreadcrumb?: boolean
  stickyHeader?: boolean
  stickyTabs?: boolean
  menuAlign?: IrisAdminMenuAlign
  contentWidth?: IrisAdminContentWidth
  contentHeight?: IrisAdminContentHeight
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
      showTabs: true,
      showBreadcrumb: true,
      stickyHeader: true,
      stickyTabs: true,
      menuAlign: 'start' as IrisAdminMenuAlign,
      contentWidth: 'fluid' as IrisAdminContentWidth,
      contentHeight: 'viewport' as IrisAdminContentHeight,
      sidebarWidth: 240 as number | string,
      collapsedWidth: 64 as number | string,
    },
    props,
  )

  const {
    activeKey: currentActive,
    navigate,
    syncFromTab,
    breadcrumb: trail,
  } = useAdminShell({
    menus: () => props.menus,
    activeKey: () => props.activeKey,
    defaultActiveKey: props.defaultActiveKey,
    onActiveKeyChange: (key) => merged.onActiveKeyChange?.(key),
    onSelect: (key, node) => merged.onSelect?.(key, node),
    tabs: props.tabs,
  })

  const collapseControlled = (): boolean => props.collapsed !== undefined
  const [internalCollapsed, setInternalCollapsed] = createSignal(merged.defaultCollapsed)
  const currentCollapsed = (): boolean =>
    collapseControlled() ? (props.collapsed as boolean) : internalCollapsed()
  const setCollapsed = (next: boolean): void => {
    if (!collapseControlled()) setInternalCollapsed(next)
    merged.onCollapsedChange?.(next)
  }

  const handleSelect = (_key: string, node: NavNode): void => navigate(node)

  // Mirror tab-store activation (incl. close→neighbor) back into the active key.
  if (props.tabs) {
    const tabsState = useStore(props.tabs.store)
    createEffect(() => {
      const key = tabsState().activeKey
      if (key) syncFromTab(key)
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

  const tabsBar = (): JSX.Element => (
    <Show when={props.tabs && merged.showTabs}>
      <div
        data-iris-admin-tabs-region=""
        data-sticky={merged.stickyTabs ? 'true' : undefined}
        style={{
          position: merged.stickyTabs && !merged.stickyHeader ? 'sticky' : 'relative',
          top: 0,
          'z-index': 49,
        }}
      >
        <IrisAdminTabs nav={props.tabs!} />
      </div>
    </Show>
  )

  const contentRegion = (horizontal = false): JSX.Element => (
    <div
      data-iris-admin-content=""
      data-width={merged.contentWidth}
      style={{
        'box-sizing': 'border-box',
        width: '100%',
        'max-width': merged.contentWidth === 'centered' ? '72rem' : undefined,
        'margin-inline': merged.contentWidth === 'centered' ? 'auto' : undefined,
        padding: '16px',
      }}
    >
      <Show when={horizontal && merged.showBreadcrumb}>
        <IrisAdminBreadcrumb trail={trail()} onSelect={handleSelect} />
      </Show>
      {renderContent()}
    </div>
  )

  const horizontalLayout = (): JSX.Element => {
    const justifyContent = (): string =>
      merged.menuAlign === 'center'
        ? 'center'
        : merged.menuAlign === 'end'
          ? 'flex-end'
          : 'flex-start'
    return (
      <div
        data-iris-admin-layout=""
        data-mode="horizontal"
        style={{
          height: merged.contentHeight === 'viewport' ? '100vh' : 'auto',
          'min-height': '100vh',
        }}
      >
        <IrisHeaderLayout
          sticky={merged.stickyHeader}
          footer={props.footer}
          header={
            <div data-iris-admin-header="">
              <div
                data-iris-admin-headerbar=""
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '12px',
                  'min-height': '52px',
                  padding: '0 16px',
                  background: 'var(--iris-background)',
                }}
              >
                {renderLogo({ collapsed: false })}
                <div
                  data-iris-admin-topnav=""
                  style={{
                    display: 'flex',
                    flex: 1,
                    'min-width': 0,
                    'justify-content': justifyContent(),
                  }}
                >
                  <IrisNavMenu
                    items={props.menus}
                    activeKey={currentActive()}
                    orientation="horizontal"
                    onSelect={handleSelect}
                  />
                </div>
                <Show when={props.toolbar}>
                  <div
                    data-iris-admin-toolbar=""
                    style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}
                  >
                    {props.toolbar}
                  </div>
                </Show>
              </div>
              {tabsBar()}
            </div>
          }
        >
          {contentRegion(true)}
        </IrisHeaderLayout>
      </div>
    )
  }

  return (
    <Show
      when={merged.mode !== 'full-content'}
      fallback={
        <div data-iris-admin-layout="" data-mode="full-content" style={{ height: '100%' }}>
          {renderContent()}
        </div>
      }
    >
      <Show when={merged.mode === 'sidebar'} fallback={horizontalLayout()}>
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
              <div
                style={{
                  flex: 1,
                  'overflow-y': 'auto',
                  'overflow-x': 'hidden',
                  padding: '8px',
                }}
              >
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
            sticky={merged.stickyHeader}
            header={
              <div data-iris-admin-header="">
                {headerBar()}
                {tabsBar()}
              </div>
            }
            footer={props.footer}
          >
            {contentRegion()}
          </IrisHeaderLayout>
        </IrisSidebarLayout>
      </Show>
    </Show>
  )
}
