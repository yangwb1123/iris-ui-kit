import { mergeProps, splitProps, type JSX } from 'solid-js'

export interface IrisDashboardGridProps extends JSX.HTMLAttributes<HTMLDivElement> {
  columns?: number
  gap?: number | string
  /** Use `repeat(auto-fill, minmax(<minColWidth>, 1fr))` instead of fixed `columns`. */
  minColWidth?: number | string
}

/** 12-column responsive dashboard grid. Solid port of the React/Vue IrisDashboardGrid. */
export function IrisDashboardGrid(props: IrisDashboardGridProps): JSX.Element {
  const merged = mergeProps({ columns: 12, gap: 16 as number | string }, props)
  const [local, others] = splitProps(merged, ['columns', 'gap', 'minColWidth', 'style', 'children'])
  const gapCss = (): string => (typeof local.gap === 'number' ? `${local.gap}px` : local.gap)
  const cols = (): string =>
    local.minColWidth
      ? `repeat(auto-fill, minmax(${typeof local.minColWidth === 'number' ? `${local.minColWidth}px` : local.minColWidth}, 1fr))`
      : `repeat(${local.columns}, 1fr)`
  return (
    <div
      {...others}
      data-iris-dashboard-grid=""
      style={{
        display: 'grid',
        gap: gapCss(),
        'grid-template-columns': cols(),
        width: '100%',
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      {local.children}
    </div>
  )
}

export interface IrisDashboardCardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  colSpan?: number | 'full'
  rowSpan?: number
  /** Show the styled card surface (background + border). Default true. */
  surface?: boolean
}

/** A single dashboard grid cell. Solid port of the React/Vue IrisDashboardCard. */
export function IrisDashboardCard(props: IrisDashboardCardProps): JSX.Element {
  const merged = mergeProps({ colSpan: 1 as number | 'full', rowSpan: 1, surface: true }, props)
  const [local, others] = splitProps(merged, ['colSpan', 'rowSpan', 'surface', 'style', 'children'])
  return (
    <div
      {...others}
      data-iris-dashboard-card=""
      style={{
        'grid-column': local.colSpan === 'full' ? '1 / -1' : `span ${local.colSpan}`,
        'grid-row': local.rowSpan > 1 ? `span ${local.rowSpan}` : undefined,
        background: local.surface ? 'var(--iris-surface)' : 'transparent',
        border: local.surface ? '1px solid var(--iris-border)' : 'none',
        'border-radius': 'var(--iris-radius-md, 6px)',
        padding: local.surface ? 'var(--iris-padding-lg, 20px)' : 0,
        'min-width': 0,
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      {local.children}
    </div>
  )
}
