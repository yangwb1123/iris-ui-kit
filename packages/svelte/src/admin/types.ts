import type { Snippet } from 'svelte'
import type { AdminChromeSize, NavNode, TabItem, TabsNav } from '@iris-ui-kit/core'

// ── NavMenu ─────────────────────────────────────────────────────────────────────
export interface IrisNavMenuProps {
  items: NavNode[]
  activeKey?: string
  expandedKeys?: string[]
  defaultExpandedKeys?: string[]
  collapsed?: boolean
  orientation?: 'vertical' | 'horizontal'
  /**
   * Bounded row geometry (`md` = the default, so omitting it keeps the
   * pre-`size` look). Resolved in core — the component only bridges the
   * numbers into inline styles.
   */
  size?: AdminChromeSize
  ariaLabel?: string
  onSelect?: (key: string, node: NavNode) => void
  onExpandedKeysChange?: (keys: string[]) => void
}

// ── AdminBreadcrumb ─────────────────────────────────────────────────────────────
export interface IrisAdminBreadcrumbProps {
  /** Root→current ancestor chain (typically `findNavPath(menus, activeKey)`). */
  trail: NavNode[]
  showIcon?: boolean
  /** Hide the breadcrumb when the trail has a single crumb. */
  hideSingle?: boolean
  separator?: string
  onSelect?: (key: string, node: NavNode) => void
}

// ── AdminTabs ───────────────────────────────────────────────────────────────────
export interface IrisAdminTabsProps {
  /** Shared tabs store (from `createTabsNav`). */
  nav: TabsNav
  onChange?: (key: string) => void
  onClose?: (key: string) => void
  onRefresh?: (key: string) => void
  /** Enable pointer/touch reordering. */
  reorderable?: boolean
  onReorder?: (tabs: TabItem[]) => void
  /**
   * Bounded bar / chip geometry (`md` = the default, so omitting it keeps the
   * pre-`size` look). Resolved in core — the component only bridges the
   * numbers into inline styles.
   */
  size?: AdminChromeSize
}

// ── AdminLayout ─────────────────────────────────────────────────────────────────
export type IrisAdminLayoutMode = 'sidebar' | 'horizontal' | 'full-content'
export type IrisAdminMenuAlign = 'start' | 'center' | 'end'
export type IrisAdminContentWidth = 'fluid' | 'centered'
export type IrisAdminContentHeight = 'auto' | 'viewport'

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
  /** Brand region; Snippet receives `{ collapsed }`. */
  logo?: Snippet<[{ collapsed: boolean }]>
  /** Header end region (theme switch, user menu, …). */
  toolbar?: Snippet
  footer?: Snippet
  onSelect?: (key: string, node: NavNode) => void
  /** Page content; Snippet receives `{ activeKey }`. */
  children?: Snippet<[{ activeKey: string }]>
}
