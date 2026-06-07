import type { Snippet } from 'svelte'
import type { HTMLAttributes } from 'svelte/elements'

// ── Stack ──────────────────────────────────────────────────────────────────────
export type IrisStackDirection = 'row' | 'column'
export type IrisStackAlign = 'start' | 'center' | 'end' | 'stretch'
export type IrisStackJustify = 'start' | 'center' | 'end' | 'between' | 'around'

export interface IrisStackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: IrisStackDirection
  spacing?: string | number
  align?: IrisStackAlign
  justify?: IrisStackJustify
  wrap?: boolean
  inline?: boolean
}

// ── HeaderLayout ────────────────────────────────────────────────────────────────
export interface IrisHeaderLayoutProps {
  headerHeight?: number | string
  footerHeight?: number | string
  /** Header sticks via `position: sticky` instead of static. Default true. */
  sticky?: boolean
  header?: Snippet
  footer?: Snippet
  class?: string
  style?: string
  children?: Snippet
}

// ── SidebarLayout ───────────────────────────────────────────────────────────────
export interface IrisSidebarLayoutSidebarState {
  collapsed: boolean
  setCollapsed: (next: boolean) => void
}

export interface IrisSidebarLayoutProps extends HTMLAttributes<HTMLDivElement> {
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (next: boolean) => void
  /** Sidebar width when expanded (px or CSS length). */
  width?: number | string
  /** Sidebar width when collapsed. */
  collapsedWidth?: number | string
  side?: 'left' | 'right'
  /** Sidebar content — a Snippet that receives `{ collapsed, setCollapsed }`. */
  sidebar?: Snippet<[IrisSidebarLayoutSidebarState]>
}

// ── DashboardGrid + Card ────────────────────────────────────────────────────────
export interface IrisDashboardGridProps extends HTMLAttributes<HTMLDivElement> {
  columns?: number
  gap?: number | string
  /** Use `repeat(auto-fill, minmax(<minColWidth>, 1fr))` instead of fixed `columns`. */
  minColWidth?: number | string
}

export interface IrisDashboardCardProps extends HTMLAttributes<HTMLDivElement> {
  colSpan?: number | 'full'
  rowSpan?: number
  /** Show the styled card surface (background + border). Default true. */
  surface?: boolean
}
