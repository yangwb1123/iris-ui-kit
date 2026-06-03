import { createSignal, mergeProps, type JSX } from 'solid-js'

export interface IrisSidebarLayoutSidebarState {
  collapsed: boolean
  setCollapsed: (next: boolean) => void
}

export interface IrisSidebarLayoutProps {
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

const asLen = (v: number | string): string => (typeof v === 'number' ? `${v}px` : v)

/**
 * Two-column layout with a collapsible sidebar; the sidebar stays mounted across
 * collapses (only its width animates) so component state survives. The render-
 * prop's `collapsed` is a live getter, so Solid keeps prop reads reactive while
 * the subtree is created once. Solid port of the React/Vue IrisSidebarLayout.
 */
export function IrisSidebarLayout(props: IrisSidebarLayoutProps): JSX.Element {
  const merged = mergeProps(
    { defaultCollapsed: false, width: 240, collapsedWidth: 60, side: 'left' as const },
    props,
  )

  const isControlled = (): boolean => props.collapsed !== undefined
  const [internal, setInternal] = createSignal(merged.defaultCollapsed)
  const collapsed = (): boolean => (isControlled() ? (props.collapsed as boolean) : internal())
  const setCollapsed = (next: boolean): void => {
    if (!isControlled()) setInternal(next)
    merged.onCollapsedChange?.(next)
  }

  // Created once → sidebar subtree stays mounted; `collapsed` is a getter so
  // consumer prop reads stay reactive (Solid compiles prop exprs as getters).
  const sidebarContent =
    typeof merged.sidebar === 'function'
      ? (merged.sidebar as (s: IrisSidebarLayoutSidebarState) => JSX.Element)({
          get collapsed() {
            return collapsed()
          },
          setCollapsed,
        })
      : merged.sidebar

  return (
    <div
      data-iris-sidebar-layout=""
      data-collapsed={collapsed() ? '' : undefined}
      data-side={merged.side}
      class={merged.class}
      style={{
        display: 'flex',
        'flex-direction': merged.side === 'right' ? 'row-reverse' : 'row',
        width: '100%',
        height: '100%',
        'min-height': 0,
        color: 'var(--iris-foreground)',
        ...(merged.style ?? {}),
      }}
    >
      <aside
        role="complementary"
        data-iris-sidebar=""
        data-collapsed={collapsed() ? '' : undefined}
        style={{
          width: collapsed() ? asLen(merged.collapsedWidth) : asLen(merged.width),
          'flex-shrink': 0,
          background: 'var(--iris-surface)',
          'border-inline-end': merged.side === 'left' ? '1px solid var(--iris-border)' : 'none',
          'border-inline-start': merged.side === 'right' ? '1px solid var(--iris-border)' : 'none',
          transition: 'width 180ms ease',
          overflow: 'hidden',
          display: 'flex',
          'flex-direction': 'column',
        }}
      >
        {sidebarContent}
      </aside>
      <div
        data-iris-sidebar-main=""
        style={{ flex: 1, 'min-width': 0, overflow: 'auto', background: 'var(--iris-background)' }}
      >
        {props.children}
      </div>
    </div>
  )
}
