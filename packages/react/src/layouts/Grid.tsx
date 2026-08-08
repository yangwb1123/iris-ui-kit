import * as React from 'react'

export type IrisGridColumns =
  number | 'auto-fit' | 'auto-fill' | string /* raw grid-template-columns value */

function resolveColumns(columns: IrisGridColumns, minColWidth: string): string {
  if (typeof columns === 'number') return `repeat(${columns}, minmax(0, 1fr))`
  if (columns === 'auto-fit') return `repeat(auto-fit, minmax(${minColWidth}, 1fr))`
  if (columns === 'auto-fill') return `repeat(auto-fill, minmax(${minColWidth}, 1fr))`
  return columns
}

function toCssSpacing(spacing: string | number): string {
  if (typeof spacing === 'number') return `${spacing}px`
  if (spacing === 'sm' || spacing === 'md' || spacing === 'lg') {
    return `var(--iris-gap-${spacing})`
  }
  return spacing
}

export interface IrisGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: IrisGridColumns
  /** Min width per column for `auto-fit` / `auto-fill`. */
  minColWidth?: string
  rowGap?: string | number
  columnGap?: string | number
  /** Shorthand for both row + column gap. Overridden if rowGap/columnGap given. */
  gap?: string | number
  inline?: boolean
}

/**
 * Two-dimensional grid layout primitive. Three column modes:
 *   - Fixed integer (`columns={3}`)
 *   - Responsive auto-fit (`columns="auto-fit"` + `minColWidth`)
 *   - Raw CSS (`columns="100px 1fr 100px"`)
 */
export const IrisGrid = React.forwardRef<HTMLDivElement, IrisGridProps>(function IrisGrid(
  {
    columns = 'auto-fit',
    minColWidth = '200px',
    rowGap,
    columnGap,
    gap = 'md',
    inline = false,
    style,
    children,
    ...rest
  },
  ref,
) {
  const colTemplate = resolveColumns(columns, minColWidth)
  const resolvedRowGap = rowGap !== undefined ? toCssSpacing(rowGap) : toCssSpacing(gap)
  const resolvedColGap = columnGap !== undefined ? toCssSpacing(columnGap) : toCssSpacing(gap)

  return (
    <div
      {...rest}
      ref={ref}
      data-iris-grid=""
      data-iris-grid-columns={String(columns)}
      style={{
        display: inline ? 'inline-grid' : 'grid',
        gridTemplateColumns: colTemplate,
        rowGap: resolvedRowGap,
        columnGap: resolvedColGap,
        ...style,
      }}
    >
      {children}
    </div>
  )
})
