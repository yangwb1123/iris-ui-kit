import * as React from 'react'

export interface IrisDashboardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: number
  gap?: number | string
  /** Use `repeat(auto-fill, minmax(<minColWidth>, 1fr))` instead of fixed `columns`. */
  minColWidth?: number | string
}

/**
 * 12-column responsive grid for dashboard composition. Each child controls
 * its span via `gridColumn` style or by wrapping with `IrisDashboardCard`.
 */
export function IrisDashboardGrid({
  columns = 12,
  gap = 16,
  minColWidth,
  style,
  children,
  ...rest
}: IrisDashboardGridProps): React.ReactElement {
  const gapCss = typeof gap === 'number' ? `${gap}px` : gap
  const gridTemplateColumns = minColWidth
    ? `repeat(auto-fill, minmax(${
        typeof minColWidth === 'number' ? `${minColWidth}px` : minColWidth
      }, 1fr))`
    : `repeat(${columns}, 1fr)`

  return (
    <div
      {...rest}
      data-iris-dashboard-grid=""
      style={{
        display: 'grid',
        gap: gapCss,
        gridTemplateColumns,
        width: '100%',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export interface IrisDashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  colSpan?: number | 'full'
  rowSpan?: number
  /** Show the styled card surface (background + border). Default true. */
  surface?: boolean
}

/**
 * A single dashboard grid cell. `colSpan='full'` makes it fill the row.
 */
export function IrisDashboardCard({
  colSpan = 1,
  rowSpan = 1,
  surface = true,
  style,
  children,
  ...rest
}: IrisDashboardCardProps): React.ReactElement {
  const gridColumn = colSpan === 'full' ? '1 / -1' : `span ${colSpan}`
  const gridRow = rowSpan > 1 ? `span ${rowSpan}` : undefined

  return (
    <div
      {...rest}
      data-iris-dashboard-card=""
      style={{
        gridColumn,
        gridRow,
        background: surface ? 'var(--iris-surface)' : 'transparent',
        border: surface ? '1px solid var(--iris-border)' : 'none',
        borderRadius: 'var(--iris-radius-md, 6px)',
        padding: surface ? 'var(--iris-padding-lg, 20px)' : 0,
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
