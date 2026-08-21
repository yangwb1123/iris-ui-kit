import { createSignal, mergeProps, splitProps, type Accessor, type JSX } from 'solid-js'

export interface IrisSidebarLayoutSidebarState {
  collapsed: boolean
  setCollapsed: (next: boolean) => void
}

export interface IrisSidebarLayoutProps extends JSX.HTMLAttributes<HTMLDivElement> {
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (next: boolean) => void
  /** Sidebar width when expanded (px or CSS length). */
  width?: number | string
  /** Sidebar width when collapsed. */
  collapsedWidth?: number | string
  side?: 'left' | 'right'
  /** Sidebar content. May be a render function that receives `{ collapsed, setCollapsed }`. */
  sidebar?: JSX.Element | ((state: IrisSidebarLayoutSidebarState) => JSX.Element)
  class?: string
  style?: JSX.CSSProperties
  children?: JSX.Element
}

const asLen = (value: number | string): string => (typeof value === 'number' ? `${value}px` : value)

function resolveSidebarContent(
  sidebar: IrisSidebarLayoutProps['sidebar'],
  collapsed: () => boolean,
  setCollapsed: (next: boolean) => void,
): JSX.Element | undefined {
  return typeof sidebar === 'function'
    ? sidebar({
        get collapsed() {
          return collapsed()
        },
        setCollapsed,
      })
    : sidebar
}

interface SidebarLayoutFrameProps {
  others: JSX.HTMLAttributes<HTMLDivElement>
  collapsed: Accessor<boolean>
  side: 'left' | 'right'
  width: number | string
  collapsedWidth: number | string
  sidebarContent?: JSX.Element
  class?: string
  style?: JSX.CSSProperties
  children?: JSX.Element
}

const SidebarLayoutFrame = (props: SidebarLayoutFrameProps): JSX.Element => (
  <div
    {...props.others}
    data-iris-sidebar-layout=""
    data-collapsed={props.collapsed() ? '' : undefined}
    data-side={props.side}
    class={props.class}
    style={{
      display: 'flex',
      'flex-direction': props.side === 'right' ? 'row-reverse' : 'row',
      width: '100%',
      height: '100%',
      'min-height': 0,
      color: 'var(--iris-foreground)',
      ...(props.style ?? {}),
    }}
  >
    <aside
      role="complementary"
      data-iris-sidebar=""
      data-collapsed={props.collapsed() ? '' : undefined}
      style={{
        width: props.collapsed() ? asLen(props.collapsedWidth) : asLen(props.width),
        'flex-shrink': 0,
        background: 'var(--iris-surface)',
        'border-inline-end': props.side === 'left' ? '1px solid var(--iris-border)' : 'none',
        'border-inline-start': props.side === 'right' ? '1px solid var(--iris-border)' : 'none',
        transition: 'width 180ms ease',
        overflow: 'hidden',
        display: 'flex',
        'flex-direction': 'column',
      }}
    >
      {props.sidebarContent}
    </aside>
    <div
      data-iris-sidebar-main=""
      style={{ flex: 1, 'min-width': 0, overflow: 'auto', background: 'var(--iris-background)' }}
    >
      {props.children}
    </div>
  </div>
)

/** Two-column layout with a collapsible, state-preserving sidebar. */
export function IrisSidebarLayout(props: IrisSidebarLayoutProps): JSX.Element {
  const merged = mergeProps(
    {
      defaultCollapsed: false,
      width: 240 as number | string,
      collapsedWidth: 60 as number | string,
      side: 'left' as const,
    },
    props,
  )
  const [, others] = splitProps(merged, [
    'collapsed',
    'defaultCollapsed',
    'onCollapsedChange',
    'width',
    'collapsedWidth',
    'side',
    'sidebar',
    'class',
    'style',
    'children',
  ])

  const isControlled = (): boolean => props.collapsed !== undefined
  const [internal, setInternal] = createSignal(merged.defaultCollapsed)
  const collapsed = (): boolean => (isControlled() ? (props.collapsed as boolean) : internal())
  const setCollapsed = (next: boolean): void => {
    if (!isControlled()) setInternal(next)
    merged.onCollapsedChange?.(next)
  }
  const sidebarContent = resolveSidebarContent(merged.sidebar, collapsed, setCollapsed)

  return (
    <SidebarLayoutFrame
      others={others as JSX.HTMLAttributes<HTMLDivElement>}
      collapsed={collapsed}
      side={merged.side}
      width={merged.width}
      collapsedWidth={merged.collapsedWidth}
      sidebarContent={sidebarContent}
      class={merged.class}
      style={merged.style}
    >
      {props.children}
    </SidebarLayoutFrame>
  )
}
