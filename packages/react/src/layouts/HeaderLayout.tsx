import * as React from 'react'

export interface IrisHeaderLayoutProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
  /** Header height (px or CSS length). Default `'auto'`. */
  headerHeight?: number | string
  /** Footer height (px or CSS length). Default `'auto'`. */
  footerHeight?: number | string
  /** Header sticks via `position: sticky` instead of static. Default true. */
  sticky?: boolean
  header?: React.ReactNode
  footer?: React.ReactNode
  children?: React.ReactNode
}

function asLen(v: number | string): string {
  return typeof v === 'number' ? `${v}px` : v
}

/**
 * Two- (or three-) region vertical layout: a sticky header on top, a
 * scrollable main region, and an optional footer.
 */
export function IrisHeaderLayout({
  headerHeight = 'auto',
  footerHeight = 'auto',
  sticky = true,
  header,
  footer,
  style,
  children,
  ...rest
}: IrisHeaderLayoutProps): React.ReactElement {
  return (
    <div
      {...rest}
      data-iris-header-layout=""
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minHeight: 0,
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        ...style,
      }}
    >
      {header ? (
        <header
          role="banner"
          data-iris-header=""
          style={{
            flexShrink: 0,
            height: asLen(headerHeight),
            borderBottom: '1px solid var(--iris-border)',
            background: 'var(--iris-surface)',
            position: sticky ? 'sticky' : 'static',
            top: 0,
            zIndex: 50,
          }}
        >
          {header}
        </header>
      ) : null}
      <main
        role="main"
        data-iris-header-main=""
        style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
      >
        {children}
      </main>
      {footer ? (
        <footer
          role="contentinfo"
          data-iris-footer=""
          style={{
            flexShrink: 0,
            height: asLen(footerHeight),
            borderTop: '1px solid var(--iris-border)',
            background: 'var(--iris-surface)',
          }}
        >
          {footer}
        </footer>
      ) : null}
    </div>
  )
}
