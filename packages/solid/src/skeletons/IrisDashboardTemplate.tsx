import { createSignal, For, mergeProps, splitProps, Show, type JSX } from 'solid-js'
import { IrisSidebarLayout } from '../layouts/SidebarLayout'
import { IrisHeaderLayout } from '../layouts/HeaderLayout'
import { IrisDashboardGrid, IrisDashboardCard } from '../layouts/DashboardGrid'
import { IrisStack } from '../layouts/Stack'

export interface IrisDashboardNavItem {
  id: string
  label: string
  icon?: string
}

export interface IrisDashboardCardSpec {
  id: string
  title: string
  colSpan?: number | 'full'
  rowSpan?: number
  body?: string
}

export interface IrisDashboardTemplateProps {
  title?: string
  sidebarTitle?: string
  nav?: IrisDashboardNavItem[]
  activeId?: string
  cards?: IrisDashboardCardSpec[]
  defaultCollapsed?: boolean
  onActiveIdChange?: (id: string) => void
  onCollapsedChange?: (value: boolean) => void
  children?: JSX.Element
}

/**
 * Layer 4 system skeleton: a 3-region dashboard shell.
 * Solid port of the Vue IrisDashboardTemplate.
 */
export function IrisDashboardTemplate(props: IrisDashboardTemplateProps): JSX.Element {
  const merged = mergeProps(
    {
      title: 'Dashboard',
      sidebarTitle: '',
      nav: [] as IrisDashboardNavItem[],
      activeId: '',
      cards: [] as IrisDashboardCardSpec[],
      defaultCollapsed: false,
    },
    props,
  )
  const [local] = splitProps(merged, [
    'title',
    'sidebarTitle',
    'nav',
    'activeId',
    'cards',
    'defaultCollapsed',
    'onActiveIdChange',
    'onCollapsedChange',
    'children',
  ])

  const [collapsed, setCollapsed] = createSignal(local.defaultCollapsed)

  const sidebarContent = (state: { collapsed: boolean }) => (
    <IrisStack spacing="sm" style={{ padding: '12px' }}>
      <Show when={local.sidebarTitle}>
        <div
          style={{
            padding: '8px 12px',
            'font-size': '14px',
            'font-weight': '600',
            color: 'var(--iris-foreground)',
            opacity: state.collapsed ? '0' : '1',
            transition: 'opacity 120ms ease',
            'white-space': 'nowrap',
            overflow: 'hidden',
          }}
        >
          {local.sidebarTitle}
        </div>
      </Show>
      <nav aria-label="Primary" style={{ display: 'flex', 'flex-direction': 'column', gap: '2px' }}>
        <For each={local.nav}>
          {(item) => {
            const isActive = () => item.id === local.activeId
            return (
              <button
                type="button"
                data-iris-dashboard-nav-item={item.id}
                data-iris-dashboard-nav-active={isActive() ? 'true' : undefined}
                onClick={() => local.onActiveIdChange?.(item.id)}
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  background: isActive() ? 'var(--iris-primary)' : 'transparent',
                  color: isActive()
                    ? 'var(--iris-primary-foreground, #fff)'
                    : 'var(--iris-foreground)',
                  border: 'none',
                  'border-radius': 'var(--iris-radius-sm, 4px)',
                  cursor: 'pointer',
                  'font-size': '14px',
                  'font-family': 'inherit',
                  'text-align': 'start',
                  outline: 'none',
                }}
              >
                <Show when={item.icon}>
                  <span
                    aria-hidden="true"
                    style={{ width: '16px', display: 'inline-flex', 'justify-content': 'center' }}
                  >
                    {item.icon}
                  </span>
                </Show>
                <span
                  style={{
                    opacity: state.collapsed ? '0' : '1',
                    transition: 'opacity 120ms ease',
                    'white-space': 'nowrap',
                  }}
                >
                  {item.label}
                </span>
              </button>
            )
          }}
        </For>
      </nav>
    </IrisStack>
  )

  const mainContent = (
    <IrisHeaderLayout
      header={
        <div style={{ padding: '12px 20px', 'font-size': '16px', 'font-weight': '600' }}>
          {local.title}
        </div>
      }
    >
      <Show when={!local.children} fallback={local.children}>
        <div style={{ padding: '20px' }}>
          <IrisDashboardGrid columns={12} gap={16}>
            <For each={local.cards}>
              {(card) => (
                <IrisDashboardCard
                  colSpan={card.colSpan ?? 4}
                  rowSpan={card.rowSpan ?? 1}
                  data-iris-dashboard-card-id={card.id}
                >
                  <h3
                    style={{
                      margin: '0 0 8px 0',
                      'font-size': '14px',
                      'font-weight': '600',
                      color: 'var(--iris-foreground)',
                    }}
                  >
                    {card.title}
                  </h3>
                  <Show when={card.body}>
                    <div style={{ 'font-size': '13px', color: 'var(--iris-muted)' }}>
                      {card.body}
                    </div>
                  </Show>
                </IrisDashboardCard>
              )}
            </For>
          </IrisDashboardGrid>
        </div>
      </Show>
    </IrisHeaderLayout>
  )

  return (
    <div
      data-iris-dashboard-template=""
      style={{
        width: '100%',
        height: '100vh',
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
      }}
    >
      <IrisSidebarLayout
        collapsed={collapsed()}
        onCollapsedChange={(v: boolean) => {
          setCollapsed(v)
          local.onCollapsedChange?.(v)
        }}
        width={240}
        collapsedWidth={64}
        sidebar={sidebarContent}
      >
        {mainContent}
      </IrisSidebarLayout>
    </div>
  )
}
