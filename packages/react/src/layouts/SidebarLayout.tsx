import * as React from 'react'

export interface IrisSidebarLayoutSidebarState {
  collapsed: boolean
  setCollapsed: (next: boolean) => void
}

export interface IrisSidebarLayoutProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (next: boolean) => void
  /** Sidebar width when expanded (px or CSS length). */
  width?: number | string
  /** Sidebar width when collapsed. */
  collapsedWidth?: number | string
  side?: 'left' | 'right'
  /** Sidebar content. May be a render function that receives `{ collapsed, setCollapsed }`. */
  sidebar?:
    | React.ReactNode
    | ((state: IrisSidebarLayoutSidebarState) => React.ReactNode)
  children?: React.ReactNode
}

function asLen(v: number | string): string {
  return typeof v === 'number' ? `${v}px` : v
}

/**
 * Two-column layout with a collapsible sidebar. The sidebar is kept mounted
 * across collapses (only its width animates) so component state survives.
 */
export function IrisSidebarLayout({
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  width = 240,
  collapsedWidth = 60,
  side = 'left',
  sidebar,
  style,
  children,
  ...rest
}: IrisSidebarLayoutProps): React.ReactElement {
  const isControlled = collapsedProp !== undefined
  const [internal, setInternal] = React.useState(defaultCollapsed)
  const collapsed = isControlled ? Boolean(collapsedProp) : internal

  const setCollapsed = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternal(next)
      onCollapsedChange?.(next)
    },
    [isControlled, onCollapsedChange],
  )

  const sidebarContent =
    typeof sidebar === 'function'
      ? (sidebar as (s: IrisSidebarLayoutSidebarState) => React.ReactNode)({
          collapsed,
          setCollapsed,
        })
      : sidebar

  const sidebarStyle: React.CSSProperties = {
    width: collapsed ? asLen(collapsedWidth) : asLen(width),
    flexShrink: 0,
    background: 'var(--iris-surface)',
    borderRight: side === 'left' ? '1px solid var(--iris-border)' : 'none',
    borderLeft: side === 'right' ? '1px solid var(--iris-border)' : 'none',
    transition: 'width 180ms ease',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  }

  return (
    <div
      {...rest}
      data-iris-sidebar-layout=""
      data-collapsed={collapsed ? '' : undefined}
      data-side={side}
      style={{
        display: 'flex',
        flexDirection: side === 'right' ? 'row-reverse' : 'row',
        width: '100%',
        height: '100%',
        minHeight: 0,
        color: 'var(--iris-foreground)',
        ...style,
      }}
    >
      <aside
        role="complementary"
        data-iris-sidebar=""
        data-collapsed={collapsed ? '' : undefined}
        style={sidebarStyle}
      >
        {sidebarContent}
      </aside>
      <div
        data-iris-sidebar-main=""
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'auto',
          background: 'var(--iris-background)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
