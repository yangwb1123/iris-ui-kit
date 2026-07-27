import * as React from 'react'

export interface IrisMasonryProps {
  /** Number of columns. */
  columns?: number
  /** Gap between items (px). */
  gap?: number
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

/**
 * Masonry layout: flows children into balanced columns via CSS multi-column,
 * with each item kept from breaking across columns — for card grids and
 * galleries of varying heights.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisMasonry}.
 */
export function IrisMasonry({
  columns = 3,
  gap = 16,
  children,
  style,
  className,
  ...rest
}: IrisMasonryProps): React.ReactElement {
  return (
    <div
      data-iris-masonry=""
      data-columns={columns}
      className={className}
      {...rest}
      style={{ columnCount: columns, columnGap: gap, ...style }}
    >
      {React.Children.map(children, (child) => (
        <div data-iris-masonry-item="" style={{ breakInside: 'avoid', marginBlockEnd: gap }}>
          {child}
        </div>
      ))}
    </div>
  )
}
