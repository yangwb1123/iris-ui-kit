import * as React from 'react'
import { IrisSidebarLayout, type IrisSidebarLayoutSidebarState } from '../layouts/SidebarLayout'
import { IrisHeaderLayout } from '../layouts/HeaderLayout'
import { IrisDashboardGrid, IrisDashboardCard } from '../layouts/DashboardGrid'
import { IrisStack } from '../layouts/Stack'

export interface IrisDashboardNavItem {
  id: string
  label: string
  icon?: React.ReactNode
}

export interface IrisDashboardCardSpec {
  id: string
  title: string
  colSpan?: number | 'full'
  rowSpan?: number
  body?: React.ReactNode
}

export interface IrisDashboardTemplateProps {
  title?: string
  sidebarTitle?: string
  nav?: IrisDashboardNavItem[]
  activeId?: string
  onActiveIdChange?: (id: string) => void
  cards?: IrisDashboardCardSpec[]
  defaultCollapsed?: boolean
  onCollapsedChange?: (next: boolean) => void
  /** Custom header content (replaces default title). */
  header?: React.ReactNode
  /** Custom sidebar header. Receives `{ collapsed, setCollapsed }`. */
  sidebarHeader?: (state: IrisSidebarLayoutSidebarState) => React.ReactNode
  /** Custom main body content (replaces default grid). */
  children?: React.ReactNode
  /** Per-card body override, keyed by card id. */
  cardSlots?: Record<string, React.ReactNode>
  style?: React.CSSProperties
  className?: string
}

/**
 * Layer 4 system skeleton: 3-region dashboard shell — sidebar + header +
 * main grid. Built from `IrisSidebarLayout` + `IrisHeaderLayout` +
 * `IrisDashboardGrid`.
 */
export function IrisDashboardTemplate({
  title = 'Dashboard',
  sidebarTitle = '',
  nav = [],
  activeId = '',
  onActiveIdChange,
  cards = [],
  defaultCollapsed = false,
  onCollapsedChange,
  header,
  sidebarHeader,
  children,
  cardSlots,
  style,
  className,
}: IrisDashboardTemplateProps): React.ReactElement {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)

  const handleCollapsed = (next: boolean) => {
    setCollapsed(next)
    onCollapsedChange?.(next)
  }

  return (
    <div
      data-iris-dashboard-template=""
      className={className}
      style={{
        width: '100%',
        height: '100vh',
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        ...style,
      }}
    >
      <IrisSidebarLayout
        collapsed={collapsed}
        onCollapsedChange={handleCollapsed}
        width={240}
        collapsedWidth={64}
        sidebar={(state) => (
          <IrisStack spacing="sm" style={{ padding: 12 }}>
            {sidebarHeader ? (
              sidebarHeader(state)
            ) : sidebarTitle ? (
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: 'var(--iris-font-size-md, 14px)',
                  fontWeight: 600,
                  color: 'var(--iris-foreground)',
                  opacity: state.collapsed ? 0 : 1,
                  transition: 'opacity 120ms ease',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {sidebarTitle}
              </div>
            ) : null}
            <nav
              aria-label="Primary"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--iris-space-xxs, 4px)',
              }}
            >
              {nav.map((item) => {
                const isActive = item.id === activeId
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-iris-dashboard-nav-item={item.id}
                    data-iris-dashboard-nav-active={isActive ? 'true' : undefined}
                    onClick={() => onActiveIdChange?.(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--iris-space-sm, 12px)',
                      padding: '8px 12px',
                      background: isActive ? 'var(--iris-primary)' : 'transparent',
                      color: isActive
                        ? 'var(--iris-primary-foreground, #fff)'
                        : 'var(--iris-foreground)',
                      border: 'none',
                      borderRadius: 'var(--iris-radius-sm, 4px)',
                      cursor: 'pointer',
                      fontSize: 'var(--iris-font-size-md, 14px)',
                      fontFamily: 'inherit',
                      textAlign: 'start',
                      outline: 'none',
                    }}
                  >
                    {item.icon ? (
                      <span
                        aria-hidden="true"
                        style={{ width: 16, display: 'inline-flex', justifyContent: 'center' }}
                      >
                        {item.icon}
                      </span>
                    ) : null}
                    <span
                      style={{
                        opacity: state.collapsed ? 0 : 1,
                        transition: 'opacity 120ms ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </nav>
          </IrisStack>
        )}
      >
        <IrisHeaderLayout
          header={
            header ?? (
              <div
                style={{
                  padding: '12px 20px',
                  fontSize: 'var(--iris-font-size-lg, 16px)',
                  fontWeight: 600,
                }}
              >
                {title}
              </div>
            )
          }
        >
          {children ?? (
            <div style={{ padding: 20 }}>
              <IrisDashboardGrid columns={12} gap={16}>
                {cards.map((card) => (
                  <IrisDashboardCard
                    key={card.id}
                    colSpan={card.colSpan ?? 4}
                    rowSpan={card.rowSpan ?? 1}
                    data-iris-dashboard-card-id={card.id}
                  >
                    <h3
                      style={{
                        margin: '0 0 8px 0',
                        fontSize: 'var(--iris-font-size-md, 14px)',
                        fontWeight: 600,
                        color: 'var(--iris-foreground)',
                      }}
                    >
                      {card.title}
                    </h3>
                    {cardSlots?.[card.id] !== undefined ? (
                      cardSlots[card.id]
                    ) : card.body ? (
                      <div
                        style={{
                          fontSize: 'var(--iris-font-size-sm, 13px)',
                          color: 'var(--iris-muted)',
                        }}
                      >
                        {card.body}
                      </div>
                    ) : null}
                  </IrisDashboardCard>
                ))}
              </IrisDashboardGrid>
            </div>
          )}
        </IrisHeaderLayout>
      </IrisSidebarLayout>
    </div>
  )
}
