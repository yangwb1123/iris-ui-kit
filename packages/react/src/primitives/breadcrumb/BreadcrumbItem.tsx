import * as React from 'react'

export interface IrisBreadcrumbItemProps extends React.HTMLAttributes<HTMLElement> {
  href?: string
  /** Internal: set by parent `IrisBreadcrumb` when this is the last item. */
  isCurrent?: boolean
  children?: React.ReactNode
}

/**
 * A single breadcrumb crumb. Renders an `<a>` when `href` is given and the
 * crumb is not the last one; otherwise a `<span>`. The `isCurrent` flag is
 * set automatically by the parent `IrisBreadcrumb` based on position.
 */
export const IrisBreadcrumbItem = React.forwardRef<HTMLElement, IrisBreadcrumbItemProps>(
  function IrisBreadcrumbItem({ href, isCurrent = false, style, children, ...rest }, ref) {
    const baseStyle: React.CSSProperties = {
      color: isCurrent ? 'var(--iris-muted)' : 'var(--iris-primary)',
      textDecoration: 'none',
      cursor: isCurrent ? 'default' : href ? 'pointer' : 'default',
    }

    const common = {
      ...rest,
      'aria-current': isCurrent ? ('page' as const) : undefined,
      'data-iris-breadcrumb-crumb': '',
      style: { ...baseStyle, ...style },
    }

    if (href && !isCurrent) {
      return (
        <a {...common} ref={ref as React.Ref<HTMLAnchorElement>} href={href}>
          {children}
        </a>
      )
    }
    return (
      <span {...common} ref={ref as React.Ref<HTMLSpanElement>}>
        {children}
      </span>
    )
  },
)
